'use strict';

const axios = require('axios');

const AI_URL         = process.env.AI_SERVICE_URL || 'http://localhost:5000/predict';
const TIMEOUT_MS     = parseInt(process.env.AI_TIMEOUT_MS, 10) || 4000;
const FALLBACK_LEVEL = 'Medium';

/**
 * Map the Python microservice response to our Mongoose schema enum values.
 * Python model returns: "High" | "Medium" | "Low"
 * We extend to support "Critical" for the most urgent cases.
 */
const LEVEL_MAP = {
  high:     'High',
  medium:   'Medium',
  low:      'Low',
  critical: 'Critical',
};

function normalizeLevel(raw) {
  if (!raw) return FALLBACK_LEVEL;
  return LEVEL_MAP[raw.toLowerCase()] ?? FALLBACK_LEVEL;
}

/**
 * classifyUrgency
 * ───────────────
 * Sends the citizen's reclamation description to the Python AI microservice
 * and returns a structured urgency object.
 *
 * @param {string} description  – The free-text reclamation description.
 * @param {string} [category]   – Optional category for richer context.
 * @returns {Promise<{
 *   level:        'Low' | 'Medium' | 'High' | 'Critical',
 *   confidence:   number,        // 0.0 – 1.0
 *   reason:       string,
 *   aiGenerated:  boolean,
 *   rawAiResponse: object | null,
 * }>}
 */
async function classifyUrgency(description, category = '') {
  // ── Validate input ─────────────────────────────────
  if (!description || typeof description !== 'string' || description.trim().length < 5) {
    console.warn('[AI] Description too short or missing – using fallback.');
    return buildFallback('Description trop courte pour l\'analyse IA.');
  }

  try {
    // ── Call Python microservice ───────────────────────
    const response = await axios.post(
      AI_URL,
      {
        description: description.trim(),
        category:    category.trim(),
      },
      {
        timeout: TIMEOUT_MS,
        headers: { 'Content-Type': 'application/json' },
        // Don't throw on 4xx/5xx – handle manually
        validateStatus: (status) => status < 600,
      }
    );

    // ── Handle non-200 responses ───────────────────────
    if (response.status !== 200) {
      console.warn(`[AI] Microservice returned HTTP ${response.status}. Using fallback.`);
      return buildFallback('Service IA indisponible (erreur HTTP).');
    }

    const data = response.data;

    // ── Validate expected fields ───────────────────────
    if (!data || !data.urgency_level) {
      console.warn('[AI] Unexpected response format:', JSON.stringify(data));
      return buildFallback('Format de réponse IA inattendu.');
    }

    const level      = normalizeLevel(data.urgency_level);
    const confidence = typeof data.confidence === 'number'
      ? Math.min(1, Math.max(0, data.confidence))
      : 0.75;
    const reason = data.reason || data.explanation || generateDefaultReason(level);

    console.log(`[AI] Classification → ${level} (confidence: ${(confidence * 100).toFixed(1)}%)`);

    return {
      level,
      confidence,
      reason,
      aiGenerated:   true,
      rawAiResponse: data,
    };

  } catch (err) {
    // ── Network / timeout errors ───────────────────────
    if (err.code === 'ECONNREFUSED') {
      console.warn('[AI] ⚠ Microservice offline (ECONNREFUSED). Using fallback urgency: Medium.');
    } else if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
      console.warn(`[AI] ⚠ Microservice timeout (>${TIMEOUT_MS}ms). Using fallback urgency: Medium.`);
    } else {
      console.error('[AI] Unexpected error:', err.message);
    }

    return buildFallback('Microservice IA hors ligne – valeur par défaut appliquée.');
  }
}

/**
 * Build a fallback urgency object when the AI is unavailable.
 */
function buildFallback(reason = '') {
  return {
    level:         FALLBACK_LEVEL,
    confidence:    0,
    reason,
    aiGenerated:   false,
    rawAiResponse: null,
  };
}

/**
 * Generate a human-readable reason when the AI doesn't provide one.
 */
function generateDefaultReason(level) {
  const reasons = {
    Critical: 'Risque critique détecté. Intervention immédiate requise.',
    High:     'Risque élevé détecté. Traitement prioritaire recommandé.',
    Medium:   'Importance modérée. Traitement dans les délais normaux.',
    Low:      'Problème mineur. Peut être traité dans les délais standards.',
  };
  return reasons[level] || reasons.Medium;
}

/**
 * healthCheck – ping the AI microservice.
 * Returns true if reachable, false otherwise.
 */
async function checkAiHealth() {
  try {
    const res = await axios.get(
      AI_URL.replace('/predict', '/health'),
      { timeout: 2000, validateStatus: () => true }
    );
    return res.status === 200;
  } catch {
    return false;
  }
}

module.exports = { classifyUrgency, checkAiHealth };
