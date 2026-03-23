'use strict';

/**
 * validateEnv
 * ───────────
 * Called once at server startup.
 * If any required variable is missing, the process exits immediately
 * with a clear message — better than a cryptic error 30s later.
 */
function validateEnv() {
  const REQUIRED = [
    'JWT_SECRET',
    'MONGO_URI',
  ];

  const missing = REQUIRED.filter(key => !process.env[key] || process.env[key].trim() === '');

  if (missing.length > 0) {
    console.error('\n❌  ERREUR DE CONFIGURATION — Variables manquantes dans .env :\n');
    missing.forEach(key => console.error(`   • ${key}`));
    console.error('\n   📄  Copie .env.example → .env et remplis les valeurs.\n');
    process.exit(1);
  }

  // Warn if JWT_SECRET is still the example value
  if (process.env.JWT_SECRET === 'your_super_secret_jwt_key_change_in_production') {
    console.warn('⚠️  JWT_SECRET : valeur par défaut détectée. Change-la en production !');
  }

  console.log('✅  Variables d\'environnement validées.');
}

module.exports = validateEnv;
