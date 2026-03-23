'use strict';

const { Router } = require('express');
const ctrl       = require('../controllers/notificationController');
const { protect } = require('../middleware/auth');

const router = Router();

router.get('/',               protect, ctrl.getMyNotifications);
router.patch('/read-all',     protect, ctrl.markAllRead);
router.patch('/:id/read',     protect, ctrl.markRead);

module.exports = router;
