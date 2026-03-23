'use strict';

const { Router } = require('express');
const { body }   = require('express-validator');
const ctrl       = require('../controllers/reclamationController');
const { protect, authorize, optionalAuth } = require('../middleware/auth');
const upload     = require('../middleware/upload');

const router = Router();

// ── Validation rules ────────────────────────────────────
const createRules = [
  body('title')      .trim().notEmpty().withMessage('Le titre est requis.').isLength({ min: 5, max: 120 }),
  body('description').trim().notEmpty().withMessage('La description est requise.').isLength({ min: 20, max: 2000 }),
  body('category')   .notEmpty().withMessage('La catégorie est requise.'),
  body('location.address').optional().trim(),
];

// ── Public routes (no auth) ─────────────────────────────
router.get('/public',       optionalAuth, ctrl.getPublicFeed);

// ── Citizen routes ──────────────────────────────────────
router.post('/',
  protect,
  authorize('Citoyen'),
  upload.array('images', 5),
  createRules,
  ctrl.createReclamation
);

router.get('/my-history',
  protect,
  authorize('Citoyen'),
  ctrl.getMyHistory
);

router.post('/:id/vote',
  protect,
  ctrl.vote
);

router.post('/:id/comments',
  protect,
  body('text').trim().notEmpty().withMessage('Le commentaire ne peut pas être vide.'),
  ctrl.addComment
);

// ── Admin & Agent routes ─────────────────────────────────
router.get('/all',
  protect,
  authorize('Admin', 'Agent'),
  ctrl.getAllReclamations
);

router.get('/:id',
  protect,
  ctrl.getReclamationById
);

router.patch('/:id/status',
  protect,
  authorize('Admin', 'Agent'),
  body('status').notEmpty().withMessage('Le statut est requis.'),
  ctrl.updateStatus
);

router.patch('/:id/assign',
  protect,
  authorize('Admin'),
  body('agentId').notEmpty().withMessage("L'ID de l'agent est requis.").isMongoId(),
  ctrl.assignAgent
);

// ── Admin only ───────────────────────────────────────────
router.delete('/:id',
  protect,
  authorize('Admin'),
  ctrl.deleteReclamation
);

// ── Admin: delete a specific comment ────────────────────
router.delete('/:id/comments/:commentId',
  protect,
  authorize('Admin'),
  ctrl.deleteComment
);

module.exports = router;

// ── Citizen: cancel own reclamation (within 2h) ─────────
router.patch('/:id/cancel',
  protect,
  authorize('Citoyen'),
  async (req, res, next) => {
    try {
      const rec = await require('../models/Reclamation').findById(req.params.id);
      if (!rec) return res.status(404).json({ success: false, message: 'Réclamation introuvable.' });

      // Must be owner
      if (!rec.citizen.equals(req.user._id)) {
        return res.status(403).json({ success: false, message: 'Accès refusé.' });
      }
      // Only cancellable if Pending or In Progress
      if (!['Pending', 'In Progress'].includes(rec.status)) {
        return res.status(400).json({ success: false, message: 'Cette réclamation ne peut plus être annulée.' });
      }
      // 2-hour window
      const TWO_HOURS = 2 * 60 * 60 * 1000;
      if (Date.now() - new Date(rec.createdAt) > TWO_HOURS) {
        return res.status(400).json({ success: false, message: 'Délai d\'annulation dépassé (2 heures).' });
      }

      rec.status = 'Cancelled';
      rec.timeline.push({
        event:       'Réclamation annulée par le citoyen',
        performedBy: req.user._id,
        fromStatus:  rec.status,
        toStatus:    'Cancelled',
      });
      await rec.save();

      res.json({ success: true, message: 'Réclamation annulée avec succès.', data: rec });
    } catch (err) { next(err); }
  }
);
