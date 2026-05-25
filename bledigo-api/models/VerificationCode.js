'use strict';
const mongoose = require('mongoose');

const VerificationCodeSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    index: true,
  },
  code: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 600, // 10 minutes (600 seconds)
  },
});

module.exports = mongoose.model('VerificationCode', VerificationCodeSchema);
