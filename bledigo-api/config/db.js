'use strict';

const mongoose = require('mongoose');

const MAX_RETRIES   = 5;
const RETRY_DELAY   = 5000; // ms

/**
 * Connect to MongoDB with automatic retry on failure.
 * Uses environment variable MONGO_URI.
 */
async function connectDB(retries = MAX_RETRIES) {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/bledigo';

  try {
    const conn = await mongoose.connect(uri, {
      // Mongoose 8 handles most options internally
    });

    console.log(`[MongoDB] Connected → ${conn.connection.host}/${conn.connection.name}`);

    mongoose.connection.on('error', (err) => {
      console.error('[MongoDB] Runtime error:', err.message);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('[MongoDB] Disconnected. Attempting reconnect…');
    });

  } catch (err) {
    console.error(`[MongoDB] Connection failed: ${err.message}`);

    if (retries > 0) {
      console.log(`[MongoDB] Retrying in ${RETRY_DELAY / 1000}s… (${retries} attempts left)`);
      await new Promise(r => setTimeout(r, RETRY_DELAY));
      return connectDB(retries - 1);
    }

    console.error('[MongoDB] Max retries reached. Exiting.');
    process.exit(1);
  }
}

module.exports = connectDB;
