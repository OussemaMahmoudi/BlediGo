"""
BlediGo – AI Urgency Classification Microservice
Flask + keyword heuristic (with accent normalization)
POST /predict → { urgency_level, confidence, reason }
"""

import os, re, logging, unicodedata
from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # Allow all origins for local dev

# ── Accent normalization ──────────────────────────────────
def normalize(text):
    """Remove accents and lowercase for robust matching."""
    return ''.join(
        c for c in unicodedata.normalize('NFD', text.lower())
        if unicodedata.category(c) != 'Mn'
    )

# ── Keywords (accent-free, matched against normalized text) ──
CRITICAL_KW = [
    # People injured / life threat
    "enfant blesse", "enfants blesses", "personne blessee", "personnes blessees",
    "blesse", "blessure", "blessures", "mort", "deces", "victime",
    "hospitalisation", "ambulance appelee", "sang",
    # Fire / explosion / gas
    "incendie", "feu", "flammes", "explosion", "gaz", "fuite de gaz",
    "risque d explosion", "danger d explosion",
    # Collapse / flood
    "effondrement", "s effondre", "inondation", "eau envahit",
    # Urgency markers
    "danger immediat", "urgence absolue", "urgence critique",
    "intervention immediate", "tout de suite", "immediatement",
    "ce matin blesse", "accident grave", "accident mortel",
    # Direct danger
    "tombe dans", "chute dans", "fosse profonde", "trou profond",
    "electrocution", "electrocute", "noyade",
]

HIGH_KW = [
    # Infrastructure danger
    "lampadaire en panne", "eclairage en panne", "zone sombre", "completement sombre",
    "aucun eclairage", "pas d eclairage", "nuit sans eclairage",
    "fuite d eau", "fuite d'eau", "eau qui coule", "chaussee inondee",
    "route inondee", "voie inondee", "route bloquee", "voie bloquee",
    "coupure electrique", "panne electrique",
    # Risk to vulnerable
    "pres de l ecole", "devant l ecole", "ecole primaire", "ecole",
    "enfants a risque", "danger pour les enfants",
    "personne agee", "personnes agees", "handicape",
    # Traffic danger
    "danger pour la circulation", "risque d accident", "accident potentiel",
    "circulation dangereuse", "voiture", "pieton en danger",
    "panneau stop", "signalisation absente", "stop tombe",
    # Duration + risk combo
    "depuis plusieurs semaines", "depuis des semaines", "depuis longtemps",
    # Single strong risk words
    "dangereux", "dangereuse", "dangereux pour", "risque eleve",
    "securite", "securite publique", "obstacle", "inaccessible",
    "glissant", "glissante", "chute probable",
]

MEDIUM_KW = [
    "poubelles", "ordures", "dechets", "collecte", "pas ramasse",
    "non collecte", "odeur", "odeurs",
    "nid de poule", "trou dans la route", "chaussee degradee", "voirie degradee",
    "panneau", "signalisation", "fissure",
    "panne", "en panne", "ne fonctionne pas",
    "semaines", "jours",
]

LOW_KW = [
    "peinture", "ecaillee", "repeinture", "repeindre",
    "herbe", "gazon", "pelouse", "tonte", "tondue",
    "arbre", "vegetation", "buisson",
    "esthetique", "embellissement", "decoratif",
    "quand possible", "pas urgent", "peu urgent", "sans urgence",
    "lentement", "tranquillement", "pas prioritaire",
    "banc", "bac a fleurs", "fontaine decorative",
]

# ── Category boosters ─────────────────────────────────────
CATEGORY_CRITICAL_BOOST = {
    "Eau & Assainissement": ["fuite", "inondation", "eau"],
    "Eclairage public":     ["danger", "sombre", "nuit", "accident"],
}
CATEGORY_LOW_BOOST = {
    "Espaces verts": LOW_KW,
    "Bâtiments publics": ["peinture", "esthetique"],
}

def count_hits(text_norm, keywords):
    return sum(1 for kw in keywords if kw in text_norm)

def classify(text: str, category: str = "") -> dict:
    norm = normalize(text)
    cat_norm = normalize(category)

    c_hits = count_hits(norm, CRITICAL_KW)
    h_hits = count_hits(norm, HIGH_KW)
    m_hits = count_hits(norm, MEDIUM_KW)
    l_hits = count_hits(norm, LOW_KW)

    # Category boosts
    for cat_key, boost_kws in CATEGORY_CRITICAL_BOOST.items():
        if normalize(cat_key) in cat_norm:
            c_hits += sum(1 for kw in boost_kws if kw in norm) * 0.5

    for cat_key, boost_kws in CATEGORY_LOW_BOOST.items():
        if normalize(cat_key) in cat_norm:
            l_hits += sum(1 for kw in boost_kws if kw in norm) * 0.5

    log.info(f"Hits → C:{c_hits} H:{h_hits} M:{m_hits} L:{l_hits} | text: {text[:60]!r}")

    # ── Decision rules ───────────────────────────────────
    if c_hits >= 1:
        confidence = min(0.96, 0.75 + c_hits * 0.07)
        return {
            "urgency_level": "Critical",
            "confidence": round(confidence, 3),
            "reason": "Mots-clés critiques détectés : danger immédiat, blessures, incendie ou risque de vie.",
            "classifier": "keyword_heuristic",
            "debug": {"c": c_hits, "h": h_hits, "m": m_hits, "l": l_hits},
        }

    if h_hits >= 1:
        confidence = min(0.89, 0.65 + h_hits * 0.08)
        return {
            "urgency_level": "High",
            "confidence": round(confidence, 3),
            "reason": "Indicateurs de risque élevé : sécurité publique, école, circulation ou infrastructure critique.",
            "classifier": "keyword_heuristic",
            "debug": {"c": c_hits, "h": h_hits, "m": m_hits, "l": l_hits},
        }

    if l_hits >= 1 and h_hits == 0 and c_hits == 0:
        confidence = min(0.82, 0.60 + l_hits * 0.08)
        return {
            "urgency_level": "Low",
            "confidence": round(confidence, 3),
            "reason": "Problème esthétique ou non urgent détecté. Peut être traité en priorité basse.",
            "classifier": "keyword_heuristic",
            "debug": {"c": c_hits, "h": h_hits, "m": m_hits, "l": l_hits},
        }

    if m_hits >= 1:
        confidence = min(0.75, 0.55 + m_hits * 0.07)
        return {
            "urgency_level": "Medium",
            "confidence": round(confidence, 3),
            "reason": "Problème modéré détecté. Traitement dans les délais normaux recommandé.",
            "classifier": "keyword_heuristic",
            "debug": {"c": c_hits, "h": h_hits, "m": m_hits, "l": l_hits},
        }

    # Default
    return {
        "urgency_level": "Medium",
        "confidence": 0.50,
        "reason": "Aucun indicateur spécifique détecté. Urgence modérée appliquée par défaut.",
        "classifier": "keyword_heuristic",
        "debug": {"c": c_hits, "h": h_hits, "m": m_hits, "l": l_hits},
    }


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "model": "keyword_heuristic_v2",
                    "timestamp": datetime.utcnow().isoformat() + "Z"}), 200


@app.route("/predict", methods=["POST"])
def predict():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "JSON body required."}), 400

    description = data.get("description", "").strip()
    category    = data.get("category", "").strip()

    if not description or len(description) < 5:
        return jsonify({"error": "Description too short."}), 422

    try:
        result = classify(description, category)
        log.info(f"→ {result['urgency_level']} ({result['confidence']:.0%})")
        return jsonify(result), 200
    except Exception as exc:
        log.error(f"Error: {exc}", exc_info=True)
        return jsonify({
            "urgency_level": "Medium", "confidence": 0.0,
            "reason": "Erreur interne.", "classifier": "fallback",
        }), 200


if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    log.info(f"🚀 AI microservice v2 starting on port {port}")
    app.run(host="0.0.0.0", port=port, debug=True)
