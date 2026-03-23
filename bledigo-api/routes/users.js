'use strict';

const { Router } = require('express');
const ctrl       = require('../controllers/userController');
const { protect, authorize } = require('../middleware/auth');

const router = Router();

// ── Admin statistics ────────────────────────────────────
router.get('/stats',
  protect,
  authorize('Admin'),
  ctrl.getUserStats
);

// ── Admin: list all users ───────────────────────────────
router.get('/',
  protect,
  authorize('Admin'),
  ctrl.getAllUsers
);

// ── Any authenticated user: view/edit profile ───────────
router.get('/:id',
  protect,
  ctrl.getUserById
);

router.patch('/:id',
  protect,
  ctrl.updateUser
);

// ── Admin only ───────────────────────────────────────────
router.patch('/:id/toggle-active',
  protect,
  authorize('Admin'),
  ctrl.toggleActive
);

router.delete('/:id',
  protect,
  authorize('Admin'),
  ctrl.deleteUser
);

module.exports = router;
