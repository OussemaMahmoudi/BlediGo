'use strict';

require('dotenv').config();
const mongoose = require('mongoose');
const User     = require('../models/User');

async function clearUsers() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/bledigo');
    console.log('\n🔄  Clearing all users except Admin\n');

    const result = await User.deleteMany({ role: { $ne: 'Admin' } });
    console.log(`✅  Deleted ${result.deletedCount} non-admin users.`);

  } catch (err) {
    console.error('❌  Error:', err.message);
  } finally {
    await mongoose.disconnect();
  }
}

clearUsers();
