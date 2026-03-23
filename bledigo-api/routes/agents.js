'use strict';

const { Router }  = require('express');
const { body }    = require('express-validator');
const Reclamation = require('../models/Reclamation');
const Agent       = require('../models/Agent');
const { protect, authorize } = require('../middleware/auth');

const router = Router();

// ── GET /api/agents  (Admin) — all agents with live stats ──
router.get('/', protect, authorize('Admin'), async (req, res, next) => {
  try {
    const agents = await Agent.find().sort({ firstName: 1 }).lean();

    // Attach live stats for every agent in one aggregate
    const statsAgg = await Reclamation.aggregate([
      { $match: { assignedAgent: { $ne: null } } },
      {
        $group: {
          _id:      '$assignedAgent',
          total:    { $sum: 1 },
          pending:  { $sum: { $cond: [{ $eq: ['$status', 'Pending']      }, 1, 0] } },
          inprog:   { $sum: { $cond: [{ $eq: ['$status', 'In Progress']  }, 1, 0] } },
          resolved: { $sum: { $cond: [{ $eq: ['$status', 'Resolved']     }, 1, 0] } },
          rejected: { $sum: { $cond: [{ $eq: ['$status', 'Rejected']     }, 1, 0] } },
          critical: { $sum: { $cond: [{ $in: ['$urgency.level', ['Critical']] }, 1, 0] } },
          high:     { $sum: { $cond: [{ $in: ['$urgency.level', ['High']]     }, 1, 0] } },
        },
      },
    ]);

    const statsMap = {};
    statsAgg.forEach(s => { statsMap[String(s._id)] = s; });

    const result = agents.map(agent => {
      const s = statsMap[String(agent._id)] || { total:0, pending:0, inprog:0, resolved:0, rejected:0, critical:0, high:0 };
      const active = s.pending + s.inprog;
      const load   = s.total > 0 ? Math.round((active / Math.max(s.total, 1)) * 100) : 0;
      const resolutionRate = s.total > 0 ? Math.round((s.resolved / s.total) * 100) : 0;
      return {
        ...agent,
        stats: {
          total:          s.total,
          pending:        s.pending,
          inProgress:     s.inprog,
          resolved:       s.resolved,
          rejected:       s.rejected,
          critical:       s.critical,
          high:           s.high,
          active,
          load,
          resolutionRate,
        },
      };
    });

    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

// ── GET /api/agents/workload  (Admin) — load per agent ─
router.get('/workload', protect, authorize('Admin'), async (req, res, next) => {
  try {
    const workload = await Reclamation.aggregate([
      { $match: { status: { $in: ['Pending', 'In Progress'] }, assignedAgent: { $ne: null } } },
      {
        $group: {
          _id:         '$assignedAgent',
          activeCount: { $sum: 1 },
          urgentCount: { $sum: { $cond: [{ $in: ['$urgency.level', ['High', 'Critical']] }, 1, 0] } },
        },
      },
      { $lookup: { from: 'agents', localField: '_id', foreignField: '_id', as: 'agent' } },
      { $unwind: { path: '$agent', preserveNullAndEmpty: false } },
      {
        $project: {
          agentId:     '$_id',
          name:        { $concat: ['$agent.firstName', ' ', '$agent.lastName'] },
          department:  '$agent.department',
          activeCount: 1,
          urgentCount: 1,
        },
      },
      { $sort: { activeCount: -1 } },
    ]);
    res.json({ success: true, data: workload });
  } catch (err) { next(err); }
});

// ── PATCH /api/agents/:id/toggle-active  (Admin) ────────
router.patch('/:id/toggle-active', protect, authorize('Admin'), async (req, res, next) => {
  try {
    const agent = await Agent.findById(req.params.id);
    if (!agent) return res.status(404).json({ success: false, message: 'Agent introuvable.' });

    agent.isActive = !agent.isActive;
    await agent.save({ validateBeforeSave: false });

    res.json({
      success:  true,
      message:  `Compte agent ${agent.isActive ? 'activé' : 'désactivé'}.`,
      isActive: agent.isActive,
    });
  } catch (err) { next(err); }
});

// ── GET /api/agents/:id/reclamations  (Admin) ────────────
router.get('/:id/reclamations', protect, authorize('Admin'), async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const filter = { assignedAgent: req.params.id };
    if (status) filter.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [recs, total] = await Promise.all([
      Reclamation.find(filter)
        .populate('citizen', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .select('-timeline -urgency.rawAiResponse'),
      Reclamation.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: { reclamations: recs, pagination: { total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / parseInt(limit)) } },
    });
  } catch (err) { next(err); }
});

// ── GET /api/agents/my-dashboard  (Agent) ──────────────
router.get('/my-dashboard', protect, authorize('Agent'), async (req, res, next) => {
  try {
    const agentId = req.user._id;
    const [assigned, stats] = await Promise.all([
      Reclamation.find({ assignedAgent: agentId })
        .populate('citizen', 'firstName lastName email phone')
        .sort({ 'urgency.level': 1, createdAt: 1 })
        .select('-timeline -urgency.rawAiResponse'),
      Reclamation.aggregate([
        { $match: { assignedAgent: agentId } },
        { $group: {
          _id:      null,
          total:    { $sum: 1 },
          pending:  { $sum: { $cond: [{ $eq: ['$status', 'Pending']     }, 1, 0] } },
          inprog:   { $sum: { $cond: [{ $eq: ['$status', 'In Progress'] }, 1, 0] } },
          resolved: { $sum: { $cond: [{ $eq: ['$status', 'Resolved']    }, 1, 0] } },
        }},
      ]),
    ]);

    const now     = Date.now();
    const overdue = assigned.filter(r => {
      if (['Resolved', 'Rejected', 'Cancelled'].includes(r.status)) return false;
      const limit = r.urgency?.level === 'Critical' ? 12 : 48;
      return (now - new Date(r.createdAt)) > limit * 3600 * 1000;
    });

    res.json({
      success: true,
      data: { assigned, overdue, stats: stats[0] || { total: 0, pending: 0, inprog: 0, resolved: 0 } },
    });
  } catch (err) { next(err); }
});

// ── POST /api/agents/report  (Agent) ─────────────────────
router.post('/report',
  protect,
  authorize('Agent'),
  body('reclamationId').isMongoId().withMessage('ID de réclamation invalide.'),
  body('text').trim().notEmpty().withMessage('Le rapport est vide.'),
  async (req, res, next) => {
    try {
      const { reclamationId, text, newStatus } = req.body;
      const rec = await Reclamation.findOne({ _id: reclamationId, assignedAgent: req.user._id });
      if (!rec) return res.status(404).json({ success: false, message: 'Réclamation introuvable ou non assignée.' });

      rec.resolutionReport = { text, submittedAt: new Date() };
      if (newStatus && ['In Progress', 'Resolved'].includes(newStatus)) {
        const prev = rec.status;
        rec.status = newStatus;
        rec.timeline.push({
          event:       `Rapport soumis. Statut : ${newStatus}`,
          description: text.substring(0, 200),
          performedBy: req.user._id,
          fromStatus:  prev,
          toStatus:    newStatus,
        });
      }
      await rec.save();
      res.json({ success: true, message: 'Rapport soumis avec succès.', data: rec });
    } catch (err) { next(err); }
  }
);

module.exports = router;
