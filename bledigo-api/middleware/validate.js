'use strict';

const { body, validationResult } = require('express-validator');

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      message: 'Données invalides.',
      errors: errors.array().map(e => ({ field: e.path, message: e.msg })),
    });
  }
  next();
}

const loginRules = [
  // NOTE: NO normalizeEmail() — it strips dots from Gmail addresses
  // e.g. oussama.mahmoudi813@gmail.com → oussamamahmoudi813@gmail.com
  // which breaks login for anyone with a dot in their Gmail address.
  body('email')
    .trim()
    .isEmail().withMessage('Adresse email invalide.')
    .customSanitizer(v => v.toLowerCase().trim()),   // only lowercase+trim, no dot-stripping
  body('password')
    .notEmpty().withMessage('Le mot de passe est requis.'),
  body('role')
    .isIn(['Admin', 'Agent', 'Citoyen']).withMessage('Rôle invalide.'),
];

const registerRules = [
  body('firstName')
    .trim().notEmpty().withMessage('Le prénom est requis.')
    .isLength({ min: 2, max: 50 }).withMessage('Prénom : 2-50 caractères.'),
  body('lastName')
    .trim().notEmpty().withMessage('Le nom est requis.')
    .isLength({ min: 2, max: 50 }).withMessage('Nom : 2-50 caractères.'),
  body('email')
    .trim()
    .isEmail().withMessage('Adresse email invalide.')
    .customSanitizer(v => v.toLowerCase().trim()),
  body('password')
    .isLength({ min: 8 }).withMessage('Le mot de passe doit contenir au moins 8 caractères.'),
  body('cin')
    .optional({ checkFalsy: true })
    .matches(/^\d{8}$/).withMessage('CIN invalide (8 chiffres).'),
  // Role: only Citoyen or Agent allowed via public register — Admin is forbidden
  body('role')
    .optional({ checkFalsy: true })
    .isIn(['Citoyen', 'Agent']).withMessage('Rôle invalide pour l\'inscription.'),
  body('department')
    .optional({ checkFalsy: true })
    .trim().isLength({ max: 100 }).withMessage('Département trop long.'),
];

const reclamationRules = [
  body('title')
    .trim().notEmpty().withMessage('Le titre est requis.')
    .isLength({ min: 5, max: 120 }),
  body('description')
    .trim().notEmpty().withMessage('La description est requise.')
    .isLength({ min: 20, max: 2000 }),
  body('category')
    .notEmpty().withMessage('La catégorie est requise.'),
];

module.exports = { validate, loginRules, registerRules, reclamationRules };
