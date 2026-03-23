'use strict';

const { Router } = require('express');
const { protect } = require('../middleware/auth');
const { classifyUrgency } = require('../utils/aiClient');

const router = Router();

// POST /api/ai/predict
// Proxies to the Python microservice — keeps CORS clean for the browser
router.post('/predict', protect, async (req, res) => {
  const { description = '', category = '' } = req.body;

  if (!description || description.trim().length < 5) {
    return res.status(422).json({ success: false, message: 'Description trop courte.' });
  }

  try {
    const result = await classifyUrgency(description.trim(), category.trim());
    res.json({
      success:       true,
      urgency_level: result.level,
      confidence:    result.confidence,
      reason:        result.reason,
      classifier:    result.aiGenerated ? 'ai_microservice' : 'keyword_fallback',
    });
  } catch (err) {
    res.json({
      success:       false,
      urgency_level: 'Medium',
      confidence:    0.5,
      reason:        'Analyse par défaut (microservice indisponible).',
      classifier:    'fallback',
    });
  }
});

module.exports = router;
