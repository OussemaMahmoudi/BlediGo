'use strict';

const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema(
  {
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      enum: [
        'reclamation_submitted',
        'reclamation_assigned',
        'reclamation_status_changed',
        'reclamation_resolved',
        'reclamation_overdue',
        'comment_added',
        'service_demand_accepted',
        'service_demand_rejected',
        'message_received',
        'account_activated',
        'system',
      ],
      required: true,
    },
    title:   { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    link:    { type: String },  // frontend route to navigate to
    isRead:  { type: Boolean, default: false },
    readAt:  { type: Date },
    // Reference to the related document
    ref: {
      model: { type: String }, // 'Reclamation' | 'Service' | etc.
      id:    { type: mongoose.Schema.Types.ObjectId },
    },
  },
  {
    timestamps: true,
    toJSON: { transform: (_d, ret) => { delete ret.__v; return ret; } },
  }
);

NotificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
NotificationSchema.index({ recipient: 1, createdAt: -1 });

// ── Static: create & save a notification ───────────────
NotificationSchema.statics.notify = async function (data) {
  try {
    return await this.create(data);
  } catch (err) {
    console.error('[Notification] Failed to create:', err.message);
    return null;
  }
};

module.exports = mongoose.model('Notification', NotificationSchema);
