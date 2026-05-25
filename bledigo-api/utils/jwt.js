'use strict';

const jwt = require('jsonwebtoken');

function signToken(payload, expiresIn) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: expiresIn || process.env.JWT_EXPIRES_IN || '7d',
  });
}

/**
 * sendToken
 * ─────────
 * Builds the auth response. The `role` field is passed explicitly
 * because Mongoose schema defaults are not always populated on
 * documents fetched with .select('+password') or from native MongoClient.
 *
 * @param {object} user      – Mongoose/raw user document
 * @param {number} statusCode
 * @param {object} res
 * @param {string} [roleOverride] – explicit role when user.role may be undefined
 */
function sendToken(user, statusCode, res, roleOverride) {
  // Determine role — fallback chain so it is NEVER undefined
  const role = roleOverride || user.role || user.roleName || 'Citoyen';

  const token = signToken({ id: user._id, role });

  res.status(statusCode).json({
    success: true,
    token,
    user: {
      id:           user._id,
      firstName:    user.firstName,
      lastName:     user.lastName,
      fullName:     user.fullName || `${user.firstName} ${user.lastName}`,
      email:        user.email,
      role,                        // ← always present, never undefined
      municipality: user.municipality,
      avatarUrl:    user.avatarUrl || null,
      isActive:     user.isActive,
    },
  });
}

module.exports = { signToken, sendToken };