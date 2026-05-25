// ─────────────────────────────────────────────────────────
// BlediGo Mock Data
// All records have both _id-style and id fields, plus
// all fields the dashboards expect, so the app never crashes
// when the backend is offline.
// ─────────────────────────────────────────────────────────

const now = new Date()
const d = (daysAgo) => new Date(now - daysAgo * 86400000).toISOString()
const dLabel = (daysAgo) => {
  const labels = ['Aujourd\'hui','Hier','Il y a 2j','Il y a 3j','Il y a 4j','Il y a 5j','Il y a 6j']
  return labels[daysAgo] || `Il y a ${daysAgo}j`
}

// ═══════════════════════════════════════════════════════
// RECLAMATIONS
// ═══════════════════════════════════════════════════════
export const reclamations = [
  {
    _id: 'rec001', id: 'rec001',
    title: 'Eclairage public défectueux, Rue Ibn Khaldoun',
    description: 'Plusieurs lampadaires en panne entre les n°12 et 28. Zone sombre, danger piétons.',
    category: 'Eclairage public', cat: 'Eclairage',
    urgency: { level: 'Medium', confidence: 0.76, reason: 'Problème modéré', aiGenerated: true },
    urg: 'Normal', status: 'En cours',
    date: '14 mars', createdAt: d(7),
    citizen: 'Ahmed Mansour', assignedAgent: { firstName: 'Karim', lastName: 'Zghal' },
    agent: 'Karim Zghal', late: false, isOverdue: false,
    votes: { count: 24 }, comments: [
      { user: 'Sana K.', text: 'Confirme, très dangereux le soir.', time: 'il y a 3h' },
    ],
  },
  {
    _id: 'rec002', id: 'rec002',
    title: 'Nid-de-poule devant école primaire',
    description: 'Nid-de-poule dangereux devant l\'école. Risque d\'accidents pour enfants.',
    category: 'Voirie & Routes', cat: 'Routes',
    urgency: { level: 'High', confidence: 0.88, reason: 'Risque élevé détecté', aiGenerated: true },
    urg: 'Urgent', status: 'Critique',
    date: '11 mars', createdAt: d(10),
    citizen: 'Fatma Saidi', assignedAgent: null,
    agent: '--', late: true, isOverdue: true,
    votes: { count: 41 }, comments: [
      { user: 'Parent', text: 'Extrêmement dangereux !', time: 'il y a 5h' },
    ],
  },
  {
    _id: 'rec003', id: 'rec003',
    title: 'Panneau signalisation cassé',
    description: 'Panneau STOP à l\'intersection de la Rue de la République tombé.',
    category: 'Signalisation', cat: 'Routes',
    urgency: { level: 'Medium', confidence: 0.65, reason: 'Urgence modérée', aiGenerated: true },
    urg: 'Normal', status: 'En attente',
    date: '10 mars', createdAt: d(11),
    citizen: 'Youssef Trabelsi', assignedAgent: { firstName: 'Mohamed', lastName: 'Haddad' },
    agent: 'Mohamed Haddad', late: false, isOverdue: false,
    votes: { count: 18 }, comments: [],
  },
  {
    _id: 'rec004', id: 'rec004',
    title: 'Voirie dégradée Av. Mohamed V',
    description: 'Nombreuses fissures sur l\'avenue Mohamed V, section rues 14 à 22.',
    category: 'Voirie & Routes', cat: 'Voirie',
    urgency: { level: 'Medium', confidence: 0.70, reason: 'Urgence modérée', aiGenerated: true },
    urg: 'Normal', status: 'En cours',
    date: '09 mars', createdAt: d(12),
    citizen: 'Hedi Baccouche', assignedAgent: { firstName: 'Karim', lastName: 'Zghal' },
    agent: 'Karim Zghal', late: false, isOverdue: false,
    votes: { count: 32 }, comments: [],
  },
  {
    _id: 'rec005', id: 'rec005',
    title: 'Fuite d\'eau Av. Habib Thameur',
    description: 'Fuite importante, chaussée inondée depuis 3 jours.',
    category: 'Eau & Assainissement', cat: 'Eau',
    urgency: { level: 'Critical', confidence: 0.92, reason: 'Risque critique détecté', aiGenerated: true },
    urg: 'Critique', status: 'Critique',
    date: '09 mars', createdAt: d(12),
    citizen: 'Rania Boussairi', assignedAgent: null,
    agent: '--', late: true, isOverdue: true,
    votes: { count: 38 }, comments: [],
  },
  {
    _id: 'rec006', id: 'rec006',
    title: 'Déchets non collectés, quartier Ennahli',
    description: 'Poubelles non vidées depuis 5 jours. Odeurs importantes.',
    category: 'Propreté & Déchets', cat: 'Propreté',
    urgency: { level: 'Low', confidence: 0.60, reason: 'Problème habituel', aiGenerated: true },
    urg: 'Bas', status: 'Resolue',
    date: '05 mars', createdAt: d(16),
    citizen: 'Rania Boussairi', assignedAgent: { firstName: 'Omar', lastName: 'Bouzid' },
    agent: 'Omar Bouzid', late: false, isOverdue: false,
    votes: { count: 57 }, comments: [
      { user: 'Rania B.', text: 'Enfin résolu ! Merci.', time: 'il y a 4j' },
    ],
  },
]

// ═══════════════════════════════════════════════════════
// SERVICES
// ═══════════════════════════════════════════════════════
export const services = [
  { _id:'svc001', id:'SVC-001', name:'Acte de naissance',         cat:'Etat civil', category:'Etat civil',  mode:'En ligne',   days:'Lun-Ven', hours:'08h-16h', dem:247, note:4.3, active:true,  isActive:true  },
  { _id:'svc002', id:'SVC-002', name:'Permis de construire',       cat:'Urbanisme',  category:'Urbanisme',   mode:'Presentiel', days:'Lun-Jeu', hours:'08h-14h', dem:89,  note:4.2, active:true,  isActive:true  },
  { _id:'svc003', id:'SVC-003', name:'Collecte déchets spéciaux', cat:'Proprete',   category:'Proprete',    mode:'Presentiel', days:'Sam',     hours:'07h-12h', dem:12,  note:3.1, active:false, isActive:false },
  { _id:'svc004', id:'SVC-004', name:'Transport scolaire',         cat:'Transport',  category:'Transport',   mode:'En ligne',   days:'Lun-Ven', hours:'09h-15h', dem:134, note:4.8, active:true,  isActive:true  },
  { _id:'svc005', id:'SVC-005', name:'Réservation salle des fêtes',cat:'Culture',   category:'Culture',     mode:'Presentiel', days:'Mar-Sam', hours:'09h-17h', dem:45,  note:4.5, active:true,  isActive:true  },
]

// ═══════════════════════════════════════════════════════
// DEMANDES
// ═══════════════════════════════════════════════════════
export const demandes = [
  { _id:'dem001', id:'DEM-492', svc:'Permis de construire',    citizen:'Ahmed Mansour',   agent:'Karim Zghal',  date:'17 mars 14:22', delai:'6h restantes', status:'En attente', expired:false, createdAt: d(0) },
  { _id:'dem002', id:'DEM-491', svc:'Transport scolaire',       citizen:'Sara Belhaj',     agent:'Sara Ben Ali', date:'17 mars 11:05', delai:'2h restantes', status:'En attente', expired:false, createdAt: d(0) },
  { _id:'dem003', id:'DEM-488', svc:'Acte de naissance',        citizen:'Karim Triki',     agent:'--',           date:'16 mars 08:30', delai:'Expiré',       status:'Expire',     expired:true,  createdAt: d(1) },
  { _id:'dem004', id:'DEM-485', svc:'Entretien espaces verts',  citizen:'Nadia Cherni',    agent:'Omar Bouzid',  date:'15 mars 10:00', delai:'Traité',       status:'Acceptee',   expired:false, createdAt: d(2) },
]

// ═══════════════════════════════════════════════════════
// USERS
// ═══════════════════════════════════════════════════════
export const users = []

// ═══════════════════════════════════════════════════════
// AGENTS
// ═══════════════════════════════════════════════════════
export const agents = [
  { _id:'agt001', init:'KZ', name:'Karim Zghal',    firstName:'Karim',   lastName:'Zghal',   dept:'Direction Technique', department:'Direction Technique', spec:'Eclairage, Routes',      specialization:['Eclairage','Routes'],      active:8, resolved:42, load:80, color:'#1A3C6B', isActive:true },
  { _id:'agt002', init:'MH', name:'Mohamed Haddad', firstName:'Mohamed', lastName:'Haddad',  dept:'Service Voirie',       department:'Service Voirie',      spec:'Routes, Signalisation',  specialization:['Routes','Signalisation'],   active:3, resolved:28, load:30, color:'#1D8C5E', isActive:true },
  { _id:'agt003', init:'OB', name:'Omar Bouzid',    firstName:'Omar',    lastName:'Bouzid',  dept:'Service Propreté',     department:'Service Proprete',    spec:'Déchets, Espaces verts', specialization:['Dechets','Espaces verts'],  active:5, resolved:35, load:50, color:'#E8873A', isActive:true },
  { _id:'agt004', init:'SB', name:'Sara Ben Ali',   firstName:'Sara',    lastName:'Ben Ali', dept:'Service Transport',    department:'Service Transport',   spec:'Transport, Logistique',  specialization:['Transport','Logistique'],   active:2, resolved:21, load:20, color:'#B8760D', isActive:true },
]

// ═══════════════════════════════════════════════════════
// COMMENTS (for moderation)
// ═══════════════════════════════════════════════════════
export const comments = [
  { _id:'com001', id:1, user:'Utilisateur Anonyme', text:'Ce service est inutile ! Rien ne se fait...', rec:'#rec001', time:'il y a 3h',  createdAt:d(0), flagged:true,  deleted:false },
  { _id:'com002', id:2, user:'Ali Ben Salah',        text:'Même problème depuis 6 mois !',               rec:'#rec002', time:'il y a 1j',  createdAt:d(1), flagged:true,  deleted:false },
  { _id:'com003', id:3, user:'Khalil Karray',        text:'Spam lien suspect http://fakesite.com',        rec:'#rec006', time:'il y a 2j',  createdAt:d(2), flagged:true,  deleted:false },
  { _id:'com004', id:4, user:'Sana Khouafi',         text:'Même problème dans notre quartier.',           rec:'#rec001', time:'il y a 2h',  createdAt:d(0), flagged:false, deleted:false },
  { _id:'com005', id:5, user:'Mohamed Haddad',       text:'Ce problème dure depuis 2 semaines.',          rec:'#rec002', time:'il y a 1j',  createdAt:d(1), flagged:false, deleted:false },
]

// ═══════════════════════════════════════════════════════
// NOTIFICATIONS
// ═══════════════════════════════════════════════════════
export const notifications = [
  { _id:'ntf001', id:1, text:'Réclamation #rec002 hors délai +72h. Réaffectation requise.',     message:'Réclamation hors délai.', title:'Alerte', time:'Il y a 1h',  createdAt:d(0), unread:true,  isRead:false, actionSec:'affectations' },
  { _id:'ntf002', id:2, text:'5 commentaires signalés comme inappropriés.',                     message:'Commentaires signalés.',  title:'Modération', time:'Il y a 2h',  createdAt:d(0), unread:true,  isRead:false, actionSec:'commentaires'  },
  { _id:'ntf003', id:3, text:'Nouvelle demande #DEM-492 de Ahmed Mansour.',                      message:'Nouvelle demande.',       title:'Demande', time:'Il y a 3h',  createdAt:d(0), unread:true,  isRead:false, actionSec:null },
  { _id:'ntf004', id:4, text:'Agent Karim Zghal a résolu la réclamation #rec001.',              message:'Réclamation résolue.',    title:'Résolution', time:'Il y a 5h',  createdAt:d(0), unread:true,  isRead:false, actionSec:null },
  { _id:'ntf005', id:5, text:'3 nouvelles inscriptions citoyens aujourd\'hui.',                 message:'Nouvelles inscriptions.', title:'Inscriptions', time:'Il y a 6h', createdAt:d(0), unread:true,  isRead:false, actionSec:null },
  { _id:'ntf006', id:6, text:'Rapport mensuel de février généré.',                              message:'Rapport généré.',         title:'Rapport', time:'Hier',       createdAt:d(1), unread:false, isRead:true,  actionSec:null },
  { _id:'ntf007', id:7, text:'Mise à jour système — Version 2.5.0',                            message:'Mise à jour.',            title:'Système', time:'Il y a 2j',  createdAt:d(2), unread:false, isRead:true,  actionSec:null },
]

// ═══════════════════════════════════════════════════════
// CONVERSATIONS
// ═══════════════════════════════════════════════════════
export const conversations = [
  {
    id: 0, user:'Ahmed Mansour', init:'AM', color:'#E8873A',
    sub:'Réclamation #rec001', badge:'progress', time:'14:22',
    msgs:[
      { out:false, text:'Bonjour, où en est ma réclamation ?' },
      { out:true,  text:'Intervention programmée demain matin 8h-10h.' },
      { out:false, text:'Merci beaucoup !' },
    ],
  },
  {
    id: 1, user:'Fatma Saidi', init:'FS', color:'#1A3C6B',
    sub:'Réclamation #rec002', badge:'urgent', time:'Hier',
    msgs:[
      { out:false, text:'Mon signalement est urgent. Des enfants sont en danger !' },
      { out:true,  text:'Bien reçu. Je classe ce dossier en priorité.' },
    ],
  },
]

// ═══════════════════════════════════════════════════════
// CATEGORY STATS
// ═══════════════════════════════════════════════════════
export const categoryStats = [
  { name:'Voirie & Routes', count:38, color:'#1A3C6B' },
  { name:'Eclairage',       count:29, color:'#E8873A' },
  { name:'Propreté',        count:22, color:'#1D8C5E' },
  { name:'Espaces verts',   count:15, color:'#B8760D' },
  { name:'Eau',             count:10, color:'#8C96AE' },
]
