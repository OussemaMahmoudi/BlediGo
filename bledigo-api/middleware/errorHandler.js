'use strict';

const mongoose = require('mongoose');

/**
 * Global Express error handler.
 * Normalises Mongoose, JWT, and custom errors into consistent JSON responses.
 */
function errorHandler(err, _req, res, _next) {
  let status  = err.statusCode || err.status || 500;
  let message = err.message    || 'Erreur interne du serveur.';
  let errors  = undefined;

  // ── Mongoose validation error ───────────────────────
  if (err instanceof mongoose.Error.ValidationError) {
    status  = 422;
    message = 'Données invalides.';
    errors  = Object.values(err.errors).map(e => ({
      field:   e.path,
      message: e.message,
    }));
  }

  // ── Mongoose cast error (bad ObjectId) ──────────────
  if (err instanceof mongoose.Error.CastError) {
    status  = 400;
    message = `Identifiant invalide pour le champ "${err.path}".`;
  }

  // ── MongoDB duplicate key ───────────────────────────
  if (err.code === 11000) {
    status  = 409;
    const field = Object.keys(err.keyValue || {})[0] || 'champ';
    message = `La valeur du champ "${field}" est déjà utilisée.`;
  }

  // ── JWT errors ──────────────────────────────────────
  if (err.name === 'JsonWebTokenError')  { status = 401; message = 'Token JWT invalide.'; }
  if (err.name === 'TokenExpiredError')  { status = 401; message = 'Session expirée.'; }

  // ── CORS error ──────────────────────────────────────
  if (err.message?.startsWith('CORS:')) { status = 403; }

  // ── Multer (file upload) ────────────────────────────
  if (err.code === 'LIMIT_FILE_SIZE') {
    status  = 413;
    message = `Fichier trop volumineux (max ${process.env.MAX_FILE_SIZE_MB || 5} MB).`;
  }

  // ── Log server errors ───────────────────────────────
  if (status >= 500) {
    console.error('[Error]', err.stack || err.message);
  }

  res.status(status).json({
    success: false,
    message,
    ...(errors && { errors }),
    ...(process.env.NODE_ENV === 'development' && status >= 500 && { stack: err.stack }),
  });
}

/**
 * Async wrapper – catches errors from async route handlers
 * so you don't need try/catch everywhere.
 *
 * Usage: router.get('/path', asyncHandler(async (req, res) => { … }))
 */
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

module.exports = errorHandler;
module.exports.asyncHandler = asyncHandler;
