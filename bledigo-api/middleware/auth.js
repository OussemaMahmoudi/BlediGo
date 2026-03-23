'use strict';

const jwt     = require('jsonwebtoken');
const Admin   = require('../models/Admin');
const Agent   = require('../models/Agent');
const Citoyen = require('../models/Citoyen');

// Map role → model (each has its own collection)
const MODEL_MAP = {
  Admin:   Admin,
  Agent:   Agent,
  Citoyen: Citoyen,
};

/**
 * protect
 * ───────
 * Verifies JWT, reads the role embedded in the token,
 * then fetches the user from the correct collection.
 * Attaches req.user on success.
 */
async function protect(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Accès refusé. Veuillez vous connecter.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // decoded = { id, role, iat, exp }

    const Model = MODEL_MAP[decoded.role];
    if (!Model) {
      return res.status(401).json({ success: false, message: 'Token invalide — rôle inconnu.' });
    }

    const user = await Model.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Compte introuvable. Veuillez vous reconnecter.' });
    }
    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'Compte désactivé. Contactez l\'administrateur.' });
    }

    req.user = user;
    next();
  } catch (err) {
    const msg = err.name === 'TokenExpiredError'
      ? 'Session expirée. Veuillez vous reconnecter.'
      : 'Token invalide. Veuillez vous reconnecter.';
    return res.status(401).json({ success: false, message: msg });
  }
}

/**
 * authorize(...roles)
 * ───────────────────
 * Role-based access control. Must be used after protect().
 * Usage: authorize('Admin', 'Agent')
 */
function authorize(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Accès interdit. Rôle requis : ${roles.join(' ou ')}.`,
      });
    }
    next();
  };
}

/**
 * optionalAuth
 * ────────────
 * Populates req.user if a valid token is present,
 * but does NOT block unauthenticated requests.
 */
async function optionalAuth(req, _res, next) {
  try {
    const auth = req.headers.authorization;
    if (auth?.startsWith('Bearer ')) {
      const decoded = jwt.verify(auth.split(' ')[1], process.env.JWT_SECRET);
      const Model   = MODEL_MAP[decoded.role];
      if (Model) req.user = await Model.findById(decoded.id).select('-password');
    }
  } catch (_) { /* continue as unauthenticated */ }
  next();
}

module.exports = { protect, authorize, optionalAuth };
