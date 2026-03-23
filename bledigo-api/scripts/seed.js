'use strict';

/**
 * BlediGo — Seed Script
 * ─────────────────────
 * Inserts sample data into 3 separate MongoDB collections:
 *   • admins   — the default admin account
 *   • agents   — 4 municipal agents
 *   • citoyens — 3 test citizens
 *   • services — 5 municipal services
 *
 * Uses native MongoClient so there is ZERO Mongoose validation.
 * Safe to run multiple times (skips existing documents).
 *
 * Run: node scripts/seed.js
 */

require('dotenv').config();
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcryptjs');

const URI = process.env.MONGO_URI || 'mongodb://localhost:27017/bledigo';
const DB  = URI.split('/').pop().split('?')[0];

// ── Seed data ─────────────────────────────────────────────

const ADMIN = {
  firstName:    'Oussema',
  lastName:     'Mahmoudi',
  email:        'oussama.mahmoudi813@gmail.com',
  rawPassword:  'ouusema123',
  role:         'Admin',
  municipality: 'Tunis',
  department:   'Administration',
  isActive:     true,
};

const AGENTS = [
  {
    firstName: 'Karim',   lastName: 'Zghal',
    email: 'k.zghal@munic.tn',   rawPassword: 'Agent1234',
    role: 'Agent', department: 'Direction Technique',
    specialization: ['Eclairage', 'Voirie'],
    municipality: 'Tunis', isActive: true,
  },
  {
    firstName: 'Mohamed', lastName: 'Haddad',
    email: 'm.haddad@munic.tn',  rawPassword: 'Agent1234',
    role: 'Agent', department: 'Service Voirie',
    specialization: ['Routes', 'Signalisation'],
    municipality: 'Tunis', isActive: true,
  },
  {
    firstName: 'Omar',    lastName: 'Bouzid',
    email: 'o.bouzid@munic.tn',  rawPassword: 'Agent1234',
    role: 'Agent', department: 'Service Proprete',
    specialization: ['Dechets', 'Espaces verts'],
    municipality: 'Tunis', isActive: true,
  },
  {
    firstName: 'Sara',    lastName: 'Ben Ali',
    email: 's.benali@munic.tn',  rawPassword: 'Agent1234',
    role: 'Agent', department: 'Service Transport',
    specialization: ['Transport', 'Logistique'],
    municipality: 'Tunis', isActive: true,
  },
];

const CITOYENS = [
  {
    firstName: 'Ahmed',   lastName: 'Mansour',
    email: 'ahmed.mansour@test.com', rawPassword: 'Citoyen1234',
    cin: '12345678', phone: '+21622345678',
    municipality: 'Tunis', isActive: true,
  },
  {
    firstName: 'Fatma',   lastName: 'Saidi',
    email: 'fatma.saidi@test.com',   rawPassword: 'Citoyen1234',
    cin: '87654321', phone: '+21699876543',
    municipality: 'Tunis', isActive: true,
  },
  {
    firstName: 'Youssef', lastName: 'Trabelsi',
    email: 'y.trabelsi@test.com',    rawPassword: 'Citoyen1234',
    cin: '55512345', phone: '+21655512345',
    municipality: 'Tunis', isActive: true,
  },
];

const SERVICES = [
  {
    name: 'Acte de naissance',
    category: 'Etat civil', mode: 'En ligne', isActive: true,
    schedule: { days: 'Lun-Ven', openTime: '08:00', closeTime: '16:00' },
    description: "Demande d'extrait ou copie integrale.",
  },
  {
    name: 'Permis de construire',
    category: 'Urbanisme', mode: 'Presentiel', isActive: true,
    schedule: { days: 'Lun-Jeu', openTime: '08:00', closeTime: '14:00' },
    description: 'Autorisation pour travaux de construction.',
  },
  {
    name: 'Transport scolaire',
    category: 'Transport', mode: 'En ligne', isActive: true,
    schedule: { days: 'Lun-Ven', openTime: '09:00', closeTime: '15:00' },
    description: 'Inscription au transport scolaire municipal.',
  },
  {
    name: 'Collecte dechets speciaux',
    category: 'Proprete', mode: 'Presentiel', isActive: false,
    schedule: { days: 'Sam', openTime: '07:00', closeTime: '12:00' },
    description: 'Enlevement de dechets encombrants.',
  },
  {
    name: 'Entretien espaces verts',
    category: 'Proprete', mode: 'Presentiel', isActive: true,
    schedule: { days: 'Mar-Jeu', openTime: '08:00', closeTime: '15:00' },
    description: 'Elagage et entretien des espaces verts.',
  },
];

// ── Main ──────────────────────────────────────────────────

async function insertIfNotExists(col, emailField, item) {
  const exists = await col.findOne({ email: item.email });
  if (exists) {
    console.log(`   ↩  ${item.email} (déjà existant)`);
    return false;
  }
  const { rawPassword, ...rest } = item;
  await col.insertOne({
    _id:       new ObjectId(),
    ...rest,
    password:  await bcrypt.hash(rawPassword, 12),
    lastLogin: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    __v:       0,
  });
  console.log(`   ✅ ${item.email}  |  MDP: ${rawPassword}`);
  return true;
}

async function seed() {
  const client = new MongoClient(URI);
  try {
    await client.connect();
    const db = client.db(DB);
    console.log(`\n🔌  Connecté à MongoDB — base: "${DB}"\n`);

    // ── Collection: admins ─────────────────────────────
    console.log('📂  Collection: admins');
    const admins = db.collection('admins');
    await admins.deleteMany({});  // always recreate admin for clean state
    const { rawPassword: ap, ...adminRest } = ADMIN;
    await admins.insertOne({
      _id: new ObjectId(), ...adminRest,
      password: await bcrypt.hash(ap, 12),
      lastLogin: null, createdAt: new Date(), updatedAt: new Date(), __v: 0,
    });
    console.log(`   ✅ ${ADMIN.email}  |  MDP: ${ap}\n`);

    // ── Collection: agents ─────────────────────────────
    console.log('📂  Collection: agents');
    for (const a of AGENTS) await insertIfNotExists(db.collection('agents'), 'email', a);
    console.log('');

    // ── Collection: citoyens ───────────────────────────
    console.log('📂  Collection: citoyens');
    for (const c of CITOYENS) await insertIfNotExists(db.collection('citoyens'), 'email', c);
    console.log('');

    // ── Collection: services ───────────────────────────
    console.log('📂  Collection: services');
    const svcCol = db.collection('services');
    for (const s of SERVICES) {
      const exists = await svcCol.findOne({ name: s.name });
      if (exists) { console.log(`   ↩  "${s.name}" (déjà existant)`); continue; }
      await svcCol.insertOne({ _id: new ObjectId(), ...s, demands: [], ratings: [], stats: { totalDemands: 0, acceptedDemands: 0, avgRating: 0, ratingCount: 0 }, createdAt: new Date(), updatedAt: new Date(), __v: 0 });
      console.log(`   ✅ "${s.name}"`);
    }

    console.log('\n══════════════════════════════════════════════════');
    console.log('✔   Seed terminé !');
    console.log('\n📋  Comptes disponibles :');
    console.log(`\n   [Admin]   ${ADMIN.email}  /  ${ADMIN.rawPassword}`);
    AGENTS.forEach(a => console.log(`   [Agent]   ${a.email}  /  ${a.rawPassword}`));
    CITOYENS.forEach(c => console.log(`   [Citoyen] ${c.email}  /  ${c.rawPassword}`));
    console.log('\n   → Inscription libre via l\'interface pour nouveaux citoyens');
    console.log('══════════════════════════════════════════════════\n');

  } catch (err) {
    console.error('\n❌  Erreur seed :', err.message);
    if (err.stack) console.error(err.stack);
  } finally {
    await client.close();
  }
}

seed();
