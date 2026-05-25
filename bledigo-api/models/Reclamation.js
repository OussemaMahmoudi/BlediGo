'use strict';

const mongoose = require('mongoose');

// ── Comment sub-schema ──────────────────────────────────
const CommentSchema = new mongoose.Schema(
  {
    author:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text:    { type: String, required: true, trim: true, maxlength: [1000, 'Commentaire trop long.'] },
    isStaff: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// ── Timeline event sub-schema ───────────────────────────
const TimelineEventSchema = new mongoose.Schema(
  {
    event:       { type: String, required: true },
    description: { type: String },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    fromStatus:  { type: String },
    toStatus:    { type: String },
  },
  { timestamps: true }
);

// ── Main Reclamation schema ─────────────────────────────
const ReclamationSchema = new mongoose.Schema(
  {
    // ── Core content ──────────────────────────────────
    title: {
      type:      String,
      required:  [true, 'Le titre est obligatoire.'],
      trim:      true,
      minlength: [5,  'Titre trop court (min 5 caractères).'],
      maxlength: [120,'Titre trop long (max 120 caractères).'],
    },
    description: {
      type:      String,
      required:  [true, 'La description est obligatoire.'],
      trim:      true,
      minlength: [20, 'Description trop courte (min 20 caractères).'],
      maxlength: [2000,'Description trop longue.'],
    },
    category: {
      type:    String,
      required:[true, 'La catégorie est obligatoire.'],
      enum: {
        values: [
          'Eclairage public',
          'Voirie & Routes',
          'Propreté & Déchets',
          'Espaces verts',
          'Eau & Assainissement',
          'Signalisation',
          'Bâtiments publics',
          'Transports',
          'Autre',
        ],
        message: 'Catégorie invalide.',
      },
    },

    // ── Location ──────────────────────────────────────
    location: {
      address:    { type: String, trim: true },
      district:   { type: String, trim: true },
      municipality:{ type: String, trim: true, default: 'Tunis' },
      coordinates: {
        // GeoJSON Point for future geo-queries
        type:        { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number], default: [10.1815, 36.8065] }, // [lng, lat] Tunis default
      },
    },

    // ── Media ─────────────────────────────────────────
    images: [{
      url:      { type: String, required: true },
      filename: { type: String },
      mimetype: { type: String },
      size:     { type: Number },
    }],

    // ── AI urgency classification ─────────────────────
    urgency: {
      level: {
        type:    String,
        enum:    ['Low', 'Medium', 'High', 'Critical'],
        default: 'Medium',
      },
      confidence:  { type: Number, min: 0, max: 1, default: 0 },
      reason:      { type: String },
      aiGenerated: { type: Boolean, default: false },
      // Keep the raw AI response for audit/debugging
      rawAiResponse: { type: mongoose.Schema.Types.Mixed, select: false },
    },

    // ── Status workflow ───────────────────────────────
    status: {
      type:    String,
      enum: {
        values:  ['Pending', 'In Progress', 'Resolved', 'Rejected', 'Cancelled'],
        message: 'Statut invalide.',
      },
      default: 'Pending',
    },
    resolvedAt: { type: Date },
    rejectedAt: { type: Date },
    rejectionReason: { type: String, trim: true },

    // ── People ────────────────────────────────────────
    citizen: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'Citoyen',
      required: [true, 'Le citoyen est obligatoire.'],
    },
    assignedAgent: {
      type: mongoose.Schema.Types.ObjectId,
      ref:  'Agent',
      // null = unassigned
    },
    assignedAt:  { type: Date },
    assignedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    // ── Community ─────────────────────────────────────
    votes: {
      count:   { type: Number, default: 0, min: 0 },
      voters:  [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    },
    isPublic: { type: Boolean, default: true },

    // ── Comments thread ───────────────────────────────
    comments: [CommentSchema],

    // ── Audit timeline ────────────────────────────────
    timeline: [TimelineEventSchema],

    // ── Agent resolution report ───────────────────────
    resolutionReport: {
      text:        { type: String, trim: true },
      submittedAt: { type: Date },
      rating:      { type: Number, min: 1, max: 5 },
      ratedAt:     { type: Date },
    },
  },
  {
    timestamps: true,  // createdAt, updatedAt
    toJSON:     { virtuals: true, transform: (_d, ret) => { delete ret.__v; return ret; } },
    toObject:   { virtuals: true },
  }
);

// ── Geo index for proximity searches ───────────────────
ReclamationSchema.index({ 'location.coordinates': '2dsphere' });

// ── Common query indexes ────────────────────────────────
ReclamationSchema.index({ citizen: 1, createdAt: -1 });
ReclamationSchema.index({ status: 1, 'urgency.level': 1 });
ReclamationSchema.index({ assignedAgent: 1, status: 1 });
ReclamationSchema.index({ category: 1, status: 1 });
ReclamationSchema.index({ isPublic: 1, createdAt: -1 });
ReclamationSchema.index({ 'urgency.level': 1, status: 1, createdAt: 1 }); // for overdue queries

// ── Virtual: is overdue (>48h unresolved) ──────────────
ReclamationSchema.virtual('isOverdue').get(function () {
  if (['Resolved', 'Rejected', 'Cancelled'].includes(this.status)) return false;
  const limitHours = this.urgency?.level === 'Critical' ? 12 : 48;
  return (Date.now() - this.createdAt) > limitHours * 60 * 60 * 1000;
});

// ── Virtual: vote count (convenience) ──────────────────
ReclamationSchema.virtual('voteCount').get(function () {
  return this.votes?.count ?? 0;
});

// ── Pre-save: push timeline event on status change ─────
ReclamationSchema.pre('save', function (next) {
  if (this.isModified('status')) {
    if (this.status === 'Resolved') this.resolvedAt = new Date();
    if (this.status === 'Rejected') this.rejectedAt = new Date();
  }
  next();
});

// ── Static: overdue reclamations ───────────────────────
ReclamationSchema.statics.findOverdue = function () {
  const cutoff48h = new Date(Date.now() - 48 * 60 * 60 * 1000);
  return this.find({
    status: { $in: ['Pending', 'In Progress'] },
    createdAt: { $lt: cutoff48h },
  }).populate('citizen assignedAgent', 'firstName lastName email');
};

module.exports = mongoose.model('Reclamation', ReclamationSchema);
