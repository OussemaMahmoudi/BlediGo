import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FileText, Download, QrCode,
  CheckCircle, Clock, AlertTriangle, Loader2,
  Filter, Search, Eye, X, Ban,
  LayoutDashboard, Bell, Globe, Plus, ClipboardCheck, Settings,
} from 'lucide-react'
import { useMyReclamations } from '../../hooks/useData'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../hooks/useToast'
import AppShell from '../../components/shared/AppShell'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import { reclamationsAPI } from '../../services/api'

const STATUS_BADGE = {
  'Pending':'pending','En attente':'pending',
  'In Progress':'progress','En cours':'progress',
  'Resolved':'resolved','Resolue':'resolved',
  'Critical':'urgent','Critique':'urgent',
}

const STATUS_FR = {
  Pending:'En attente', 'In Progress':'En cours',
  Resolved:'Résolue', Critical:'Critique',
}

const URGENCY_COLOR = {
  Critical:'#E24B4A', High:'#B8760D', Medium:'#1A3C6B', Low:'#1D8C5E',
}

const safe = (v, fb='—') => (v != null && String(v).trim()) ? String(v) : fb
const safeDate = (r) => r?.date || (r?.createdAt ? new Date(r.createdAt).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric'}) : '—')
const safeId = (r) => String(r?._id||r?.id||'').slice(-6).toUpperCase() || '——'

// ── Navigation items (same as dashboard) ─────────────────
const NAV_ITEMS = [
  {
    label: 'Principal',
    items: [
      { section: 'dashboard', label: 'Tableau de bord', icon: <LayoutDashboard size={15} /> },
    ],
  },
  {
    label: 'Réclamations',
    items: [
      { section: 'reclamations', label: 'Mes réclamations', icon: <FileText size={15} />, badge: 0 },
      { section: 'signal', label: 'Nouveau signalement', icon: <Plus size={15} /> },
      { href: '/user/history', label: 'Historique & PDF', icon: <FileText size={15} /> },
    ],
  },
  {
    label: 'Services',
    items: [
      { section: 'services', label: 'Services municipaux', icon: <Settings size={15} /> },
      { section: 'demandes', label: 'Mes demandes', icon: <ClipboardCheck size={15} />, badge: 0 },
    ],
  },
  {
    label: 'Communauté',
    items: [
      { section: 'notifications', label: 'Notifications', icon: <Bell size={15} />, badge: 0, badgeRed: true },
      { href: '/public-feed', label: 'Feed public', icon: <Globe size={15} /> },
    ],
  },
]

// ── QR Code generator (pure canvas, no library needed) ──
function generateQR(canvas, text) {
  return new Promise((resolve) => {
    if (window.QRious) {
      new window.QRious({ element: canvas, value: text, size: 200, level: 'H', padding: 16 })
      resolve()
    } else {
      const s = document.createElement('script')
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrious/4.0.2/qrious.min.js'
      s.onload = () => {
        new window.QRious({ element: canvas, value: text, size: 200, level: 'H', padding: 16 })
        resolve()
      }
      document.head.appendChild(s)
    }
  })
}

// ── PDF generator (jsPDF from CDN) ──────────────────────
async function exportToPDF(rec, user, qrDataUrl) {
  if (!window.jspdf) {
    await new Promise(resolve => {
      const s = document.createElement('script')
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
      s.onload = resolve
      document.head.appendChild(s)
    })
  }

  const { jsPDF } = window.jspdf
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210, M = 20

  const NAVY   = [26, 60, 107]
  const ORANGE = [232, 135, 58]
  const LIGHT  = [242, 245, 251]
  const GRAY   = [140, 150, 174]

  doc.setFillColor(...NAVY)
  doc.rect(0, 0, W, 30, 'F')
  doc.setFillColor(...ORANGE)
  doc.roundedRect(M, 8, 14, 14, 3, 3, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text('BG', M + 7, 17.5, { align: 'center' })

  doc.setFontSize(16)
  doc.text('BlediGo', M + 18, 14)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text('Plateforme Municipale de Tunis', M + 18, 20)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text(`Réf. #${safeId(rec)}`, W - M, 13, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.text(safeDate(rec), W - M, 20, { align: 'right' })

  doc.setTextColor(...NAVY)
  doc.setFontSize(15)
  doc.setFont('helvetica', 'bold')
  const title = safe(rec.title)
  doc.text(title.length > 55 ? title.slice(0, 52) + '…' : title, M, 42)

  const statusText = STATUS_FR[rec.status] || safe(rec.status, 'En attente')
  doc.setFontSize(8)
  doc.setFillColor(...LIGHT)
  doc.setDrawColor(...NAVY)
  doc.roundedRect(M, 46, 36, 8, 2, 2, 'FD')
  doc.setTextColor(...NAVY)
  doc.text(`Statut : ${statusText}`, M + 3, 51.5)

  const urgLevel = rec.urgency?.level || 'Medium'
  const urgColor = URGENCY_COLOR[urgLevel] || URGENCY_COLOR.Medium
  const urgHex = urgColor.match(/\w\w/g).map(x => parseInt(x, 16))
  doc.setFillColor(...urgHex)
  doc.roundedRect(M + 40, 46, 36, 8, 2, 2, 'F')
  doc.setTextColor(255, 255, 255)
  doc.text(`IA : ${urgLevel} (${Math.round((rec.urgency?.confidence||0)*100)}%)`, M + 43, 51.5)

  let y = 64

  function sectionTitle(label) {
    doc.setFillColor(...NAVY)
    doc.rect(M, y, W - 2 * M, 7, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.text(label.toUpperCase(), M + 3, y + 5)
    doc.setTextColor(50, 50, 50)
    doc.setFont('helvetica', 'normal')
    y += 12
  }

  function row(label, value, fullWidth = false) {
    doc.setFontSize(7.5)
    doc.setTextColor(...GRAY)
    doc.text(label, M, y)
    doc.setTextColor(30, 30, 30)
    doc.setFont('helvetica', 'bold')
    if (fullWidth) {
      doc.setFont('helvetica', 'normal')
      const lines = doc.splitTextToSize(value, W - 2 * M - 2)
      doc.text(lines, M, y + 5)
      y += 5 + lines.length * 5 + 3
    } else {
      doc.text(value, M + 35, y)
      doc.setFont('helvetica', 'normal')
      y += 7
    }
  }

  sectionTitle('Informations générales')
  row('Citoyen', `${safe(user?.firstName)} ${safe(user?.lastName)}`)
  row('Email', safe(user?.email))
  row('Catégorie', safe(rec.category || rec.cat))
  row('Date de dépôt', safeDate(rec))
  row('Municipalité', safe(rec.location?.municipality || user?.municipality, 'Tunis'))

  y += 4
  sectionTitle('Description du problème')
  row('', safe(rec.description, 'Aucune description.'), true)

  y += 2
  sectionTitle('Localisation')
  row('Adresse', safe(rec.location?.address))
  if (rec.location?.coordinates) {
    const [lng, lat] = rec.location.coordinates
    if (lat && lng) row('Coordonnées GPS', `${lat.toFixed(5)}, ${lng.toFixed(5)}`)
  }

  y += 2
  sectionTitle('Analyse IA')
  row('Niveau d\'urgence', safe(rec.urgency?.level, 'Medium'))
  row('Confiance', `${Math.round((rec.urgency?.confidence||0)*100)}%`)
  row('Raison', safe(rec.urgency?.reason, 'Analyse automatique'))

  if (rec.assignedAgent) {
    y += 2
    sectionTitle('Agent assigné')
    const agentName = typeof rec.assignedAgent === 'object'
      ? `${safe(rec.assignedAgent.firstName)} ${safe(rec.assignedAgent.lastName)}`
      : safe(rec.assignedAgent)
    row('Nom', agentName)
    if (typeof rec.assignedAgent === 'object') {
      row('Département', safe(rec.assignedAgent.department))
    }
  }

  if (qrDataUrl) {
    const qrSize = 35
    const qrX = W - M - qrSize
    const qrY = 250
    doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize)
    doc.setFontSize(6.5)
    doc.setTextColor(...GRAY)
    doc.text('Scanner pour vérifier', qrX + qrSize / 2, qrY + qrSize + 4, { align: 'center' })
  }

  doc.setFillColor(...LIGHT)
  doc.rect(0, 285, W, 12, 'F')
  doc.setTextColor(...GRAY)
  doc.setFontSize(7)
  doc.text('BlediGo — Plateforme Municipale de Tunis', M, 292)
  doc.text(`Généré le ${new Date().toLocaleString('fr-FR')}`, W - M, 292, { align: 'right' })

  doc.save(`reclamation-${safeId(rec)}.pdf`)
}

// ── Detail Modal ─────────────────────────────────────────
function DetailModal({ rec, onClose, user }) {
  const qrRef     = useRef(null)
  const [generating, setGenerating] = useState(false)
  const [qrReady,    setQrReady]    = useState(false)
  const qrData = `https://bledigo.tn/reclamation/${rec._id || rec.id}`

  async function initQR() {
    if (!qrRef.current || qrReady) return
    await generateQR(qrRef.current, qrData)
    setQrReady(true)
  }

  async function handleExportPDF() {
    setGenerating(true)
    try {
      if (!qrRef.current) return
      await generateQR(qrRef.current, qrData)
      const qrDataUrl = qrRef.current.toDataURL('image/png')
      await exportToPDF(rec, user, qrDataUrl)
    } finally {
      setGenerating(false)
    }
  }

  const urgStyle = URGENCY_COLOR[rec?.urgency?.level] || URGENCY_COLOR.Medium
  const statusFr = STATUS_FR[rec?.status] || safe(rec?.status, 'En attente')

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-modal max-h-[90vh] overflow-y-auto custom-scroll animate-fade-up">

        <div className="flex items-start justify-between px-6 py-5 border-b border-border sticky top-0 bg-white z-10">
          <div>
            <span className="text-[11px] font-bold text-t3 uppercase tracking-wider">Réclamation #{safeId(rec)}</span>
            <h2 className="font-syne text-lg font-bold text-t1 mt-0.5 leading-snug">{safe(rec?.title)}</h2>
          </div>
          <button onClick={onClose} className="text-t3 hover:text-t1 p-1 ml-3 shrink-0 transition-colors">
            <X size={20}/>
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="flex flex-wrap gap-2">
            <Badge status={STATUS_BADGE[rec?.status]||'pending'}>{statusFr}</Badge>
            {rec?.urgency?.level && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-semibold text-white"
                style={{ background: urgStyle }}>
                IA : {rec.urgency.level} — {Math.round((rec.urgency.confidence||0)*100)}%
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              ['Catégorie',  safe(rec?.category||rec?.cat)],
              ['Date',       safeDate(rec)],
              ['Adresse',    safe(rec?.location?.address)],
              ['Agent',      typeof rec?.assignedAgent==='object'
                ? `${safe(rec?.assignedAgent?.firstName)} ${safe(rec?.assignedAgent?.lastName)}`
                : safe(rec?.assignedAgent, 'Non assigné')],
            ].map(([k,v]) => (
              <div key={k} className="bg-surface-2 rounded-[8px] p-3">
                <p className="text-[10.5px] font-bold text-t3 uppercase tracking-wide mb-1">{k}</p>
                <p className="text-[13px] font-medium text-t1 truncate">{v}</p>
              </div>
            ))}
          </div>

          <div>
            <p className="text-[11px] font-bold text-t3 uppercase tracking-wide mb-2">Description</p>
            <p className="text-[13.5px] text-t1 leading-relaxed bg-surface-2 rounded-[8px] p-4">
              {safe(rec?.description, 'Aucune description.')}
            </p>
          </div>

          {rec?.urgency?.reason && (
            <div className="px-4 py-3 rounded-[8px] border text-[13px]"
              style={{ borderColor: urgStyle + '40', background: urgStyle + '10', color: urgStyle }}>
              <span className="font-semibold">Analyse IA : </span>{rec.urgency.reason}
            </div>
          )}

          {rec?.images?.length > 0 && (
            <div>
              <p className="text-[11px] font-bold text-t3 uppercase tracking-wide mb-2">Photos ({rec.images.length})</p>
              <div className="grid grid-cols-3 gap-2">
                {rec.images.map((img, i) => (
                  <a key={i} href={`http://localhost:3001${img.url}`} target="_blank" rel="noreferrer"
                    className="aspect-square rounded-[8px] overflow-hidden border border-border hover:opacity-80 transition-opacity">
                    <img src={`http://localhost:3001${img.url}`} alt={`Photo ${i+1}`}
                      className="w-full h-full object-cover"
                      onError={e => { e.target.style.display='none' }}/>
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-start gap-5 bg-muted rounded-[10px] p-4">
            <div>
              <p className="text-[11px] font-bold text-t3 uppercase tracking-wide mb-2">QR Code</p>
              <canvas ref={ref => { qrRef.current = ref; if (ref) initQR() }}
                className="rounded-[8px] border border-border"/>
            </div>
            <div className="flex-1">
              <p className="text-[13px] text-t2 mb-1 font-medium">Code de vérification</p>
              <p className="text-[12px] text-t3 mb-4 leading-relaxed">
                Scannez ce QR code pour vérifier l'authenticité de votre réclamation.
              </p>
              <button onClick={handleExportPDF} disabled={generating}
                className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white text-[13px] font-semibold rounded-btn hover:shadow-btn-primary transition-all disabled:opacity-60">
                {generating
                  ? <><Loader2 size={14} className="animate-spin"/> Génération…</>
                  : <><Download size={14}/> Exporter en PDF</>
                }
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════
export default function UserHistory() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { toast, toasts } = useToast()
  const { data: reclamations = [], loading, refetch } = useMyReclamations()

  const [search,    setSearch]    = useState('')
  const [filter,    setFilter]    = useState('Tous')
  const [selected,  setSelected]  = useState(null)
  const [cancelling, setCancelling] = useState(null) // id being cancelled

  // ── Cancel reclamation (2h window) ────────────────────
  function canCancel(rec) {
    if (!['Pending', 'In Progress', 'En attente', 'En cours'].includes(rec?.status)) return false
    const TWO_HOURS = 2 * 60 * 60 * 1000
    const created = rec?.createdAt ? new Date(rec.createdAt) : null
    return created ? (Date.now() - created) < TWO_HOURS : false
  }

  async function handleCancel(rec) {
    const id = rec?._id || rec?.id
    if (!id) return
    setCancelling(id)
    try {
      await reclamationsAPI.cancel(id)
      toast('Réclamation annulée avec succès.', 'ok')
      refetch()
    } catch (err) {
      const msg = err?.response?.data?.message || 'Impossible d\'annuler cette réclamation.'
      toast(msg, 'err')
    } finally {
      setCancelling(null)
    }
  }

  const FILTERS = ['Tous', 'En attente', 'En cours', 'Resolue', 'Critique']

  const filtered = reclamations.filter(r => {
    const status = STATUS_FR[r?.status] || safe(r?.status, 'En attente')
    const matchFilter = filter === 'Tous' || status === filter || r?.status === filter
    const q = search.toLowerCase()
    const matchSearch = !q ||
      safe(r?.title).toLowerCase().includes(q) ||
      safe(r?.category||r?.cat).toLowerCase().includes(q) ||
      safeId(r).toLowerCase().includes(q)
    return matchFilter && matchSearch
  })

  const stats = {
    total:   reclamations.length,
    active:  reclamations.filter(r => ['Pending','En attente','In Progress','En cours','Critical','Critique'].includes(r?.status)).length,
    resolved:reclamations.filter(r => ['Resolved','Resolue'].includes(r?.status)).length,
  }

  // Sidebar user object
  const sidebarUser = {
    name: `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Citoyen',
    shortName: user?.firstName || 'Citoyen',
    color: '#E8873A',
    role: 'Citoyen',
  }

  const handleSectionChange = (section) => {
    if (section === 'signal') {
      navigate('/user/signal')
    } else if (section === 'reclamations') {
      // stay on this page (already on history)
    } else if (section === 'dashboard') {
      navigate('/user/dashboard')
    } else {
      navigate(`/user/dashboard?section=${section}`)
    }
  }

  return (
    <AppShell
      role="user"
      navItems={NAV_ITEMS}
      user={sidebarUser}
      activeSection="reclamations"
      onSectionChange={handleSectionChange}
      topTitle="Mes réclamations"
      topBreadcrumb="Historique & suivi"
      notifCount={0}
      toasts={toasts}
    >
      <div className="max-w-[960px] mx-auto p-4 lg:p-6 space-y-5">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label:'Total',    value:stats.total,    color:'text-primary',  icon:<FileText size={18}/>     },
            { label:'En cours', value:stats.active,   color:'text-warning',  icon:<Clock size={18}/>        },
            { label:'Résolues', value:stats.resolved, color:'text-success',  icon:<CheckCircle size={18}/> },
          ].map(s => (
            <div key={s.label} className="bg-white border border-border rounded-card p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-[10px] bg-muted flex items-center justify-center ${s.color}`}>{s.icon}</div>
              <div>
                <div className={`font-syne text-2xl font-bold ${s.color}`}>{s.value}</div>
                <div className="text-[12px] text-t3">{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-white border border-border rounded-card p-4 flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2 bg-surface-2 border border-border-2 rounded-[8px] px-3 py-2 flex-1 min-w-[180px]">
            <Search size={13} className="text-t3 shrink-0"/>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher…"
              className="bg-transparent border-none outline-none text-[13px] text-t1 w-full placeholder:text-t3 font-dm"/>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {FILTERS.map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-[7px] text-[12.5px] font-medium transition-all ${
                  filter === f ? 'bg-primary text-white' : 'bg-surface-2 text-t2 hover:bg-muted border border-border'
                }`}>{f}</button>
            ))}
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <Loader2 size={28} className="animate-spin text-primary"/>
              <p className="text-[13px] text-t3">Chargement de vos réclamations…</p>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white border border-border rounded-card p-12 text-center">
            <FileText size={40} className="mx-auto mb-3 text-t3 opacity-30"/>
            <p className="font-syne text-[16px] font-bold text-t1 mb-1">
              {search || filter !== 'Tous' ? 'Aucun résultat' : 'Aucune réclamation'}
            </p>
            <p className="text-[13px] text-t3 mb-5">
              {search || filter !== 'Tous'
                ? 'Essayez d\'autres filtres.'
                : 'Vous n\'avez pas encore soumis de réclamation.'}
            </p>
            {!search && filter === 'Tous' && (
              <button onClick={() => navigate('/user/signal')}
                className="px-5 py-2.5 bg-accent text-white text-[13.5px] font-semibold rounded-btn hover:shadow-btn-accent transition-all">
                Soumettre une réclamation
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2.5">
            {filtered.map((r, i) => {
              const statusFr = STATUS_FR[r?.status] || safe(r?.status, 'En attente')
              const urgLevel = r?.urgency?.level
              const urgColor = urgLevel ? URGENCY_COLOR[urgLevel] : null

              return (
                <div key={r?._id||r?.id||i}
                  className="bg-white border border-border rounded-card p-4 hover:shadow-card hover:-translate-y-0.5 transition-all cursor-pointer"
                  onClick={() => setSelected(r)}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="text-[11px] font-bold text-t3 font-mono">#{safeId(r)}</span>
                        <Badge status={STATUS_BADGE[r?.status]||'pending'}>{statusFr}</Badge>
                        {urgLevel && (
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full text-white"
                            style={{ background: urgColor }}>
                            IA: {urgLevel}
                          </span>
                        )}
                      </div>
                      <h3 className="text-[14px] font-semibold text-t1 truncate mb-1">{safe(r?.title)}</h3>
                      <p className="text-[12.5px] text-t3 truncate">
                        {safe(r?.category||r?.cat)} · {safe(r?.location?.address||r?.location)} · {safeDate(r)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={e => { e.stopPropagation(); setSelected(r) }}
                        className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-[7px] text-[12.5px] text-t2 hover:bg-muted transition-colors">
                        <Eye size={13}/> Voir
                      </button>
                    </div>
                  </div>

                  {/* Progress bar */}
                  {urgLevel && (
                    <div className="mt-3 flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all"
                          style={{
                            width: r?.status==='Resolved'||r?.status==='Resolue' ? '100%' :
                                   r?.status==='In Progress'||r?.status==='En cours' ? '60%' :
                                   r?.status==='Critique'||r?.status==='Critical' ? '15%' : '25%',
                            background: urgColor || '#1A3C6B',
                          }}/>
                      </div>
                      <span className="text-[11px] text-t3 shrink-0">
                        {r?.status==='Resolved'||r?.status==='Resolue' ? '100%' :
                         r?.status==='In Progress'||r?.status==='En cours' ? '60%' :
                         r?.status==='Critique'||r?.status==='Critical' ? '15%' : '25%'}
                      </span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Detail modal */}
      {selected && (
        <DetailModal rec={selected} user={user} onClose={() => setSelected(null)}/>
      )}
    </AppShell>
  )
}