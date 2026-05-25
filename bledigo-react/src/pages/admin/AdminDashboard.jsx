import { useState } from 'react'
import {
  LayoutDashboard, BarChart2, FileText, MessageSquare as CommentIcon,
  Settings, ClipboardCheck, UserCircle, Users,
  MessageCircle, Bell, SlidersHorizontal, AlertTriangle, CheckCircle,
  RefreshCw, Trash2, Eye, Plus, Download, UserPlus, Globe, Edit2,
} from 'lucide-react'
import { AreaChart, Area, PieChart, Pie, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, BarChart, Bar } from 'recharts'
import AppShell from '../../components/shared/AppShell'
import DetailPanel from '../../components/shared/DetailPanel'
import { Card, CardHeader, CardTitle, CardBody } from '../../components/ui/Card'
import StatCard from '../../components/ui/StatCard'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Toggle from '../../components/ui/Toggle'
import Avatar from '../../components/ui/Avatar'
import ProgressBar from '../../components/ui/ProgressBar'
import Modal from '../../components/ui/Modal'
import { FormGroup, Input, Select, Textarea } from '../../components/ui/Field'
import { useToast } from '../../hooks/useToast'
import {
  useReclamations, useServices, useDemandes,
  useUsers, useAgents, useAgentReclamations, useComments, useNotifications, useUnreadMessages
} from '../../hooks/useData'
import { useAuth } from '../../context/AuthContext'
import FilterBar from '../../components/ui/FilterBar'
import { notificationsAPI, reclamationsAPI, servicesAPI, usersAPI, agentsAPI } from '../../services/api'
import MessageriePanel from '../../components/shared/MessageriePanel'

// Mapping des statuts (anglais -> français et badge)
const statusDisplayMap = {
  'Pending': 'En attente',
  'In Progress': 'En cours',
  'Resolved': 'Résolue',
  'Rejected': 'Refusée',
  'Cancelled': 'Annulée',
  'Critical': 'Critique'   // pour l'urgence, mais ici on ne l'utilise pas dans le statut principal
}

const statusBadgeMap = {
  'Pending': 'pending',
  'In Progress': 'progress',
  'Resolved': 'resolved',
  'Rejected': 'cancelled',
  'Cancelled': 'cancelled'
}

// ── Agent recent reclamations (used inside detail modal) ──
function AgentRecentRecs({ agentId, recs, onAssign }) {
  const agentRecs = recs.filter(r => {
    const aid = r.assignedAgent?._id || r.assignedAgent || r.agent
    return String(aid) === String(agentId)
  }).slice(0, 5)

  const STATUS_BADGE = {
    'Pending': 'pending', 'In Progress': 'progress', 'Resolved': 'resolved',
    'Rejected': 'resolved', 'Cancelled': 'resolved',
  }
  const STATUS_FR = { Pending: 'En attente', 'In Progress': 'En cours', Resolved: 'Résolue', Rejected: 'Refusée', Cancelled: 'Annulée' }

  return (
    <div>
      <h4 className="font-syne text-[13.5px] font-bold mb-2">Réclamations récentes</h4>
      {agentRecs.length === 0 ? (
        <p className="text-[13px] text-t3 text-center py-4 bg-surface-2 rounded-[10px]">Aucune réclamation assignée</p>
      ) : (
        <div className="border border-border rounded-[10px] overflow-hidden">
          {agentRecs.map((r, i) => (
            <div key={r._id || r.id} className={`flex items-center gap-3 px-4 py-2.5 ${i < agentRecs.length - 1 ? 'border-b border-border' : ''} hover:bg-surface-2 transition-colors`}>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium truncate">{r.title}</p>
                <p className="text-[11.5px] text-t3">
                  <span className="font-semibold text-t2">{typeof r.citizen === 'object' ? `${r.citizen?.firstName || ''} ${r.citizen?.lastName || ''}`.trim() : r.citizen || 'Citoyen'}</span> · {r.category || r.cat} · {r.createdAt ? new Date(r.createdAt).toLocaleDateString('fr-FR') : r.date || '—'}
                </p>
              </div>
              <Badge status={STATUS_BADGE[r.status] || 'pending'}>{STATUS_FR[r.status] || r.status}</Badge>
              {['Pending', 'In Progress'].includes(r.status) && (
                <Button variant="ghost" size="sm" onClick={() => onAssign(r._id || r.id)}>Réaffecter</Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function AdminDashboard({ initialSection = 'dashboard' }) {
  const { user: authUser } = useAuth()
  const ADMIN = { name: authUser ? `${authUser.firstName} ${authUser.lastName}` : 'Administrateur', shortName: authUser?.firstName || 'Admin', color: '#E24B4A', role: authUser?.role || 'Admin' }
  const { toasts, toast } = useToast()
  
  const querySection = new URLSearchParams(window.location.search).get('section')
  const [section, setSection] = useState(querySection || initialSection)
  const [detailRec, setDetailRec] = useState(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [reassignModal, setReassignModal] = useState({ open: false, id: null, agentId: '', recId: '' })
  const [addSvcModal, setAddSvcModal] = useState(false)
  const [addUserModal, setAddUserModal] = useState(false)
  const [confirmModal, setConfirmModal] = useState({ open: false, msg: '', cb: null })
  const [agentDetailModal, setAgentDetailModal] = useState({ open: false, agent: null })
  const [demandDetailModal, setDemandDetailModal] = useState({ open: false, demand: null })
  const [demandReassignAgent, setDemandReassignAgent] = useState('')
  const [agentDetailTab, setAgentDetailTab] = useState('overview')
  const [svcModal, setSvcModal]   = useState({ open: false, mode: 'add', svc: null })
  const [svcForm, setSvcForm]    = useState({ name:'', category:'Etat civil', mode:'Presentiel', description:'', days:'Lun-Ven', openTime:'08:00', closeTime:'16:00', region:'Tunis', processingDays:5 })
  const [svcSaving, setSvcSaving] = useState(false)
  const [qrModal,   setQrModal]   = useState({ open: false, name: '', qrImage: '' })

  const { data: recs, setData: setRecs } = useReclamations()
  const { data: svcs, setData: setSvcs } = useServices()
  const { data: dems, setData: setDems } = useDemandes()
  const { data: usrs, setData: setUsrs } = useUsers()
  const { data: agts, setData: setAgts } = useAgents()
  const { data: coms, setData: setComs } = useComments()
  const { data: notifs, setData: setNotifs } = useNotifications()
  const unreadMsg = useUnreadMessages()

  const unread = notifs.filter(n => n.unread || !n.isRead).length
  const lateRecs = recs.filter(r => {
    if (r.late || r.isOverdue) return true
    if (['Resolved', 'Rejected', 'Cancelled'].includes(r.status)) return false
    const limitH = r.urgency?.level === 'Critical' ? 12 : 48
    const created = r.createdAt ? new Date(r.createdAt) : null
    return created ? (Date.now() - created) > limitH * 3600 * 1000 : false
  })

  // ── Filter state ─────────────────────────────────────
  const [recSearch, setRecSearch] = useState('')
  const [recStatus, setRecStatus] = useState('')  // valeur française (ex: "En attente")
  const [recCat, setRecCat] = useState('')
  const [recUrgency, setRecUrgency] = useState('')
  const [usrSearch, setUsrSearch] = useState('')
  const [usrRole, setUsrRole] = useState('')
  const [usrStatus, setUsrStatus] = useState('')
  const [demSearch, setDemSearch] = useState('')
  const [demStatus, setDemStatus] = useState('')
  const [agtSearch, setAgtSearch] = useState('')

  // ── Filtered data ─────────────────────────────────────
  const filteredRecs = recs.filter(r => {
    const q = recSearch.toLowerCase()
    const citizenName = typeof r.citizen === 'object'
      ? `${r.citizen?.firstName || ''} ${r.citizen?.lastName || ''}`.trim()
      : (r.citizen || '')
    const matchQ = !q || r.title?.toLowerCase().includes(q) || citizenName.toLowerCase().includes(q) || String(r._id || r.id || '').slice(-6).toLowerCase().includes(q)
    const matchS = !recStatus || (statusDisplayMap[r.status] === recStatus)
    const matchC = !recCat || r.category === recCat || r.cat === recCat
    const matchU = !recUrgency || (r.urgency?.level || r.urg) === recUrgency
    return matchQ && matchS && matchC && matchU
  })

  // Utilisateurs page = Citoyens ONLY — agents have their own dedicated page
  const filteredUsrs = usrs.filter(u => {
    if (u.role && u.role !== 'Citoyen') return false
    const q = usrSearch.toLowerCase()
    const fullName = `${u.firstName || u.name || ''} ${u.lastName || ''}`.toLowerCase()
    return !q || fullName.includes(q) || (u.email || '').toLowerCase().includes(q) || (u.cin || '').includes(q)
  })
  const filteredDems = dems.filter(d => {
    const q = demSearch.toLowerCase()
    const sName = (d.serviceName || d.svc || d.service || '').toLowerCase()
    const cName = typeof d.citizen === 'object'
      ? `${d.citizen?.firstName || ''} ${d.citizen?.lastName || ''}`.toLowerCase()
      : String(d.citizen || '').toLowerCase()
    const matchQ = !q || sName.includes(q) || cName.includes(q)
    const matchS = !demStatus || d.status === demStatus
    return matchQ && matchS
  })
  const filteredAgts = agts.filter(a => {
    const q = agtSearch.toLowerCase()
    const fullName = `${a.firstName || a.name || ''} ${a.lastName || ''}`.toLowerCase()
    return !q || fullName.includes(q) || (a.department || a.dept || '').toLowerCase().includes(q) || (a.email || '').toLowerCase().includes(q)
  })


  /* ───── NAV ───── */
  const NAV = [
    {
      label: 'Général', items: [
        { section: 'dashboard', label: 'Tableau de bord', icon: <LayoutDashboard size={15} /> },
        { section: 'rapports', label: 'Rapports & Stats', icon: <BarChart2 size={15} /> },
      ]
    },
    {
      label: 'Réclamations', items: [
        { section: 'reclamations', label: 'Réclamations', icon: <FileText size={15} />, badge: recs.filter(r => r.status !== 'Resolue').length },
        { section: 'commentaires', label: 'Commentaires', icon: <CommentIcon size={15} /> },
        { section: 'affectations', label: 'Affectations', icon: <RefreshCw size={15} />, badge: lateRecs.length, badgeRed: true },
      ]
    },
    {
      label: 'Services', items: [
        { section: 'services', label: 'Services municipaux', icon: <Settings size={15} /> },
        { section: 'demandes', label: 'Demandes services', icon: <ClipboardCheck size={15} />, badge: dems.filter(d => d.status === 'Pending').length },
      ]
    },
    {
      label: 'Utilisateurs', items: [
        { section: 'utilisateurs', label: 'Comptes citoyens', icon: <UserCircle size={15} /> },
        { section: 'agents', label: 'Agents municipaux', icon: <Users size={15} /> },
      ]
    },
    {
      label: 'Système', items: [
        { href: '/public-feed', label: 'Feed public', icon: <Globe size={15} /> },
        { section: 'messagerie', label: 'Messagerie', icon: <MessageCircle size={15} />, badge: unreadMsg || undefined, badgeRed: true },
        { section: 'notifications', label: 'Notifications', icon: <Bell size={15} />, badge: unread, badgeRed: true },
        { section: 'parametres', label: 'Paramètres', icon: <SlidersHorizontal size={15} /> },
      ]
    },
  ]

  const TITLES = {
    dashboard: 'Tableau de bord', rapports: 'Rapports & Stats', reclamations: 'Réclamations',
    commentaires: 'Commentaires', affectations: 'Affectations', services: 'Services municipaux',
    demandes: 'Demandes services', utilisateurs: 'Utilisateurs', agents: 'Agents municipaux',
    messagerie: 'Messagerie', notifications: 'Notifications', parametres: 'Paramètres',
  }

  /* ───── HELPERS ───── */
  function openDetail(id) {
    setDetailRec(recs.find(r => (r._id || r.id) === id) ?? null)
    setDetailOpen(true)
  }

  async function resolveRec(id) {
    try {
      await reclamationsAPI.updateStatus(id, 'Resolved', { report: 'Résolution confirmée par l\'administrateur.' })
      setRecs(prev => prev.map(r => (r._id || r.id) === id ? { ...r, status: 'Resolved', isOverdue: false } : r))
      setDetailOpen(false)
      toast(`Réclamation résolue ✓`, 'ok')
    } catch { toast('Erreur lors de la résolution', 'err') }
  }

  async function statusChange(id, newStatus) {
    const STATUS_MAP = { 'En attente': 'Pending', 'En cours': 'In Progress', 'Resolue': 'Resolved', 'Resolved': 'Resolved', 'Pending': 'Pending', 'In Progress': 'In Progress' }
    const apiStatus = STATUS_MAP[newStatus] || newStatus
    try {
      await reclamationsAPI.updateStatus(id, apiStatus)
      setRecs(prev => prev.map(r => (r._id || r.id) === id ? { ...r, status: apiStatus, isOverdue: apiStatus === 'Resolved' ? false : r.isOverdue } : r))
      toast(`Statut mis à jour : ${newStatus}`, 'ok')
    } catch { toast('Erreur lors de la mise à jour du statut', 'err') }
  }

  async function doReassign(id, agentId) {
    const targetId = id || reassignModal.recId
    if (!agentId) { toast('Sélectionnez un agent', 'err'); return }
    if (!targetId) { toast('Sélectionnez une réclamation', 'err'); return }
    try {
      await reclamationsAPI.assignAgent(targetId, agentId)
      const agent = agts.find(a => (a._id || a.id) === agentId)
      setRecs(prev => prev.map(r => (r.id || r._id) === targetId ? { ...r, agent: agent?.firstName ? `${agent.firstName} ${agent.lastName}` : agentId, status: 'In Progress', late: false, isOverdue: false } : r))
      setReassignModal({ open: false, id: null, agentId: '', recId: '' })
      toast(`Réclamation réaffectée avec succès`, 'ok')
    } catch {
      toast('Erreur lors de la réaffectation', 'err')
    }
  }

  function deleteRec(id) {
    setConfirmModal({
      open: true, msg: `Supprimer cette réclamation ?`, cb: async () => {
        try {
          await reclamationsAPI.delete(id)
          setRecs(prev => prev.filter(r => (r._id || r.id) !== id))
          setDetailOpen(false)
          toast('Réclamation supprimée', 'ok')
        } catch { toast('Erreur lors de la suppression', 'err') }
      }
    })
  }

  async function toggleSvc(id) {
    const svc = svcs.find(s => (s._id || s.id) === id)
    const newActive = !(svc?.isActive ?? svc?.active ?? true)
    try {
      await servicesAPI.update(id, { isActive: newActive })
      setSvcs(prev => prev.map(s => (s._id || s.id) === id ? { ...s, active: newActive, isActive: newActive } : s))
    } catch { toast('Erreur mise à jour service', 'err') }
  }

  function deleteSvc(id) {
    setConfirmModal({
      open: true, msg: `Supprimer ce service définitivement ?`, cb: async () => {
        try {
          await servicesAPI.delete(id)
          setSvcs(prev => prev.filter(s => (s._id || s.id) !== id))
          toast('Service supprimé', 'ok')
        } catch { toast('Erreur lors de la suppression du service', 'err') }
      }
    })
  }

  async function showQR(svc) {
    const sid = svc._id || svc.id
    if (svc.qrCode?.imageUrl) {
      setQrModal({ open: true, name: svc.name, qrImage: svc.qrCode.imageUrl })
      return
    }
    try {
      const res = await servicesAPI.getQR(sid)
      const img = res?.data?.qrImage || res?.qrImage || ''
      setSvcs(prev => prev.map(s => (s._id || s.id) === sid ? { ...s, qrCode: { ...s.qrCode, imageUrl: img } } : s))
      setQrModal({ open: true, name: svc.name, qrImage: img })
    } catch { toast('QR code indisponible', 'err') }
  }

  function openAddSvc() {
    const today = new Date().toISOString().split('T')[0]
    setSvcForm({ name:'', category:'Etat civil', mode:'Presentiel', description:'', days: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven'], openTime:'08:00', closeTime:'16:00', region:'Tunis', processingDays:5, date: today })
    setSvcModal({ open: true, mode: 'add', svc: null })
  }

  function openEditSvc(svc) {
    let dateStr = new Date().toISOString().split('T')[0]
    try {
      const d = svc.date || svc.createdAt
      if (d) dateStr = new Date(d).toISOString().split('T')[0]
    } catch(e) {}
    
    let parsedDays = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven']
    if (svc.schedule?.days) {
      if (svc.schedule.days === 'Lun-Ven') parsedDays = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven']
      else parsedDays = svc.schedule.days.split(',').map(d => d.trim())
    }
    
    setSvcForm({
      name: svc.name || '',
      category: svc.category || 'Etat civil',
      mode: svc.mode || 'Presentiel',
      description: svc.description || '',
      days: parsedDays,
      openTime: svc.schedule?.openTime || '08:00',
      closeTime: svc.schedule?.closeTime || '16:00',
      region: svc.location?.municipality || 'Tunis',
      processingDays: svc.processingDays || 5,
      date: dateStr,
    })
    setSvcModal({ open: true, mode: 'edit', svc })
  }

  async function saveSvc() {
    if (!svcForm.name.trim()) { toast('Le nom est requis', 'err'); return }
    setSvcSaving(true)
    const payload = {
      name: svcForm.name.trim(),
      category: svcForm.category,
      mode: svcForm.mode,
      description: svcForm.description,
      schedule: { days: Array.isArray(svcForm.days) ? svcForm.days.join(', ') : svcForm.days, openTime: svcForm.openTime, closeTime: svcForm.closeTime },
      location: { municipality: svcForm.region },
      processingDays: Number(svcForm.processingDays) || 5,
      date: svcForm.date,
    }
    try {
      if (svcModal.mode === 'add') {
        const res = await servicesAPI.create(payload)
        const newSvc = res?.data || res
        setSvcs(prev => [newSvc, ...prev])
        toast('Service créé avec QR code ✓', 'ok')
      } else {
        const sid = svcModal.svc._id || svcModal.svc.id
        const res = await servicesAPI.update(sid, payload)
        const updated = res?.data || res
        setSvcs(prev => prev.map(s => (s._id || s.id) === sid ? { ...s, ...updated } : s))
        toast('Service mis à jour ✓', 'ok')
      }
      setSvcModal({ open: false, mode: 'add', svc: null })
    } catch (e) {
      toast(e?.response?.data?.message || 'Erreur lors de la sauvegarde', 'err')
    } finally {
      setSvcSaving(false)
    }
  }

  async function acceptDem(demId, svcId) {
    if (!svcId) { toast('Service introuvable', 'err'); return }
    try {
      await servicesAPI.processDemand(svcId, demId, 'Accepted')
      setDems(prev => prev.map(d => (d._id || d.id) === demId ? { ...d, status: 'Accepted' } : d))
      toast('Demande acceptée ✓', 'ok')
    } catch(e) {
      toast(e?.response?.data?.message || 'Erreur', 'err')
    }
  }

  async function refuseDem(demId, svcId) {
    if (!svcId) { toast('Service introuvable', 'err'); return }
    try {
      await servicesAPI.processDemand(svcId, demId, 'Rejected')
      setDems(prev => prev.map(d => (d._id || d.id) === demId ? { ...d, status: 'Rejected' } : d))
      toast('Demande refusée', 'ok')
    } catch(e) {
      toast(e?.response?.data?.message || 'Erreur', 'err')
    }
  }

  function openDemandDetail(dem) {
    setDemandReassignAgent('')
    setDemandDetailModal({ open: true, demand: dem })
  }

  async function doReassignDemand(demId, svcId, agentId) {
    if (!agentId) { toast('Sélectionnez un agent', 'err'); return }
    if (!svcId)   { toast('Service introuvable', 'err'); return }
    try {
      await servicesAPI.reassignDemand(svcId, demId, agentId)
      const agent = agts.find(a => (a._id || a.id) === agentId)
      const agentName = agent ? `${agent.firstName} ${agent.lastName}`.trim() : 'Agent'
      setDems(prev => prev.map(d => (d._id || d.id) === demId ? { ...d, processedBy: agentId, processedByName: agentName } : d))
      setDemandDetailModal(p => ({
        ...p,
        demand: p.demand ? { ...p.demand, processedBy: agentId, processedByName: agentName } : p.demand
      }))
      setDemandReassignAgent('')
      toast(`Demande réaffectée à ${agentName} ✓`, 'ok')
    } catch (e) {
      toast(e?.response?.data?.message || 'Erreur lors de la réaffectation', 'err')
    }
  }

  async function toggleUser(id) {
    try {
      await usersAPI.toggleActive(id)
      setUsrs(prev => prev.map(u => (u.id || u._id) === id ? { ...u, active: !u.active, isActive: !u.isActive } : u))
      const u = usrs.find(u => (u.id || u._id) === id)
      toast(`Compte ${u?.active || u?.isActive ? 'désactivé' : 'activé'}`, 'ok')
    } catch {
      toast('Erreur lors de la mise à jour', 'err')
    }
  }

  function approveComment(id) {
    setComs(prev => prev.map(c => (c.id || c._id) === id ? { ...c, flagged: false } : c))
    toast('Commentaire approuvé', 'ok')
  }

  async function deleteComment(id) {
    setConfirmModal({
      open: true, msg: 'Supprimer ce commentaire ?', cb: async () => {
        const ownerRec = recs.find(r => (r.comments || []).some(c => (c.id || c._id) === id))
        try {
          if (ownerRec) await reclamationsAPI.deleteComment(ownerRec._id || ownerRec.id, id)
        } catch { }
        setComs(prev => prev.map(c => (c.id || c._id) === id ? { ...c, deleted: true, flagged: false } : c))
        toast('Commentaire supprimé', 'ok')
      }
    })
  }

  function sendMsg() {
    if (!msgInput.trim()) return
    const txt = msgInput.trim()
    setConvos(prev => prev.map((c, i) => i === activeConvo ? { ...c, msgs: [...c.msgs, { out: true, txt }] } : c))
    setMsgInput('')
    setTimeout(() => {
      setConvos(prev => prev.map((c, i) => i === activeConvo ? { ...c, msgs: [...c.msgs, { out: false, txt: 'Message bien reçu, merci.' }] } : c))
    }, 1200)
  }

  /* ───── TABLE RENDER ───── */
  function RecTable({ data }) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {['Réf.', 'Problème', 'Citoyen', 'Agent', 'Catégorie', 'Urgence', 'Statut', 'Actions'].map(h => (
                <th key={h} className="text-[11px] font-bold text-t3 uppercase tracking-wide px-4 py-2.5 text-left bg-surface-2 border-b border-border">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map(r => {
              const rid = r._id || r.id
              const isLate = r.late || r.isOverdue
              const citizen = typeof r.citizen === 'object'
                ? `${r.citizen?.firstName || ''} ${r.citizen?.lastName || ''}`.trim() || '—'
                : r.citizen || '—'
              const agent = typeof r.assignedAgent === 'object' && r.assignedAgent
                ? `${r.assignedAgent?.firstName || ''} ${r.assignedAgent?.lastName || ''}`.trim() || '—'
                : r.agent || '—'
              const cat = r.category || r.cat || '—'
              const urg = r.urgency?.level || (typeof r.urgency === 'string' ? r.urgency : null) || r.urg || 'Normal'
              const urgCls = urg === 'Critical' ? 'text-danger' : urg === 'High' ? 'text-warning' : urg === 'Low' ? 'text-success' : 'text-primary'
              const dateStr = r.createdAt ? new Date(r.createdAt).toLocaleDateString('fr-FR') : r.date || '—'
              const statusFr = statusDisplayMap[r.status] || r.status || '—'
              const badgeVar = statusBadgeMap[r.status] || 'pending'
              return (
                <tr key={rid} className={`cursor-default hover:bg-surface-2 border-b border-border last:border-0 transition-colors ${isLate ? 'bg-danger-light/20' : ''}`}>
                  <td className={`px-4 py-3 font-bold text-[13px] ${isLate ? 'text-danger' : 'text-primary'}`}>#{String(rid || '').slice(-6)}</td>
                  <td className="px-4 py-3 text-[13px] max-w-[150px] truncate">{r.title}</td>
                  <td className="px-4 py-3 text-[12.5px]">{citizen}</td>
                  <td className="px-4 py-3 text-[12.5px]">{agent}</td>
                  <td className="px-4 py-3"><span className="text-[11.5px] px-2 py-0.5 rounded bg-muted text-t2 border border-border font-medium">{cat}</span></td>
                  <td className={`px-4 py-3 text-[12px] font-semibold ${urgCls}`}>● {urg}</td>
                  <td className="px-4 py-3"><Badge status={badgeVar}>{statusFr}</Badge></td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <div className="flex gap-1.5">
                      <Button variant="outline" size="sm" onClick={() => openDetail(rid)}>
                        <Eye size={12} />
                      </Button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <>
      <AppShell
        role="admin" navItems={NAV} user={ADMIN}
        activeSection={section} onSectionChange={setSection}
        topTitle={TITLES[section] ?? 'Dashboard'} topBreadcrumb="Administration BlediGo"
        notifCount={unread} onNotifClick={() => setSection('notifications')}
        userStats={{ reclamations: recs.length, resolved: recs.filter(r => r.status === 'Resolue').length }}
        toasts={toasts}
      >

        {/* ── 1. DASHBOARD ── */}
        {section === 'dashboard' && (
          <div className="animate-fade-up">
            <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
              <div><h1 className="font-syne text-xl font-bold">Tableau de bord</h1><p className="text-[13px] text-t3 mt-0.5">Mercredi 18 mars 2026</p></div>
              <Button variant="primary" size="sm" onClick={() => setAddSvcModal(true)}><Plus size={14} /> Ajouter un service</Button>
            </div>
            {lateRecs.length > 0 && (
              <div className="flex items-center gap-2 mb-4 px-4 py-3 bg-warning-light text-warning border border-yellow-300 rounded-[10px] text-[13px]">
                <AlertTriangle size={15} />
                <span><strong>{lateRecs.length} réclamations</strong> dépassent le délai.</span>
                <Button variant="warning" size="sm" className="ml-auto" onClick={() => setSection('affectations')}>Gérer →</Button>
              </div>
            )}
            <div className="grid grid-cols-4 gap-3.5 mb-5">
              <StatCard icon={<FileText size={18} />} value={recs.length} label="Réclamations totales" change="+12 ce mois" color="blue" />
              <StatCard icon={<CheckCircle size={18} />} value={recs.filter(r => r.status === 'Resolue').length} label="Résolues" change="+8 cette semaine" color="green" />
              <StatCard icon={<Settings size={18} />} value={svcs.filter(s => s.isActive !== false).length} label="Services actifs" change="+3 nouveaux" color="orange" />
              <StatCard icon={<AlertTriangle size={18} />} value={lateRecs.length} label="En retard" change="Hors délai" changeType="dn" color="red" />
            </div>
            <div className="grid grid-cols-[1fr_280px] gap-4">
              <div className="flex flex-col gap-4">
                <Card>
                  <CardHeader><CardTitle>Réclamations récentes</CardTitle><Button variant="ghost" size="sm" onClick={() => setSection('reclamations')}>Voir tout →</Button></CardHeader>
                  <RecTable data={recs.slice(0, 4)} />
                </Card>
                <Card>
                  <CardHeader><CardTitle>Activité — 30 derniers jours</CardTitle><span className="text-[12px] text-t3">Mars 2026</span></CardHeader>
                  <CardBody>
                    <div className="w-full h-[150px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={[
                          { name: '1 Mar', v1: 20, v2: 12 },
                          { name: '8 Mar', v1: 35, v2: 25 },
                          { name: '15 Mar', v1: 28, v2: 30 },
                          { name: '22 Mar', v1: 50, v2: 45 },
                          { name: '29 Mar', v1: 45, v2: 60 }
                        ]} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorV1" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#1A3C6B" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#1A3C6B" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="colorV2" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#1D8C5E" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#1D8C5E" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                          <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                          <Area type="monotone" dataKey="v1" stroke="#1A3C6B" fillOpacity={1} fill="url(#colorV1)" strokeWidth={2} name="Soumises" />
                          <Area type="monotone" dataKey="v2" stroke="#1D8C5E" fillOpacity={1} fill="url(#colorV2)" strokeWidth={2} name="Résolues" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex gap-4 mt-2">
                      <div className="flex items-center gap-1.5 text-[12px] text-t2"><div className="w-3.5 h-[3px] bg-success rounded" /><span>Résolues</span></div>
                      <div className="flex items-center gap-1.5 text-[12px] text-t2"><div className="w-3.5 h-0.5 border-t-2 border-dashed border-primary" /><span>Soumises</span></div>
                    </div>
                  </CardBody>
                </Card>
              </div>
              <div className="flex flex-col gap-4">
                <Card>
                  <CardHeader><CardTitle>Par catégorie</CardTitle></CardHeader>
                  <CardBody className="flex items-center justify-center">
                    <div className="w-full h-[160px] relative">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={[
                            { n: 'Voirie', v: 38, c: '#1A3C6B' },
                            { n: 'Eclairage', v: 29, c: '#E8873A' },
                            { n: 'Propreté', v: 22, c: '#1D8C5E' },
                            { n: 'Eau', v: 10, c: '#8C96AE' }
                          ]} dataKey="v" nameKey="n" innerRadius={40} outerRadius={70} stroke="none" paddingAngle={2}>
                            {[{ c: '#1A3C6B' }, { c: '#E8873A' }, { c: '#1D8C5E' }, { c: '#8C96AE' }].map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.c} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px', padding: '4px 8px' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardBody>
                </Card>
                <Card>
                  <CardHeader><CardTitle>Demandes récentes</CardTitle><Button variant="ghost" size="sm" onClick={() => setSection('demandes')}>Voir →</Button></CardHeader>
                  {dems.slice(0, 3).map(d => {
                    const did = d._id || d.id
                    const cName = typeof d.citizen === 'object' ? `${d.citizen?.firstName || ''} ${d.citizen?.lastName || ''}`.trim() : String(d.citizen || '—')
                    const DEM_STATUS = { Pending: 'En attente', Accepted: 'Acceptée', Rejected: 'Refusée', Expired: 'Expirée' }
                    const DEM_BADGE = { Pending: 'pending', Accepted: 'resolved', Rejected: 'cancelled', Expired: 'urgent' }
                    return (
                      <div key={did} className="flex items-center gap-2.5 px-4 py-3 border-b border-border last:border-0">
                        <Avatar name={cName} size={28} />
                        <div className="flex-1 min-w-0"><p className="text-[13px] font-medium truncate">{d.serviceName || d.svc || '—'}</p><p className="text-[11.5px] text-t3">{cName}</p></div>
                        <Badge status={DEM_BADGE[d.status] ?? 'pending'}>{DEM_STATUS[d.status] || d.status || 'En attente'}</Badge>
                      </div>
                    )
                  })}
                </Card>
              </div>
            </div>
          </div>
        )}

        {/* ── 2. RAPPORTS ── */}
        {section === 'rapports' && (
          <div className="animate-fade-up">
            <div className="flex items-start justify-between mb-5"><h1 className="font-syne text-xl font-bold">Rapports & Statistiques</h1><Button variant="outline" size="sm" onClick={() => toast('Export PDF lancé', 'ok')}><Download size={14} /> Exporter PDF</Button></div>
            <div className="grid grid-cols-4 gap-3.5 mb-5">
              {[{ v: recs.length, l: 'Réclamations totales', c: 'text-primary' }, { v: '66%', l: 'Taux de résolution', c: 'text-success' }, { v: '38h', l: 'Délai moyen', c: 'text-accent' }, { v: '4.3★', l: 'Satisfaction', c: 'text-primary' }].map(k => (
                <div key={k.l} className="bg-white border border-border rounded-card p-5 text-center">
                  <div className={`font-syne text-[30px] font-bold ${k.c}`}>{k.v}</div>
                  <div className="text-[12.5px] text-t3 mt-1">{k.l}</div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <Card>
                <CardHeader><CardTitle>Réclamations par mois</CardTitle></CardHeader>
                <CardBody>
                  <div className="w-full h-[160px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={[
                        { m: 'Oct', h: 60 },
                        { m: 'Nov', h: 80 },
                        { m: 'Déc', h: 100 },
                        { m: 'Jan', h: 90 },
                        { m: 'Fév', h: 120 },
                        { m: 'Mars', h: 150, hi: true }
                      ]} margin={{ top: 10, right: 0, bottom: 0, left: 0 }} barSize={24}>
                        <XAxis dataKey="m" axisLine={false} tickLine={false} dy={5} fontSize={11} stroke="#9CA3AF" />
                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} cursor={{ fill: '#F3F4F6' }} />
                        <Bar dataKey="h" radius={[4, 4, 0, 0]}>
                          {[{ m: 'Oct', h: 60 }, { m: 'Nov', h: 80 }, { m: 'Déc', h: 100 }, { m: 'Jan', h: 90 }, { m: 'Fév', h: 120 }, { m: 'Mars', h: 150, hi: true }].map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.hi ? '#2563EB' : '#BFDBFE'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardBody>
              </Card>
              <Card>
                <CardHeader><CardTitle>Performance agents</CardTitle></CardHeader>
                <CardBody>
                  <div className="w-full h-[160px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart layout="vertical" data={[
                        { name: 'Karim', v: 42, color: '#1A3C6B' },
                        { name: 'Omar', v: 35, color: '#E8873A' },
                        { name: 'Mohamed', v: 28, color: '#1D8C5E' }
                      ]} margin={{ top: 0, right: 30, left: 10, bottom: 0 }} barSize={16}>
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={60} fontSize={12} stroke="#374151" />
                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} cursor={{ fill: '#F3F4F6' }} />
                        <Bar dataKey="v" radius={[0, 4, 4, 0]} name="Résolues">
                          {[{ name: 'Karim', color: '#1A3C6B' }, { name: 'Omar', color: '#E8873A' }, { name: 'Mohamed', color: '#1D8C5E' }].map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardBody>
              </Card>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Demandes par Catégorie</CardTitle>
                </CardHeader>
                <CardBody className="pt-2 pb-4">
                  <div className="w-full h-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={Object.entries(
                        svcs.reduce((acc, s) => {
                          const cat = s.category || 'Autre';
                          acc[cat] = (acc[cat] || 0) + (s.stats?.totalDemands ?? s.demands?.length ?? 0);
                          return acc;
                        }, {})
                      ).map(([name, dem]) => ({ name, dem })).sort((a,b) => b.dem - a.dem)} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} dy={10} fontSize={11} stroke="#6B7280" interval={0} 
                               tick={props => {
                                 const { x, y, payload } = props;
                                 return <text x={x} y={y} dy={16} textAnchor="middle" fill="#6B7280" fontSize={11}>{payload.value.length > 12 ? payload.value.substring(0, 10)+'...' : payload.value}</text>;
                               }} />
                        <YAxis axisLine={false} tickLine={false} fontSize={11} stroke="#6B7280" />
                        <Tooltip cursor={{ fill: '#F3F4F6' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '13px' }} />
                        <Bar dataKey="dem" radius={[4, 4, 0, 0]} name="Demandes" barSize={32}>
                          {Object.entries(
                            svcs.reduce((acc, s) => {
                              const cat = s.category || 'Autre';
                              acc[cat] = (acc[cat] || 0) + (s.stats?.totalDemands ?? s.demands?.length ?? 0);
                              return acc;
                            }, {})
                          ).map(([name, dem]) => ({ name, dem })).sort((a,b) => b.dem - a.dem).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={['#1A3C6B', '#1D8C5E', '#E8873A', '#8C96AE', '#4B5563', '#3B82F6'][index % 6]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardBody>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Canaux d'Accès</CardTitle>
                </CardHeader>
                <CardBody className="flex flex-col items-center justify-center p-0 pt-0 pb-4 h-[220px]">
                  <div className="w-full flex-1">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={Object.entries(
                            svcs.reduce((acc, s) => {
                              const m = s.mode || 'Presentiel';
                              acc[m] = (acc[m] || 0) + 1;
                              return acc;
                            }, {})
                          ).map(([name, value]) => ({ name, value }))}
                          dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={2} stroke="none"
                        >
                          {Object.entries(
                            svcs.reduce((acc, s) => {
                              const m = s.mode || 'Presentiel';
                              acc[m] = (acc[m] || 0) + 1;
                              return acc;
                            }, {})
                          ).map((e, i) => <Cell key={`cell-${i}`} fill={['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6'][i % 4]} />)}
                        </Pie>
                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '13px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-wrap justify-center gap-3 px-4 w-full mt-2">
                    {Object.entries(
                      svcs.reduce((acc, s) => {
                        const m = s.mode || 'Presentiel';
                        acc[m] = (acc[m] || 0) + 1;
                        return acc;
                      }, {})
                    ).map(([name, value], i) => (
                      <div key={name} className="flex items-center gap-1.5 text-[12px] text-t2 font-medium">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6'][i % 4] }} />
                        {name} ({value})
                      </div>
                    ))}
                  </div>
                </CardBody>
              </Card>

              <Card className="col-span-1 lg:col-span-3">
                <CardHeader><CardTitle>Aperçu Global de la Plateforme</CardTitle></CardHeader>
                <CardBody>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-full">
                    <div className="flex flex-col justify-center items-center p-4 bg-muted rounded-[10px] hover:bg-surface-2 transition-colors">
                      <Users size={24} className="text-primary mb-2" />
                      <span className="font-syne font-bold text-xl">{usrs.filter(u => u.role === 'Citoyen').length || 240}</span>
                      <span className="text-[12px] text-t3">Citoyens Inscrits</span>
                    </div>
                    <div className="flex flex-col justify-center items-center p-4 bg-muted rounded-[10px] hover:bg-surface-2 transition-colors">
                      <UserCircle size={24} className="text-success mb-2" />
                      <span className="font-syne font-bold text-xl">{agts.length || 15}</span>
                      <span className="text-[12px] text-t3">Agents Opérationnels</span>
                    </div>
                    <div className="flex flex-col justify-center items-center p-4 bg-muted rounded-[10px] hover:bg-surface-2 transition-colors">
                      <ClipboardCheck size={24} className="text-warning mb-2" />
                      <span className="font-syne font-bold text-xl">{dems.length || 89}</span>
                      <span className="text-[12px] text-t3">Total Demandes</span>
                    </div>
                  </div>
                </CardBody>
              </Card>
            </div>
          </div>
        )}

        {/* ── 3. RÉCLAMATIONS ── */}
        {section === 'reclamations' && (
          <div className="animate-fade-up space-y-4">
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div>
                <h1 className="font-syne text-xl font-bold">Réclamations</h1>
                <p className="text-[13px] text-t3 mt-0.5">{filteredRecs.length} / {recs.length} réclamations</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => toast('Export CSV lancé', 'ok')}><Download size={14} /> Export CSV</Button>
            </div>
            {lateRecs.length > 0 && (
              <div className="flex items-center gap-2 px-4 py-3 bg-warning-light text-warning border border-yellow-300 rounded-[10px] text-[13px]">
                <AlertTriangle size={15} /><span><strong>{lateRecs.length} réclamations</strong> dépassent le délai.</span>
                <Button variant="warning" size="sm" className="ml-auto" onClick={() => setSection('affectations')}>Gérer →</Button>
              </div>
            )}
            <FilterBar
              search={recSearch} onSearch={setRecSearch}
              chips={[
                { label: 'Toutes', value: '' },
                { label: 'En attente', value: 'En attente' },
                { label: 'En cours', value: 'En cours' },
                { label: 'Résolues', value: 'Resolue' },
                { label: 'Critique', value: 'Critique' },
              ]}
              activeChip={recStatus} onChip={setRecStatus}
              selects={[
                { value: recCat, onChange: setRecCat, placeholder: 'Toutes catégories', options: ['Eclairage public', 'Voirie & Routes', 'Propreté & Déchets', 'Eau & Assainissement', 'Signalisation', 'Espaces verts', 'Bâtiments publics'] },
                { value: recUrgency, onChange: setRecUrgency, placeholder: 'Toute urgence', options: ['Critical', 'High', 'Medium', 'Low'] },
              ]}
              count={filteredRecs.length} countLabel="résultat(s)"
            />
            <Card>
              {filteredRecs.length === 0
                ? <div className="py-12 text-center text-t3"><FileText size={32} className="mx-auto mb-2 opacity-25" /><p className="font-medium">Aucune réclamation</p><p className="text-[13px] mt-1">Modifiez vos filtres</p></div>
                : <RecTable data={filteredRecs} />
              }
            </Card>
          </div>
        )}

        {/* ── 4. COMMENTAIRES ── */}
        {section === 'commentaires' && (
          <div className="animate-fade-up">
            <h1 className="font-syne text-xl font-bold mb-5">Tous les commentaires</h1>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <Card>
                  <CardHeader><CardTitle>Derniers Commentaires</CardTitle></CardHeader>
                  <CardBody className="flex flex-col gap-3">
                    {coms.filter(c => !c.deleted).length === 0 ? <p className="text-center text-t3 py-6">Aucun commentaire ✅</p> :
                      coms.filter(c => !c.deleted)
                        .sort((a,b) => (b.timestamp || 0) - (a.timestamp || 0))
                        .map(c => (
                        <div key={c.id} className="flex gap-2.5">
                          <Avatar name={c.user} size={36} />
                          <div className="flex-1 bg-surface-2 border border-border rounded-[9px] p-3">
                            <div className="flex justify-between items-start mb-1.5">
                              <div>
                                <span className="text-[13.5px] font-bold mr-2">{c.user}</span>
                                <Badge status="resolved">En ligne</Badge>
                              </div>
                              <Button variant="ghost" size="sm" className="text-danger hover:bg-danger-light hover:text-danger rounded" onClick={() => deleteComment(c.id)}>
                                Supprimer
                              </Button>
                            </div>
                            <p className="text-[13px] text-t1 leading-relaxed">"{c.text}"</p>
                            <p className="text-[11.5px] text-t3 mt-2">{c.rec} · {c.time}</p>
                          </div>
                        </div>
                      ))
                    }
                  </CardBody>
                </Card>
              </div>
              <div className="flex flex-col gap-4">
                <Card>
                  <CardHeader><CardTitle>Statistiques</CardTitle></CardHeader>
                  <CardBody className="flex flex-col gap-3">
                    {[['Total', coms.length, 'text-t1'], ['En ligne', coms.filter(c => !c.deleted).length, 'text-success'], ['Supprimés', coms.filter(c => c.deleted).length, 'text-danger']].map(([l, v, cls]) => (
                      <div key={l} className="flex justify-between items-center text-[13.5px]">
                        <span className="text-t2">{l}</span>
                        <span className={`font-bold text-[15px] ${cls}`}>{v}</span>
                      </div>
                    ))}
                  </CardBody>
                </Card>
              </div>
            </div>
          </div>
        )}

        {/* ── 5. AFFECTATIONS ── */}
        {section === 'affectations' && (
          <div className="animate-fade-up">
            <h1 className="font-syne text-xl font-bold mb-5">Affectations & Suivi agents</h1>
            {lateRecs.length > 0 && <div className="flex items-center gap-2 mb-4 px-4 py-3 bg-danger-light text-danger border border-red-200 rounded-[10px] text-[13px]"><AlertTriangle size={15} />Réclamations <strong>{lateRecs.map(r => '#' + r.id).join(', ')}</strong> dépassent le délai de 48h.</div>}
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardHeader><CardTitle>Charge par agent</CardTitle></CardHeader>
                {filteredAgts.map(a => {
                  const aId = a._id || a.id
                  const aName = `${a.firstName || ''} ${a.lastName || ''}`.trim() || (a.name || 'Agent')
                  const aLoad = a.stats?.load ?? 0
                  const aActive = a.stats?.active ?? 0
                  const isAct = a.isActive !== false
                  return (
                    <div key={aId} className={`px-4 py-3.5 border-b border-border last:border-0 ${!isAct ? 'opacity-50' : ''}`}>
                      <div className="flex items-center gap-2.5 mb-2">
                        <Avatar name={aName} color={isAct ? '#1D8C5E' : '#888'} size={32} />
                        <div className="flex-1 min-w-0">
                          <p className="text-[13.5px] font-semibold truncate">{aName}</p>
                          <p className="text-[11.5px] text-t3">{a.department || a.dept || '—'}</p>
                        </div>
                        <Badge status={aLoad > 70 ? 'urgent' : aLoad > 40 ? 'pending' : 'resolved'}>{aActive} actives</Badge>
                      </div>
                      <ProgressBar value={aLoad} color={aLoad > 70 ? '#E8873A' : aLoad > 50 ? '#B8760D' : '#1D8C5E'} />
                      <p className="text-[11px] text-t3 mt-1">Charge {aLoad > 70 ? 'élevée' : aLoad > 40 ? 'modérée' : 'normale'} — {aLoad}%</p>
                    </div>
                  )
                })}
              </Card>
              <Card>
                <CardHeader><CardTitle>Hors délai</CardTitle><Badge status="urgent">{lateRecs.length} urgentes</Badge></CardHeader>
                {lateRecs.map(r => (
                  <div key={r._id || r.id} className="px-4 py-3.5 border-b border-border last:border-0 bg-danger-light/20">
                    <div className="flex justify-between mb-1">
                      <span className="font-bold text-danger text-[13px]">#{String(r._id || r.id || '').slice(-6)}</span>
                      <Badge status="urgent">Hors délai</Badge>
                    </div>
                    <p className="text-[13px] font-medium mb-1 truncate">{r.title}</p>
                    <p className="text-[11.5px] text-t3 mb-2">
                      <strong className="text-t2">{typeof r.citizen === 'object' ? `${r.citizen?.firstName || ''} ${r.citizen?.lastName || ''}`.trim() : r.citizen || 'Citoyen'}</strong> · {r.assignedAgent
                        ? `Agent : ${r.assignedAgent?.firstName || ''} ${r.assignedAgent?.lastName || ''}`.trim()
                        : 'Non assigné'
                      } · {r.createdAt ? new Date(r.createdAt).toLocaleDateString('fr-FR') : r.date || '—'}
                    </p>
                    <Button variant="accent" full size="sm" onClick={() => setReassignModal({ open: true, id: r._id || r.id, agentId: '', recId: '' })}>Réaffecter maintenant</Button>
                  </div>
                ))}
                {lateRecs.length === 0 && <div className="text-center py-10 text-t3"><CheckCircle size={32} className="mx-auto mb-2 text-success" /><p>Aucune réclamation en retard !</p></div>}
              </Card>
            </div>
          </div>
        )}

        {/* ── 6. SERVICES ── */}
        {section === 'services' && (
          <div className="animate-fade-up">
            <div className="flex items-start justify-between mb-5">
              <div><h1 className="font-syne text-xl font-bold">Services municipaux</h1><p className="text-[13px] text-t3 mt-0.5">{svcs.length} services · {svcs.filter(s => s.isActive !== false).length} actifs</p></div>
              <Button variant="primary" size="sm" onClick={openAddSvc}><Plus size={14} /> Ajouter un service</Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <StatCard icon={<Settings size={18} />} value={svcs.length} label="Services totaux" color="blue" />
              <StatCard icon={<CheckCircle size={18} />} value={svcs.filter(s => s.isActive !== false).length} label="Services actifs" color="green" />
              <StatCard icon={<Users size={18} />} value={svcs.reduce((a, s) => a + (s.stats?.totalDemands ?? s.demands?.length ?? 0), 0)} label="Demandes totales" color="orange" />
            </div>
            
            {svcs.length === 0 ? (
              <div className="text-center py-20 text-t3"><Settings size={40} className="mx-auto mb-4 opacity-20" /><p className="font-medium">Aucun service enregistré</p><p className="text-[13px] mt-1 mb-4">Créez votre premier service municipal</p><Button variant="primary" size="sm" onClick={openAddSvc}><Plus size={14} /> Créer un service</Button></div>
            ) : (
              <div className="flex flex-col gap-6">
                {Object.entries(svcs.reduce((acc, svc) => {
                  const cat = svc.category || 'Autre';
                  if (!acc[cat]) acc[cat] = [];
                  acc[cat].push(svc);
                  return acc;
                }, {})).map(([cat, catSvcs]) => (
                  <div key={cat}>
                    <h2 className="font-syne text-[15px] font-bold mb-3 px-1">{cat} <span className="text-t3 text-[13px] font-normal">({catSvcs.length})</span></h2>
                    <Card>
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                          <thead>
                            <tr>{['Service', 'Catégorie', 'Mode', 'Région / Horaires', 'Demandes', 'QR', 'Statut', 'Actions'].map(h => <th key={h} className="text-[11px] font-bold text-t3 uppercase tracking-wide px-4 py-2.5 text-left bg-surface-2 border-b border-border">{h}</th>)}</tr>
                          </thead>
                          <tbody>
                            {catSvcs.map(s => {
                              const sid = s._id || s.id
                              const isActive = s.isActive !== false
                              const demCount = s.stats?.totalDemands ?? (s.demands?.length ?? 0)
                              const hours = s.schedule ? `${s.schedule.openTime || '08:00'}–${s.schedule.closeTime || '16:00'}` : '—'
                              const days = s.schedule?.days || '—'
                              return (
                                <tr key={sid} className="hover:bg-surface-2 border-b border-border last:border-0 transition-colors">
                                  <td className="px-4 py-3"><div className="font-semibold text-[13px]">{s.name}</div><div className="text-[11px] text-t3">#{String(sid).slice(-6)}</div></td>
                                  <td className="px-4 py-3"><span className="text-[11.5px] px-2 py-0.5 rounded bg-muted text-t2 border border-border font-medium">{s.category || '—'}</span></td>
                                  <td className="px-4 py-3"><Badge status={isActive ? 'resolved' : 'cancelled'}>{s.mode || 'Presentiel'}</Badge></td>
                                  <td className="px-4 py-3 text-[12px] text-t3">{s.location?.municipality || 'Tunis'}<br />{days} · {hours}</td>
                                  <td className="px-4 py-3 font-bold text-[14px]">{demCount}</td>
                                  <td className="px-4 py-3">
                                    <Button variant="outline" size="sm" onClick={() => showQR(s)}>📷 QR</Button>
                                  </td>
                                  <td className="px-4 py-3"><Toggle checked={isActive} onChange={() => toggleSvc(sid)} /></td>
                                  <td className="px-4 py-3">
                                    <div className="flex gap-1.5">
                                      <Button variant="outline" size="sm" onClick={() => openEditSvc(s)}><Edit2 size={12} /></Button>
                                      <Button variant="danger" size="sm" onClick={() => deleteSvc(sid)}><Trash2 size={12} /></Button>
                                    </div>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </Card>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── 7. DEMANDES ── */}
        {section === 'demandes' && (
          <div className="animate-fade-up">
            <h1 className="font-syne text-xl font-bold mb-5">Demandes de services</h1>
            <div className="flex items-center gap-2 mb-2 px-4 py-3 bg-primary/8 text-primary border border-primary/20 rounded-[10px] text-[13px]">
              <AlertTriangle size={15} /> Les demandes non traitées après 24h peuvent être réaffectées à un autre agent.
            </div>
            <FilterBar
              search={demSearch} onSearch={setDemSearch}
              chips={[{ label: 'Toutes', value: '' }, { label: 'En attente', value: 'Pending' }, { label: 'Acceptées', value: 'Accepted' }, { label: 'Refusées', value: 'Rejected' }, { label: 'Expirées', value: 'Expired' }]}
              activeChip={demStatus} onChip={setDemStatus}
              count={filteredDems.length} countLabel="demande(s)" className="mb-4"
            />
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>{['Réf.', 'Service', 'Citoyen', 'Agent assigné', 'Date', 'Délai', 'Statut', 'Consulter'].map(h => <th key={h} className="text-[11px] font-bold text-t3 uppercase tracking-wide px-4 py-2.5 text-left bg-surface-2 border-b border-border">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {filteredDems.length === 0 ? (
                      <tr><td colSpan={8} className="text-center py-10 text-t3">Aucune demande</td></tr>
                    ) : filteredDems.map(d => {
                      const did = d._id || d.id
                      const citizenName = typeof d.citizen === 'object' && d.citizen
                        ? `${d.citizen?.firstName || ''} ${d.citizen?.lastName || ''}`.trim() || '—'
                        : String(d.citizen || '—')
                      const svcName = d.serviceName || d.svc || '—'
                      const dateStr = d.createdAt ? new Date(d.createdAt).toLocaleDateString('fr-FR') : d.date || '—'
                      const isOverdue24 = d.status === 'Pending' && d.createdAt
                        ? (Date.now() - new Date(d.createdAt)) > 24 * 3600 * 1000 : false
                      const DEM_STATUS = { Pending: 'En attente', Accepted: 'Acceptée', Rejected: 'Refusée', Expired: 'Expirée' }
                      const statusLabel = DEM_STATUS[d.status] || d.status || 'En attente'
                      const DEM_BADGE  = { Pending: 'pending', Accepted: 'resolved', Rejected: 'cancelled', Expired: 'urgent' }
                      // Résolution de l'agent assigné à la demande
                      const assignedAgentName = d.processedByName
                        || (() => {
                          const a = agts.find(a => String(a._id || a.id) === String(d.processedBy))
                          return a ? `${a.firstName} ${a.lastName}`.trim() : null
                        })()
                        || (d.responsibleAgent ? `${d.responsibleAgent?.firstName || ''} ${d.responsibleAgent?.lastName || ''}`.trim() : null)
                        || '—'
                      return (
                        <tr key={did} className={`hover:bg-surface-2 border-b border-border last:border-0 transition-colors ${isOverdue24 ? 'bg-danger-light/20' : ''}`}>
                          <td className={`px-4 py-3 font-bold text-[13px] ${isOverdue24 ? 'text-danger' : 'text-primary'}`}>#{String(did).slice(-6)}</td>
                          <td className="px-4 py-3 text-[13px] max-w-[130px] truncate">{svcName}</td>
                          <td className="px-4 py-3 text-[12.5px]">{citizenName}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                <span className="text-[9px] font-bold text-primary">{assignedAgentName !== '—' ? assignedAgentName.charAt(0).toUpperCase() : '?'}</span>
                              </div>
                              <span className={`text-[12px] ${assignedAgentName === '—' ? 'text-t3 italic' : 'text-t1 font-medium'}`}>{assignedAgentName}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-[12px] text-t3">{dateStr}</td>
                          <td className={`px-4 py-3 text-[12px] font-semibold ${isOverdue24 ? 'text-danger' : d.status === 'Accepted' ? 'text-success' : 'text-t3'}`}>
                            {isOverdue24 ? '⚠ Dépassé' : d.status === 'Accepted' ? '✓ Traité' : d.status === 'Rejected' ? '✗ Refusé' : '< 24h'}
                          </td>
                          <td className="px-4 py-3"><Badge status={DEM_BADGE[d.status] ?? 'pending'}>{statusLabel}</Badge></td>
                          <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                            <button
                              onClick={() => openDemandDetail(d)}
                              title="Consulter les détails de la demande"
                              className="w-8 h-8 rounded-[8px] flex items-center justify-center border border-border bg-white hover:bg-primary hover:text-white hover:border-primary transition-all duration-150 text-t2 shadow-sm"
                            >
                              <Eye size={13} />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* ── 8. UTILISATEURS (Citoyens uniquement, lecture seule) ── */}
        {section === 'utilisateurs' && (
          <div className="animate-fade-up space-y-4">
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div>
                <h1 className="font-syne text-xl font-bold">Citoyens inscrits</h1>
                <p className="text-[13px] text-t3 mt-0.5">{filteredUsrs.length} citoyen{filteredUsrs.length !== 1 ? 's' : ''} enregistré{filteredUsrs.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
            <FilterBar
              search={usrSearch} onSearch={setUsrSearch}
              count={filteredUsrs.length} countLabel="citoyen(s)"
            />
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>{['Citoyen', 'Email', 'CIN', 'Municipalité', 'Inscription'].map(h => (
                      <th key={h} className="text-[11px] font-bold text-t3 uppercase tracking-wide px-4 py-2.5 text-left bg-surface-2 border-b border-border">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {filteredUsrs.length === 0 ? (
                      <tr><td colSpan={5} className="px-4 py-12 text-center text-t3">
                        <Users size={32} className="mx-auto mb-2 opacity-25" />
                        <p>Aucun citoyen trouvé</p>
                      </td></tr>
                    ) : filteredUsrs.map(u => {
                      const uid = u._id || u.id
                      const uName = `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email || '—'
                      const joined = u.createdAt ? new Date(u.createdAt).toLocaleDateString('fr-FR') : '—'
                      return (
                        <tr key={uid} className="hover:bg-surface-2 border-b border-border last:border-0 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <Avatar name={uName} color="#1A3C6B" size={30} />
                              <div>
                                <p className="font-semibold text-[13px]">{uName}</p>
                                {u.phone && <p className="text-[11.5px] text-t3">{u.phone}</p>}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-[12.5px] text-t2">{u.email || '—'}</td>
                          <td className="px-4 py-3 text-[12px] text-t3">{u.cin || '—'}</td>
                          <td className="px-4 py-3 text-[12px] text-t2">{u.municipality || 'Tunis'}</td>
                          <td className="px-4 py-3 text-[12px] text-t3">{joined}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* ── 9. AGENTS ── */}
        {section === 'agents' && (
          <div className="animate-fade-up space-y-4">
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div>
                <h1 className="font-syne text-xl font-bold">Agents municipaux</h1>
                <p className="text-[13px] text-t3 mt-0.5">{filteredAgts.length} agent{filteredAgts.length !== 1 ? 's' : ''} · {agts.filter(a => a.isActive !== false).length} actifs</p>
              </div>
              <Button variant="primary" size="sm" onClick={() => setAddUserModal(true)}><Plus size={14} /> Ajouter un agent</Button>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard icon={<Users size={18} />} value={agts.length} label="Agents total" color="blue" />
              <StatCard icon={<CheckCircle size={18} />} value={agts.filter(a => a.isActive !== false).length} label="Actifs" color="green" />
              <StatCard icon={<FileText size={18} />} value={agts.reduce((s, a) => s + (a.stats?.active || 0), 0)} label="Réclamations actives" color="orange" />
              <StatCard icon={<BarChart2 size={18} />} value={agts.length > 0 ? Math.round(agts.reduce((s, a) => s + (a.stats?.resolutionRate || 0), 0) / agts.length) + '%' : '—'} label="Taux résolution moyen" color="blue" />
            </div>

            <FilterBar
              search={agtSearch} onSearch={setAgtSearch}
              count={filteredAgts.length} countLabel="agent(s)"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredAgts.length === 0 && (
                <div className="col-span-3 text-center py-16 text-t3">
                  <Users size={36} className="mx-auto mb-3 opacity-30" />
                  <p>Aucun agent trouvé</p>
                </div>
              )}
              {filteredAgts.map(a => {
                const id = a._id || a.id
                const fullName = a.firstName && a.lastName ? `${a.firstName} ${a.lastName}` : (a.name || 'Agent')
                const stats = a.stats || {}
                const load = stats.load ?? 0
                const isActive = a.isActive !== false
                return (
                  <Card key={id} className={!isActive ? 'opacity-60' : ''}>
                    <CardBody className="p-5">
                      <div className="flex items-start gap-3 mb-4">
                        <div className="relative shrink-0">
                          <Avatar name={fullName} color={isActive ? '#1D8C5E' : '#888'} size={48} />
                          <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${isActive ? 'bg-success' : 'bg-t3'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-syne text-[14.5px] font-bold truncate">{fullName}</h3>
                          <p className="text-[12px] text-t3 truncate">{a.department || a.dept || 'Direction Technique'}</p>
                          {(a.specialization || a.spec) && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {(Array.isArray(a.specialization) ? a.specialization : (a.spec || '').split(',')).slice(0, 3).map((s, i) => (
                                <span key={i} className="text-[10.5px] px-1.5 py-0.5 rounded bg-primary/8 text-primary font-medium">{String(s).trim()}</span>
                              ))}
                            </div>
                          )}
                        </div>
                        <Toggle checked={isActive} onChange={async () => {
                          try {
                            await agentsAPI.toggleActive(id)
                            setAgts(prev => prev.map(x => (x._id || x.id) === id ? { ...x, isActive: !x.isActive } : x))
                            toast(`${fullName} ${isActive ? 'désactivé' : 'activé'}`, 'ok')
                          } catch { toast('Erreur', 'err') }
                        }} />
                      </div>

                      <div className="grid grid-cols-3 gap-2 mb-3">
                        {[
                          { label: 'Total', value: stats.total ?? 0, color: '#1A3C6B' },
                          { label: 'En cours', value: stats.active ?? 0, color: '#E8873A' },
                          { label: 'Résolues', value: stats.resolved ?? 0, color: '#1D8C5E' },
                        ].map(({ label, value, color }) => (
                          <div key={label} className="bg-muted rounded-[8px] p-2 text-center">
                            <div className="font-syne font-bold text-[17px]" style={{ color }}>{value}</div>
                            <div className="text-[10.5px] text-t3">{label}</div>
                          </div>
                        ))}
                      </div>

                      <div className="mb-3">
                        <div className="flex justify-between text-[11.5px] mb-1">
                          <span className="text-t3">Taux résolution</span>
                          <span className="font-semibold">{stats.resolutionRate ?? 0}%</span>
                        </div>
                        <ProgressBar value={stats.resolutionRate ?? 0} color="#1D8C5E" height={6} />
                      </div>

                      <div className="mb-4">
                        <div className="flex justify-between text-[11.5px] mb-1">
                          <span className="text-t3">Charge de travail</span>
                          <span className={`font-semibold ${load > 70 ? 'text-danger' : load > 40 ? 'text-warning' : 'text-success'}`}>{load}%</span>
                        </div>
                        <ProgressBar value={load} color={load > 70 ? '#E24B4A' : load > 40 ? '#E8873A' : '#1D8C5E'} height={6} />
                      </div>

                      {(stats.critical || 0) + (stats.high || 0) > 0 && (
                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-danger-light text-danger rounded-[8px] text-[12px] font-medium mb-3">
                          <AlertTriangle size={12} />
                          {(stats.critical || 0) + (stats.high || 0)} réclamation{(stats.critical || 0) + (stats.high || 0) > 1 ? 's' : ''} urgente{(stats.critical || 0) + (stats.high || 0) > 1 ? 's' : ''}
                        </div>
                      )}

                      <div className="flex flex-col sm:flex-row gap-2">
                        <Button variant="outline" size="md"
                          onClick={() => setAgentDetailModal({ open: true, agent: a })}
                          className="flex items-center justify-center gap-2">
                          <Eye size={14} /> Voir détails
                        </Button>
                        <Button variant="primary" size="md" disabled={!isActive}
                          onClick={() => setReassignModal({ open: true, id: null, agentId: id, recId: '' })}
                          className="flex items-center justify-center gap-2">
                          <UserPlus size={14} /> Affecter
                        </Button>
                      </div>
                    </CardBody>
                  </Card>
                )
              })}
            </div>
          </div>
        )}

        {/* ── 10. MESSAGERIE ── */}
        {section === 'messagerie' && (
          <MessageriePanel role="Admin" />
        )}

        {/* ── 11. NOTIFICATIONS ── */}
        {section === 'notifications' && (
          <div className="animate-fade-up">
            <div className="flex items-center justify-between mb-5">
              <div><h1 className="font-syne text-xl font-bold">Notifications</h1><p className="text-[13px] text-t3 mt-0.5">{unread} non lues</p></div>
              <Button variant="ghost" size="sm" onClick={async () => { try { await notificationsAPI.markAllRead() } catch { } setNotifs(prev => prev.map(n => ({ ...n, unread: false }))); toast('Tout marqué comme lu', 'ok') }}>Tout marquer lu</Button>
            </div>
            <Card>
              {notifs.map(n => (
                <div key={n.id} onClick={async () => { try { await notificationsAPI.markRead(n._id || n.id) } catch { } setNotifs(prev => prev.map(x => (x._id || x.id) === (n._id || n.id) ? { ...x, unread: false } : x)) }}
                  className={`flex items-start gap-3 px-4 py-3.5 border-b border-border last:border-0 cursor-pointer transition-colors hover:bg-surface-2 ${n.unread ? 'bg-primary/5' : ''}`}>
                  <div className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${n.unread ? 'bg-primary' : 'bg-transparent border border-border-2'}`} />
                  <div className="flex-1"><p className={`text-[13px] ${n.unread ? 'font-medium' : 'text-t2'}`}>{n.text || n.message || ''}</p><p className="text-[11.5px] text-t3 mt-0.5">{n.time || new Date(n.createdAt || Date.now()).toLocaleString('fr-FR')}</p></div>
                  {n.actionSec && <Button variant="accent" size="sm" onClick={e => { e.stopPropagation(); setSection(n.actionSec) }}>Agir</Button>}
                </div>
              ))}
            </Card>
          </div>
        )}

        {/* ── 12. PARAMÈTRES ── */}
        {section === 'parametres' && (
          <div className="animate-fade-up">
            <div className="flex items-start justify-between mb-5">
              <h1 className="font-syne text-xl font-bold">Paramètres système</h1>
              <Button variant="primary" size="sm" onClick={() => toast('Paramètres sauvegardés', 'ok')}>💾 Sauvegarder</Button>
            </div>
            <div className="grid grid-cols-2 gap-5">
              <div className="flex flex-col gap-5">
                <Card>
                  <CardHeader><CardTitle>Paramètres généraux</CardTitle></CardHeader>
                  <CardBody className="flex flex-col gap-0">
                    {[['Nom de la municipalité', 'Municipalité de Tunis', 'text'], ['Langue par défaut', 'Français', 'select'], ['Fuseau horaire', 'UTC+1 (Tunis)', 'select']].map(([l, v, t]) => (
                      <div key={l} className="flex items-center justify-between py-3.5 border-b border-border last:border-0">
                        <div><p className="text-[13.5px] font-semibold">{l}</p></div>
                        <input defaultValue={v} className="bg-surface-2 border border-border-2 rounded-btn px-3 py-2 text-[13px] outline-none font-dm w-48" />
                      </div>
                    ))}
                  </CardBody>
                </Card>
                <Card>
                  <CardHeader><CardTitle>Délais de traitement</CardTitle></CardHeader>
                  <CardBody className="flex flex-col gap-0">
                    {[['Réclamation normale', '48'], ['Réclamation urgente', '12'], ['Demande service', '24'], ['Annulation citoyen', '2']].map(([l, v]) => (
                      <div key={l} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                        <p className="text-[13.5px] font-semibold">{l}</p>
                        <div className="flex items-center gap-2"><input type="number" defaultValue={v} className="bg-surface-2 border border-border-2 rounded-btn px-3 py-2 text-[13px] outline-none font-dm w-16" /><span className="text-[13px] text-t3">heures</span></div>
                      </div>
                    ))}
                  </CardBody>
                </Card>
              </div>
              <div className="flex flex-col gap-5">
                <Card>
                  <CardHeader><CardTitle>Notifications email</CardTitle></CardHeader>
                  <CardBody className="flex flex-col gap-0">
                    {['Nouvelle réclamation', 'Confirmation citoyen', 'Réclamation résolue', 'Annulation service', 'Alertes hors délai'].map(l => {
                      return (
                        <div key={l} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                          <p className="text-[13.5px] font-semibold">{l}</p>
                          <Toggle checked={true} onChange={() => toast(l + ' toggled', 'ok')} />
                        </div>
                      )
                    })}
                  </CardBody>
                </Card>
                <Card>
                  <CardHeader><CardTitle>Modération commentaires</CardTitle></CardHeader>
                  <CardBody className="flex flex-col gap-0">
                    {['Auto-suppression spam', 'Signalement automatique', 'Approbation manuelle'].map((l, i) => (
                      <div key={l} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                        <p className="text-[13.5px] font-semibold">{l}</p>
                        <Toggle checked={i < 2} onChange={() => toast(l + ' toggled', 'ok')} />
                      </div>
                    ))}
                  </CardBody>
                </Card>
              </div>
            </div>
          </div>
        )}

      </AppShell>

      {/* Detail Panel avec masquage du bouton résoudre pour l'admin */}
      <DetailPanel
        rec={detailRec} open={detailOpen}
        onClose={() => setDetailOpen(false)}
        onResolve={resolveRec}
        onReassign={id => { setDetailOpen(false); setReassignModal({ open: true, id }) }}
        onStatusChange={statusChange}
        hideResolveButton={true}
      />

      {/* ── AGENT DETAIL MODAL ── */}
      <Modal
        open={agentDetailModal.open}
        onClose={() => { setAgentDetailModal({ open: false, agent: null }); setAgentDetailTab('overview') }}
        title={agentDetailModal.agent ? `${agentDetailModal.agent.firstName || ''} ${agentDetailModal.agent.lastName || ''} — Fiche agent` : ''}
        size="lg"
        footer={
          <div className="flex items-center gap-2 w-full">
            <Button variant={agentDetailModal.agent?.isActive !== false ? 'danger' : 'success'}
              onClick={async () => {
                const a = agentDetailModal.agent
                const id = a?._id || a?.id
                if (!id) return
                try {
                  await agentsAPI.toggleActive(id)
                  const newActive = !(a.isActive !== false)
                  setAgts(prev => prev.map(x => (x._id || x.id) === id ? { ...x, isActive: newActive } : x))
                  setAgentDetailModal(p => ({ ...p, agent: { ...p.agent, isActive: newActive } }))
                  toast(`Compte ${newActive ? 'activé' : 'désactivé'}`, 'ok')
                } catch { toast('Erreur', 'err') }
              }}>
              {agentDetailModal.agent?.isActive !== false ? 'Désactiver le compte' : 'Activer le compte'}
            </Button>
            <div className="flex-1" />
            <Button variant="primary"
              onClick={() => {
                const id = agentDetailModal.agent?._id || agentDetailModal.agent?.id
                setAgentDetailModal({ open: false, agent: null })
                setReassignModal({ open: true, id: null, agentId: id, recId: '' })
              }}>
              Affecter une réclamation
            </Button>
            <Button variant="outline" onClick={() => setAgentDetailModal({ open: false, agent: null })}>Fermer</Button>
          </div>
        }
      >
        {agentDetailModal.agent && (() => {
          const a = agentDetailModal.agent
          const stats = a.stats || {}
          const name = `${a.firstName || ''} ${a.lastName || ''}`.trim()
          const isActive = a.isActive !== false
          return (
            <div className="space-y-4">
              <div className="flex items-start gap-4 p-4 bg-surface-2 rounded-[10px]">
                <div className="relative shrink-0">
                  <Avatar name={name} color={isActive ? '#1D8C5E' : '#888'} size={64} />
                  <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-white ${isActive ? 'bg-success' : 'bg-t3'}`} />
                </div>
                <div className="flex-1">
                  <h3 className="font-syne text-[17px] font-bold">{name}</h3>
                  <p className="text-[13px] text-t3">{a.department || 'Direction Technique'}</p>
                  <p className="text-[12.5px] text-t2 mt-0.5">{a.email}</p>
                  {a.phone && <p className="text-[12.5px] text-t3">{a.phone}</p>}
                  <div className="flex flex-wrap gap-1 mt-2">
                    {(Array.isArray(a.specialization) ? a.specialization : []).map((s, i) => (
                      <span key={i} className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{s}</span>
                    ))}
                  </div>
                </div>
                <span className={`text-[11.5px] font-semibold px-2.5 py-1 rounded-full ${isActive ? 'bg-success-light text-success' : 'bg-muted text-t3'}`}>
                  {isActive ? '● Actif' : '○ Inactif'}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {[
                  { label: 'Total assignées', value: stats.total ?? 0, color: '#1A3C6B' },
                  { label: 'En cours', value: stats.active ?? 0, color: '#E8873A' },
                  { label: 'Résolues', value: stats.resolved ?? 0, color: '#1D8C5E' },
                  { label: 'Taux résolution', value: (stats.resolutionRate ?? 0) + '%', color: '#1D8C5E' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-white border border-border rounded-[10px] p-3 text-center">
                    <div className="font-syne font-bold text-[20px]" style={{ color }}>{value}</div>
                    <div className="text-[11px] text-t3 mt-0.5">{label}</div>
                  </div>
                ))}
              </div>

              {((stats.critical || 0) + (stats.high || 0)) > 0 && (
                <div className="flex items-center gap-3 px-4 py-3 bg-danger-light border border-red-200 rounded-[10px] text-[13px] text-danger">
                  <AlertTriangle size={15} />
                  <span><strong>{stats.critical || 0}</strong> critique{(stats.critical || 0) !== 1 ? 's' : ''} · <strong>{stats.high || 0}</strong> haute{(stats.high || 0) !== 1 ? 's' : ''}</span>
                </div>
              )}

              <div>
                <div className="flex justify-between text-[12.5px] mb-1.5">
                  <span className="text-t2 font-medium">Charge de travail</span>
                  <span className={`font-bold ${(stats.load ?? 0) > 70 ? 'text-danger' : (stats.load ?? 0) > 40 ? 'text-warning' : 'text-success'}`}>{stats.load ?? 0}%</span>
                </div>
                <ProgressBar value={stats.load ?? 0} color={(stats.load ?? 0) > 70 ? '#E24B4A' : (stats.load ?? 0) > 40 ? '#E8873A' : '#1D8C5E'} height={10} />
                <p className="text-[11.5px] text-t3 mt-1">
                  {stats.active ?? 0} réclamation{(stats.active ?? 0) !== 1 ? 's' : ''} active{(stats.active ?? 0) !== 1 ? 's' : ''} sur {stats.total ?? 0} totales
                </p>
              </div>

              <AgentRecentRecs agentId={a._id || a.id} recs={recs} onAssign={id => { setAgentDetailModal({ open: false, agent: null }); setReassignModal({ open: true, id, agentId: '' }) }} />

              <div className="grid grid-cols-2 gap-3 text-[12.5px] bg-surface-2 rounded-[10px] p-4">
                {[
                  ['ID compte', String(a._id || a.id || '—').slice(-8)],
                  ['Municipalité', a.municipality || 'Tunis'],
                  ['Inscription', a.createdAt ? new Date(a.createdAt).toLocaleDateString('fr-FR') : '—'],
                  ['Dernière co.', a.lastLogin ? new Date(a.lastLogin).toLocaleDateString('fr-FR') : 'Jamais'],
                ].map(([k, v]) => (
                  <div key={k}><span className="block text-t3 text-[11px] uppercase font-bold tracking-wide mb-0.5">{k}</span><span className="font-medium">{v}</span></div>
                ))}
              </div>
            </div>
          )
        })()}
      </Modal>

      {/* Reassign Modal */}
      <Modal open={reassignModal.open} onClose={() => setReassignModal({ open: false, id: null, agentId: '', recId: '' })} title="Affecter une réclamation"
        footer={<><Button variant="outline" onClick={() => setReassignModal({ open: false, id: null, agentId: '', recId: '' })}>Annuler</Button><Button variant="accent" disabled={!reassignModal.agentId || (reassignModal.id === null && !reassignModal.recId)} onClick={() => doReassign(reassignModal.recId || reassignModal.id, reassignModal.agentId)}>Affecter</Button></>}>
        {!reassignModal.id && reassignModal.agentId && (
          <FormGroup label="Réclamation à affecter">
            <Select value={reassignModal.recId || ''} onChange={e => setReassignModal(p => ({ ...p, recId: e.target.value }))}>
              <option value="">— Sélectionner une réclamation —</option>
              {recs.filter(r => ['Pending', 'In Progress'].includes(r.status)).map(r => (
                <option key={r._id || r.id} value={r._id || r.id}>
                  #{String(r._id || r.id || '').slice(-6)} — {r.title?.substring(0, 45)}
                </option>
              ))}
            </Select>
          </FormGroup>
        )}
        {reassignModal.id && (
          <div className="p-3 bg-danger-light text-danger rounded-[9px] text-[13px] mb-3">Réclamation <strong>#{String(reassignModal.id).slice(-6)}</strong> — réaffectation requise</div>
        )}
        <FormGroup label="Affecter à l'agent" htmlFor="ra">
          <Select id="ra" value={reassignModal.agentId} onChange={e => setReassignModal(p => ({ ...p, agentId: e.target.value }))}>
            <option value="">— Sélectionner un agent —</option>
            {agts.filter(a => a.isActive !== false).map(a => {
              const load = a.stats?.load ?? 0
              return (
                <option key={a._id || a.id} value={a._id || a.id}>
                  {a.firstName} {a.lastName} — {a.department || 'Agent'} ({load}% charge)
                </option>
              )
            })}
          </Select>
        </FormGroup>
        <FormGroup label="Note pour l'agent"><Textarea placeholder="Instructions supplémentaires…" /></FormGroup>
      </Modal>

      {/* ── DEMAND DETAIL MODAL ── */}
      <Modal
        open={demandDetailModal.open}
        onClose={() => setDemandDetailModal({ open: false, demand: null })}
        title="Détails de la demande de service"
        size="lg"
        footer={
          <div className="flex items-center gap-2 w-full">
            {demandDetailModal.demand?.status === 'Pending' && (
              <>
                <Button variant="success" size="sm"
                  onClick={async () => {
                    const d = demandDetailModal.demand
                    await acceptDem(d._id || d.id, d.serviceId)
                    setDemandDetailModal(p => ({ ...p, demand: { ...p.demand, status: 'Accepted' } }))
                  }}>
                  ✓ Accepter
                </Button>
                <Button variant="danger" size="sm"
                  onClick={async () => {
                    const d = demandDetailModal.demand
                    await refuseDem(d._id || d.id, d.serviceId)
                    setDemandDetailModal(p => ({ ...p, demand: { ...p.demand, status: 'Rejected' } }))
                  }}>
                  ✗ Refuser
                </Button>
              </>
            )}
            <div className="flex-1" />
            <Button variant="outline" onClick={() => setDemandDetailModal({ open: false, demand: null })}>Fermer</Button>
          </div>
        }
      >
        {demandDetailModal.demand && (() => {
          const d = demandDetailModal.demand
          const did = d._id || d.id
          const citizenName = typeof d.citizen === 'object' && d.citizen
            ? `${d.citizen?.firstName || ''} ${d.citizen?.lastName || ''}`.trim() || '—'
            : String(d.citizen || '—')
          const citizenEmail = typeof d.citizen === 'object' ? d.citizen?.email : '—'
          const svcName = d.serviceName || d.svc || '—'
          const dateStr = d.createdAt ? new Date(d.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : d.date || '—'
          const processedAt = d.processedAt ? new Date(d.processedAt).toLocaleDateString('fr-FR') : null
          const DEM_STATUS = { Pending: 'En attente', Accepted: 'Acceptée', Rejected: 'Refusée', Expired: 'Expirée', Cancelled: 'Annulée' }
          const DEM_BADGE  = { Pending: 'pending', Accepted: 'resolved', Rejected: 'cancelled', Expired: 'urgent', Cancelled: 'cancelled' }
          const statusLabel = DEM_STATUS[d.status] || d.status || 'En attente'
          const isOverdue24 = d.status === 'Pending' && d.createdAt
            ? (Date.now() - new Date(d.createdAt)) > 24 * 3600 * 1000 : false

          // Agent actuellement assigné
          const currentAgent = d.processedByName
            || (() => {
              const a = agts.find(a => String(a._id || a.id) === String(d.processedBy))
              return a ? `${a.firstName} ${a.lastName}`.trim() : null
            })()
            || (d.responsibleAgent ? `${d.responsibleAgent?.firstName || ''} ${d.responsibleAgent?.lastName || ''}`.trim() : null)

          return (
            <div className="space-y-4">

              {/* Bandeau statut */}
              <div className={`flex items-center gap-3 px-4 py-3 rounded-[10px] border ${
                isOverdue24 ? 'bg-danger-light border-red-200 text-danger'
                : d.status === 'Accepted' ? 'bg-success-light border-green-200 text-success'
                : d.status === 'Rejected' || d.status === 'Cancelled' ? 'bg-muted border-border text-t3'
                : 'bg-primary/8 border-primary/20 text-primary'
              }`}>
                <AlertTriangle size={15} className={isOverdue24 ? '' : 'opacity-0 w-0'} />
                <span className="font-semibold text-[13px]">
                  {isOverdue24 ? '⚠ Délai de 24h dépassé — réaffectation recommandée' : `Statut : ${statusLabel}`}
                </span>
                <Badge status={DEM_BADGE[d.status] ?? 'pending'} className="ml-auto">{statusLabel}</Badge>
              </div>

              {/* Infos principales */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-surface-2 rounded-[10px] p-4">
                  <p className="text-[10.5px] text-t3 font-bold uppercase tracking-wide mb-2">Service demandé</p>
                  <p className="font-syne text-[15px] font-bold text-t1">{svcName}</p>
                  <p className="text-[11.5px] text-t3 mt-0.5">Réf. #{String(did).slice(-6)}</p>
                  {d.serviceCategory && <span className="text-[11px] mt-1 inline-block px-2 py-0.5 rounded bg-muted border border-border text-t2 font-medium">{d.serviceCategory}</span>}
                </div>
                <div className="bg-surface-2 rounded-[10px] p-4">
                  <p className="text-[10.5px] text-t3 font-bold uppercase tracking-wide mb-2">Citoyen</p>
                  <div className="flex items-center gap-2">
                    <Avatar name={citizenName} color="#1A3C6B" size={36} />
                    <div>
                      <p className="font-semibold text-[13.5px]">{citizenName}</p>
                      {citizenEmail && citizenEmail !== '—' && <p className="text-[11.5px] text-t3">{citizenEmail}</p>}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-surface-2 rounded-[10px] p-3 text-center">
                  <p className="text-[10px] text-t3 font-bold uppercase mb-1">Date de soumission</p>
                  <p className="text-[13px] font-semibold">{dateStr}</p>
                </div>
                <div className="bg-surface-2 rounded-[10px] p-3 text-center">
                  <p className="text-[10px] text-t3 font-bold uppercase mb-1">Délai</p>
                  <p className={`text-[13px] font-semibold ${isOverdue24 ? 'text-danger' : 'text-t1'}`}>
                    {isOverdue24 ? '⚠ Dépassé' : d.status === 'Accepted' ? '✓ Traité' : d.status === 'Rejected' ? '✗ Refusé' : '< 24h'}
                  </p>
                </div>
                {processedAt && (
                  <div className="bg-surface-2 rounded-[10px] p-3 text-center">
                    <p className="text-[10px] text-t3 font-bold uppercase mb-1">Traité le</p>
                    <p className="text-[13px] font-semibold">{processedAt}</p>
                  </div>
                )}
              </div>

              {/* Évaluations */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-surface-2 rounded-[10px] p-3 text-center">
                  <p className="text-[10px] text-t3 font-bold uppercase mb-1">Note globale (Service)</p>
                  <p className="text-[14px] font-semibold text-t1">{d.avgRating ? `${d.avgRating} / 5 ⭐` : 'Aucune'}</p>
                </div>
                <div className="bg-surface-2 rounded-[10px] p-3 text-center">
                  <p className="text-[10px] text-t3 font-bold uppercase mb-1">Évaluation de cette demande</p>
                  <p className="text-[14px] font-semibold text-t1">{d.userRating ? `${d.userRating} / 5 ⭐` : 'Non évaluée'}</p>
                </div>
              </div>

              {d.notes && (
                <div className="bg-surface-2 border border-border rounded-[10px] p-4">
                  <p className="text-[10.5px] text-t3 font-bold uppercase tracking-wide mb-1.5">Notes / Motif</p>
                  <p className="text-[13px] text-t2 italic">"{d.notes}"</p>
                </div>
              )}

              {/* Section agent assigné */}
              <div className="border border-border rounded-[10px] overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 bg-surface-2 border-b border-border">
                  <Users size={14} className="text-primary" />
                  <p className="text-[12px] font-bold text-t2 uppercase tracking-wide">Agent responsable</p>
                </div>
                <div className="p-4">
                  {currentAgent ? (
                    <div className="flex items-center gap-3 mb-4">
                      <Avatar name={currentAgent} color="#1D8C5E" size={40} />
                      <div>
                        <p className="font-semibold text-[14px]">{currentAgent}</p>
                        <p className="text-[12px] text-success font-medium">● Agent assigné automatiquement</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 mb-4 px-3 py-2.5 bg-warning-light rounded-[8px] text-warning text-[12.5px]">
                      <AlertTriangle size={13} />
                      <span>Aucun agent assigné — une affectation automatique est recommandée.</span>
                    </div>
                  )}

                  <div className="border-t border-border pt-4">
                    <p className="text-[12px] font-semibold text-t2 mb-2">Réaffecter à un autre agent :</p>
                    <div className="flex gap-2">
                      <select
                        value={demandReassignAgent}
                        onChange={e => setDemandReassignAgent(e.target.value)}
                        className="flex-1 border border-border-2 rounded-btn px-3 py-2 text-[13px] bg-white outline-none focus:border-primary transition-colors"
                      >
                        <option value="">— Sélectionner un agent —</option>
                        {agts.filter(a => a.isActive !== false).map(a => {
                          const load = a.stats?.load ?? 0
                          return (
                            <option key={a._id || a.id} value={a._id || a.id}>
                              {a.firstName} {a.lastName} — {a.department || 'Agent'} ({load}% charge)
                            </option>
                          )
                        })}
                      </select>
                      <Button
                        variant="accent"
                        size="sm"
                        disabled={!demandReassignAgent}
                        onClick={() => doReassignDemand(did, d.serviceId, demandReassignAgent)}
                      >
                        <RefreshCw size={13} /> Réaffecter
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          )
        })()}
      </Modal>

      {/* Add/Edit Service Modal */}
      <Modal
        open={svcModal.open}
        onClose={() => setSvcModal({ open: false, mode: 'add', svc: null })}
        title={svcModal.mode === 'add' ? 'Ajouter un service' : `Modifier — ${svcModal.svc?.name}`}
        footer={<>
          <Button variant="outline" onClick={() => setSvcModal({ open: false, mode: 'add', svc: null })}>Annuler</Button>
          <Button variant="primary" onClick={saveSvc} disabled={svcSaving}>{svcSaving ? 'Enregistrement…' : svcModal.mode === 'add' ? 'Créer le service' : 'Sauvegarder'}</Button>
        </>}
      >
        <FormGroup label="Nom du service *">
          <Input placeholder="Ex : Acte de naissance" value={svcForm.name} onChange={e => setSvcForm(p => ({ ...p, name: e.target.value }))} />
        </FormGroup>
        <div className="grid grid-cols-2 gap-3">
          <FormGroup label="Catégorie">
            <Select value={svcForm.category} onChange={e => setSvcForm(p => ({ ...p, category: e.target.value }))}>
              {['Etat civil','Urbanisme','Proprete','Transport','Culture','Education','Sante','Autre'].map(c => <option key={c}>{c}</option>)}
            </Select>
          </FormGroup>
          <FormGroup label="Mode d'accès">
            <Select value={svcForm.mode} onChange={e => setSvcForm(p => ({ ...p, mode: e.target.value }))}>
              <option>En ligne</option><option>Presentiel</option><option>Hybride</option>
            </Select>
          </FormGroup>
        </div>
        <FormGroup label="Description">
          <Textarea placeholder="Décrivez le service, les étapes et documents requis…" value={svcForm.description} onChange={e => setSvcForm(p => ({ ...p, description: e.target.value }))} />
        </FormGroup>
        <FormGroup label="Jours d'ouverture">
          <div className="flex flex-wrap gap-2 mt-1 mb-3">
            {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(d => {
              const isSelected = Array.isArray(svcForm.days) && svcForm.days.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => {
                    setSvcForm(p => {
                      const cur = Array.isArray(p.days) ? p.days : [];
                      return { ...p, days: isSelected ? cur.filter(x => x !== d) : [...cur, d] };
                    })
                  }}
                  className={`px-3 py-1.5 text-[12px] font-medium rounded-[6px] border transition-colors ${isSelected ? 'bg-primary text-white border-primary' : 'bg-surface-2 text-t2 border-border-2 hover:bg-surface-3'}`}
                >
                  {d}
                </button>
              )
            })}
          </div>
        </FormGroup>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <FormGroup label="Ouverture">
            <Input type="time" value={svcForm.openTime} onChange={e => setSvcForm(p => ({ ...p, openTime: e.target.value }))} />
          </FormGroup>
          <FormGroup label="Fermeture">
            <Input type="time" value={svcForm.closeTime} onChange={e => setSvcForm(p => ({ ...p, closeTime: e.target.value }))} />
          </FormGroup>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FormGroup label="Municipalité / Région">
            <Select value={svcForm.region} onChange={e => setSvcForm(p => ({ ...p, region: e.target.value }))}>
              {['Ariana', 'Béja', 'Ben Arous', 'Bizerte', 'Gabès', 'Gafsa', 'Jendouba', 'Kairouan', 'Kasserine', 'Kébili', 'Le Kef', 'Mahdia', 'La Manouba', 'Médenine', 'Monastir', 'Nabeul', 'Sfax', 'Sidi Bouzid', 'Siliana', 'Sousse', 'Tataouine', 'Tozeur', 'Tunis', 'Zaghouan'].map(r => <option key={r} value={r}>{r}</option>)}
            </Select>
          </FormGroup>
          <FormGroup label="Délai traitement (jours)">
            <Input type="number" min={1} max={60} value={svcForm.processingDays} onChange={e => setSvcForm(p => ({ ...p, processingDays: e.target.value }))} />
          </FormGroup>
        </div>
        <div className="mb-3 mt-1">
          <FormGroup label="Date d'activation (Sélectionnée automatiquement)">
            <Input type="date" value={svcForm.date} readOnly className="opacity-70 bg-surface-2 cursor-not-allowed pointer-events-none" />
          </FormGroup>
        </div>
        {svcModal.mode === 'add' && (
          <p className="text-[12px] text-t3 bg-surface-2 px-3 py-2 rounded-[8px]">📷 Un QR code sera automatiquement généré à la création du service.</p>
        )}
      </Modal>

      {/* QR Code Modal */}
      <Modal open={qrModal.open} onClose={() => setQrModal({ open: false, name: '', qrImage: '' })} title={`QR Code — ${qrModal.name}`} size="sm"
        footer={<Button variant="outline" onClick={() => setQrModal({ open: false, name: '', qrImage: '' })}>Fermer</Button>}
      >
        <div className="flex flex-col items-center gap-4 py-2">
          {qrModal.qrImage ? (
            <img src={qrModal.qrImage} alt={`QR ${qrModal.name}`} className="w-52 h-52 rounded-[10px] border border-border" />
          ) : (
            <div className="w-52 h-52 flex items-center justify-center bg-surface-2 rounded-[10px] border border-border text-t3 text-[13px]">Génération en cours…</div>
          )}
          <p className="text-[12.5px] text-t2 text-center">Scannez ce code pour accéder directement au service <strong>{qrModal.name}</strong>.</p>
          {qrModal.qrImage && (
            <a href={qrModal.qrImage} download={`qr-${qrModal.name}.png`} className="text-[12px] text-primary underline">Télécharger le QR code</a>
          )}
        </div>
      </Modal>

      {/* Add User Modal */}
      <Modal open={addUserModal} onClose={() => setAddUserModal(false)} title="Nouvel utilisateur"
        footer={<><Button variant="outline" onClick={() => setAddUserModal(false)}>Annuler</Button><Button variant="primary" onClick={() => { setAddUserModal(false); toast('Compte créé', 'ok') }}>Créer le compte</Button></>}>
        <div className="grid grid-cols-2 gap-3">
          <FormGroup label="Prénom"><Input placeholder="Ahmed" /></FormGroup>
          <FormGroup label="Nom"><Input placeholder="Mansour" /></FormGroup>
        </div>
        <FormGroup label="Email"><Input type="email" placeholder="agent@munic.tn" /></FormGroup>
        <div className="grid grid-cols-2 gap-3">
          <FormGroup label="Rôle"><Select><option>Citoyen</option><option>Agent</option><option>Administrateur</option></Select></FormGroup>
          <FormGroup label="Service"><Select><option>Direction Technique</option><option>Service Voirie</option><option>Service Propreté</option></Select></FormGroup>
        </div>
        <FormGroup label="CIN / Matricule"><Input placeholder="12345678" /></FormGroup>
      </Modal>

      {/* Confirm Modal */}
      <Modal open={confirmModal.open} onClose={() => setConfirmModal({ open: false, msg: '', cb: null })} title="Confirmation" size="sm"
        footer={<><Button variant="outline" onClick={() => setConfirmModal({ open: false, msg: '', cb: null })}>Annuler</Button><Button variant="danger" onClick={() => { confirmModal.cb?.(); setConfirmModal({ open: false, msg: '', cb: null }) }}>Confirmer</Button></>}>
        <p className="text-[13.5px] text-t2 leading-relaxed">{confirmModal.msg}</p>
      </Modal>
    </>
  )
}
