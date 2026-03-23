"""
BlediGo – Seed training script for the urgency classifier.

Run once to train the model from labelled examples:
    python train_sample.py

This creates urgency_model.pkl and vectorizer.pkl
which app.py will automatically load.
"""

import joblib
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report
from sklearn.model_selection import train_test_split

# ── Labelled training data ───────────────────────────────
SAMPLES = [
    # Critical
    ("Un enfant a été blessé à cause d'un trou dans la route devant l'école", "Critical"),
    ("Fuite de gaz massive dans la rue, odeur forte, danger immédiat", "Critical"),
    ("Incendie déclaré dans le parc municipal, fumée visible", "Critical"),
    ("Effondrement d'un mur menaçant les passants sur le trottoir", "Critical"),
    ("Inondation soudaine bloquant l'accès aux services d'urgence", "Critical"),
    ("Câble électrique tombé sur la chaussée, risque électrocution", "Critical"),
    ("Accident grave sur l'avenue principale, blessés sur place", "Critical"),
    ("Fuite d'eau importante sous pression endommageant les fondations", "Critical"),
    ("Arbre sur le point de tomber sur la voiture garée, danger immédiat", "Critical"),
    ("Personne âgée bloquée dans un ascenseur depuis 3 heures", "Critical"),

    # High
    ("Lampadaire en panne depuis une semaine, zone très sombre la nuit", "High"),
    ("Nid-de-poule profond devant une école primaire, risque d'accidents", "High"),
    ("Panneau STOP renversé à l'intersection principale, dangereux", "High"),
    ("Fuite d'eau sur la chaussée depuis 3 jours, route glissante", "High"),
    ("Route dégradée avec de grosses fissures, pneus crevasés régulièrement", "High"),
    ("Voirie impraticable pour les ambulances dans le quartier", "High"),
    ("Égout bouché causant des refoulements dans les maisons", "High"),
    ("Éclairage public défaillant dans un passage piéton fréquenté", "High"),
    ("Arbre incliné dangereusement sur le trottoir très fréquenté", "High"),
    ("Déchets médicaux abandonnés dans un espace public", "High"),

    # Medium
    ("Poubelles non collectées depuis 5 jours dans le quartier", "Medium"),
    ("Banc cassé dans le parc municipal, ne peut plus être utilisé", "Medium"),
    ("Signalisation routière effacée, difficile à lire", "Medium"),
    ("Déchets abandonnés le long de la route principale", "Medium"),
    ("Fontaine publique hors service depuis deux semaines", "Medium"),
    ("Trottoir en mauvais état avec petites fissures et bosses", "Medium"),
    ("Terrain vague non entretenu utilisé comme décharge sauvage", "Medium"),
    ("Stationnement anarchique bloquant partiellement la rue", "Medium"),
    ("Bruit excessif d'un chantier en dehors des horaires autorisés", "Medium"),
    ("Graffitis sur le mur de l'école, mauvaise image pour les enfants", "Medium"),
    ("Absence d'éclairage dans la ruelle derrière le marché", "Medium"),

    # Low
    ("La peinture du banc dans le jardin public est un peu écaillée", "Low"),
    ("Herbe un peu haute dans le parc, pourrait être tondue", "Low"),
    ("Quelques feuilles mortes non ramassées sur le trottoir", "Low"),
    ("La couleur du revêtement de trottoir a légèrement pâli", "Low"),
    ("Petit nid-de-poule de taille modeste dans une rue peu fréquentée", "Low"),
    ("Poubelle avec couvercle légèrement abîmé mais toujours fonctionnelle", "Low"),
    ("Panneau indicateur légèrement rouillé mais encore lisible", "Low"),
    ("Fleurs du rond-point nécessitent un peu d'entretien", "Low"),
    ("Quelques tuiles légèrement désalignées sur le toit du kiosque", "Low"),
    ("Décoration lumineuse de rue partiellement éteinte", "Low"),
]

texts  = [s[0] for s in SAMPLES]
labels = [s[1] for s in SAMPLES]

# ── Train / test split ───────────────────────────────────
X_train, X_test, y_train, y_test = train_test_split(
    texts, labels, test_size=0.2, random_state=42, stratify=labels
)

# ── Vectoriser ───────────────────────────────────────────
vectorizer = TfidfVectorizer(
    ngram_range=(1, 2),
    max_features=5000,
    strip_accents="unicode",
    lowercase=True,
)
X_train_vec = vectorizer.fit_transform(X_train)
X_test_vec  = vectorizer.transform(X_test)

# ── Train classifier ─────────────────────────────────────
clf = LogisticRegression(max_iter=1000, C=1.0, class_weight="balanced")
clf.fit(X_train_vec, y_train)

# ── Evaluate ─────────────────────────────────────────────
y_pred = clf.predict(X_test_vec)
print("\n📊 Classification Report:")
print(classification_report(y_test, y_pred, target_names=clf.classes_))

# ── Persist ──────────────────────────────────────────────
joblib.dump(clf,        "urgency_model.pkl")
joblib.dump(vectorizer, "vectorizer.pkl")

print("✅ Model saved: urgency_model.pkl + vectorizer.pkl")
print("   Restart app.py to use the new model.\n")

# ── Quick manual test ────────────────────────────────────
test_cases = [
    "Un enfant blessé devant l'école, danger immédiat !",
    "Lampadaire cassé dans la rue, c'est sombre la nuit",
    "Déchets non collectés depuis 3 jours",
    "La peinture du banc est un peu écaillée",
]

print("🔍 Quick tests:")
for text in test_cases:
    vec    = vectorizer.transform([text])
    proba  = clf.predict_proba(vec)[0]
    pred   = clf.predict(vec)[0]
    conf   = max(proba)
    print(f"  [{pred:8s} {conf:.0%}] {text[:60]}")
