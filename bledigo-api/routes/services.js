'use strict';

const { Router } = require('express');
const { body }   = require('express-validator');
const ctrl       = require('../controllers/serviceController');
const { protect, authorize } = require('../middleware/auth');

const router = Router();

const createRules = [
  body('name')    .trim().notEmpty().withMessage('Le nom est requis.').isLength({ min: 3, max: 100 }),
  body('category').notEmpty().withMessage('La catégorie est requise.'),
];

// ── Public / Citizen ────────────────────────────────────
router.get('/',    ctrl.getAllServices);
router.get('/:id', ctrl.getServiceById);

router.post('/:id/demand',
  protect,
  authorize('Citoyen'),
  ctrl.submitDemand
);

router.post('/:id/rate',
  protect,
  authorize('Citoyen'),
  body('score').isInt({ min: 1, max: 5 }).withMessage('Note entre 1 et 5.'),
  ctrl.rateService
);

// ── Agent / Admin ────────────────────────────────────────
router.patch('/:id/demand/:demandId',
  protect,
  authorize('Admin', 'Agent'),
  ctrl.processDemand
);

// ── Admin only ───────────────────────────────────────────
router.post('/',
  protect,
  authorize('Admin'),
  createRules,
  ctrl.createService
);

router.patch('/:id',
  protect,
  authorize('Admin'),
  ctrl.updateService
);

router.delete('/:id',
  protect,
  authorize('Admin'),
  ctrl.deleteService
);

module.exports = router;
