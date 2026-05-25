'use strict';

/**
 * Messages routes
 * ───────────────
 * POST /api/messages                    → send a message
 * GET  /api/messages/conversations      → list unique conversation partners
 * GET  /api/messages/thread/:userId     → messages with a specific user
 * PATCH /api/messages/thread/:userId/read → mark all messages in thread as read
 * GET  /api/messages/contacts           → get available contacts (role-based)
 */

const { Router } = require('express');
const { body }   = require('express-validator');
const Message    = require('../models/Message');
const Reclamation = require('../models/Reclamation');
const Agent      = require('../models/Agent');
const Admin      = require('../models/Admin');
const Citoyen    = require('../models/Citoyen');
const { protect, authorize } = require('../middleware/auth');

const router = Router();

// ── Helper: get user info from any collection ────────────
async function getUserInfo(id, role) {
  const Model = { Admin, Agent, Citoyen }[role];
  if (!Model) return null;
  const user = await Model.findById(id).select('firstName lastName email role');
  if (!user) return null;
  return {
    _id:       user._id,
    firstName: user.firstName,
    lastName:  user.lastName,
    email:     user.email,
    role:      role,
    name:      `${user.firstName} ${user.lastName}`.trim(),
  };
}

// ── Helper: check if sender is allowed to message receiver ─
async function canMessage(sender, receiverId, receiverRole) {
  const sid  = String(sender._id);
  const sRole = sender.role;

  if (sRole === 'Admin') {
    // Admin can message everyone
    return true;
  }

  if (sRole === 'Agent') {
    // Agent can message: Admin, or any Citoyen who has a reclamation assigned to this agent
    if (receiverRole === 'Admin') return true;
    if (receiverRole === 'Citoyen') {
      const rec = await Reclamation.findOne({
        assignedAgent: sender._id,
        citizen: receiverId,
      });
      return !!rec;
    }
    return false;
  }

  if (sRole === 'Citoyen') {
    // Citoyen can message:
    //  - Agents who are assigned to their reclamations
    //  - Admin ONLY if admin has sent the citoyen a message first
    if (receiverRole === 'Agent') {
      const rec = await Reclamation.findOne({
        citizen:       sender._id,
        assignedAgent: receiverId,
      });
      return !!rec;
    }
    if (receiverRole === 'Admin') {
      // Admin must have texted first
      const adminMsg = await Message.findOne({
        senderId:   receiverId,   // admin
        receiverId: sender._id,   // citoyen
      });
      return !!adminMsg;
    }
    return false;
  }

  return false;
}

// ─────────────────────────────────────────────────────────
// GET /api/messages/contacts — available contacts for current user
// ─────────────────────────────────────────────────────────
router.get('/contacts', protect, async (req, res, next) => {
  try {
    const me    = req.user;
    const meId  = String(me._id);
    const contacts = [];

    if (me.role === 'Admin') {
      // Admin sees all agents + all citoyens
      const [agents, citoyens] = await Promise.all([
        Agent.find({ isActive: true }).select('firstName lastName email role'),
        Citoyen.find({ isActive: { $ne: false } }).select('firstName lastName email'),
      ]);
      agents.forEach(a => contacts.push({ _id: a._id, name: `${a.firstName} ${a.lastName}`.trim(), role: 'Agent', email: a.email }));
      citoyens.forEach(c => contacts.push({ _id: c._id, name: `${c.firstName} ${c.lastName}`.trim(), role: 'Citoyen', email: c.email }));
    }

    if (me.role === 'Agent') {
      // Agent sees: Admin + citoyens who have reclamations assigned to this agent
      const [admins, recs] = await Promise.all([
        Admin.find({}).select('firstName lastName email'),
        Reclamation.find({ assignedAgent: me._id }).populate('citizen', 'firstName lastName email').select('citizen'),
      ]);
      admins.forEach(a => contacts.push({ _id: a._id, name: `${a.firstName} ${a.lastName}`.trim(), role: 'Admin', email: a.email }));
      const seen = new Set();
      recs.forEach(r => {
        const c = r.citizen;
        if (c && !seen.has(String(c._id))) {
          seen.add(String(c._id));
          contacts.push({ _id: c._id, name: `${c.firstName} ${c.lastName}`.trim(), role: 'Citoyen', email: c.email });
        }
      });
    }

    if (me.role === 'Citoyen') {
      // Citoyen sees: agents from their reclamations + Admin if admin texted first
      const [recs, adminFirstMsg] = await Promise.all([
        Reclamation.find({ citizen: me._id, assignedAgent: { $ne: null } })
          .populate('assignedAgent', 'firstName lastName email')
          .select('assignedAgent'),
        // Check if any admin has sent a message to this citoyen
        Admin.find({}).select('_id firstName lastName email').then(async (admins) => {
          const results = [];
          for (const admin of admins) {
            const msg = await Message.findOne({ senderId: admin._id, receiverId: me._id }).lean();
            if (msg) results.push(admin);
          }
          return results;
        }),
      ]);

      const seen = new Set();
      recs.forEach(r => {
        const a = r.assignedAgent;
        if (a && !seen.has(String(a._id))) {
          seen.add(String(a._id));
          contacts.push({ _id: a._id, name: `${a.firstName} ${a.lastName}`.trim(), role: 'Agent', email: a.email });
        }
      });
      adminFirstMsg.forEach(admin => {
        contacts.push({ _id: admin._id, name: `${admin.firstName} ${admin.lastName}`.trim(), role: 'Admin', email: admin.email });
      });
    }

    res.json({ success: true, data: contacts });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────
// GET /api/messages/conversations — list threads with unread count
// ─────────────────────────────────────────────────────────
router.get('/conversations', protect, async (req, res, next) => {
  try {
    const me = req.user;

    // Get all messages where I am sender OR receiver
    const msgs = await Message.find({
      $or: [{ senderId: me._id }, { receiverId: me._id }],
    }).sort({ createdAt: -1 }).lean();

    // Build a map of unique partners: partnerId → { lastMsg, unreadCount }
    const threads = new Map();

    for (const msg of msgs) {
      const isSender  = String(msg.senderId) === String(me._id);
      const partnerId = String(isSender ? msg.receiverId : msg.senderId);
      const partnerRole = isSender ? msg.receiverRole : msg.senderRole;

      if (!threads.has(partnerId)) {
        threads.set(partnerId, {
          partnerId,
          partnerRole,
          lastMsg:     msg,
          unreadCount: 0,
        });
      }

      // Count unread messages sent to me
      if (!isSender && !msg.isRead) {
        threads.get(partnerId).unreadCount++;
      }
    }

    // Enrich with partner info
    const conversations = [];
    for (const [partnerId, thread] of threads) {
      const info = await getUserInfo(partnerId, thread.partnerRole);
      if (info) {
        conversations.push({
          partner:       info,
          lastMessage:   thread.lastMsg,
          unreadCount:   thread.unreadCount,
        });
      }
    }

    // Sort by last message date
    conversations.sort((a, b) => new Date(b.lastMessage.createdAt) - new Date(a.lastMessage.createdAt));

    res.json({ success: true, data: conversations });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────
// GET /api/messages/thread/:partnerId?role=Agent
// ─────────────────────────────────────────────────────────
router.get('/thread/:partnerId', protect, async (req, res, next) => {
  try {
    const me        = req.user;
    const partnerId = req.params.partnerId;

    const msgs = await Message.find({
      $or: [
        { senderId: me._id,    receiverId: partnerId },
        { senderId: partnerId, receiverId: me._id   },
      ],
    }).sort({ createdAt: 1 }).lean();

    // Mark messages sent to me as read
    await Message.updateMany(
      { senderId: partnerId, receiverId: me._id, isRead: false },
      { isRead: true }
    );

    res.json({ success: true, data: msgs });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────
// POST /api/messages — send a message
// ─────────────────────────────────────────────────────────
router.post('/',
  protect,
  body('text').trim().notEmpty().withMessage('Le message ne peut pas être vide.'),
  body('receiverId').isMongoId().withMessage('Destinataire invalide.'),
  body('receiverRole').isIn(['Admin', 'Agent', 'Citoyen']).withMessage('Rôle destinataire invalide.'),
  async (req, res, next) => {
    try {
      const me = req.user;
      const { text, receiverId, receiverRole, reclamationId } = req.body;

      // Check permission
      const allowed = await canMessage(me, receiverId, receiverRole);
      if (!allowed) {
        return res.status(403).json({
          success: false,
          message: 'Vous ne pouvez pas envoyer un message à cet utilisateur.',
        });
      }

      const msg = await Message.create({
        senderId:      me._id,
        senderRole:    me.role,
        receiverId,
        receiverRole,
        text,
        reclamationId: reclamationId || undefined,
      });

      res.status(201).json({ success: true, data: msg });
    } catch (err) { next(err); }
  }
);

// ─────────────────────────────────────────────────────────
// GET /api/messages/unread-count — quick badge count
// ─────────────────────────────────────────────────────────
router.get('/unread-count', protect, async (req, res, next) => {
  try {
    const count = await Message.countDocuments({
      receiverId: req.user._id,
      isRead:     false,
    });
    res.json({ success: true, data: { count } });
  } catch (err) { next(err); }
});

module.exports = router;
