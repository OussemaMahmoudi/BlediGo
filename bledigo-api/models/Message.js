'use strict';

const mongoose = require('mongoose');

/**
 * Message model
 * ─────────────
 * Represents a single message in a conversation thread.
 * 
 * Access rules (enforced in controller):
 *  - Citoyen → can send to agents assigned to their reclamations, or to Admin if Admin texted first
 *  - Agent   → can send to any Citoyen assigned to them, or to Admin
 *  - Admin   → can send to any Agent or Citoyen
 */

const MessageSchema = new mongoose.Schema(
  {
    // ── Participants ────────────────────────────────────
    senderId:   { type: mongoose.Schema.Types.ObjectId, required: true },
    senderRole: { type: String, enum: ['Admin', 'Agent', 'Citoyen'], required: true },

    receiverId:   { type: mongoose.Schema.Types.ObjectId, required: true },
    receiverRole: { type: String, enum: ['Admin', 'Agent', 'Citoyen'], required: true },

    // ── Content ─────────────────────────────────────────
    text: {
      type:      String,
      required:  [true, 'Le message ne peut pas être vide.'],
      trim:      true,
      maxlength: [2000, 'Message trop long.'],
    },

    // ── State ───────────────────────────────────────────
    isRead: { type: Boolean, default: false },

    // ── Optional context link ────────────────────────────
    reclamationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Reclamation' },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true, transform: (_d, ret) => { delete ret.__v; return ret; } },
  }
);

// ── Indexes for fast thread queries ─────────────────────
MessageSchema.index({ senderId: 1, receiverId: 1, createdAt: -1 });
MessageSchema.index({ receiverId: 1, isRead: 1 });

module.exports = mongoose.model('Message', MessageSchema);
