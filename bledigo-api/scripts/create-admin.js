'use strict';

/**
 * Creates the ONE admin account in the "admins" collection.
 * Uses native MongoClient — no Mongoose, no validation.
 * Safe to run multiple times (deletes and recreates).
 *
 * Run: node scripts/create-admin.js
 */

require('dotenv').config();
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcryptjs');

const URI = process.env.MONGO_URI || 'mongodb://localhost:27017/bledigo';
const DB  = URI.split('/').pop().split('?')[0];

async function run() {
  const client = new MongoClient(URI);
  try {
    await client.connect();
    const db     = client.db(DB);
    const admins = db.collection('admins');

    // Always wipe and recreate — guarantees a clean state
    const deleted = await admins.deleteMany({});
    if (deleted.deletedCount > 0) console.log(`🗑   Ancien(s) admin(s) supprimé(s)`);

    await admins.insertOne({
      _id:          new ObjectId(),
      firstName:    'Oussema',
      lastName:     'Mahmoudi',
      email:        'oussama.mahmoudi813@gmail.com',
      password:     await bcrypt.hash('ouusema123', 12),
      role:         'Admin',
      municipality: 'Tunis',
      department:   'Administration',
      isActive:     true,
      createdAt:    new Date(),
      updatedAt:    new Date(),
      __v:          0,
    });

    console.log('\n✅  Admin créé dans la collection "admins"');
    console.log('   Email    : oussama.mahmoudi813@gmail.com');
    console.log('   Password : ouusema123');
    console.log('   Role     : Admin');
    console.log('   Collection: admins\n');

  } catch (e) {
    console.error('❌  Erreur :', e.message);
  } finally {
    await client.close();
  }
}

run();
