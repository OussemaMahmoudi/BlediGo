'use strict';

/**
 * Shared password plugin — applied to Admin, Agent, Citoyen models.
 * - Hashes password with bcrypt (12 rounds) before every save
 * - Provides comparePassword() instance method
 */

const bcrypt = require('bcryptjs');

module.exports = function passwordPlugin(schema) {

  // ── Hash on save (only when password field is modified) ─
  schema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    try {
      this.password = await bcrypt.hash(this.password, 12);
      next();
    } catch (err) { next(err); }
  });

  // ── Compare plain-text candidate against stored hash ───
  schema.methods.comparePassword = function (candidate) {
    return bcrypt.compare(candidate, this.password);
  };
};
