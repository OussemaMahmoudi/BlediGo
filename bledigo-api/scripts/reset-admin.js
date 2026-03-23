'use strict';

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const User     = require('../models/User');

const ADMIN_EMAIL    = 'oussema.mahmoudi777@gmail.com';
const ADMIN_PASSWORD = 'admin';

async function resetAdmin() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/bledigo');
    console.log('\n🔄  Reset Admin\n');

    // Delete existing admin (whatever state it's in)
    const deleted = await User.deleteOne({ email: ADMIN_EMAIL });
    if (deleted.deletedCount > 0) {
      console.log('🗑   Ancien admin supprime');
    }

    // Hash password manually to bypass the 8-char minlength validation
    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 12);

    const admin = new User({
      firstName:    'Oussema',
      lastName:     'Mahmoudi',
      email:        ADMIN_EMAIL,
      password:     hashedPassword,
      role:         'Admin',
      municipality: 'Tunis',
      isActive:     true,
    });

    await admin.save({ validateBeforeSave: false });

    console.log('✅  Admin recrée avec succes');
    console.log('\n📋  Identifiants :');
    console.log('    Email    : ' + ADMIN_EMAIL);
    console.log('    Password : ' + ADMIN_PASSWORD);
    console.log('\n🚀  Tu peux maintenant te connecter sur http://localhost:5173\n');

  } catch (err) {
    console.error('❌  Erreur :', err.message);
  } finally {
    await mongoose.disconnect();
  }
}

resetAdmin();
