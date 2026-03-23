'use strict';
const { Router } = require('express');
const { protect } = require('../middleware/auth');
const Admin   = require('../models/Admin');
const Agent   = require('../models/Agent');
const Citoyen = require('../models/Citoyen');
const router  = Router();

const MODEL_MAP = { Admin, Agent, Citoyen };

// GET /api/profile/me
router.get('/me', protect, async (req, res, next) => {
  try {
    const Model = MODEL_MAP[req.user.role];
    const user  = await Model.findById(req.user._id).lean();
    if (!user) return res.status(404).json({ success:false, message:'Profil introuvable.' });
    res.json({ success:true, data: { ...user, role: req.user.role } });
  } catch(err){ next(err) }
});

// PATCH /api/profile/me
router.patch('/me', protect, async (req, res, next) => {
  try {
    const FORBIDDEN = ['password','role','_id','email'];
    FORBIDDEN.forEach(k => delete req.body[k]);

    const Model = MODEL_MAP[req.user.role];
    const user  = await Model.findByIdAndUpdate(
      req.user._id, req.body,
      { new:true, runValidators:true, lean:true }
    );
    if (!user) return res.status(404).json({ success:false, message:'Profil introuvable.' });
    res.json({ success:true, message:'Profil mis à jour.', data:{ ...user, role:req.user.role } });
  } catch(err){ next(err) }
});
module.exports = router;
