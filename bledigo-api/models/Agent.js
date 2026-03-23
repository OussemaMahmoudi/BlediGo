'use strict';

/**
 * Agent model  →  MongoDB collection: "agents"
 * ──────────────────────────────────────────────
 * Created by Admin only via POST /api/users/agents.
 * Public API cannot create agent accounts.
 */

const mongoose       = require('mongoose');
const passwordPlugin = require('./_passwordPlugin');

const AgentSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: [true, 'Le prénom est obligatoire.'], trim: true, minlength: 2, maxlength: 50 },
    lastName:  { type: String, required: [true, 'Le nom est obligatoire.'],    trim: true, minlength: 2, maxlength: 50 },
    email: {
      type: String, required: [true, "L'email est obligatoire."],
      unique: true, lowercase: true, trim: true,
      validate: { validator: v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), message: 'Email invalide.' },
    },
    password:       { type: String, required: true, select: false },
    role:           { type: String, default: 'Agent', immutable: true },
    department:     { type: String, trim: true, default: 'Direction Technique' },
    specialization: { type: [String], default: [] },
    municipality:   { type: String, trim: true, default: 'Tunis' },
    phone:          { type: String, trim: true },
    isActive:       { type: Boolean, default: true },
    lastLogin:      { type: Date },
  },
  {
    timestamps: true,
    collection: 'agents',   // ← explicit collection name
    toJSON: {
      virtuals: true,
      transform: (_d, ret) => { delete ret.password; delete ret.__v; return ret; },
    },
  }
);

AgentSchema.virtual('fullName').get(function () { return `${this.firstName} ${this.lastName}`; });
AgentSchema.virtual('initials').get(function () { return `${this.firstName[0]}${this.lastName[0]}`.toUpperCase(); });

AgentSchema.index({ isActive: 1 });
AgentSchema.index({ department: 1 });

AgentSchema.plugin(passwordPlugin);
module.exports = mongoose.model('Agent', AgentSchema);
