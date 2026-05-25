'use strict';

const { validationResult } = require('express-validator');
const mongoose = require('mongoose');
const Reclamation = require('../models/Reclamation');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { classifyUrgency } = require('../utils/aiClient');
const Agent = require('../models/Agent');
const { sendItemReceivedEmail, sendStatusUpdateEmail, sendAgentAssignmentEmail } = require('../utils/email');
const jwt = require('jsonwebtoken');

// ── Shared populate helper ──────────────────────────────
const CITIZEN_FIELDS = 'firstName lastName email phone municipality';
const AGENT_FIELDS = 'firstName lastName email department';

// ───────────────────────────────────────────────────────
// POST /api/reclamations
// Submit a new reclamation (Citoyen only)
// ─── THIS IS THE CRITICAL CONTROLLER WITH AI INTEGRATION ─
// ───────────────────────────────────────────────────────
exports.createReclamation = async (req, res, next) => {
  try {
    // ── Input validation ─────────────────────────────
    const errs = validationResult(req);
    if (!errs.isEmpty()) {
      return res.status(422).json({
        success: false,
        message: 'Données de réclamation invalides.',
        errors: errs.array().map(e => ({ field: e.path, message: e.msg })),
      });
    }

    const { title, description, category, location } = req.body;

    // ── Build image list from uploaded files ─────────
    const images = (req.files || []).map(file => ({
      url: `/uploads/${file.filename}`,
      filename: file.filename,
      mimetype: file.mimetype,
      size: file.size,
    }));

    // ─────────────────────────────────────────────────
    // ★  AI URGENCY CLASSIFICATION
    // ─────────────────────────────────────────────────
    console.log(`[Reclamation] Calling AI classifier for: "${title}"`);
    const urgencyResult = await classifyUrgency(description, category);
    // urgencyResult = { level, confidence, reason, aiGenerated, rawAiResponse }

    // AUTO-ASSIGNMENT: category → department → least-loaded agent
    const CATEGORY_DEPT_MAP = {
      'Eclairage public':     'Direction Technique',
      'Voirie & Routes':      'Service Voirie',
      'Propreté & Déchets':   'Service Propreté',
      'Espaces verts':        'Service Espaces verts',
      'Eau & Assainissement': 'Service Eau & Assainissement',
      'Signalisation':        'Service Voirie',
      'Bâtiments publics':    'Service Bâtiments publics',
      'Transports':           'Service Transport',
      'Autre':                null,
    };
    let autoAssignedAgent = null;
    let autoAssignedAt    = null;
    let assignedAgentName = null;
    let noAgentAvailable  = false;
    const targetDept = CATEGORY_DEPT_MAP[category];
    if (targetDept) {
      try {
        const candidates = await Agent.find({ isActive: true, department: targetDept }).lean();
        if (candidates.length === 0) {
          noAgentAvailable = true;
          console.warn(`[Reclamation] No active agent in dept "${targetDept}" for "${category}"`);
        } else {
          const workloads = await Promise.all(
            candidates.map(async (agent) => ({
              agent,
              count: await Reclamation.countDocuments({
                assignedAgent: agent._id,
                status: { $in: ['Pending', 'In Progress'] },
              }),
            }))
          );
          workloads.sort((a, b) => a.count - b.count);
          const selected = workloads[0].agent;
          autoAssignedAgent = selected._id;
          autoAssignedAt    = new Date();
          assignedAgentName = `${selected.firstName} ${selected.lastName}`;
          console.log(`[Reclamation] Auto-assigned → ${assignedAgentName} (dept: ${targetDept}, load: ${workloads[0].count})`);
        }
      } catch (assignErr) {
        console.warn('[Reclamation] Auto-assignment error:', assignErr.message);
      }
    } else {
      noAgentAvailable = true;
    }

    // ── Build timeline events ──────────────────────────────
    const timelineEvents = [{
      event: 'Réclamation soumise',
      description: `Réclamation créée par ${req.user.fullName}. Urgence IA : ${urgencyResult.level}.${autoAssignedAgent ? ' Affectée automatiquement.' : ''}`,
      performedBy: req.user._id,
      toStatus: autoAssignedAgent ? 'In Progress' : 'Pending',
    }];

    if (autoAssignedAgent && assignedAgentName) {
      timelineEvents.push({
        event: `Affectée à ${assignedAgentName}`,
        description: `Affectation automatique basée sur la charge de travail et la spécialisation.`,
        performedBy: req.user._id,
        fromStatus: 'Pending',
        toStatus: 'In Progress',
      });
    }

    // ── Create document ──────────────────────────────
    const reclamation = await Reclamation.create({
      title,
      description,
      category,
      location: {
        address: location?.address || '',
        district: location?.district || '',
        municipality: location?.municipality || req.user.municipality || 'Tunis',
        coordinates: location?.coordinates || undefined,
      },
      images,
      citizen: req.user._id,
      urgency: urgencyResult,
      status: autoAssignedAgent ? 'In Progress' : 'Pending',
      assignedAgent: autoAssignedAgent,
      assignedAt: autoAssignedAt,
      timeline: timelineEvents,
    });

    // ── Notify admins of new high/critical reclamation ─
    if (['High', 'Critical'].includes(urgencyResult.level)) {
      const admins = await Agent.find({ isActive: true }, '_id');
      const { default: AdminModel } = await Promise.resolve({ default: require('../models/Admin') });
      const adminUsers = await AdminModel.find({ isActive: true }, '_id');
      await Promise.allSettled(adminUsers.map(admin =>
        Notification.notify({
          recipient: admin._id,
          type: 'reclamation_submitted',
          title: `🚨 Réclamation urgente (#${reclamation._id.toString().slice(-6)})`,
          message: `Nouvelle réclamation "${title}" — Urgence : ${urgencyResult.level}`,
          ref: { model: 'Reclamation', id: reclamation._id },
        })
      ));
    }

    // ── Notify auto-assigned agent ────────────────────
    if (autoAssignedAgent) {
      await Notification.notify({
        recipient: autoAssignedAgent,
        type: 'reclamation_assigned',
        title: 'Nouvelle réclamation assignée automatiquement',
        message: `La réclamation "${title}" (${urgencyResult.level}) vous a été affectée automatiquement.`,
        ref: { model: 'Reclamation', id: reclamation._id },
      }).catch(() => { });

      try {
        const ag = await Agent.findById(autoAssignedAgent);
        if (ag && ag.email) {
          await sendAgentAssignmentEmail(ag.email, ag.firstName, title, urgencyResult.level);
        }
      } catch (e) {}
    }

    // ── Notify citizen of submission ─────────────────
    await Notification.notify({
      recipient: req.user._id,
      type: 'reclamation_submitted',
      title: 'Réclamation soumise',
      message: `Votre réclamation "${title}" a été enregistrée. Urgence détectée : ${urgencyResult.level}.`,
      ref: { model: 'Reclamation', id: reclamation._id },
    });

    // ── Send Email Confirmation with Cancel Link ─────
    const cancelToken = jwt.sign(
      { id: reclamation._id, type: 'reclamation' },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '2h' }
    );
    await sendItemReceivedEmail(req.user.email, req.user.firstName, 'Réclamation', title, cancelToken);

    console.log(`[Reclamation] Created: ${reclamation._id} | Urgency: ${urgencyResult.level} (AI: ${urgencyResult.aiGenerated})`);

    // ── Return populated document ────────────────────
    const populated = await Reclamation.findById(reclamation._id)
      .populate('citizen', CITIZEN_FIELDS);

    res.status(201).json({
      success: true,
      message: 'Réclamation soumise avec succès.',
      noAgentAvailable,
      data: populated,
    });

  } catch (err) {
    next(err);
  }
};

// ───────────────────────────────────────────────────────
// GET /api/reclamations/my-history
// The logged-in citizen's own reclamations
// ───────────────────────────────────────────────────────
exports.getMyHistory = async (req, res, next) => {
  try {
    const { status, category, page = 1, limit = 10 } = req.query;
    const filter = { citizen: req.user._id };

    if (status) filter.status = status;
    if (category) filter.category = category;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [reclamations, total] = await Promise.all([
      Reclamation.find(filter)
        .populate({ path: 'assignedAgent', model: 'Agent', select: AGENT_FIELDS })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .select('-timeline -comments -urgency.rawAiResponse'),
      Reclamation.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: {
        reclamations,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / parseInt(limit)),
        },
      },
    });

  } catch (err) {
    next(err);
  }
};

// ───────────────────────────────────────────────────────
// GET /api/reclamations/all
// All reclamations (Admin/Agent)
// ───────────────────────────────────────────────────────
exports.getAllReclamations = async (req, res, next) => {
  try {
    const {
      status, category, urgency, assignedAgent,
      municipality, isOverdue,
      page = 1, limit = 20,
      sort = '-createdAt',
    } = req.query;

    const filter = {};

    if (status) filter.status = status;
    if (category) filter.category = category;
    if (urgency) filter['urgency.level'] = urgency;
    if (municipality) filter['location.municipality'] = municipality;
    if (assignedAgent) {
      filter.assignedAgent = assignedAgent === 'null' ? null : assignedAgent;
    }

    // Agents see only their assigned reclamations
    if (req.user.role === 'Agent') {
      filter.assignedAgent = req.user._id;
    }

    // Overdue filter: not resolved and older than 48h
    if (isOverdue === 'true') {
      const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
      filter.createdAt = { $lt: cutoff };
      filter.status = { $in: ['Pending', 'In Progress'] };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [reclamations, total] = await Promise.all([
      Reclamation.find(filter)
        .populate('citizen', CITIZEN_FIELDS)
        .populate({ path: 'assignedAgent', model: 'Agent', select: AGENT_FIELDS })
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .select('-urgency.rawAiResponse'),
      Reclamation.countDocuments(filter),
    ]);

    // Compute stats for the response
    const stats = await Reclamation.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          pending: { $sum: { $cond: [{ $eq: ['$status', 'Pending'] }, 1, 0] } },
          inprog: { $sum: { $cond: [{ $eq: ['$status', 'In Progress'] }, 1, 0] } },
          resolved: { $sum: { $cond: [{ $eq: ['$status', 'Resolved'] }, 1, 0] } },
          critical: { $sum: { $cond: [{ $eq: ['$urgency.level', 'Critical'] }, 1, 0] } },
          high: { $sum: { $cond: [{ $eq: ['$urgency.level', 'High'] }, 1, 0] } },
        },
      },
    ]);

    res.json({
      success: true,
      data: {
        reclamations,
        stats: stats[0] || {},
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / parseInt(limit)),
        },
      },
    });

  } catch (err) {
    next(err);
  }
};

// ───────────────────────────────────────────────────────
// GET /api/reclamations/public
// Public feed (no auth required, only isPublic=true)
// ───────────────────────────────────────────────────────
// controllers/reclamationController.js
exports.getPublicFeed = async (req, res, next) => {
  try {
    const { category, status, sort = '-votes.count', page = 1, limit = 10 } = req.query;
    const filter = { isPublic: true };

    if (category) filter.category = category;
    if (status) filter.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [reclamations, total] = await Promise.all([
      Reclamation.find(filter)
        .select('title description category status urgency.level location.address location.municipality votes createdAt images timeline assignedAt resolvedAt comments') // ← comments added
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit)),
      Reclamation.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: {
        reclamations,
        pagination: { total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / parseInt(limit)) },
      },
    });
  } catch (err) {
    next(err);
  }
};

// ───────────────────────────────────────────────────────
// GET /api/reclamations/:id
// Single reclamation detail
// ───────────────────────────────────────────────────────
exports.getReclamationById = async (req, res, next) => {
  try {
    const rec = await Reclamation.findById(req.params.id)
      .populate('citizen', CITIZEN_FIELDS)
      .populate({ path: 'assignedAgent', model: 'Agent', select: AGENT_FIELDS })
      .populate('comments.author', 'firstName lastName role')
      .populate('timeline.performedBy', 'firstName lastName role');

    if (!rec) {
      return res.status(404).json({ success: false, message: 'Réclamation introuvable.' });
    }

    // Citizens can only see their own (unless public)
    if (req.user?.role === 'Citoyen') {
      if (!rec.citizen._id.equals(req.user._id) && !rec.isPublic) {
        return res.status(403).json({ success: false, message: 'Accès refusé.' });
      }
    }

    res.json({ success: true, data: rec });
  } catch (err) {
    next(err);
  }
};

// ───────────────────────────────────────────────────────
// PATCH /api/reclamations/:id/status
// Agent or Admin updates the status
// ───────────────────────────────────────────────────────
exports.updateStatus = async (req, res, next) => {
  try {
    const { status, rejectionReason, report } = req.body;

    const VALID_STATUSES = ['Pending', 'In Progress', 'Resolved', 'Rejected', 'Cancelled'];
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Statut invalide. Valeurs : ${VALID_STATUSES.join(', ')}`,
      });
    }

    const rec = await Reclamation.findById(req.params.id);
    if (!rec) return res.status(404).json({ success: false, message: 'Réclamation introuvable.' });

    // Agents can only update their assigned reclamations
    if (req.user.role === 'Agent' && !rec.assignedAgent?.equals(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Vous n\'êtes pas assigné à cette réclamation.' });
    }

    const fromStatus = rec.status;
    rec.status = status;

    if (status === 'Rejected' && rejectionReason) {
      rec.rejectionReason = rejectionReason;
    }
    if (status === 'Resolved' && report) {
      rec.resolutionReport = { text: report, submittedAt: new Date() };
    }

    // Add timeline event
    rec.timeline.push({
      event: `Statut changé : ${fromStatus} → ${status}`,
      description: rejectionReason || report || '',
      performedBy: req.user._id,
      fromStatus,
      toStatus: status,
    });

    await rec.save();

    // ── Notify citizen ───────────────────────────────
    await Notification.notify({
      recipient: rec.citizen,
      type: 'reclamation_status_changed',
      title: `Réclamation mise à jour`,
      message: `Votre réclamation a été mise à jour : ${status}.${rejectionReason ? ' Motif : ' + rejectionReason : ''}`,
      ref: { model: 'Reclamation', id: rec._id },
    });

    const updated = await Reclamation.findById(rec._id)
      .populate('citizen', CITIZEN_FIELDS)
      .populate({ path: 'assignedAgent', model: 'Agent', select: AGENT_FIELDS });

    // ── Send Status Update Email ─────────────────────
    if (updated.citizen && updated.citizen.email) {
      const motif = status === 'Rejected' ? rejectionReason : (status === 'Resolved' ? report : null);
      await sendStatusUpdateEmail(
        updated.citizen.email,
        updated.citizen.firstName,
        'Réclamation',
        updated.title,
        status,
        motif
      );
    }

    console.log(`[Reclamation] Status ${fromStatus}→${status} | ID: ${rec._id} | By: ${req.user.email}`);

    res.json({ success: true, message: 'Statut mis à jour.', data: updated });
  } catch (err) {
    next(err);
  }
};

// ───────────────────────────────────────────────────────
// PATCH /api/reclamations/:id/assign
// Admin assigns an agent
// ───────────────────────────────────────────────────────
exports.assignAgent = async (req, res, next) => {
  try {
    const { agentId } = req.body;
    if (!agentId || !mongoose.Types.ObjectId.isValid(agentId)) {
      return res.status(400).json({ success: false, message: 'Agent ID invalide.' });
    }

    const agent = await Agent.findOne({ _id: agentId, isActive: true });
    if (!agent) return res.status(404).json({ success: false, message: 'Agent introuvable ou inactif.' });

    const rec = await Reclamation.findById(req.params.id);
    if (!rec) return res.status(404).json({ success: false, message: 'Réclamation introuvable.' });

    const prevAgent = rec.assignedAgent;
    rec.assignedAgent = agentId;
    rec.assignedAt = new Date();
    rec.assignedBy = req.user._id;
    if (rec.status === 'Pending') rec.status = 'In Progress';

    const agentFullName = `${agent.firstName} ${agent.lastName}`.trim();
    rec.timeline.push({
      event: `Affectée à ${agentFullName}`,
      performedBy: req.user._id,
      fromStatus: rec.status,
      toStatus: rec.status,
    });

    await rec.save();

    // Notify the newly assigned agent
    await Notification.notify({
      recipient: agentId,
      type: 'reclamation_assigned',
      title: 'Nouvelle réclamation assignée',
      message: `La réclamation "${rec.title}" (${rec.urgency.level}) vous a été affectée.`,
      ref: { model: 'Reclamation', id: rec._id },
    });

    if (agent.email) {
      await sendAgentAssignmentEmail(agent.email, agent.firstName, rec.title, rec.urgency.level);
    }

    const updated = await Reclamation.findById(rec._id)
      .populate('citizen', CITIZEN_FIELDS)
      .populate({ path: 'assignedAgent', model: 'Agent', select: AGENT_FIELDS });

    res.json({ success: true, message: `Réclamation affectée à ${agentFullName}.`, data: updated });
  } catch (err) {
    next(err);
  }
};

// ───────────────────────────────────────────────────────
// POST /api/reclamations/:id/vote
// Citizen votes/supports a reclamation
// ───────────────────────────────────────────────────────
exports.vote = async (req, res, next) => {
  try {
    const rec = await Reclamation.findById(req.params.id);
    if (!rec) return res.status(404).json({ success: false, message: 'Réclamation introuvable.' });

    const uid = req.user._id;
    const idx = rec.votes.voters.findIndex(v => v.equals(uid));
    let action;

    if (idx === -1) {
      // Add vote
      rec.votes.voters.push(uid);
      rec.votes.count++;
      action = 'added';
    } else {
      // Remove vote
      rec.votes.voters.splice(idx, 1);
      rec.votes.count = Math.max(0, rec.votes.count - 1);
      action = 'removed';
    }

    await rec.save();
    res.json({ success: true, action, voteCount: rec.votes.count });
  } catch (err) {
    next(err);
  }
};

// ───────────────────────────────────────────────────────
// POST /api/reclamations/:id/comments
// Add a comment to a reclamation
// ───────────────────────────────────────────────────────
// Inappropriate keywords — auto-reject comments containing these
const BANNED_WORDS = [
  'spam', 'pub', 'casino', 'viagra', 'porn', 'xxx', 'arnaque', 'escroquerie',
  'idiot', 'imbecile', 'stupide', 'connard', 'salaud', 'merde', 'putain',
  'raciste', 'racism', 'terroriste', 'bombe', 'tuer', 'mort à', 'catastrophe'
];

function containsBannedWords(text) {
  const lower = text.toLowerCase();
  return BANNED_WORDS.some(w => lower.includes(w));
}

exports.addComment = async (req, res, next) => {
  try {
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ success: false, message: 'Le commentaire est vide.' });

    // ── Moderation check ──────────────────────────────
    if (containsBannedWords(text)) {
      return res.status(422).json({
        success: false,
        message: 'Commentaire refusé : contenu inapproprié détecté.',
      });
    }

    const rec = await Reclamation.findById(req.params.id);
    if (!rec) return res.status(404).json({ success: false, message: 'Réclamation introuvable.' });

    rec.comments.push({
      author: req.user._id,
      text: text.trim(),
      isStaff: ['Agent', 'Admin'].includes(req.user.role),
    });

    await rec.save();

    const updated = await Reclamation.findById(rec._id)
      .populate('comments.author', 'firstName lastName role');

    res.status(201).json({
      success: true,
      message: 'Commentaire ajouté.',
      data: updated.comments[updated.comments.length - 1],
    });
  } catch (err) {
    next(err);
  }
};

// ───────────────────────────────────────────────────────
// DELETE /api/reclamations/:id
// Admin only — hard delete
// ───────────────────────────────────────────────────────
exports.deleteReclamation = async (req, res, next) => {
  try {
    const rec = await Reclamation.findByIdAndDelete(req.params.id);
    if (!rec) return res.status(404).json({ success: false, message: 'Réclamation introuvable.' });

    console.log(`[Reclamation] Deleted: ${req.params.id} | By: ${req.user.email}`);
    res.json({ success: true, message: 'Réclamation supprimée.' });
  } catch (err) {
    next(err);
  }
};

// ───────────────────────────────────────────────────────
// DELETE /api/reclamations/:id/comments/:commentId
// Admin only — remove inappropriate comment
// ───────────────────────────────────────────────────────
exports.deleteComment = async (req, res, next) => {
  try {
    const rec = await Reclamation.findById(req.params.id);
    if (!rec) return res.status(404).json({ success: false, message: 'Réclamation introuvable.' });

    const comment = rec.comments.id(req.params.commentId);
    if (!comment) return res.status(404).json({ success: false, message: 'Commentaire introuvable.' });

    comment.deleteOne();
    await rec.save();

    res.json({ success: true, message: 'Commentaire supprimé.' });
  } catch (err) { next(err); }
};

// ───────────────────────────────────────────────────────
// GET /api/reclamations/cancel-via-email
// Cancel via email link (with JWT token)
// ───────────────────────────────────────────────────────
exports.cancelViaEmail = async (req, res, next) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).send('<h1>Lien invalide ou expiré</h1>');

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(400).send('<h1 style="color:red; font-family:sans-serif; text-align:center; padding: 50px;">Ce lien d\'annulation a expiré (limite de 2 heures dépassée).</h1>');
      }
      return res.status(400).send('<h1 style="color:red; font-family:sans-serif; text-align:center; padding: 50px;">Lien invalide ou altéré.</h1>');
    }

    if (decoded.type !== 'reclamation') {
      return res.status(400).send('<h1 style="color:red; font-family:sans-serif; text-align:center; padding: 50px;">Type de demande incorrect.</h1>');
    }

    const rec = await Reclamation.findById(decoded.id);
    if (!rec) return res.status(404).send('<h1 style="color:red; font-family:sans-serif; text-align:center; padding: 50px;">Réclamation introuvable.</h1>');

    if (!['Pending', 'In Progress'].includes(rec.status)) {
      return res.send(`
        <div style="font-family: Arial, sans-serif; text-align: center; max-width: 500px; margin: 40px auto; color: #333; padding: 30px; border: 1px solid #eee; border-radius: 10px;">
          <h1 style="color: #F1AC4D; margin-bottom: 20px;">Impossible d'annuler</h1>
          <p style="font-size: 16px;">Cette réclamation a déjà été traitée ou annulée (Statut : ${rec.status}).</p>
        </div>
      `);
    }

    rec.status = 'Cancelled';
    rec.timeline.push({
      event: 'Réclamation annulée par le citoyen (via email)',
      performedBy: rec.citizen,
      fromStatus: rec.status,
      toStatus: 'Cancelled',
    });
    
    await rec.save();

    res.send(`
      <div style="font-family: Arial, sans-serif; text-align: center; max-width: 500px; margin: 40px auto; color: #333; padding: 30px; border: 1px solid #eee; border-radius: 10px; background-color: #F8FFF9; border-color: #D4EDDA;">
        <h1 style="color: #1D8C5E; margin-bottom: 20px;">Annulation confirmée</h1>
        <p style="font-size: 16px;">Votre réclamation a bien été annulée.</p>
        <p style="font-size: 14px; color: #777; margin-top: 20px;">Vous pouvez fermer cette fenêtre.</p>
      </div>
    `);

  } catch (err) {
    next(err);
  }
};
