'use strict';

const Admin   = require('../models/Admin');
const Agent   = require('../models/Agent');
const Citoyen = require('../models/Citoyen');

// ── Helper: query all 3 collections and merge ───────────
async function fetchAllUsers({ role, isActive, municipality, skip, limit }) {
  const buildFilter = () => {
    const f = {};
    if (isActive !== undefined) f.isActive = isActive === 'true' || isActive === true;
    if (municipality) f.municipality = municipality;
    return f;
  };

  let results = [];

  if (!role || role === 'Admin') {
    const docs = await Admin.find(buildFilter()).sort({ createdAt: -1 }).lean();
    results = results.concat(docs.map(d => ({ ...d, role: 'Admin' })));
  }
  if (!role || role === 'Agent') {
    const docs = await Agent.find(buildFilter()).sort({ createdAt: -1 }).lean();
    results = results.concat(docs.map(d => ({ ...d, role: 'Agent' })));
  }
  if (!role || role === 'Citoyen') {
    const docs = await Citoyen.find(buildFilter()).sort({ createdAt: -1 }).lean();
    results = results.concat(docs.map(d => ({ ...d, role: 'Citoyen' })));
  }

  results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const total     = results.length;
  const paginated = results.slice(skip, skip + limit);
  return { users: paginated, total };
}

// ── GET /api/users  (Admin) ─────────────────────────────
exports.getAllUsers = async (req, res, next) => {
  try {
    const { role, isActive, municipality, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const { users, total } = await fetchAllUsers({ role, isActive, municipality, skip, limit: parseInt(limit) });
    res.json({
      success: true,
      data: { users, pagination: { total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / parseInt(limit)) } },
    });
  } catch (err) { next(err); }
};

// ── GET /api/users/stats  (Admin) ──────────────────────
exports.getUserStats = async (req, res, next) => {
  try {
    const [adminCount, agentCount, citoyenCount,
           adminActive, agentActive, citoyenActive] = await Promise.all([
      Admin.countDocuments(),   Agent.countDocuments(),   Citoyen.countDocuments(),
      Admin.countDocuments({ isActive: true }), Agent.countDocuments({ isActive: true }), Citoyen.countDocuments({ isActive: true }),
    ]);
    res.json({ success: true, data: [
      { _id: 'Admin',   count: adminCount,   active: adminActive },
      { _id: 'Agent',   count: agentCount,   active: agentActive },
      { _id: 'Citoyen', count: citoyenCount, active: citoyenActive },
    ]});
  } catch (err) { next(err); }
};

// ── GET /api/users/:id  (Admin or self) ────────────────
exports.getUserById = async (req, res, next) => {
  try {
    let user = null;
    for (const [M, role] of [[Admin,'Admin'],[Agent,'Agent'],[Citoyen,'Citoyen']]) {
      const found = await M.findById(req.params.id).lean();
      if (found) { user = { ...found, role }; break; }
    }
    if (!user) return res.status(404).json({ success: false, message: 'Utilisateur introuvable.' });
    if (req.user.role === 'Citoyen' && String(user._id) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Accès refusé.' });
    }
    res.json({ success: true, data: user });
  } catch (err) { next(err); }
};

// ── PATCH /api/users/:id  (Admin or self) ──────────────
exports.updateUser = async (req, res, next) => {
  try {
    if (req.user.role !== 'Admin') { delete req.body.role; delete req.body.isActive; }
    delete req.body.password;
    let user = null;
    for (const [M, role] of [[Admin,'Admin'],[Agent,'Agent'],[Citoyen,'Citoyen']]) {
      const found = await M.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }).lean();
      if (found) { user = { ...found, role }; break; }
    }
    if (!user) return res.status(404).json({ success: false, message: 'Utilisateur introuvable.' });
    res.json({ success: true, message: 'Profil mis à jour.', data: user });
  } catch (err) { next(err); }
};

// ── PATCH /api/users/:id/toggle-active  (Admin) ────────
exports.toggleActive = async (req, res, next) => {
  try {
    let user = null;
    for (const M of [Admin, Agent, Citoyen]) {
      const found = await M.findById(req.params.id);
      if (found) { user = found; break; }
    }
    if (!user) return res.status(404).json({ success: false, message: 'Utilisateur introuvable.' });
    user.isActive = !user.isActive;
    await user.save({ validateBeforeSave: false });
    res.json({ success: true, message: `Compte ${user.isActive ? 'activé' : 'désactivé'}.`, isActive: user.isActive });
  } catch (err) { next(err); }
};

// ── DELETE /api/users/:id  (Admin) ─────────────────────
exports.deleteUser = async (req, res, next) => {
  try {
    let deleted = false;
    for (const M of [Admin, Agent, Citoyen]) {
      const result = await M.findByIdAndDelete(req.params.id);
      if (result) { deleted = true; break; }
    }
    if (!deleted) return res.status(404).json({ success: false, message: 'Utilisateur introuvable.' });
    res.json({ success: true, message: 'Utilisateur supprimé.' });
  } catch (err) { next(err); }
};
