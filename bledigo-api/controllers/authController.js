'use strict';

const Admin        = require('../models/Admin');
const Agent        = require('../models/Agent');
const Citoyen      = require('../models/Citoyen');
const Notification = require('../models/Notification');
const VerificationCode = require('../models/VerificationCode');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../utils/email');
const { sendToken } = require('../utils/jwt');

const MODEL_MAP = { Admin, Agent, Citoyen };

// ── Check email across all 3 collections ────────────────
async function emailExistsAnywhere(email) {
  const e = email.toLowerCase().trim();
  const [a, ag, c] = await Promise.all([
    Admin.findOne({ email: e }).lean(),
    Agent.findOne({ email: e }).lean(),
    Citoyen.findOne({ email: e }).lean(),
  ]);
  return !!(a || ag || c);
}

// ════════════════════════════════════════════════════════
// POST /api/auth/forgot-password-code
// ════════════════════════════════════════════════════════
exports.forgotPasswordCode = async (req, res, next) => {
  try {
    const { email, role } = req.body;
    if (!email || !role) return res.status(400).json({ success: false, message: 'Identifiants requis.' });
    if (role === 'Admin') return res.status(403).json({ success: false, message: 'Les administrateurs ne peuvent pas réinitialiser leur mot de passe ici.' });

    const cleanEmail = email.toLowerCase().trim();
    const Model = MODEL_MAP[role];
    if (!Model) return res.status(400).json({ success: false, message: 'Rôle invalide.' });

    const user = await Model.findOne({ email: cleanEmail });
    if (!user) {
      return res.status(404).json({ success: false, message: `Aucun compte ${role} n'a été trouvé avec cet email.` });
    }

    // Generate code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    await VerificationCode.deleteMany({ email: cleanEmail });
    await VerificationCode.create({ email: cleanEmail, code });

    await sendPasswordResetEmail(cleanEmail, code, user.firstName);
    res.json({ success: true, message: 'Code de réinitialisation envoyé.' });
  } catch (err) { next(err); }
};

// ════════════════════════════════════════════════════════
// POST /api/auth/verify-reset-code
// ════════════════════════════════════════════════════════
exports.verifyResetCode = async (req, res, next) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ success: false, message: 'Informations requises.' });

    const cleanEmail = email.toLowerCase().trim();
    const validCode = await VerificationCode.findOne({ email: cleanEmail, code });
    if (!validCode) {
      return res.status(400).json({ success: false, message: 'Code invalide ou expiré.' });
    }

    res.json({ success: true, message: 'Code valide.' });
  } catch (err) { next(err); }
};

// ════════════════════════════════════════════════════════
// POST /api/auth/reset-password
// ════════════════════════════════════════════════════════
exports.resetPassword = async (req, res, next) => {
  try {
    const { email, role, code, newPassword } = req.body;
    if (!email || !role || !code || !newPassword) 
      return res.status(400).json({ success: false, message: 'Toutes les informations sont requises.' });
    if (role === 'Admin') 
      return res.status(403).json({ success: false, message: 'Action non autorisée pour un Admin.' });

    if (newPassword.length < 8)
      return res.status(422).json({ success: false, message: 'Minimum 8 caractères requis.' });

    const cleanEmail = email.toLowerCase().trim();
    
    // Check code
    const validCode = await VerificationCode.findOne({ email: cleanEmail, code });
    if (!validCode) {
      return res.status(400).json({
        success: false,
        message: 'Code invalide ou expiré.',
        errors: [{ field: 'code', message: 'Code invalide ou expiré.' }]
      });
    }

    const Model = MODEL_MAP[role];
    if (!Model) return res.status(400).json({ success: false, message: 'Rôle invalide.' });

    const user = await Model.findOne({ email: cleanEmail });
    if (!user) return res.status(404).json({ success: false, message: 'Utilisateur introuvable.' });

    user.password = newPassword;
    await user.save(); // Password middleware will handle hashing
    
    await VerificationCode.deleteOne({ _id: validCode._id });

    res.json({ success: true, message: 'Mot de passe réinitialisé avec succès.' });
  } catch (err) { next(err); }
};

// ════════════════════════════════════════════════════════
// POST /api/auth/send-verification
// ════════════════════════════════════════════════════════
exports.sendVerification = async (req, res, next) => {
  try {
    const { email, firstName } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'L\'email est requis.' });
    }
    const cleanEmail = email.toLowerCase().trim();

    // Check if email already exists
    if (await emailExistsAnywhere(cleanEmail)) {
      return res.status(409).json({
        success: false,
        message: 'Cette adresse email est déjà utilisée.',
        errors: [{ field: 'email', message: 'Un compte existe déjà avec cette adresse email.' }],
      });
    }

    // Generate 6 digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Delete any existing codes for this email
    await VerificationCode.deleteMany({ email: cleanEmail });

    // Save new code
    await VerificationCode.create({ email: cleanEmail, code });

    // Send email
    await sendVerificationEmail(cleanEmail, code, firstName);

    res.status(200).json({ success: true, message: 'Code de vérification envoyé.' });
  } catch (err) { next(err); }
};

// ════════════════════════════════════════════════════════
// POST /api/auth/register  — creates Citoyen or Agent
// Role is determined by req.body.role (defaults to Citoyen)
// Admin accounts are NEVER creatable via public API
// ════════════════════════════════════════════════════════
exports.register = async (req, res, next) => {
  try {
    const { firstName, lastName, email, password, cin, phone, municipality, department, role: requestedRole, verificationCode } = req.body;

    // Determine role — Admin registration is forbidden via public API
    const role = requestedRole === 'Agent' ? 'Agent' : 'Citoyen';

    // Verify code first
    const cleanEmail = email.toLowerCase().trim();
    if (!verificationCode) {
      return res.status(400).json({
        success: false,
        message: 'Le code de vérification est requis.',
        errors: [{ field: 'verificationCode', message: 'Code manquant.' }],
      });
    }

    const validCode = await VerificationCode.findOne({ email: cleanEmail, code: verificationCode });
    if (!validCode) {
      return res.status(400).json({
        success: false,
        message: 'Code de vérification invalide ou expiré.',
        errors: [{ field: 'verificationCode', message: 'Code invalide ou expiré.' }]
      });
    }

    // Global email uniqueness across all 3 collections
    if (await emailExistsAnywhere(cleanEmail)) {
      return res.status(409).json({
        success: false,
        message: 'Cette adresse email est déjà utilisée.',
        errors: [{ field: 'email', message: 'Un compte existe déjà avec cette adresse email.' }],
      });
    }

    let account;

    if (role === 'Agent') {
      account = await Agent.create({
        firstName:    firstName.trim(),
        lastName:     lastName.trim(),
        email:        email.toLowerCase().trim(),
        password,
        phone:        phone?.trim()       || undefined,
        department:   department?.trim()  || 'Direction Technique',
        municipality: municipality?.trim() || 'Tunis',
      });

      await Notification.notify({
        recipient:     account._id,
        type:          'account_activated',
        title:         'Bienvenue sur BlediGo !',
        message:       `Bienvenue ${account.firstName} ! Votre compte agent est actif.`,
      }).catch(() => {});

      sendToken(account, 201, res, 'Agent');

    } else {
      // Citoyen — check CIN uniqueness
      if (cin && cin.trim()) {
        const cinTaken = await Citoyen.findOne({ cin: cin.trim() }).lean();
        if (cinTaken) {
          return res.status(409).json({
            success: false,
            message: 'Ce numéro CIN est déjà enregistré.',
            errors: [{ field: 'cin', message: 'CIN déjà associé à un compte.' }],
          });
        }
      }

      account = await Citoyen.create({
        firstName:    firstName.trim(),
        lastName:     lastName.trim(),
        email:        email.toLowerCase().trim(),
        password,
        cin:          cin?.trim()          || undefined,
        phone:        phone?.trim()        || undefined,
        municipality: municipality?.trim() || 'Tunis',
      });

      await Notification.notify({
        recipient:     account._id,
        type:          'account_activated',
        title:         'Bienvenue sur BlediGo !',
        message:       `Bienvenue ${account.firstName} ! Votre compte citoyen est actif.`,
      }).catch(() => {});

      sendToken(account, 201, res, 'Citoyen');
    }

    // Delete code after successful registration
    await VerificationCode.deleteOne({ _id: validCode._id });

  } catch (err) { next(err); }
};

// ════════════════════════════════════════════════════════
// POST /api/auth/login
// Role from request → query correct collection
// ════════════════════════════════════════════════════════
exports.login = async (req, res, next) => {
  try {
    const { email, password, role } = req.body;

    // Sanitize email consistently — lowercase + trim ONLY
    // IMPORTANT: Do NOT strip dots — gmail addresses contain dots
    const cleanEmail = email.toLowerCase().trim();

    const Model = MODEL_MAP[role];
    if (!Model) {
      return res.status(400).json({
        success: false,
        message: 'Rôle invalide.',
        errors: [{ field: 'role', message: 'Sélectionnez un rôle valide.' }],
      });
    }

    const user = await Model.findOne({ email: cleanEmail }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Email ou mot de passe incorrect.',
        errors: [{ field: 'email', message: `Aucun compte ${role} avec cet email.` }],
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Compte désactivé. Contactez l\'administrateur.',
      });
    }

    if (!await user.comparePassword(password)) {
      return res.status(401).json({
        success: false,
        message: 'Email ou mot de passe incorrect.',
        errors: [{ field: 'password', message: 'Mot de passe incorrect.' }],
      });
    }

    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    sendToken(user, 200, res, role);  // role = 'Admin'|'Agent'|'Citoyen'
  } catch (err) { next(err); }
};

// GET /api/auth/me — re-fetches fresh data from DB, strips sensitive fields
exports.getMe = async (req, res, next) => {
  try {
    const Model = MODEL_MAP[req.user.role];
    const fresh = await Model.findById(req.user._id).select('-password').lean();
    if (!fresh) return res.status(404).json({ success: false, message: 'Utilisateur introuvable.' });
    const role = req.user.role;
    res.json({
      success: true,
      user: {
        ...fresh,
        role,
        // Ensure fullName is always available in the same shape as sendToken
        fullName: `${fresh.firstName||''} ${fresh.lastName||''}`.trim(),
      },
    });
  } catch (err) { next(err); }
};

// POST /api/auth/change-password
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword)
      return res.status(400).json({ success: false, message: 'Les deux mots de passe sont requis.' });
    if (newPassword.length < 8)
      return res.status(422).json({ success: false, message: 'Minimum 8 caractères requis.' });

    const Model = MODEL_MAP[req.user.role];
    const user  = await Model.findById(req.user._id).select('+password');

    if (!await user.comparePassword(currentPassword))
      return res.status(401).json({ success: false, message: 'Mot de passe actuel incorrect.' });

    user.password = newPassword;
    await user.save();
    res.json({ success: true, message: 'Mot de passe mis à jour avec succès.' });
  } catch (err) { next(err); }
};
