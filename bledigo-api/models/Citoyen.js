'use strict';

/**
 * Citoyen model  →  MongoDB collection: "citoyens"
 * ──────────────────────────────────────────────────
 * Created by public self-registration via POST /api/auth/register.
 * Email must be unique across ALL three collections (checked in controller).
 */

const mongoose       = require('mongoose');
const passwordPlugin = require('./_passwordPlugin');

const CitoyenSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: [true, 'Le prénom est obligatoire.'], trim: true, minlength: 2, maxlength: 50 },
    lastName:  { type: String, required: [true, 'Le nom est obligatoire.'],    trim: true, minlength: 2, maxlength: 50 },
    email: {
      type: String, required: [true, "L'email est obligatoire."],
      unique: true, lowercase: true, trim: true,
      validate: { validator: v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), message: 'Email invalide.' },
    },
    password:  { type: String, required: true, select: false },
    role:      { type: String, default: 'Citoyen', immutable: true },

    // Citizen-specific fields
    cin: {
      type: String, unique: true, sparse: true, trim: true,
      validate: { validator: v => !v || /^\d{8}$/.test(v), message: 'CIN invalide (8 chiffres).' },
    },
    phone:        { type: String, trim: true },
    municipality: { type: String, trim: true, default: 'Tunis' },
    address:      { type: String, trim: true },
    isActive:     { type: Boolean, default: true },
    lastLogin:    { type: Date },
  },
  {
    timestamps: true,
    collection: 'citoyens',   // ← explicit collection name
    toJSON: {
      virtuals: true,
      transform: (_d, ret) => { delete ret.password; delete ret.__v; return ret; },
    },
  }
);

CitoyenSchema.virtual('fullName').get(function () { return `${this.firstName} ${this.lastName}`; });
CitoyenSchema.virtual('initials').get(function () { return `${this.firstName[0]}${this.lastName[0]}`.toUpperCase(); });

CitoyenSchema.index({ municipality: 1 });
CitoyenSchema.index({ isActive: 1 });

CitoyenSchema.plugin(passwordPlugin);
module.exports = mongoose.model('Citoyen', CitoyenSchema);
