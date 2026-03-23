'use strict';

/**
 * Admin model  →  MongoDB collection: "admins"
 * Only ONE admin. Created only via scripts/create-admin.js.
 * Public API cannot create or modify admin accounts.
 */

const mongoose       = require('mongoose');
const passwordPlugin = require('./_passwordPlugin');

const AdminSchema = new mongoose.Schema(
  {
    firstName:    { type: String, required: true, trim: true },
    lastName:     { type: String, required: true, trim: true },
    email: {
      type: String, required: true, unique: true,
      lowercase: true, trim: true,
      validate: { validator: v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), message: 'Email invalide.' },
    },
    password:     { type: String, required: true, select: false },
    role:         { type: String, default: 'Admin', immutable: true },
    municipality: { type: String, default: 'Tunis', trim: true },
    department:   { type: String, default: 'Administration', trim: true },
    isActive:     { type: Boolean, default: true },
    lastLogin:    { type: Date },
  },
  {
    timestamps: true,
    collection: 'admins',
    toJSON: {
      virtuals: true,
      transform: (_d, ret) => { delete ret.password; delete ret.__v; return ret; },
    },
  }
);

AdminSchema.virtual('fullName').get(function () { return `${this.firstName} ${this.lastName}`; });
AdminSchema.plugin(passwordPlugin);
module.exports = mongoose.model('Admin', AdminSchema);
