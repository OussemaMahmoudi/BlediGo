'use strict';

const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

// ── Schedule sub-schema ─────────────────────────────────
const ScheduleSchema = new mongoose.Schema(
  {
    days:      { type: String, trim: true, default: 'Lun-Ven' },
    openTime:  { type: String, default: '08:00' },
    closeTime: { type: String, default: '16:00' },
    notes:     { type: String, trim: true },
  },
  { _id: false }
);

// ── Demand sub-schema (each time a citizen requests this) ─
const DemandSchema = new mongoose.Schema(
  {
    citizen:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status:    { type: String, enum: ['Pending', 'Accepted', 'Rejected', 'Expired'], default: 'Pending' },
    notes:     { type: String, trim: true },
    processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    processedAt: { type: Date },
    requestedDate: { type: Date },
  },
  { timestamps: true }
);

// ── Main Service schema ─────────────────────────────────
const ServiceSchema = new mongoose.Schema(
  {
    name: {
      type:      String,
      required:  [true, 'Le nom du service est obligatoire.'],
      trim:      true,
      unique:    true,
      minlength: [3,  'Nom trop court.'],
      maxlength: [100,'Nom trop long.'],
    },
    description: {
      type:      String,
      trim:      true,
      maxlength: [1000, 'Description trop longue.'],
    },
    category: {
      type:    String,
      required:[true, 'La catégorie est obligatoire.'],
      enum: {
        values: [
          'Etat civil',
          'Urbanisme',
          'Proprete',
          'Transport',
          'Culture',
          'Education',
          'Sante',
          'Autre',
        ],
        message: 'Catégorie de service invalide.',
      },
    },
    mode: {
      type:    String,
      enum:    ['En ligne', 'Presentiel', 'Hybride'],
      default: 'Presentiel',
    },

    // ── Location ──────────────────────────────────────
    location: {
      address:    { type: String, trim: true },
      municipality:{ type: String, trim: true, default: 'Tunis' },
      coordinates: {
        type:        { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number], default: [10.1815, 36.8065] },
      },
    },

    // ── QR code ───────────────────────────────────────
    qrCode: {
      data:      { type: String, default: () => uuidv4() }, // unique payload
      url:       { type: String },   // full URL encoded in QR
      imageUrl:  { type: String },   // stored QR image if pre-generated
    },

    // ── Schedule ──────────────────────────────────────
    schedule: { type: ScheduleSchema, default: () => ({}) },

    // ── Status ────────────────────────────────────────
    isActive:  { type: Boolean, default: true },
    isOnline:  { type: Boolean, default: false },

    // ── Statistics (denormalized for fast reads) ──────
    stats: {
      totalDemands:    { type: Number, default: 0, min: 0 },
      acceptedDemands: { type: Number, default: 0, min: 0 },
      avgRating:       { type: Number, default: 0, min: 0, max: 5 },
      ratingCount:     { type: Number, default: 0 },
    },

    // ── Ratings from citizens ──────────────────────────
    ratings: [{
      citizen:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      score:     { type: Number, min: 1, max: 5, required: true },
      comment:   { type: String, trim: true, maxlength: 500 },
      createdAt: { type: Date, default: Date.now },
    }],

    // ── Demands ───────────────────────────────────────
    demands: [DemandSchema],

    // ── Responsible agent ─────────────────────────────
    responsibleAgent: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    // ── Required documents ────────────────────────────
    requiredDocuments: [{ type: String, trim: true }],

    // ── Processing delay ──────────────────────────────
    processingDays: { type: Number, default: 5, min: 1 },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
    toJSON:  { virtuals: true, transform: (_d, ret) => { delete ret.__v; return ret; } },
    toObject: { virtuals: true },
  }
);

// ── Geo index ───────────────────────────────────────────
ServiceSchema.index({ 'location.coordinates': '2dsphere' });
ServiceSchema.index({ category: 1, isActive: 1 });
ServiceSchema.index({ isActive: 1, isOnline: 1 });

// ── Virtual: pending demand count ──────────────────────
ServiceSchema.virtual('pendingDemandCount').get(function () {
  return (this.demands || []).filter(d => d.status === 'Pending').length;
});

// ── Pre-save: rebuild qrCode.url from name ──────────────
ServiceSchema.pre('save', function (next) {
  if (this.isModified('name') || !this.qrCode?.url) {
    const base = process.env.FRONTEND_URL || 'http://localhost:5173';
    this.qrCode.url = `${base}/services/${encodeURIComponent(this.name)}?qr=${this.qrCode.data}`;
  }
  next();
});

module.exports = mongoose.model('Service', ServiceSchema);
