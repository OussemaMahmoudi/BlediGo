#!/usr/bin/env node
'use strict';

/**
 * BlediGo API — Setup Script
 * ──────────────────────────
 * Run once before starting the server:
 *   node scripts/setup.js
 *
 * What it does:
 *  1. Checks that .env exists (copies .env.example if not)
 *  2. Creates the uploads/ directory
 *  3. Prints a summary of the configuration
 */

const fs   = require('fs');
const path = require('path');

const ROOT        = path.join(__dirname, '..');
const ENV_FILE    = path.join(ROOT, '.env');
const ENV_EXAMPLE = path.join(ROOT, '.env.example');
const UPLOADS_DIR = path.join(ROOT, 'uploads');

console.log('\n🔧  BlediGo API — Setup\n');

// ── 1. .env file ────────────────────────────────────────
if (!fs.existsSync(ENV_FILE)) {
  if (fs.existsSync(ENV_EXAMPLE)) {
    fs.copyFileSync(ENV_EXAMPLE, ENV_FILE);
    console.log('✅  .env créé depuis .env.example');
    console.log('   ⚠️  Ouvre .env et change JWT_SECRET avant de continuer !\n');
  } else {
    // Create a minimal .env from scratch
    const minimal = `NODE_ENV=development
PORT=3001
MONGO_URI=mongodb://localhost:27017/bledigo
JWT_SECRET=bledigo_jwt_secret_${Date.now()}
JWT_EXPIRES_IN=7d
AI_SERVICE_URL=http://localhost:5000/predict
AI_TIMEOUT_MS=4000
UPLOAD_DIR=uploads
MAX_FILE_SIZE_MB=5
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
`;
    fs.writeFileSync(ENV_FILE, minimal);
    console.log('✅  .env créé avec des valeurs par défaut');
  }
} else {
  console.log('✅  .env existe déjà');
}

// ── 2. uploads/ directory ────────────────────────────────
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  console.log('✅  Dossier uploads/ créé');
} else {
  console.log('✅  Dossier uploads/ existe déjà');
}

// ── 3. Load and display config ───────────────────────────
require('dotenv').config({ path: ENV_FILE });

console.log('\n📋  Configuration actuelle :');
console.log(`   PORT       : ${process.env.PORT || 3001}`);
console.log(`   MONGO_URI  : ${process.env.MONGO_URI}`);
console.log(`   JWT_SECRET : ${process.env.JWT_SECRET ? '✅ défini (' + process.env.JWT_SECRET.length + ' caractères)' : '❌ MANQUANT'}`);
console.log(`   AI_URL     : ${process.env.AI_SERVICE_URL}`);
console.log(`   CORS       : ${process.env.CORS_ORIGINS}`);

console.log('\n🚀  Démarrer le serveur avec : npm run dev\n');
