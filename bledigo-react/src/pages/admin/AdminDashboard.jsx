import { useState } from 'react'
import {
  LayoutDashboard, BarChart2, FileText, MessageSquare as CommentIcon,
  Settings, ClipboardCheck, UserCircle, Users,
  MessageCircle, Bell, SlidersHorizontal, AlertTriangle, CheckCircle,
  RefreshCw, Trash2, Eye, Plus, Download
} from 'lucide-react'
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
  useUsers, useAgents, useAgentReclamations, useComments, useNotifications
} from '../../hooks/useData'
import { useAuth } from '../../context/AuthContext'
import FilterBar, { SearchInput, FilterSelect } from '../../components/ui/FilterBar'
import { Search } from 'lucide-react'
import { notificationsAPI, reclamationsAPI, servicesAPI, usersAPI, agentsAPI } from '../../services/api'


const STATUS_BADGE = {
  'En cours':'progress','En attente':'pending','Resolue':'resolved','Critique':'urgent','Acceptee':'resolved','Expire':'urgent'
}

// ── Agent recent reclamations (used inside detail modal) ──
function AgentRecentRecs({ agentId, recs, onAssign }) {
  // Filter from already-loaded recs first; if empty show message
  const agentRecs = recs.filter(r => {
    const aid = r.assignedAgent?._id || r.assignedAgent || r.agent
    return String(aid) === String(agentId)
  }).slice(0, 5)

  const STATUS_BADGE = {
    'Pending':'pending','In Progress':'progress','Resolved':'resolved',
    'Rejected':'resolved','Cancelled':'resolved',
  }
  const STATUS_FR = { Pending:'En attente','In Progress':'En cours',Resolved:'Résolue',Rejected:'Refusée',Cancelled:'Annulée' }

  return (
    <div>
      <h4 className="font-syne text-[13.5px] font-bold mb-2">Réclamations récentes</h4>
      {agentRecs.length === 0 ? (
        <p className="text-[13px] text-t3 text-center py-4 bg-surface-2 rounded-[10px]">Aucune réclamation assignée</p>
      ) : (
        <div className="border border-border rounded-[10px] overflow-hidden">
          {agentRecs.map((r, i) => (
            <div key={r._id||r.id} className={`flex items-center gap-3 px-4 py-2.5 ${i<agentRecs.length-1?'border-b border-border':''} hover:bg-surface-2 transition-colors`}>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium truncate">{r.title}</p>
                <p className="text-[11.5px] text-t3">{r.category||r.cat} · {r.createdAt?new Date(r.createdAt).toLocaleDateString('fr-FR'):r.date||'—'}</p>
              </div>
              <Badge status={STATUS_BADGE[r.status]||'pending'}>{STATUS_FR[r.status]||r.status}</Badge>
              {['Pending','In Progress'].includes(r.status) && (
                <Button variant="ghost" size="sm" onClick={()=>onAssign(r._id||r.id)}>Réaffecter</Button>
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
  const [section, setSection]     = useState(initialSection)
  const [detailRec, setDetailRec] = useState(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [reassignModal, setReassignModal] = useState({ open:false, id:null, agentId:'', recId:'' })
  const [addSvcModal, setAddSvcModal]     = useState(false)
  const [addUserModal, setAddUserModal]   = useState(false)
  const [confirmModal, setConfirmModal]   = useState({ open:false, msg:'', cb:null })
  const [agentDetailModal, setAgentDetailModal] = useState({ open:false, agent:null })
  const [agentDetailTab,   setAgentDetailTab]   = useState('overview')
  const [activeConvo, setActiveConvo]     = useState(0)
  const [msgInput, setMsgInput]           = useState('')

  const { data:recs,    setData:setRecs }    = useReclamations()
  const { data:svcs,    setData:setSvcs }    = useServices()
  const { data:dems,    setData:setDems }    = useDemandes()
  const { data:usrs,    setData:setUsrs }    = useUsers()
  const { data:agts, setData:setAgts }       = useAgents()
  const { data:coms,    setData:setComs }    = useComments()
  const { data:notifs,  setData:setNotifs }  = useNotifications()

  const unread = notifs.filter(n => n.unread || !n.isRead).length
  const lateRecs = recs.filter(r => {
    if (r.late || r.isOverdue) return true
    if (['Resolved','Rejected','Cancelled'].includes(r.status)) return false
    const limitH = r.urgency?.level === 'Critical' ? 12 : 48
    const created = r.createdAt ? new Date(r.createdAt) : null
    return created ? (Date.now() - created) > limitH * 3600 * 1000 : false
  })

  // ── Filter state ─────────────────────────────────────
  const [recSearch,  setRecSearch]  = useState('')
  const [recStatus,  setRecStatus]  = useState('')
  const [recCat,     setRecCat]     = useState('')
  const [recUrgency, setRecUrgency] = useState('')
  const [usrSearch,  setUsrSearch]  = useState('')
  const [usrRole,    setUsrRole]    = useState('')
  const [usrStatus,  setUsrStatus]  = useState('')
  const [demSearch,  setDemSearch]  = useState('')
  const [demStatus,  setDemStatus]  = useState('')
  const [agtSearch,  setAgtSearch]  = useState('')

  // ── Filtered data ─────────────────────────────────────
  const filteredRecs = recs.filter(r => {
    const q = recSearch.toLowerCase()
    const matchQ = !q || r.title?.toLowerCase().includes(q) || (r.citizen?.firstName||r.citizen||'').toString().toLowerCase().includes(q) || String(r._id||r.id||'').slice(-6).toLowerCase().includes(q)
    const matchS = !recStatus  || r.status === recStatus
    const matchC = !recCat     || r.category === recCat || r.cat === recCat
    const matchU = !recUrgency || (r.urgency?.level||r.urg) === recUrgency
    return matchQ && matchS && matchC && matchU
  })
  // Utilisateurs page = Citoyens ONLY — agents have their own dedicated page
  const filteredUsrs = usrs.filter(u => {
    if (u.role && u.role !== 'Citoyen') return false
    const q = usrSearch.toLowerCase()
    const fullName = `${u.firstName||u.name||''} ${u.lastName||''}`.toLowerCase()
    return !q || fullName.includes(q) || (u.email||'').toLowerCase().includes(q) || (u.cin||'').includes(q)
  })
  const filteredDems = dems.filter(d => {
    const q     = demSearch.toLowerCase()
    const sName = (d.serviceName || d.svc || d.service || '').toLowerCase()
    const cName = typeof d.citizen === 'object'
      ? `${d.citizen?.firstName||''} ${d.citizen?.lastName||''}`.toLowerCase()
      : String(d.citizen||'').toLowerCase()
    const matchQ = !q || sName.includes(q) || cName.includes(q)
    const matchS = !demStatus || d.status === demStatus
    return matchQ && matchS
  })
  const filteredAgts = agts.filter(a => {
    const q = agtSearch.toLowerCase()
    const fullName = `${a.firstName||a.name||''} ${a.lastName||''}`.toLowerCase()
    return !q || fullName.includes(q) || (a.department||a.dept||'').toLowerCase().includes(q) || (a.email||'').toLowerCase().includes(q)
  })

  // Conversations (local state)
  const [convos, setConvos] = useState([
    { id:0, user:'Ahmed Mansour', init:'AM', color:'#E8873A', sub:'Réclamation #1042', badge:'progress', time:'14:22',
      msgs:[{out:false,txt:"Bonjour, où en est ma réclamation #1042 ?"},{out:true,txt:"Intervention programmée demain matin 8h-10h."},{out:false,txt:"Merci !"}]},
    { id:1, user:'Fatma Saidi',   init:'FS', color:'#1A3C6B', sub:'Réclamation #1038', badge:'urgent',   time:'Hier',
      msgs:[{out:false,txt:"Mon signalement est urgent !"},{out:true,txt:"Je classe ce dossier en priorité."}]},
  ])

  /* ───── NAV ───── */
  const NAV = [
    { label:'Général', items:[
      { section:'dashboard',    label:'Tableau de bord',       icon:<LayoutDashboard size={15}/> },
      { section:'rapports',     label:'Rapports & Stats',      icon:<BarChart2 size={15}/> },
    ]},
    { label:'Réclamations', items:[
      { section:'reclamations', label:'Réclamations',          icon:<FileText size={15}/>,         badge:recs.filter(r=>r.status!=='Resolue').length },
      { section:'commentaires', label:'Commentaires',          icon:<CommentIcon size={15}/>,      badge:coms.filter(c=>c.flagged&&!c.deleted).length, badgeRed:true },
      { section:'affectations', label:'Affectations',          icon:<RefreshCw size={15}/>,        badge:lateRecs.length, badgeRed:true },
    ]},
    { label:'Services', items:[
      { section:'services',     label:'Services municipaux',   icon:<Settings size={15}/> },
      { section:'demandes',     label:'Demandes services',     icon:<ClipboardCheck size={15}/>,   badge:dems.filter(d=>d.status==='Pending').length },
    ]},
    { label:'Utilisateurs', items:[
      { section:'utilisateurs', label:'Comptes citoyens',      icon:<UserCircle size={15}/> },
      { section:'agents',       label:'Agents municipaux',     icon:<Users size={15}/> },
    ]},
    { label:'Système', items:[
      { section:'messagerie',   label:'Messagerie',            icon:<MessageCircle size={15}/>,    badge:2 },
      { section:'notifications',label:'Notifications',         icon:<Bell size={15}/>,             badge:unread, badgeRed:true },
      { section:'parametres',   label:'Paramètres',            icon:<SlidersHorizontal size={15}/> },
    ]},
  ]

  const TITLES = {
    dashboard:'Tableau de bord', rapports:'Rapports & Stats', reclamations:'Réclamations',
    commentaires:'Commentaires', affectations:'Affectations', services:'Services municipaux',
    demandes:'Demandes services', utilisateurs:'Utilisateurs', agents:'Agents municipaux',
    messagerie:'Messagerie', notifications:'Notifications', parametres:'Paramètres',
  }

  /* ───── HELPERS ───── */
  function openDetail(id) {
    setDetailRec(recs.find(r => (r._id||r.id) === id) ?? null)
    setDetailOpen(true)
  }
  async function resolveRec(id) {
    try {
      await reclamationsAPI.updateStatus(id, 'Resolved', { report: 'Résolution confirmée par l\'administrateur.' })
      setRecs(prev => prev.map(r => (r._id||r.id)===id ? {...r, status:'Resolved', isOverdue:false} : r))
      setDetailOpen(false)
      toast(`Réclamation résolue ✓`, 'ok')
    } catch { toast('Erreur lors de la résolution', 'err') }
  }
  async function statusChange(id, newStatus) {
    const STATUS_MAP = { 'En attente':'Pending','En cours':'In Progress','Resolue':'Resolved','Resolved':'Resolved','Pending':'Pending','In Progress':'In Progress' }
    const apiStatus = STATUS_MAP[newStatus] || newStatus
    try {
      await reclamationsAPI.updateStatus(id, apiStatus)
      setRecs(prev => prev.map(r => (r._id||r.id)===id ? {...r, status:apiStatus, isOverdue:apiStatus==='Resolved'?false:r.isOverdue} : r))
      toast(`Statut mis à jour : ${newStatus}`, 'ok')
    } catch { toast('Erreur lors de la mise à jour du statut', 'err') }
  }
  async function doReassign(id, agentId) {
    const targetId = id || reassignModal.recId
    if (!agentId) { toast('Sélectionnez un agent', 'err'); return }
    if (!targetId) { toast('Sélectionnez une réclamation', 'err'); return }
    try {
      await reclamationsAPI.assignAgent(targetId, agentId)
      const agent = agts.find(a => (a._id||a.id) === agentId)
      setRecs(prev => prev.map(r => (r.id||r._id)===targetId ? {...r, agent: agent?.firstName ? `${agent.firstName} ${agent.lastName}` : agentId, status:'In Progress', late:false, isOverdue:false} : r))
      setReassignModal({open:false, id:null, agentId:'', recId:''})
      toast(`Réclamation réaffectée avec succès`, 'ok')
    } catch {
      toast('Erreur lors de la réaffectation', 'err')
    }
  }
  function deleteRec(id) {
    setConfirmModal({ open:true, msg:`Supprimer cette réclamation ?`, cb: async () => {
      try {
        await reclamationsAPI.delete(id)
        setRecs(prev => prev.filter(r => (r._id||r.id) !== id))
        setDetailOpen(false)
        toast('Réclamation supprimée', 'ok')
      } catch { toast('Erreur lors de la suppression', 'err') }
    }})
  }
  async function toggleSvc(id) {
    const svc = svcs.find(s => (s._id||s.id)===id)
    const newActive = !(svc?.isActive ?? svc?.active ?? true)
    try {
      await servicesAPI.update(id, { isActive: newActive })
      setSvcs(prev => prev.map(s => (s._id||s.id)===id ? {...s, active:newActive, isActive:newActive} : s))
    } catch { toast('Erreur mise à jour service', 'err') }
  }
  function deleteSvc(id) {
    setConfirmModal({ open:true, msg:`Supprimer ce service ?`, cb: async () => {
      try {
        await servicesAPI.delete(id)
        setSvcs(prev => prev.filter(s => (s._id||s.id)!==id))
        toast('Service supprimé', 'ok')
      } catch { toast('Erreur lors de la suppression du service', 'err') }
    }})
  }
  async function acceptDem(demId, svcId) {
    try {
      if (svcId) await servicesAPI.processDemand(svcId, demId, 'Accepted')
      setDems(prev => prev.map(d => (d._id||d.id)===demId ? {...d, status:'Acceptee'} : d))
      toast('Demande acceptée ✓', 'ok')
    } catch {
      setDems(prev => prev.map(d => (d._id||d.id)===demId ? {...d, status:'Acceptee'} : d))
      toast('Demande acceptée', 'ok')
    }
  }
  async function refuseDem(demId, svcId) {
    try {
      if (svcId) await servicesAPI.processDemand(svcId, demId, 'Rejected')
      setDems(prev => prev.map(d => (d._id||d.id)===demId ? {...d, status:'Refuse'} : d))
      toast('Demande refusée', 'ok')
    } catch {
      setDems(prev => prev.map(d => (d._id||d.id)===demId ? {...d, status:'Refuse'} : d))
      toast('Demande refusée', 'ok')
    }
  }
  async function toggleUser(id) {
    try {
      await usersAPI.toggleActive(id)
      setUsrs(prev => prev.map(u => (u.id||u._id)===id ? {...u, active:!u.active, isActive:!u.isActive} : u))
      const u = usrs.find(u => (u.id||u._id)===id)
      toast(`Compte ${u?.active||u?.isActive ? 'désactivé' : 'activé'}`, 'ok')
    } catch {
      toast('Erreur lors de la mise à jour', 'err')
    }
  }
  function approveComment(id) {
    setComs(prev => prev.map(c => (c.id||c._id)===id ? {...c,flagged:false} : c))
    toast('Commentaire approuvé', 'ok')
  }
  async function deleteComment(id) {
    setConfirmModal({ open:true, msg:'Supprimer ce commentaire ?', cb: async () => {
      // id here is the comment id — find the reclamation that owns it
      const ownerRec = recs.find(r => (r.comments||[]).some(c => (c.id||c._id)===id))
      try {
        if (ownerRec) await reclamationsAPI.deleteComment(ownerRec._id||ownerRec.id, id)
      } catch {}
      setComs(prev => prev.map(c => (c.id||c._id)===id ? {...c,deleted:true,flagged:false} : c))
      toast('Commentaire supprimé', 'ok')
    }})
  }
  function sendMsg() {
    if (!msgInput.trim()) return
    const txt = msgInput.trim()
    setConvos(prev => prev.map((c,i) => i===activeConvo ? {...c, msgs:[...c.msgs,{out:true,txt}]} : c))
    setMsgInput('')
    setTimeout(() => {
      setConvos(prev => prev.map((c,i) => i===activeConvo ? {...c, msgs:[...c.msgs,{out:false,txt:'Message bien reçu, merci.'}]} : c))
    }, 1200)
  }

  /* ───── TABLE HELPERS ───── */
  function RecTable({ data }) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead><tr>
            {['Réf.','Problème','Citoyen','Agent','Catégorie','Urgence','Statut','Date','Actions'].map(h=>(
              <th key={h} className="text-[11px] font-bold text-t3 uppercase tracking-wide px-4 py-2.5 text-left bg-surface-2 border-b border-border">{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {data.map(r => {
              const rid     = r._id || r.id
              const isLate  = r.late || r.isOverdue
              const citizen = typeof r.citizen === 'object'
                ? `${r.citizen?.firstName||''} ${r.citizen?.lastName||''}`.trim() || '—'
                : r.citizen || '—'
              const agent   = typeof r.assignedAgent === 'object' && r.assignedAgent
                ? `${r.assignedAgent?.firstName||''} ${r.assignedAgent?.lastName||''}`.trim() || '—'
                : r.agent || '—'
              const cat     = r.category || r.cat || '—'
              const urg     = r.urgency?.level || (typeof r.urgency==='string' ? r.urgency : null) || r.urg || 'Normal'
              const urgCls  = urg==='Critical'?'text-danger':urg==='High'?'text-warning':urg==='Low'?'text-success':'text-primary'
              const dateStr = r.createdAt ? new Date(r.createdAt).toLocaleDateString('fr-FR') : r.date || '—'
              return (
                <tr key={rid} onClick={()=>openDetail(rid)} className={`cursor-pointer hover:bg-surface-2 border-b border-border last:border-0 transition-colors ${isLate?'bg-danger-light/20':''}`}>
                  <td className={`px-4 py-3 font-bold text-[13px] ${isLate?'text-danger':'text-primary'}`}>#{String(rid||'').slice(-6)}</td>
                  <td className="px-4 py-3 text-[13px] max-w-[150px] truncate">{r.title}</td>
                  <td className="px-4 py-3 text-[12.5px]">{citizen}</td>
                  <td className="px-4 py-3 text-[12.5px]">{agent}</td>
                  <td className="px-4 py-3"><span className="text-[11.5px] px-2 py-0.5 rounded bg-muted text-t2 border border-border font-medium">{cat}</span></td>
                  <td className={`px-4 py-3 text-[12px] font-semibold ${urgCls}`}>● {urg}</td>
                  <td className="px-4 py-3"><Badge status={STATUS_BADGE[r.status]??'pending'}>{r.status}</Badge></td>
                  <td className={`px-4 py-3 text-[12px] ${isLate?'text-danger font-semibold':'text-t3'}`}>{dateStr}{isLate?' ⚠':''}</td>
                  <td className="px-4 py-3" onClick={e=>e.stopPropagation()}>
                    <div className="flex gap-1.5">
                      <Button variant="outline" size="sm" onClick={()=>openDetail(rid)}><Eye size={12}/></Button>
                      {!['Resolved','Rejected','Cancelled'].includes(r.status) && (
                        <Button variant="success" size="sm" onClick={()=>resolveRec(rid)}><CheckCircle size={12}/></Button>
                      )}
                      {isLate && (
                        <Button variant="accent" size="sm" onClick={()=>setReassignModal({open:true,id:rid,agentId:'',recId:''})}>Réaffecter</Button>
                      )}
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
        topTitle={TITLES[section]??'Dashboard'} topBreadcrumb="Administration BlediGo"
        notifCount={unread} onNotifClick={()=>setSection('notifications')}
        userStats={{ reclamations: recs.length, resolved: recs.filter(r=>r.status==='Resolue').length }}
        toasts={toasts}
      >

        {/* ── 1. DASHBOARD ── */}
        {section==='dashboard' && (
          <div className="animate-fade-up">
            <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
              <div><h1 className="font-syne text-xl font-bold">Tableau de bord</h1><p className="text-[13px] text-t3 mt-0.5">Mercredi 18 mars 2026</p></div>
              <Button variant="primary" size="sm" onClick={()=>setAddSvcModal(true)}><Plus size={14}/> Ajouter un service</Button>
            </div>
            {lateRecs.length > 0 && (
              <div className="flex items-center gap-2 mb-4 px-4 py-3 bg-warning-light text-warning border border-yellow-300 rounded-[10px] text-[13px]">
                <AlertTriangle size={15}/>
                <span><strong>{lateRecs.length} réclamations</strong> dépassent le délai.</span>
                <Button variant="warning" size="sm" className="ml-auto" onClick={()=>setSection('affectations')}>Gérer →</Button>
              </div>
            )}
            <div className="grid grid-cols-4 gap-3.5 mb-5">
              <StatCard icon={<FileText size={18}/>}     value={recs.length}                              label="Réclamations totales"  change="+12 ce mois"      color="blue"/>
              <StatCard icon={<CheckCircle size={18}/>}  value={recs.filter(r=>r.status==='Resolue').length} label="Résolues"            change="+8 cette semaine" color="green"/>
              <StatCard icon={<Settings size={18}/>}     value={svcs.filter(s=>s.isActive!==false).length}          label="Services actifs"        change="+3 nouveaux"      color="orange"/>
              <StatCard icon={<AlertTriangle size={18}/>}value={lateRecs.length}                          label="En retard"              change="Hors délai"       changeType="dn" color="red"/>
            </div>
            <div className="grid grid-cols-[1fr_280px] gap-4">
              <div className="flex flex-col gap-4">
                <Card>
                  <CardHeader><CardTitle>Réclamations récentes</CardTitle><Button variant="ghost" size="sm" onClick={()=>setSection('reclamations')}>Voir tout →</Button></CardHeader>
                  <RecTable data={recs.slice(0,4)}/>
                </Card>
                <Card>
                  <CardHeader><CardTitle>Activité — 30 derniers jours</CardTitle><span className="text-[12px] text-t3">Mars 2026</span></CardHeader>
                  <CardBody>
                    <svg className="w-full h-[150px]" viewBox="0 0 520 150" preserveAspectRatio="none">
                      {[30,60,90,120].map(y=><line key={y} x1="0" y1={y} x2="520" y2={y} stroke="#EEF1F8" strokeWidth="1"/>)}
                      <path d="M0,140 C80,125 160,100 240,80 C320,60 400,35 520,22" fill="none" stroke="#1D8C5E" strokeWidth="2.5" strokeLinecap="round"/>
                      <path d="M0,130 C80,120 160,108 240,95 C320,82 400,65 520,55" fill="none" stroke="#1A3C6B" strokeWidth="2" strokeDasharray="5 4" strokeLinecap="round"/>
                    </svg>
                    <div className="flex gap-4 mt-2">
                      <div className="flex items-center gap-1.5 text-[12px] text-t2"><div className="w-3.5 h-[3px] bg-success rounded"/><span>Résolues</span></div>
                      <div className="flex items-center gap-1.5 text-[12px] text-t2"><div className="w-3.5 h-0.5 border-t-2 border-dashed border-primary"/><span>Soumises</span></div>
                    </div>
                  </CardBody>
                </Card>
              </div>
              <div className="flex flex-col gap-4">
                <Card>
                  <CardHeader><CardTitle>Par catégorie</CardTitle></CardHeader>
                  <CardBody className="flex flex-col gap-2.5">
                    {[{n:'Voirie',v:38,c:'#1A3C6B'},{n:'Eclairage',v:29,c:'#E8873A'},{n:'Propreté',v:22,c:'#1D8C5E'},{n:'Eau',v:10,c:'#8C96AE'}].map(c=>(
                      <div key={c.n}>
                        <div className="flex justify-between text-[12.5px] mb-1"><span>{c.n}</span><span className="font-bold">{c.v}</span></div>
                        <ProgressBar value={c.v/50*100} color={c.c}/>
                      </div>
                    ))}
                  </CardBody>
                </Card>
                <Card>
                  <CardHeader><CardTitle>Demandes récentes</CardTitle><Button variant="ghost" size="sm" onClick={()=>setSection('demandes')}>Voir →</Button></CardHeader>
                  {dems.slice(0,3).map(d=>{
                    const did = d._id || d.id
                    const cName = typeof d.citizen === 'object' ? `${d.citizen?.firstName||''} ${d.citizen?.lastName||''}`.trim() : String(d.citizen||'—')
                    const DEM_STATUS = { Pending:'En attente', Accepted:'Acceptée', Rejected:'Refusée', Expired:'Expirée' }
                    const DEM_BADGE  = { Pending:'pending', Accepted:'resolved', Rejected:'cancelled', Expired:'urgent' }
                    return (
                    <div key={did} className="flex items-center gap-2.5 px-4 py-3 border-b border-border last:border-0">
                      <Avatar name={cName} size={28}/>
                      <div className="flex-1 min-w-0"><p className="text-[13px] font-medium truncate">{d.serviceName||d.svc||'—'}</p><p className="text-[11.5px] text-t3">{cName}</p></div>
                      <Badge status={DEM_BADGE[d.status]??'pending'}>{DEM_STATUS[d.status]||d.status||'En attente'}</Badge>
                    </div>
                    )
                  })}
                </Card>
              </div>
            </div>
          </div>
        )}

        {/* ── 2. RAPPORTS ── */}
        {section==='rapports' && (
          <div className="animate-fade-up">
            <div className="flex items-start justify-between mb-5"><h1 className="font-syne text-xl font-bold">Rapports & Statistiques</h1><Button variant="outline" size="sm" onClick={()=>toast('Export PDF lancé','ok')}><Download size={14}/> Exporter PDF</Button></div>
            <div className="grid grid-cols-4 gap-3.5 mb-5">
              {[{v:recs.length,l:'Réclamations totales',c:'text-primary'},{v:'66%',l:'Taux de résolution',c:'text-success'},{v:'38h',l:'Délai moyen',c:'text-accent'},{v:'4.3★',l:'Satisfaction',c:'text-primary'}].map(k=>(
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
                  <div className="flex items-end gap-2 h-[160px]">
                    {[{m:'Oct',h:60},{m:'Nov',h:80},{m:'Déc',h:100},{m:'Jan',h:90},{m:'Fév',h:120},{m:'Mars',h:150,hi:true}].map(b=>(
                      <div key={b.m} className="flex-1 flex flex-col items-center gap-1">
                        <div className={`w-full rounded-t-[5px] ${b.hi?'bg-primary':'bg-primary/20'}`} style={{height:b.h}}/>
                        <span className={`text-[10px] ${b.hi?'text-primary font-bold':'text-t3'}`}>{b.m}</span>
                      </div>
                    ))}
                  </div>
                </CardBody>
              </Card>
              <Card>
                <CardHeader><CardTitle>Performance agents</CardTitle></CardHeader>
                <CardBody className="flex flex-col gap-3">
                  {[{n:'Karim Zghal',v:42,p:85,c:'#1A3C6B'},{n:'Omar Bouzid',v:35,p:71,c:'#E8873A'},{n:'Mohamed Haddad',v:28,p:57,c:'#1D8C5E'}].map(a=>(
                    <div key={a.n}>
                      <div className="flex justify-between text-[12.5px] mb-1"><span className="font-semibold">{a.n}</span><span className="text-t3">{a.v} résolues</span></div>
                      <ProgressBar value={a.p} color={a.c}/>
                    </div>
                  ))}
                </CardBody>
              </Card>
            </div>
          </div>
        )}

        {/* ── 3. RÉCLAMATIONS ── */}
        {section==='reclamations' && (
          <div className="animate-fade-up space-y-4">
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div>
                <h1 className="font-syne text-xl font-bold">Réclamations</h1>
                <p className="text-[13px] text-t3 mt-0.5">{filteredRecs.length} / {recs.length} réclamations</p>
              </div>
              <Button variant="outline" size="sm" onClick={()=>toast('Export CSV lancé','ok')}><Download size={14}/> Export CSV</Button>
            </div>
            {lateRecs.length>0 && (
              <div className="flex items-center gap-2 px-4 py-3 bg-warning-light text-warning border border-yellow-300 rounded-[10px] text-[13px]">
                <AlertTriangle size={15}/><span><strong>{lateRecs.length} réclamations</strong> dépassent le délai.</span>
                <Button variant="warning" size="sm" className="ml-auto" onClick={()=>setSection('affectations')}>Gérer →</Button>
              </div>
            )}
            <FilterBar
              search={recSearch} onSearch={setRecSearch}
              chips={[
                {label:'Toutes', value:''},
                {label:'En attente', value:'En attente'},
                {label:'En cours', value:'En cours'},
                {label:'Résolues', value:'Resolue'},
                {label:'Critique', value:'Critique'},
              ]}
              activeChip={recStatus} onChip={setRecStatus}
              selects={[
                { value:recCat,     onChange:setRecCat,     placeholder:'Toutes catégories', options:['Eclairage public','Voirie & Routes','Propreté & Déchets','Eau & Assainissement','Signalisation','Espaces verts','Bâtiments publics'] },
                { value:recUrgency, onChange:setRecUrgency, placeholder:'Toute urgence',     options:['Critical','High','Medium','Low'] },
              ]}
              count={filteredRecs.length} countLabel="résultat(s)"
            />
            <Card>
              {filteredRecs.length===0
                ? <div className="py-12 text-center text-t3"><FileText size={32} className="mx-auto mb-2 opacity-25"/><p className="font-medium">Aucune réclamation</p><p className="text-[13px] mt-1">Modifiez vos filtres</p></div>
                : <RecTable data={filteredRecs}/>
              }
            </Card>
          </div>
        )}

        {/* ── 4. COMMENTAIRES ── */}
        {section==='commentaires' && (
          <div className="animate-fade-up">
            <h1 className="font-syne text-xl font-bold mb-5">Modération des commentaires</h1>
            {coms.filter(c=>c.flagged&&!c.deleted).length>0 && (
              <div className="flex items-center gap-2 mb-4 px-4 py-3 bg-danger-light text-danger border border-red-200 rounded-[10px] text-[13px]"><AlertTriangle size={15}/><span>{coms.filter(c=>c.flagged&&!c.deleted).length} commentaires signalés — examen requis.</span></div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardHeader><CardTitle>Commentaires signalés</CardTitle><Badge status="urgent">{coms.filter(c=>c.flagged&&!c.deleted).length} à examiner</Badge></CardHeader>
                <CardBody className="flex flex-col gap-4">
                  {coms.filter(c=>c.flagged&&!c.deleted).length===0 ? <p className="text-center text-t3 py-6">Aucun commentaire signalé ✅</p> :
                    coms.filter(c=>c.flagged&&!c.deleted).map(c=>(
                      <div key={c.id} className="flex gap-2.5">
                        <Avatar name={c.user} color="#E24B4A" size={32}/>
                        <div className="flex-1 bg-surface-2 border border-border rounded-[10px] p-3">
                          <div className="flex justify-between mb-1"><span className="text-[13px] font-semibold">{c.user}</span><Badge status="urgent">Signalé</Badge></div>
                          <p className="text-[13px] text-t2 leading-snug mb-2">"{c.text}"</p>
                          <p className="text-[11px] text-t3 mb-2">{c.rec} · {c.time}</p>
                          <div className="flex gap-1.5">
                            <Button variant="success" size="sm" onClick={()=>approveComment(c.id)}>Approuver</Button>
                            <Button variant="danger"  size="sm" onClick={()=>deleteComment(c.id)}>Supprimer</Button>
                            <Button variant="outline" size="sm" onClick={()=>toast('Utilisateur bloqué','ok')}>Bloquer</Button>
                          </div>
                        </div>
                      </div>
                    ))
                  }
                </CardBody>
              </Card>
              <div className="flex flex-col gap-4">
                <Card>
                  <CardHeader><CardTitle>Approuvés récents</CardTitle></CardHeader>
                  <CardBody className="flex flex-col gap-3">
                    {coms.filter(c=>!c.flagged&&!c.deleted).map(c=>(
                      <div key={c.id} className="flex gap-2.5">
                        <Avatar name={c.user} size={30}/>
                        <div className="flex-1 bg-surface-2 border border-border rounded-[9px] p-2.5">
                          <div className="flex justify-between mb-1"><span className="text-[13px] font-semibold">{c.user}</span><Badge status="resolved">Approuvé</Badge></div>
                          <p className="text-[12.5px] text-t2">"{c.text}"</p>
                        </div>
                      </div>
                    ))}
                  </CardBody>
                </Card>
                <Card>
                  <CardHeader><CardTitle>Statistiques</CardTitle></CardHeader>
                  <CardBody className="flex flex-col gap-2.5">
                    {[['Total',coms.length,'text-t1'],['Approuvés',coms.filter(c=>!c.flagged&&!c.deleted).length,'text-success'],['Signalés',coms.filter(c=>c.flagged&&!c.deleted).length,'text-danger'],['Supprimés',coms.filter(c=>c.deleted).length,'text-t3']].map(([l,v,cls])=>(
                      <div key={l} className="flex justify-between text-[13px]"><span className="text-t2">{l}</span><span className={`font-bold ${cls}`}>{v}</span></div>
                    ))}
                    <ProgressBar value={Math.round(coms.filter(c=>!c.flagged&&!c.deleted).length/Math.max(coms.length,1)*100)} color="#1D8C5E"/>
                  </CardBody>
                </Card>
              </div>
            </div>
          </div>
        )}

        {/* ── 5. AFFECTATIONS ── */}
        {section==='affectations' && (
          <div className="animate-fade-up">
            <h1 className="font-syne text-xl font-bold mb-5">Affectations & Suivi agents</h1>
            {lateRecs.length>0 && <div className="flex items-center gap-2 mb-4 px-4 py-3 bg-danger-light text-danger border border-red-200 rounded-[10px] text-[13px]"><AlertTriangle size={15}/>Réclamations <strong>{lateRecs.map(r=>'#'+r.id).join(', ')}</strong> dépassent le délai de 48h.</div>}
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardHeader><CardTitle>Charge par agent</CardTitle></CardHeader>
                {filteredAgts.map(a=>{
                  const aId      = a._id||a.id
                  const aName    = `${a.firstName||''} ${a.lastName||''}`.trim() || (a.name||'Agent')
                  const aLoad    = a.stats?.load    ?? 0
                  const aActive  = a.stats?.active  ?? 0
                  const isAct    = a.isActive !== false
                  return (
                  <div key={aId} className={`px-4 py-3.5 border-b border-border last:border-0 ${!isAct?'opacity-50':''}`}>
                    <div className="flex items-center gap-2.5 mb-2">
                      <Avatar name={aName} color={isAct?'#1D8C5E':'#888'} size={32}/>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13.5px] font-semibold truncate">{aName}</p>
                        <p className="text-[11.5px] text-t3">{a.department||a.dept||'—'}</p>
                      </div>
                      <Badge status={aLoad>70?'urgent':aLoad>40?'pending':'resolved'}>{aActive} actives</Badge>
                    </div>
                    <ProgressBar value={aLoad} color={aLoad>70?'#E8873A':aLoad>50?'#B8760D':'#1D8C5E'}/>
                    <p className="text-[11px] text-t3 mt-1">Charge {aLoad>70?'élevée':aLoad>40?'modérée':'normale'} — {aLoad}%</p>
                  </div>
                )})}
              </Card>
              <Card>
                <CardHeader><CardTitle>Hors délai</CardTitle><Badge status="urgent">{lateRecs.length} urgentes</Badge></CardHeader>
                {lateRecs.map(r=>(
                  <div key={r._id||r.id} className="px-4 py-3.5 border-b border-border last:border-0 bg-danger-light/20">
                    <div className="flex justify-between mb-1">
                      <span className="font-bold text-danger text-[13px]">#{String(r._id||r.id||'').slice(-6)}</span>
                      <Badge status="urgent">Hors délai</Badge>
                    </div>
                    <p className="text-[13px] font-medium mb-1 truncate">{r.title}</p>
                    <p className="text-[11.5px] text-t3 mb-2">
                      {r.assignedAgent
                        ? `Agent: ${r.assignedAgent?.firstName||''} ${r.assignedAgent?.lastName||''}`.trim()
                        : 'Non assigné'
                      } · {r.createdAt ? new Date(r.createdAt).toLocaleDateString('fr-FR') : r.date||'—'}
                    </p>
                    <Button variant="accent" full size="sm" onClick={()=>setReassignModal({open:true,id:r._id||r.id,agentId:'',recId:''})}>Réaffecter maintenant</Button>
                  </div>
                ))}
                {lateRecs.length===0 && <div className="text-center py-10 text-t3"><CheckCircle size={32} className="mx-auto mb-2 text-success"/><p>Aucune réclamation en retard !</p></div>}
              </Card>
            </div>
          </div>
        )}

        {/* ── 6. SERVICES ── */}
        {section==='services' && (
          <div className="animate-fade-up">
            <div className="flex items-start justify-between mb-5">
              <div><h1 className="font-syne text-xl font-bold">Services municipaux</h1><p className="text-[13px] text-t3 mt-0.5">{svcs.length} services · {svcs.filter(s=>s.isActive!==false).length} actifs</p></div>
              <Button variant="primary" size="sm" onClick={()=>setAddSvcModal(true)}><Plus size={14}/> Ajouter un service</Button>
            </div>
            <div className="grid grid-cols-4 gap-3.5 mb-5">
              <StatCard icon={<Settings size={18}/>} value={svcs.length}                      label="Services totaux"   color="blue"/>
              <StatCard icon={<CheckCircle size={18}/>} value={svcs.filter(s=>s.isActive!==false).length} label="Actifs"           color="green"/>
              <StatCard icon={<Users size={18}/>} value={svcs.reduce((a,s)=>a+(s.stats?.totalDemands??s.demands?.length??0),0)} label="Demandes totales" color="orange"/>
              <StatCard icon={<BarChart2 size={18}/>} value={svcs.length>0?(svcs.reduce((a,s)=>a+(s.stats?.avgRating??0),0)/svcs.length).toFixed(1):'—'} label="Note moyenne" color="blue"/>
            </div>
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead><tr>{['Service','Catégorie','Mode','Horaires','Demandes','Note','QR','Actif','Actions'].map(h=><th key={h} className="text-[11px] font-bold text-t3 uppercase tracking-wide px-4 py-2.5 text-left bg-surface-2 border-b border-border">{h}</th>)}</tr></thead>
                  <tbody>
                    {svcs.map(s=>{
                      const sid     = s._id || s.id
                      const isActive = s.isActive !== false
                      const avgNote  = s.stats?.avgRating ?? 0
                      const demCount = s.stats?.totalDemands ?? (s.demands?.length ?? 0)
                      const hours   = s.schedule ? `${s.schedule.openTime||''}–${s.schedule.closeTime||''}` : '—'
                      const days    = s.schedule?.days || '—'
                      return (
                      <tr key={sid} className="hover:bg-surface-2 border-b border-border last:border-0 transition-colors">
                        <td className="px-4 py-3"><div className="font-semibold text-[13px]">{s.name}</div><div className="text-[11px] text-t3">#{String(sid).slice(-6)}</div></td>
                        <td className="px-4 py-3"><span className="text-[11.5px] px-2 py-0.5 rounded bg-muted text-t2 border border-border font-medium">{s.category||s.cat||'—'}</span></td>
                        <td className="px-4 py-3"><Badge status={isActive?'resolved':'cancelled'}>{s.mode||'Presentiel'}</Badge></td>
                        <td className="px-4 py-3 text-[12px] text-t3">{days}<br/>{hours}</td>
                        <td className="px-4 py-3 font-bold">{demCount}</td>
                        <td className="px-4 py-3 text-[13px]">{'★'.repeat(Math.round(avgNote))}{'☆'.repeat(5-Math.round(avgNote))} <span className="text-t3 text-[11px]">{avgNote.toFixed ? avgNote.toFixed(1) : avgNote}</span></td>
                        <td className="px-4 py-3"><Button variant="outline" size="sm" onClick={()=>toast(`QR — ${s.name}`,'ok')}>QR</Button></td>
                        <td className="px-4 py-3"><Toggle checked={isActive} onChange={()=>toggleSvc(sid)}/></td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1.5">
                            <Button variant="outline" size="sm" onClick={()=>toast(`Modifier ${s.name}`,'ok')}>✏</Button>
                            <Button variant="danger"  size="sm" onClick={()=>deleteSvc(sid)}><Trash2 size={12}/></Button>
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
        )}

        {/* ── 7. DEMANDES ── */}
        {section==='demandes' && (
          <div className="animate-fade-up">
            <h1 className="font-syne text-xl font-bold mb-5">Demandes de services</h1>
            <div className="flex items-center gap-2 mb-2 px-4 py-3 bg-primary/8 text-primary border border-primary/20 rounded-[10px] text-[13px]">
              <AlertTriangle size={15}/> Les demandes non traitées après 24h sont réaffectées automatiquement.
            </div>
            <FilterBar
              search={demSearch} onSearch={setDemSearch}
              chips={[{label:'Toutes',value:''},{label:'En attente',value:'En attente'},{label:'Acceptées',value:'Acceptee'},{label:'Expirées',value:'Expire'}]}
              activeChip={demStatus} onChip={setDemStatus}
              count={filteredDems.length} countLabel="demande(s)" className="mb-4"
            />
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead><tr>{['Réf.','Service','Citoyen','Agent','Date','Délai','Statut','Actions'].map(h=><th key={h} className="text-[11px] font-bold text-t3 uppercase tracking-wide px-4 py-2.5 text-left bg-surface-2 border-b border-border">{h}</th>)}</tr></thead>
                  <tbody>
                    {filteredDems.map(d=>{
                      const did      = d._id || d.id
                      const citizenName = typeof d.citizen === 'object' && d.citizen
                        ? `${d.citizen?.firstName||''} ${d.citizen?.lastName||''}`.trim() || '—'
                        : String(d.citizen||'—')
                      const svcName  = d.serviceName || d.svc || '—'
                      const dateStr  = d.createdAt ? new Date(d.createdAt).toLocaleDateString('fr-FR') : d.date || '—'
                      const isExpired = d.status === 'Expired' || d.expired
                      // 24h overdue check
                      const isOverdue24 = d.status === 'Pending' && d.createdAt
                        ? (Date.now() - new Date(d.createdAt)) > 24*3600*1000 : false
                      const DEM_STATUS = { Pending:'En attente', Accepted:'Acceptée', Rejected:'Refusée', Expired:'Expirée' }
                      const statusLabel = DEM_STATUS[d.status] || d.status || 'En attente'
                      const DEM_BADGE   = { Pending:'pending', Accepted:'resolved', Rejected:'cancelled', Expired:'urgent' }
                      return (
                      <tr key={did} className={`hover:bg-surface-2 border-b border-border last:border-0 transition-colors ${isExpired||isOverdue24?'bg-danger-light/20':''}`}>
                        <td className={`px-4 py-3 font-bold text-[13px] ${isExpired||isOverdue24?'text-danger':'text-primary'}`}>#{String(did).slice(-6)}</td>
                        <td className="px-4 py-3 text-[13px] max-w-[130px] truncate">{svcName}</td>
                        <td className="px-4 py-3 text-[12.5px]">{citizenName}</td>
                        <td className="px-4 py-3 text-[12px] text-t3">{dateStr}</td>
                        <td className={`px-4 py-3 text-[12px] font-semibold ${isOverdue24?'text-danger':d.status==='Accepted'?'text-success':'text-t3'}`}>
                          {isOverdue24 ? '⚠ Dépassé' : d.status === 'Accepted' ? 'Traité' : isExpired ? 'Expiré' : '< 24h'}
                        </td>
                        <td className="px-4 py-3"><Badge status={DEM_BADGE[d.status]??'pending'}>{statusLabel}</Badge></td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1.5">
                            {d.status === 'Pending' && <>
                              <Button variant="success" size="sm" onClick={()=>acceptDem(did, d.serviceId)}>✓ Accepter</Button>
                              <Button variant="danger"  size="sm" onClick={()=>refuseDem(did, d.serviceId)}>✗ Refuser</Button>
                            </>}
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
        )}

        {/* ── 8. UTILISATEURS (Citoyens uniquement, lecture seule) ── */}
        {section==='utilisateurs' && (
          <div className="animate-fade-up space-y-4">
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div>
                <h1 className="font-syne text-xl font-bold">Citoyens inscrits</h1>
                <p className="text-[13px] text-t3 mt-0.5">{filteredUsrs.length} citoyen{filteredUsrs.length!==1?'s':''} enregistré{filteredUsrs.length!==1?'s':''}</p>
              </div>
            </div>
            <FilterBar
              search={usrSearch} onSearch={setUsrSearch}
              count={filteredUsrs.length} countLabel="citoyen(s)"
            />
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead><tr>{['Citoyen','Email','CIN','Municipalité','Inscription'].map(h=>(
                    <th key={h} className="text-[11px] font-bold text-t3 uppercase tracking-wide px-4 py-2.5 text-left bg-surface-2 border-b border-border">{h}</th>
                  ))}</tr></thead>
                  <tbody>
                    {filteredUsrs.length === 0 ? (
                      <tr><td colSpan={5} className="px-4 py-12 text-center text-t3">
                        <Users size={32} className="mx-auto mb-2 opacity-25"/>
                        <p>Aucun citoyen trouvé</p>
                      </td></tr>
                    ) : filteredUsrs.map(u=>{
                      const uid   = u._id || u.id
                      const uName = `${u.firstName||''} ${u.lastName||''}`.trim() || u.email || '—'
                      const joined = u.createdAt ? new Date(u.createdAt).toLocaleDateString('fr-FR') : '—'
                      return (
                        <tr key={uid} className="hover:bg-surface-2 border-b border-border last:border-0 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <Avatar name={uName} color="#1A3C6B" size={30}/>
                              <div>
                                <p className="font-semibold text-[13px]">{uName}</p>
                                {u.phone && <p className="text-[11.5px] text-t3">{u.phone}</p>}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-[12.5px] text-t2">{u.email||'—'}</td>
                          <td className="px-4 py-3 text-[12px] text-t3">{u.cin||'—'}</td>
                          <td className="px-4 py-3 text-[12px] text-t2">{u.municipality||'Tunis'}</td>
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
        {section==='agents' && (
          <div className="animate-fade-up space-y-4">
            {/* Header */}
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div>
                <h1 className="font-syne text-xl font-bold">Agents municipaux</h1>
                <p className="text-[13px] text-t3 mt-0.5">{filteredAgts.length} agent{filteredAgts.length!==1?'s':''} · {agts.filter(a=>a.isActive!==false).length} actifs</p>
              </div>
              <Button variant="primary" size="sm" onClick={()=>setAddUserModal(true)}><Plus size={14}/> Ajouter un agent</Button>
            </div>

            {/* Summary stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard icon={<Users size={18}/>}       value={agts.length}                                             label="Agents total"    color="blue"/>
              <StatCard icon={<CheckCircle size={18}/>} value={agts.filter(a=>a.isActive!==false).length}               label="Actifs"          color="green"/>
              <StatCard icon={<FileText size={18}/>}    value={agts.reduce((s,a)=>s+(a.stats?.active||0),0)}            label="Réclamations actives" color="orange"/>
              <StatCard icon={<BarChart2 size={18}/>}   value={agts.length>0?Math.round(agts.reduce((s,a)=>s+(a.stats?.resolutionRate||0),0)/agts.length)+'%':'—'} label="Taux résolution moyen" color="blue"/>
            </div>

            {/* Search */}
            <FilterBar
              search={agtSearch} onSearch={setAgtSearch}
              count={filteredAgts.length} countLabel="agent(s)"
            />

            {/* Agent cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredAgts.length === 0 && (
                <div className="col-span-3 text-center py-16 text-t3">
                  <Users size={36} className="mx-auto mb-3 opacity-30"/>
                  <p>Aucun agent trouvé</p>
                </div>
              )}
              {filteredAgts.map(a => {
                const id       = a._id || a.id
                const fullName = a.firstName && a.lastName ? `${a.firstName} ${a.lastName}` : (a.name||'Agent')
                const stats    = a.stats || {}
                const load     = stats.load ?? 0
                const isActive = a.isActive !== false
                return (
                  <Card key={id} className={!isActive ? 'opacity-60' : ''}>
                    <CardBody className="p-5">
                      {/* Avatar + name + status */}
                      <div className="flex items-start gap-3 mb-4">
                        <div className="relative shrink-0">
                          <Avatar name={fullName} color={isActive?'#1D8C5E':'#888'} size={48}/>
                          <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${isActive?'bg-success':'bg-t3'}`}/>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-syne text-[14.5px] font-bold truncate">{fullName}</h3>
                          <p className="text-[12px] text-t3 truncate">{a.department||a.dept||'Direction Technique'}</p>
                          {(a.specialization||a.spec) && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {(Array.isArray(a.specialization)?a.specialization:(a.spec||'').split(',')).slice(0,3).map((s,i)=>(
                                <span key={i} className="text-[10.5px] px-1.5 py-0.5 rounded bg-primary/8 text-primary font-medium">{String(s).trim()}</span>
                              ))}
                            </div>
                          )}
                        </div>
                        <Toggle checked={isActive} onChange={async()=>{
                          try {
                            await agentsAPI.toggleActive(id)
                            setAgts(prev => prev.map(x => (x._id||x.id)===id ? {...x, isActive:!x.isActive} : x))
                            toast(`${fullName} ${isActive?'désactivé':'activé'}`, 'ok')
                          } catch { toast('Erreur', 'err') }
                        }}/>
                      </div>

                      {/* Stats grid */}
                      <div className="grid grid-cols-3 gap-2 mb-3">
                        {[
                          { label:'Total',    value: stats.total    ?? 0, color:'#1A3C6B' },
                          { label:'En cours', value: stats.active   ?? 0, color:'#E8873A' },
                          { label:'Résolues', value: stats.resolved ?? 0, color:'#1D8C5E' },
                        ].map(({label,value,color})=>(
                          <div key={label} className="bg-muted rounded-[8px] p-2 text-center">
                            <div className="font-syne font-bold text-[17px]" style={{color}}>{value}</div>
                            <div className="text-[10.5px] text-t3">{label}</div>
                          </div>
                        ))}
                      </div>

                      {/* Resolution rate */}
                      <div className="mb-3">
                        <div className="flex justify-between text-[11.5px] mb-1">
                          <span className="text-t3">Taux résolution</span>
                          <span className="font-semibold">{stats.resolutionRate??0}%</span>
                        </div>
                        <ProgressBar value={stats.resolutionRate??0} color="#1D8C5E" height={6}/>
                      </div>

                      {/* Workload */}
                      <div className="mb-4">
                        <div className="flex justify-between text-[11.5px] mb-1">
                          <span className="text-t3">Charge de travail</span>
                          <span className={`font-semibold ${load>70?'text-danger':load>40?'text-warning':'text-success'}`}>{load}%</span>
                        </div>
                        <ProgressBar value={load} color={load>70?'#E24B4A':load>40?'#E8873A':'#1D8C5E'} height={6}/>
                      </div>

                      {/* Urgent badge */}
                      {(stats.critical||0)+(stats.high||0) > 0 && (
                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-danger-light text-danger rounded-[8px] text-[12px] font-medium mb-3">
                          <AlertTriangle size={12}/>
                          {(stats.critical||0)+(stats.high||0)} réclamation{(stats.critical||0)+(stats.high||0)>1?'s':''} urgente{(stats.critical||0)+(stats.high||0)>1?'s':''}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2">
                        <Button variant="outline" full size="sm"
                          onClick={()=>setAgentDetailModal({open:true, agent:a})}>
                          Voir détails
                        </Button>
                        <Button variant="primary" full size="sm" disabled={!isActive}
                          onClick={()=>setReassignModal({open:true, id:null, agentId:id, recId:''})}>
                          Affecter une réclamation
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
        {section==='messagerie' && (
          <div className="animate-fade-up">
            <h1 className="font-syne text-xl font-bold mb-5">Messagerie</h1>
            <div className="grid grid-cols-[250px_1fr] h-[480px] bg-white border border-border rounded-card overflow-hidden">
              <div className="border-r border-border flex flex-col">
                <div className="p-2.5 border-b border-border">
                  <div className="flex items-center gap-2 bg-surface-2 border border-border rounded-[8px] px-3 py-1.5">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#8C96AE" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                    <input placeholder="Rechercher..." className="bg-transparent border-none outline-none text-[13px] w-full font-dm"/>
                  </div>
                </div>
                {convos.map((c,i)=>(
                  <div key={c.id} onClick={()=>setActiveConvo(i)} className={`flex items-start gap-2.5 p-3 cursor-pointer border-b border-border transition-colors ${i===activeConvo?'bg-primary/8':'hover:bg-surface-2'}`}>
                    <Avatar name={c.user} color={c.color} size={34}/>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between"><span className={`text-[13px] ${i===activeConvo?'font-semibold':''}`}>{c.user}</span><span className="text-[11px] text-t3">{c.time}</span></div>
                      <p className="text-[12px] text-t3 truncate">{c.msgs[c.msgs.length-1].txt.substring(0,35)}…</p>
                      <Badge status={c.badge} className="mt-1 text-[10px] py-0">{c.sub}</Badge>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex flex-col">
                <div className="px-4 py-3 border-b border-border flex items-center gap-2.5">
                  <Avatar name={convos[activeConvo].user} color={convos[activeConvo].color} size={34}/>
                  <div><p className="text-[13.5px] font-semibold">{convos[activeConvo].user}</p><p className="text-[11.5px] text-success">● En ligne</p></div>
                  <Badge status={convos[activeConvo].badge} className="ml-auto">{convos[activeConvo].sub}</Badge>
                </div>
                <div className="flex-1 p-4 flex flex-col gap-2.5 overflow-y-auto custom-scroll">
                  {convos[activeConvo].msgs.map((m,i)=>(
                    <div key={i} className={`max-w-[65%] px-3.5 py-2.5 rounded-[11px] text-[13.5px] leading-relaxed ${m.out?'bg-primary text-white self-end rounded-tr-sm':'bg-muted border border-border self-start rounded-tl-sm'}`}>{m.txt}</div>
                  ))}
                </div>
                <div className="p-3 border-t border-border flex gap-2">
                  <input value={msgInput} onChange={e=>setMsgInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&sendMsg()} placeholder="Écrire un message…" className="flex-1 bg-surface-2 border border-border-2 rounded-full px-4 py-2 text-[13.5px] outline-none font-dm"/>
                  <Button variant="primary" size="sm" onClick={sendMsg}>Envoyer</Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── 11. NOTIFICATIONS ── */}
        {section==='notifications' && (
          <div className="animate-fade-up">
            <div className="flex items-center justify-between mb-5">
              <div><h1 className="font-syne text-xl font-bold">Notifications</h1><p className="text-[13px] text-t3 mt-0.5">{unread} non lues</p></div>
              <Button variant="ghost" size="sm" onClick={async()=>{ try { await notificationsAPI.markAllRead() } catch {} setNotifs(prev=>prev.map(n=>({...n,unread:false}))); toast('Tout marqué comme lu','ok')}}>Tout marquer lu</Button>
            </div>
            <Card>
              {notifs.map(n=>(
                <div key={n.id} onClick={async()=>{ try { await notificationsAPI.markRead(n._id||n.id) } catch {} setNotifs(prev=>prev.map(x=>(x._id||x.id)===(n._id||n.id)?{...x,unread:false}:x))}}
                  className={`flex items-start gap-3 px-4 py-3.5 border-b border-border last:border-0 cursor-pointer transition-colors hover:bg-surface-2 ${n.unread?'bg-primary/5':''}`}>
                  <div className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${n.unread?'bg-primary':'bg-transparent border border-border-2'}`}/>
                  <div className="flex-1"><p className={`text-[13px] ${n.unread?'font-medium':'text-t2'}`}>{n.text||n.message||''}</p><p className="text-[11.5px] text-t3 mt-0.5">{n.time||new Date(n.createdAt||Date.now()).toLocaleString('fr-FR')}</p></div>
                  {n.actionSec && <Button variant="accent" size="sm" onClick={e=>{e.stopPropagation();setSection(n.actionSec)}}>Agir</Button>}
                </div>
              ))}
            </Card>
          </div>
        )}

        {/* ── 12. PARAMÈTRES ── */}
        {section==='parametres' && (
          <div className="animate-fade-up">
            <div className="flex items-start justify-between mb-5">
              <h1 className="font-syne text-xl font-bold">Paramètres système</h1>
              <Button variant="primary" size="sm" onClick={()=>toast('Paramètres sauvegardés','ok')}>💾 Sauvegarder</Button>
            </div>
            <div className="grid grid-cols-2 gap-5">
              <div className="flex flex-col gap-5">
                <Card>
                  <CardHeader><CardTitle>Paramètres généraux</CardTitle></CardHeader>
                  <CardBody className="flex flex-col gap-0">
                    {[['Nom de la municipalité','Municipalité de Tunis','text'],['Langue par défaut','Français','select'],['Fuseau horaire','UTC+1 (Tunis)','select']].map(([l,v,t])=>(
                      <div key={l} className="flex items-center justify-between py-3.5 border-b border-border last:border-0">
                        <div><p className="text-[13.5px] font-semibold">{l}</p></div>
                        <input defaultValue={v} className="bg-surface-2 border border-border-2 rounded-btn px-3 py-2 text-[13px] outline-none font-dm w-48"/>
                      </div>
                    ))}
                  </CardBody>
                </Card>
                <Card>
                  <CardHeader><CardTitle>Délais de traitement</CardTitle></CardHeader>
                  <CardBody className="flex flex-col gap-0">
                    {[['Réclamation normale','48'],['Réclamation urgente','12'],['Demande service','24'],['Annulation citoyen','2']].map(([l,v])=>(
                      <div key={l} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                        <p className="text-[13.5px] font-semibold">{l}</p>
                        <div className="flex items-center gap-2"><input type="number" defaultValue={v} className="bg-surface-2 border border-border-2 rounded-btn px-3 py-2 text-[13px] outline-none font-dm w-16"/><span className="text-[13px] text-t3">heures</span></div>
                      </div>
                    ))}
                  </CardBody>
                </Card>
              </div>
              <div className="flex flex-col gap-5">
                <Card>
                  <CardHeader><CardTitle>Notifications email</CardTitle></CardHeader>
                  <CardBody className="flex flex-col gap-0">
                    {['Nouvelle réclamation','Confirmation citoyen','Réclamation résolue','Annulation service','Alertes hors délai'].map(l=>{
                      const [on,setOn] = [true, ()=>{}]
                      return (
                        <div key={l} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                          <p className="text-[13.5px] font-semibold">{l}</p>
                          <Toggle checked={true} onChange={()=>toast(l+' toggled','ok')}/>
                        </div>
                      )
                    })}
                  </CardBody>
                </Card>
                <Card>
                  <CardHeader><CardTitle>Modération commentaires</CardTitle></CardHeader>
                  <CardBody className="flex flex-col gap-0">
                    {['Auto-suppression spam','Signalement automatique','Approbation manuelle'].map((l,i)=>(
                      <div key={l} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                        <p className="text-[13.5px] font-semibold">{l}</p>
                        <Toggle checked={i<2} onChange={()=>toast(l+' toggled','ok')}/>
                      </div>
                    ))}
                  </CardBody>
                </Card>
              </div>
            </div>
          </div>
        )}

      </AppShell>

      {/* Detail Panel */}
      <DetailPanel
        rec={detailRec} open={detailOpen}
        onClose={()=>setDetailOpen(false)}
        onResolve={resolveRec}
        onReassign={id=>{ setDetailOpen(false); setReassignModal({open:true,id}) }}
        onStatusChange={statusChange}
      />

      {/* ── AGENT DETAIL MODAL ── */}
      <Modal
        open={agentDetailModal.open}
        onClose={()=>{ setAgentDetailModal({open:false,agent:null}); setAgentDetailTab('overview') }}
        title={agentDetailModal.agent ? `${agentDetailModal.agent.firstName||''} ${agentDetailModal.agent.lastName||''} — Fiche agent` : ''}
        size="lg"
        footer={
          <div className="flex items-center gap-2 w-full">
            <Button variant={agentDetailModal.agent?.isActive!==false?'danger':'success'}
              onClick={async()=>{
                const a = agentDetailModal.agent
                const id = a?._id||a?.id
                if (!id) return
                try {
                  await agentsAPI.toggleActive(id)
                  const newActive = !(a.isActive!==false)
                  setAgts(prev => prev.map(x => (x._id||x.id)===id ? {...x, isActive:newActive} : x))
                  setAgentDetailModal(p => ({...p, agent:{...p.agent, isActive:newActive}}))
                  toast(`Compte ${newActive?'activé':'désactivé'}`, 'ok')
                } catch { toast('Erreur', 'err') }
              }}>
              {agentDetailModal.agent?.isActive!==false ? 'Désactiver le compte' : 'Activer le compte'}
            </Button>
            <div className="flex-1"/>
            <Button variant="primary"
              onClick={()=>{
                const id = agentDetailModal.agent?._id||agentDetailModal.agent?.id
                setAgentDetailModal({open:false,agent:null})
                setReassignModal({open:true, id:null, agentId:id, recId:''})
              }}>
              Affecter une réclamation
            </Button>
            <Button variant="outline" onClick={()=>setAgentDetailModal({open:false,agent:null})}>Fermer</Button>
          </div>
        }
      >
        {agentDetailModal.agent && (() => {
          const a      = agentDetailModal.agent
          const stats  = a.stats || {}
          const name   = `${a.firstName||''} ${a.lastName||''}`.trim()
          const isActive = a.isActive !== false
          return (
            <div className="space-y-4">
              {/* Identity card */}
              <div className="flex items-start gap-4 p-4 bg-surface-2 rounded-[10px]">
                <div className="relative shrink-0">
                  <Avatar name={name} color={isActive?'#1D8C5E':'#888'} size={64}/>
                  <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-white ${isActive?'bg-success':'bg-t3'}`}/>
                </div>
                <div className="flex-1">
                  <h3 className="font-syne text-[17px] font-bold">{name}</h3>
                  <p className="text-[13px] text-t3">{a.department||'Direction Technique'}</p>
                  <p className="text-[12.5px] text-t2 mt-0.5">{a.email}</p>
                  {a.phone && <p className="text-[12.5px] text-t3">{a.phone}</p>}
                  <div className="flex flex-wrap gap-1 mt-2">
                    {(Array.isArray(a.specialization)?a.specialization:[]).map((s,i)=>(
                      <span key={i} className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{s}</span>
                    ))}
                  </div>
                </div>
                <span className={`text-[11.5px] font-semibold px-2.5 py-1 rounded-full ${isActive?'bg-success-light text-success':'bg-muted text-t3'}`}>
                  {isActive ? '● Actif' : '○ Inactif'}
                </span>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {[
                  { label:'Total assignées',  value: stats.total      ?? 0, color:'#1A3C6B' },
                  { label:'En cours',         value: stats.active     ?? 0, color:'#E8873A' },
                  { label:'Résolues',         value: stats.resolved   ?? 0, color:'#1D8C5E' },
                  { label:'Taux résolution',  value: (stats.resolutionRate??0)+'%', color:'#1D8C5E' },
                ].map(({label,value,color})=>(
                  <div key={label} className="bg-white border border-border rounded-[10px] p-3 text-center">
                    <div className="font-syne font-bold text-[20px]" style={{color}}>{value}</div>
                    <div className="text-[11px] text-t3 mt-0.5">{label}</div>
                  </div>
                ))}
              </div>

              {/* Urgency breakdown */}
              {((stats.critical||0)+(stats.high||0)) > 0 && (
                <div className="flex items-center gap-3 px-4 py-3 bg-danger-light border border-red-200 rounded-[10px] text-[13px] text-danger">
                  <AlertTriangle size={15}/>
                  <span><strong>{stats.critical||0}</strong> critique{(stats.critical||0)!==1?'s':''} · <strong>{stats.high||0}</strong> haute{(stats.high||0)!==1?'s':''}</span>
                </div>
              )}

              {/* Workload bar */}
              <div>
                <div className="flex justify-between text-[12.5px] mb-1.5">
                  <span className="text-t2 font-medium">Charge de travail</span>
                  <span className={`font-bold ${(stats.load??0)>70?'text-danger':(stats.load??0)>40?'text-warning':'text-success'}`}>{stats.load??0}%</span>
                </div>
                <ProgressBar value={stats.load??0} color={(stats.load??0)>70?'#E24B4A':(stats.load??0)>40?'#E8873A':'#1D8C5E'} height={10}/>
                <p className="text-[11.5px] text-t3 mt-1">
                  {stats.active??0} réclamation{(stats.active??0)!==1?'s':''} active{(stats.active??0)!==1?'s':''} sur {stats.total??0} totales
                </p>
              </div>

              {/* Recent reclamations from this agent */}
              <AgentRecentRecs agentId={a._id||a.id} recs={recs} onAssign={id=>{ setAgentDetailModal({open:false,agent:null}); setReassignModal({open:true,id,agentId:''}) }}/>

              {/* Account info */}
              <div className="grid grid-cols-2 gap-3 text-[12.5px] bg-surface-2 rounded-[10px] p-4">
                {[
                  ['ID compte',    String(a._id||a.id||'—').slice(-8)],
                  ['Municipalité', a.municipality||'Tunis'],
                  ['Inscription',  a.createdAt ? new Date(a.createdAt).toLocaleDateString('fr-FR') : '—'],
                  ['Dernière co.',  a.lastLogin  ? new Date(a.lastLogin).toLocaleDateString('fr-FR')  : 'Jamais'],
                ].map(([k,v])=>(
                  <div key={k}><span className="block text-t3 text-[11px] uppercase font-bold tracking-wide mb-0.5">{k}</span><span className="font-medium">{v}</span></div>
                ))}
              </div>
            </div>
          )
        })()}
      </Modal>

      {/* Reassign Modal */}
      <Modal open={reassignModal.open} onClose={()=>setReassignModal({open:false,id:null,agentId:'',recId:''})} title="Affecter une réclamation"
        footer={<><Button variant="outline" onClick={()=>setReassignModal({open:false,id:null,agentId:'',recId:''})}>Annuler</Button><Button variant="accent" disabled={!reassignModal.agentId||(reassignModal.id===null&&!reassignModal.recId)} onClick={()=>doReassign(reassignModal.recId||reassignModal.id, reassignModal.agentId)}>Affecter</Button></>}>
        {/* If opened from agent card, pick reclamation first */}
        {!reassignModal.id && reassignModal.agentId && (
          <FormGroup label="Réclamation à affecter">
            <Select value={reassignModal.recId||''} onChange={e=>setReassignModal(p=>({...p,recId:e.target.value}))}>
              <option value="">— Sélectionner une réclamation —</option>
              {recs.filter(r=>['Pending','In Progress'].includes(r.status)).map(r=>(
                <option key={r._id||r.id} value={r._id||r.id}>
                  #{String(r._id||r.id||'').slice(-6)} — {r.title?.substring(0,45)}
                </option>
              ))}
            </Select>
          </FormGroup>
        )}
        {reassignModal.id && (
          <div className="p-3 bg-danger-light text-danger rounded-[9px] text-[13px] mb-3">Réclamation <strong>#{String(reassignModal.id).slice(-6)}</strong> — réaffectation requise</div>
        )}
        <FormGroup label="Affecter à l'agent" htmlFor="ra">
          <Select id="ra" value={reassignModal.agentId} onChange={e => setReassignModal(p => ({...p, agentId: e.target.value}))}>
            <option value="">— Sélectionner un agent —</option>
            {agts.filter(a=>a.isActive!==false).map(a => {
              const load = a.stats?.load ?? 0
              return (
                <option key={a._id||a.id} value={a._id||a.id}>
                  {a.firstName} {a.lastName} — {a.department||'Agent'} ({load}% charge)
                </option>
              )
            })}
          </Select>
        </FormGroup>
        <FormGroup label="Note pour l'agent"><Textarea placeholder="Instructions supplémentaires…"/></FormGroup>
      </Modal>

      {/* Add Service Modal */}
      <Modal open={addSvcModal} onClose={()=>setAddSvcModal(false)} title="Ajouter un service"
        footer={<><Button variant="outline" onClick={()=>setAddSvcModal(false)}>Annuler</Button><Button variant="primary" onClick={()=>{setAddSvcModal(false);toast('Service ajouté','ok')}}>Enregistrer</Button></>}>
        <FormGroup label="Nom du service *"><Input placeholder="Ex : Acte de naissance"/></FormGroup>
        <div className="grid grid-cols-2 gap-3">
          <FormGroup label="Catégorie"><Select><option>Etat civil</option><option>Urbanisme</option><option>Proprete</option><option>Transport</option></Select></FormGroup>
          <FormGroup label="Mode"><Select><option>En ligne</option><option>Présentiel</option><option>Hybride</option></Select></FormGroup>
        </div>
        <FormGroup label="Description"><Textarea placeholder="Décrivez le service…"/></FormGroup>
        <div className="grid grid-cols-2 gap-3">
          <FormGroup label="Jours"><Input placeholder="Lun-Ven"/></FormGroup>
          <FormGroup label="Horaires"><Input placeholder="08h-16h"/></FormGroup>
        </div>
      </Modal>

      {/* Add User Modal */}
      <Modal open={addUserModal} onClose={()=>setAddUserModal(false)} title="Nouvel utilisateur"
        footer={<><Button variant="outline" onClick={()=>setAddUserModal(false)}>Annuler</Button><Button variant="primary" onClick={()=>{setAddUserModal(false);toast('Compte créé','ok')}}>Créer le compte</Button></>}>
        <div className="grid grid-cols-2 gap-3">
          <FormGroup label="Prénom"><Input placeholder="Ahmed"/></FormGroup>
          <FormGroup label="Nom"><Input placeholder="Mansour"/></FormGroup>
        </div>
        <FormGroup label="Email"><Input type="email" placeholder="agent@munic.tn"/></FormGroup>
        <div className="grid grid-cols-2 gap-3">
          <FormGroup label="Rôle"><Select><option>Citoyen</option><option>Agent</option><option>Administrateur</option></Select></FormGroup>
          <FormGroup label="Service"><Select><option>Direction Technique</option><option>Service Voirie</option><option>Service Propreté</option></Select></FormGroup>
        </div>
        <FormGroup label="CIN / Matricule"><Input placeholder="12345678"/></FormGroup>
      </Modal>

      {/* Confirm Modal */}
      <Modal open={confirmModal.open} onClose={()=>setConfirmModal({open:false,msg:'',cb:null})} title="Confirmation" size="sm"
        footer={<><Button variant="outline" onClick={()=>setConfirmModal({open:false,msg:'',cb:null})}>Annuler</Button><Button variant="danger" onClick={()=>{confirmModal.cb?.();setConfirmModal({open:false,msg:'',cb:null})}}>Confirmer</Button></>}>
        <p className="text-[13.5px] text-t2 leading-relaxed">{confirmModal.msg}</p>
      </Modal>
    </>
  )
}
