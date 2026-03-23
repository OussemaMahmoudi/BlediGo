'use strict';

const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const UserSchema = new mongoose.Schema(
  {
    firstName: {
      type: String, required: [true, 'Le prénom est obligatoire.'],
      trim: true, minlength: [2, 'Prénom trop court.'], maxlength: 50,
    },
    lastName: {
      type: String, required: [true, 'Le nom est obligatoire.'],
      trim: true, minlength: [2, 'Nom trop court.'], maxlength: 50,
    },
    // sparse: allows multiple null values without violating unique constraint
    cin: {
      type: String, unique: true, sparse: true, trim: true,
      validate: { validator: v => !v || /^\d{8}$/.test(v), message: 'CIN invalide (8 chiffres).' },
    },
    email: {
      type: String, required: [true, "L'email est obligatoire."],
      unique: true, lowercase: true, trim: true,
      validate: { validator: v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), message: 'Email invalide.' },
    },
    phone: { type: String, trim: true },
    // NOTE: no minlength here — validated in middleware so seed scripts
    // can create accounts with short passwords (e.g. 'admin') safely.
    password: { type: String, required: [true, 'Le mot de passe est obligatoire.'], select: false },
    role: {
      type: String, default: 'Citoyen',
      enum: { values: ['Citoyen', 'Agent', 'Admin'], message: 'Rôle invalide.' },
    },
    municipality:   { type: String, trim: true, default: 'Tunis' },
    address:        { type: String, trim: true },
    department:     { type: String, trim: true },
    specialization: { type: [String], default: [] },
    isActive:       { type: Boolean, default: true },
    avatarUrl:      { type: String },
    lastLogin:      { type: Date },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => { delete ret.password; delete ret.__v; return ret; },
    },
    toObject: { virtuals: true },
  }
);

UserSchema.virtual('fullName').get(function () { return `${this.firstName} ${this.lastName}`; });
UserSchema.virtual('initials').get(function () { return `${this.firstName[0]}${this.lastName[0]}`.toUpperCase(); });

// Only compound / non-unique indexes here — unique: true on field already creates an index
UserSchema.index({ role: 1 });
UserSchema.index({ isActive: 1, role: 1 });
UserSchema.index({ municipality: 1 });

UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    this.password = await bcrypt.hash(this.password, 12);
    next();
  } catch (err) { next(err); }
});

UserSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};
UserSchema.methods.isStaff = function () {
  return ['Agent', 'Admin'].includes(this.role);
};

module.exports = mongoose.model('User', UserSchema);
