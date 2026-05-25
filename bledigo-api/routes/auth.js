'use strict';
const { Router } = require('express');
const ctrl = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { loginRules, registerRules, validate } = require('../middleware/validate');

const router = Router();
router.post('/send-verification', validate, ctrl.sendVerification);
router.post('/forgot-password-code', validate, ctrl.forgotPasswordCode);
router.post('/verify-reset-code', validate, ctrl.verifyResetCode);
router.post('/reset-password', validate, ctrl.resetPassword);
router.post('/register', registerRules, validate, ctrl.register);
router.post('/login',    loginRules,    validate, ctrl.login);
router.get( '/me',       protect,               ctrl.getMe);
router.post('/change-password', protect,         ctrl.changePassword);
module.exports = router;
