'use strict';
const { Router } = require('express');
const ctrl = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { loginRules, registerRules, validate } = require('../middleware/validate');

const router = Router();
router.post('/register', registerRules, validate, ctrl.register);
router.post('/login',    loginRules,    validate, ctrl.login);
router.get( '/me',       protect,               ctrl.getMe);
router.post('/change-password', protect,         ctrl.changePassword);
module.exports = router;
