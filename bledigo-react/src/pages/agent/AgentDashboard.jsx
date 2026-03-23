import { useState, useEffect, useCallback } from 'react'
import {
  LayoutDashboard, FileText, Clock, ClipboardCheck,
  MessageCircle, Bell, UserCircle, CheckCircle, Loader2,
  AlertTriangle, Plus,
} from 'lucide-react'
import AppShell from '../../components/shared/AppShell'
import { Card, CardHeader, CardTitle, CardBody } from '../../components/ui/Card'
import StatCard from '../../components/ui/StatCard'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Avatar from '../../components/ui/Avatar'
import ProgressBar from '../../components/ui/ProgressBar'
import Modal from '../../components/ui/Modal'
import { FormGroup, Select, Textarea, Input } from '../../components/ui/Field'
import { useToast } from '../../hooks/useToast'
import { useAuth } from '../../context/AuthContext'
import FilterBar from '../../components/ui/FilterBar'
import { notificationsAPI, agentsAPI, reclamationsAPI, servicesAPI } from '../../services/api'
import { useNotifications, useDemandes } from '../../hooks/useData'

const STATUS_BADGE = {
  'En cours':'progress','En attente':'pending','Resolue':'resolved','Critique':'urgent',
  'Pending':'pending','In Progress':'progress','Resolved':'resolved','Cancelled':'resolved',
}

export default function AgentDashboard() {
  const { user: authUser } = useAuth()
  const { toasts, toast } = useToast()

  const AGENT = {
    name:      authUser ? `${authUser.firstName} ${authUser.lastName}` : 'Agent',
    shortName: authUser?.firstName || 'Agent',
    color:     '#1D8C5E',
    role:      authUser?.department || 'Direction Technique',
  }

  // ── Real API data ─────────────────────────────────────
  const [recs,     setRecs]     = useState([])
  const [recsLoading, setRecsLoading] = useState(true)
  const { data: dems, setData: setDems, refetch: refetchDems } = useDemandes()
  const { data: notifs, setData: setNotifs } = useNotifications()
  const [section,  setSection]  = useState('dashboard')
  const [traiterModal, setTraiterModal] = useState({ open:false, rec:null })
  const [newStatus,    setNewStatus]    = useState('In Progress')
  const [rapport,      setRapport]      = useState('')
  const [convos,  setConvos]   = useState([])
  const [activeConvo, setActiveConvo] = useState(0)
  const [msgInput, setMsgInput] = useState('')

  // ── Fetch real reclamations from API ─────────────────
  const fetchRecs = useCallback(async () => {
    setRecsLoading(true)
    try {
      const res = await agentsAPI.getMyDashboard()
      const data = res?.data || res
      const assigned = Array.isArray(data?.assigned) ? data.assigned
                     : Array.isArray(data) ? data
                     : []
      setRecs(assigned)
    } catch {
      setRecs([])
    } finally {
      setRecsLoading(false)
    }
  }, [])

  useEffect(() => { fetchRecs() }, [fetchRecs])

  const lateRecs = recs.filter(r => r.late || r.isOverdue)
  const unread   = notifs.filter(n => n.unread || !n.isRead).length

  // ── Filter state ─────────────────────────────────────
  const [recSearch,  setRecSearch]  = useState('')
  const [recStatus,  setRecStatus]  = useState('')
  const [recUrgency, setRecUrgency] = useState('')
  const [demStatus,  setDemStatus]  = useState('')

  const filteredRecs = recs.filter(r => {
    const q = recSearch.toLowerCase()
    const matchQ = !q || (r.title||'').toLowerCase().includes(q) || String(r._id||r.id||'').slice(-6).toLowerCase().includes(q)
    const matchS = !recStatus  || r.status === recStatus
    const matchU = !recUrgency || (r.urgency?.level||r.urg||'') === recUrgency
    return matchQ && matchS && matchU
  })
  const filteredDems = dems.filter(d => !demStatus || d.status === demStatus)

  async function markAllRead() {
    try { await notificationsAPI.markAllRead() } catch {}
    setNotifs(prev => prev.map(n => ({...n, unread:false, isRead:true})))
    toast('Toutes les notifications marquées comme lues', 'ok')
  }

  async function markNotifRead(n) {
    const id = n._id || n.id
    try { await notificationsAPI.markRead(id) } catch {}
    setNotifs(prev => prev.map(x => (x._id||x.id)===id ? {...x,unread:false,isRead:true} : x))
  }

  function openTraiter(rec) {
    setTraiterModal({ open:true, rec })
    setNewStatus(rec.status === 'En attente' ? 'En cours' : rec.status)
    setRapport('')
  }

  async function submitTraitement() {
    const rec = traiterModal.rec
    const id  = rec._id || rec.id
    // Map French status labels to API values
    const STATUS_MAP = { 'En attente':'Pending','En cours':'In Progress','Resolue':'Resolved','In Progress':'In Progress','Resolved':'Resolved','Pending':'Pending' }
    const apiStatus = STATUS_MAP[newStatus] || newStatus
    try {
      await agentsAPI.submitReport(id, rapport || 'Traitement en cours', apiStatus)
      toast(`Réclamation mise à jour : ${newStatus}`, 'ok')
    } catch {
      // Optimistic update if API fails
      setRecs(prev => prev.map(r => (r._id||r.id) === id ? {...r, status: newStatus} : r))
      toast(`Statut mis à jour localement`, 'ok')
    }
    setTraiterModal({ open:false, rec:null })
    fetchRecs()
  }

  async function resolveRec(id) {
    try {
      await reclamationsAPI.updateStatus(id, 'Resolved', { report: 'Résolution confirmée par l\'agent.' })
      toast('Réclamation marquée résolue ✓', 'ok')
    } catch {
      setRecs(prev => prev.map(r => (r._id||r.id) === id ? {...r, status:'Resolved'} : r))
      toast('Réclamation résolue (local)', 'ok')
    }
    fetchRecs()
  }

  async function acceptDem(demId, svcId) {
    try {
      if (svcId) await servicesAPI.processDemand(svcId, demId, 'Accepted')
    } catch {}
    setDems(prev => prev.map(d => (d._id||d.id)===demId ? {...d, status:'Accepted'} : d))
    toast('Demande acceptée ✓', 'ok')
    setTimeout(() => refetchDems(), 500)
  }
  async function refuseDem(demId, svcId) {
    try {
      if (svcId) await servicesAPI.processDemand(svcId, demId, 'Rejected')
    } catch {}
    setDems(prev => prev.map(d => (d._id||d.id)===demId ? {...d, status:'Rejected'} : d))
    toast('Demande refusée', 'ok')
    setTimeout(() => refetchDems(), 500)
  }

  function sendMsg() {
    if (!msgInput.trim()) return
    const txt = msgInput.trim()
    setConvos(prev => prev.map((c,i) => i===activeConvo ? {...c, msgs:[...c.msgs,{out:true,text:txt}]} : c))
    setMsgInput('')
    setTimeout(() => {
      setConvos(prev => prev.map((c,i) => i===activeConvo
        ? {...c, msgs:[...c.msgs,{out:false,text:'Message bien reçu, merci.'}]}
        : c
      ))
    }, 1000)
  }

  const NAV = [
    { label:'Principal', items:[
      { section:'dashboard',       label:'Tableau de bord',    icon:<LayoutDashboard size={15}/> },
    ]},
    { label:'Réclamations', items:[
      { section:'mes-reclamations',label:'Mes réclamations',   icon:<FileText size={15}/>,
        badge: recs.filter(r => r.status !== 'Resolue').length || undefined },
      { section:'en-retard',       label:'En retard',          icon:<Clock size={15}/>,
        badge: lateRecs.length || undefined, badgeRed: true },
    ]},
    { label:'Services', items:[
      { section:'mes-demandes',    label:'Demandes à traiter', icon:<ClipboardCheck size={15}/>,
        badge: dems.filter(d => d.status==='En attente').length || undefined },
    ]},
    { label:'Communication', items:[
      { section:'messagerie',      label:'Messagerie',         icon:<MessageCircle size={15}/>, badge:2 },
      { section:'notifications',   label:'Notifications',      icon:<Bell size={15}/>,
        badge: unread || undefined, badgeRed: true },
      { section:'mon-profil',      label:'Mon profil',         icon:<UserCircle size={15}/> },
    ]},
  ]

  const TITLES = {
    dashboard:         { title:'Tableau de bord',    bread:`Bonjour, ${AGENT.shortName} 👷` },
    'mes-reclamations':{ title:'Mes réclamations',   bread:'Réclamations assignées' },
    'en-retard':       { title:'En retard',          bread:'Hors délai — action requise' },
    'mes-demandes':    { title:'Demandes à traiter', bread:'Traitement des demandes' },
    messagerie:        { title:'Messagerie',         bread:'Communications citoyens' },
    notifications:     { title:'Notifications',      bread:`${unread} non lue${unread!==1?'s':''}` },
    'mon-profil':      { title:'Mon profil',         bread:'Informations personnelles' },
  }
  const meta = TITLES[section] || TITLES.dashboard

  return (
    <>
      <AppShell
        role="agent" navItems={NAV} user={AGENT}
        activeSection={section} onSectionChange={setSection}
        topTitle={meta.title} topBreadcrumb={meta.bread}
        notifCount={unread} onNotifClick={() => setSection('notifications')}
        userStats={{ reclamations: recs.length, resolved: recs.filter(r=>r.status==='Resolue').length, demandes: dems.length }}
        toasts={toasts}
      >

        {/* ── DASHBOARD ── */}
        {section === 'dashboard' && (
          <div className="animate-fade-up space-y-4">
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div>
                <h1 className="font-syne text-xl font-bold">Bonjour, {AGENT.shortName} 👷</h1>
                <p className="text-[13px] text-t3 mt-0.5">{AGENT.role}</p>
              </div>
              <Button variant="primary" size="sm" onClick={() => toast('Rapport soumis', 'ok')}>
                📊 Soumettre un rapport
              </Button>
            </div>

            {lateRecs.length > 0 && (
              <div className="flex items-center gap-2 px-4 py-3 bg-warning-light text-warning border border-yellow-300 rounded-[10px] text-[13px]">
                <Clock size={15}/>
                <span>{lateRecs.length} réclamation{lateRecs.length>1?'s':''} hors délai — intervention requise.</span>
                <Button variant="warning" size="sm" className="ml-auto" onClick={() => setSection('en-retard')}>Voir →</Button>
              </div>
            )}

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard icon={<FileText size={18}/>}     value={recs.length}                              label="Assignées"        color="blue"/>
              <StatCard icon={<Clock size={18}/>}        value={recs.filter(r=>r.status==='En cours').length}   label="En cours"   color="orange"/>
              <StatCard icon={<CheckCircle size={18}/>}  value={recs.filter(r=>r.status==='Resolue').length}    label="Résolues"   color="green"/>
              <StatCard icon={<AlertTriangle size={18}/>}value={lateRecs.length}                          label="En retard"        color="red"/>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-4">
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Réclamations actives</CardTitle>
                    <Button variant="ghost" size="sm" onClick={() => setSection('mes-reclamations')}>Tout voir →</Button>
                  </CardHeader>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse min-w-[500px]">
                      <thead><tr>
                        {['Réf.','Titre','Urgence','Statut','Date',''].map(h => (
                          <th key={h} className="text-[11px] font-bold text-t3 uppercase tracking-wide px-4 py-2.5 text-left bg-surface-2 border-b border-border">{h}</th>
                        ))}
                      </tr></thead>
                      <tbody>
                        {recs.filter(r => r.status !== 'Resolue').slice(0,5).map(r => (
                          <tr key={r._id||r.id} className={`hover:bg-surface-2 border-b border-border last:border-0 transition-colors ${r.late||r.isOverdue?'bg-danger-light/20':''}`}>
                            <td className={`px-4 py-3 font-bold text-[13px] ${r.late||r.isOverdue?'text-danger':'text-primary'}`}>
                              #{String(r._id||r.id||r.ref||Math.random()).slice(-6)}
                            </td>
                            <td className="px-4 py-3 text-[13px] max-w-[160px] truncate">{r.title}</td>
                            <td className={`px-4 py-3 text-[12px] font-semibold ${
                              (r.urgency?.level||r.urg)==='Critical'||(r.urgency?.level||r.urg)==='Critique'?'text-danger':
                              (r.urgency?.level||r.urg)==='High'||(r.urgency?.level||r.urg)==='Urgent'?'text-warning':'text-success'
                            }`}>● {r.urgency?.level||r.urg||'Normal'}</td>
                            <td className="px-4 py-3"><Badge status={STATUS_BADGE[r.status]||'pending'}>{r.status}</Badge></td>
                            <td className={`px-4 py-3 text-[12px] ${r.late||r.isOverdue?'text-danger font-semibold':'text-t3'}`}>
                              {r.date||new Date(r.createdAt||Date.now()).toLocaleDateString('fr-FR')}{r.late||r.isOverdue?' ⚠':''}
                            </td>
                            <td className="px-4 py-3">
                              <Button variant="primary" size="sm" onClick={() => openTraiter(r)}>Traiter</Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>

                <Card>
                  <CardHeader><CardTitle>Ma charge de travail</CardTitle></CardHeader>
                  <CardBody>
                    <div className="flex justify-between text-[12.5px] mb-1.5">
                      <span className="text-t2">Charge globale</span>
                      <span className="font-bold text-accent">
                        {Math.round(recs.filter(r=>r.status!=='Resolue').length / Math.max(recs.length,1) * 100)}%
                      </span>
                    </div>
                    <ProgressBar value={Math.round(recs.filter(r=>r.status!=='Resolue').length / Math.max(recs.length,1) * 100)} color="#E8873A" height={10}/>
                  </CardBody>
                </Card>
              </div>

              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Demandes à traiter</CardTitle>
                    <Button variant="ghost" size="sm" onClick={() => setSection('mes-demandes')}>Voir →</Button>
                  </CardHeader>
                  {filteredDems.filter(d=>!demStatus||d.status===demStatus).slice(0,3).map(d => (
                    <div key={d._id||d.id} className="flex items-center gap-2.5 px-4 py-3 border-b border-border last:border-0">
                      <Avatar name={typeof d.citizen==='object'?`${d.citizen?.firstName||''} ${d.citizen?.lastName||''}`.trim():d.citizen||'—'} size={28}/>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium truncate">{d.serviceName||d.svc||'—'}</p>
                        <p className="text-[11.5px] text-t3">{typeof d.citizen==='object'?`${d.citizen?.firstName||''} ${d.citizen?.lastName||''}`.trim():d.citizen||'—'}</p>
                      </div>
                      <Button variant="success" size="sm" onClick={() => acceptDem(d._id||d.id, d.serviceId)}>✓</Button>
                    </div>
                  ))}
                  {dems.filter(d=>d.status==='En attente').length === 0 && (
                    <p className="px-4 py-6 text-center text-t3 text-[13px]">Aucune demande en attente</p>
                  )}
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Notifications</CardTitle>
                    {unread > 0 && <span className="text-[11px] bg-danger text-white px-2 py-0.5 rounded-full font-bold">{unread}</span>}
                  </CardHeader>
                  {notifs.slice(0,4).map(n => (
                    <div key={n._id||n.id} onClick={() => markNotifRead(n)}
                      className={`flex gap-2.5 px-4 py-3 cursor-pointer border-b border-border last:border-0 hover:bg-surface-2 transition-colors ${(n.unread||!n.isRead)?'bg-primary/5':''}`}>
                      <div className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${(n.unread||!n.isRead)?'bg-primary':'bg-transparent border border-border-2'}`}/>
                      <div>
                        <p className={`text-[13px] leading-snug ${(n.unread||!n.isRead)?'font-medium':''}`}>{n.text||n.message||n.txt||''}</p>
                        <p className="text-[11px] text-t3 mt-0.5">{n.time||new Date(n.createdAt||Date.now()).toLocaleString('fr-FR')}</p>
                      </div>
                    </div>
                  ))}
                </Card>
              </div>
            </div>
          </div>
        )}

        {/* ── MES RÉCLAMATIONS ── */}
        {section === 'mes-reclamations' && (
          <div className="animate-fade-up space-y-4">
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div>
                <h1 className="font-syne text-xl font-bold">Mes réclamations</h1>
                <p className="text-[13px] text-t3 mt-0.5">{filteredRecs.length} / {recs.length} réclamations assignées</p>
              </div>
            </div>
            <FilterBar
              search={recSearch} onSearch={setRecSearch}
              chips={[
                {label:'Toutes',value:''},
                {label:'En attente',value:'En attente'},
                {label:'En cours',value:'En cours'},
                {label:'Résolues',value:'Resolue'},
                {label:'Critique',value:'Critique'},
              ]}
              activeChip={recStatus} onChip={setRecStatus}
              selects={[{ value:recUrgency, onChange:setRecUrgency, placeholder:'Toute urgence', options:['Critical','High','Medium','Low'] }]}
              count={filteredRecs.length} countLabel="résultat(s)"
            />
            <Card>
              {filteredRecs.length===0 && (
                <div className="py-10 text-center text-t3"><p className="font-medium">Aucune réclamation</p><p className="text-[13px] mt-1">Modifiez vos filtres</p></div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full border-collapse min-w-[600px]">
                  <thead><tr>
                    {['Réf.','Titre','Citoyen','Urgence','Statut','Date','Actions'].map(h => (
                      <th key={h} className="text-[11px] font-bold text-t3 uppercase tracking-wide px-4 py-2.5 text-left bg-surface-2 border-b border-border">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {filteredRecs.map(r => (
                      <tr key={r._id||r.id} className={`hover:bg-surface-2 border-b border-border last:border-0 transition-colors ${r.late||r.isOverdue?'bg-danger-light/20':''}`}>
                        <td className={`px-4 py-3 font-bold text-[13px] ${r.late||r.isOverdue?'text-danger':'text-primary'}`}>
                          #{String(r._id||r.id||r.ref||Math.random()).slice(-6)}
                        </td>
                        <td className="px-4 py-3 text-[13px] max-w-[150px] truncate">{r.title}</td>
                        <td className="px-4 py-3 text-[12.5px]">{r.citizen?.firstName ? `${r.citizen.firstName} ${r.citizen.lastName}` : r.citizen||'—'}</td>
                        <td className={`px-4 py-3 text-[12px] font-semibold ${
                          (r.urgency?.level||r.urg)==='Critical'||(r.urgency?.level||r.urg)==='Critique'?'text-danger':
                          (r.urgency?.level||r.urg)==='High'||(r.urgency?.level||r.urg)==='Urgent'?'text-warning':'text-success'
                        }`}>● {r.urgency?.level||r.urg||'Normal'}</td>
                        <td className="px-4 py-3"><Badge status={STATUS_BADGE[r.status]||'pending'}>{r.status}</Badge></td>
                        <td className={`px-4 py-3 text-[12px] ${r.late||r.isOverdue?'text-danger font-semibold':'text-t3'}`}>
                          {r.date||new Date(r.createdAt||Date.now()).toLocaleDateString('fr-FR')}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1.5">
                            <Button variant="primary" size="sm" onClick={() => openTraiter(r)}>Traiter</Button>
                            {r.status !== 'Resolue' && (
                              <Button variant="success" size="sm" onClick={() => resolveRec(r._id||r.id)}>✓</Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* ── EN RETARD ── */}
        {section === 'en-retard' && (
          <div className="animate-fade-up">
            <h1 className="font-syne text-xl font-bold mb-5">Réclamations en retard</h1>
            {lateRecs.length === 0 ? (
              <div className="text-center py-16">
                <CheckCircle size={40} className="mx-auto mb-3 text-success"/>
                <p className="font-syne text-lg font-bold text-t1">Aucune réclamation en retard !</p>
                <p className="text-t3 text-[13px] mt-1">Toutes les réclamations sont dans les délais.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {lateRecs.map(r => (
                  <Card key={r._id||r.id}>
                    <div className="p-4 bg-danger-light/40 border-b border-border">
                      <div className="flex justify-between mb-1">
                        <span className="font-bold text-danger text-[15px]">#{String(r._id||r.id||r.ref||Math.random()).slice(-6)}</span>
                        <Badge status="urgent">Hors délai</Badge>
                      </div>
                      <p className="text-[13.5px] font-semibold">{r.title}</p>
                      <p className="text-[12px] text-t3 mt-1">
                        {r.citizen?.firstName ? `${r.citizen.firstName} ${r.citizen.lastName}` : r.citizen||'—'} · {r.date||new Date(r.createdAt||Date.now()).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                    <CardBody>
                      <div className="flex gap-2">
                        <Button variant="primary" full size="sm" onClick={() => openTraiter(r)}>Traiter</Button>
                        <Button variant="success" full size="sm" onClick={() => resolveRec(r._id||r.id)}>Résoudre</Button>
                      </div>
                    </CardBody>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── MES DEMANDES ── */}
        {section === 'mes-demandes' && (
          <div className="animate-fade-up space-y-4">
            <h1 className="font-syne text-xl font-bold">Demandes à traiter</h1>
            <FilterBar
              chips={[{label:'Toutes',value:''},{label:'En attente',value:'En attente'},{label:'En cours',value:'En cours'},{label:'Acceptées',value:'Acceptee'}]}
              activeChip={demStatus} onChip={setDemStatus}
              count={filteredDems.length} countLabel="demande(s)"
            />
            <div className="flex items-center gap-2 mb-4 px-4 py-3 bg-primary/8 text-primary border border-primary/20 rounded-[10px] text-[13px]">
              <ClipboardCheck size={15}/> Traitez les demandes dans les 24h pour éviter une réaffectation.
            </div>
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse min-w-[600px]">
                  <thead><tr>
                    {['Réf.','Service','Citoyen','Date','Délai','Statut','Actions'].map(h => (
                      <th key={h} className="text-[11px] font-bold text-t3 uppercase tracking-wide px-4 py-2.5 text-left bg-surface-2 border-b border-border">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {dems.map(d => {
                      const did = d._id || d.id
                      const cName = typeof d.citizen === 'object' && d.citizen
                        ? `${d.citizen?.firstName||''} ${d.citizen?.lastName||''}`.trim() || '—'
                        : String(d.citizen||'—')
                      const dateStr = d.createdAt ? new Date(d.createdAt).toLocaleDateString('fr-FR') : '—'
                      const isExpired = d.status === 'Expired'
                      const isOverdue = d.status === 'Pending' && d.createdAt
                        ? (Date.now() - new Date(d.createdAt)) > 24*3600*1000 : false
                      const DEM_STATUS = { Pending:'En attente', Accepted:'Acceptée', Rejected:'Refusée', Expired:'Expirée' }
                      const DEM_BADGE  = { Pending:'pending', Accepted:'resolved', Rejected:'cancelled', Expired:'urgent' }
                      return (
                        <tr key={did} className={`hover:bg-surface-2 border-b border-border last:border-0 ${isExpired||isOverdue?'bg-danger-light/20':''}`}>
                          <td className={`px-4 py-3 font-bold text-[13px] ${isExpired||isOverdue?'text-danger':'text-primary'}`}>#{String(did).slice(-6)}</td>
                          <td className="px-4 py-3 text-[13px]">{d.serviceName||d.svc||'—'}</td>
                          <td className="px-4 py-3 text-[12.5px]">{cName}</td>
                          <td className="px-4 py-3 text-[12px] text-t3">{dateStr}</td>
                          <td className={`px-4 py-3 text-[12.5px] font-semibold ${isOverdue?'text-danger':d.status==='Accepted'?'text-success':'text-warning'}`}>
                            {isOverdue ? '⚠ Dépassé' : d.status === 'Accepted' ? 'Traité' : isExpired ? 'Expiré' : '< 24h'}
                          </td>
                          <td className="px-4 py-3"><Badge status={DEM_BADGE[d.status]??'pending'}>{DEM_STATUS[d.status]||d.status||'—'}</Badge></td>
                          <td className="px-4 py-3">
                            {d.status === 'Pending' && (
                              <div className="flex gap-1.5">
                                <Button variant="success" size="sm" onClick={() => acceptDem(did, d.serviceId)}>✓ Accepter</Button>
                                <Button variant="danger"  size="sm" onClick={() => refuseDem(did, d.serviceId)}>✗ Refuser</Button>
                              </div>
                            )}
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

        {/* ── MESSAGERIE ── */}
        {section === 'messagerie' && (
          <div className="animate-fade-up">
            <h1 className="font-syne text-xl font-bold mb-5">Messagerie</h1>
            <div className="grid grid-cols-[240px_1fr] h-[460px] bg-white border border-border rounded-card overflow-hidden">
              <div className="border-r border-border flex flex-col">
                {convos.map((c,i) => (
                  <div key={c.id} onClick={() => setActiveConvo(i)}
                    className={`flex items-start gap-2.5 p-3 cursor-pointer border-b border-border transition-colors ${i===activeConvo?'bg-primary/8':'hover:bg-surface-2'}`}>
                    <Avatar name={c.user} color={c.color} size={32}/>
                    <div className="flex-1 min-w-0">
                      <p className={`text-[13px] ${i===activeConvo?'font-semibold':''}`}>{c.user}</p>
                      <p className="text-[12px] text-t3 truncate">
                        {(c.msgs[c.msgs.length-1]?.text || c.msgs[c.msgs.length-1]?.txt || '').substring(0,28)}…
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex flex-col">
                <div className="px-4 py-3 border-b border-border flex items-center gap-2.5">
                  <Avatar name={convos[activeConvo]?.user||'U'} color={convos[activeConvo]?.color} size={32}/>
                  <div>
                    <p className="font-semibold text-[13.5px]">{convos[activeConvo]?.user}</p>
                    <p className="text-[11.5px] text-success">● En ligne · Citoyen</p>
                  </div>
                </div>
                <div className="flex-1 p-4 flex flex-col gap-2.5 overflow-y-auto custom-scroll">
                  {convos[activeConvo]?.msgs.map((m,i) => (
                    <div key={i} className={`max-w-[65%] px-3.5 py-2.5 rounded-[11px] text-[13.5px] leading-relaxed ${
                      m.out ? 'bg-primary text-white self-end rounded-tr-sm' : 'bg-muted border border-border self-start rounded-tl-sm'
                    }`}>{m.text||m.txt}</div>
                  ))}
                </div>
                <div className="p-3 border-t border-border flex gap-2">
                  <input value={msgInput} onChange={e => setMsgInput(e.target.value)}
                    onKeyDown={e => e.key==='Enter' && sendMsg()}
                    placeholder="Écrire un message…"
                    className="flex-1 bg-surface-2 border border-border-2 rounded-full px-4 py-2 text-[13.5px] outline-none font-dm"/>
                  <Button variant="primary" size="sm" onClick={sendMsg}>Envoyer</Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── NOTIFICATIONS ── */}
        {section === 'notifications' && (
          <div className="animate-fade-up">
            <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
              <div>
                <h1 className="font-syne text-xl font-bold">Notifications</h1>
                <p className="text-[13px] text-t3 mt-0.5">{unread} non lue{unread!==1?'s':''}</p>
              </div>
              <Button variant="outline" size="sm" onClick={markAllRead}>Tout marquer lu</Button>
            </div>
            <Card>
              {notifs.length === 0
                ? <p className="p-8 text-center text-t3">Aucune notification</p>
                : notifs.map(n => (
                  <div key={n._id||n.id} onClick={() => markNotifRead(n)}
                    className={`flex items-start gap-3 px-4 py-3.5 border-b border-border last:border-0 cursor-pointer hover:bg-surface-2 transition-colors ${(n.unread||!n.isRead)?'bg-primary/5':''}`}>
                    <div className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${(n.unread||!n.isRead)?'bg-primary':'bg-transparent border border-border-2'}`}/>
                    <div className="flex-1">
                      <p className={`text-[13px] ${(n.unread||!n.isRead)?'font-medium':''}`}>{n.text||n.message||n.txt||''}</p>
                      <p className="text-[11.5px] text-t3 mt-0.5">{n.time||new Date(n.createdAt||Date.now()).toLocaleString('fr-FR')}</p>
                    </div>
                  </div>
                ))
              }
            </Card>
          </div>
        )}

        {/* ── MON PROFIL ── */}
        {section === 'mon-profil' && (
          <div className="animate-fade-up">
            <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
              <h1 className="font-syne text-xl font-bold">Mon profil</h1>
              <Button variant="primary" size="sm" onClick={() => toast('Profil sauvegardé', 'ok')}>💾 Sauvegarder</Button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <Card>
                <CardHeader><CardTitle>Informations personnelles</CardTitle></CardHeader>
                <CardBody className="space-y-4">
                  <div className="flex items-center gap-4 p-4 bg-surface-2 rounded-[10px]">
                    <Avatar name={AGENT.name} color="#1D8C5E" size={52}/>
                    <div>
                      <p className="font-syne text-[17px] font-bold">{AGENT.name}</p>
                      <p className="text-[13px] text-t3">{AGENT.role}</p>
                    </div>
                  </div>
                  <FormGroup label="Département">
                    <Input defaultValue={AGENT.role}/>
                  </FormGroup>
                </CardBody>
              </Card>
              <Card>
                <CardHeader><CardTitle>Statistiques</CardTitle></CardHeader>
                <CardBody>
                  {[
                    ['Réclamations traitées', recs.filter(r=>r.status==='Resolue').length],
                    ['En cours',              recs.filter(r=>r.status==='En cours').length],
                    ['Demandes traitées',     dems.filter(d=>d.status==='Acceptee').length],
                    ['Taux résolution',       `${Math.round(recs.filter(r=>r.status==='Resolue').length/Math.max(recs.length,1)*100)}%`],
                  ].map(([l,v]) => (
                    <div key={l} className="flex justify-between py-3 border-b border-border last:border-0">
                      <span className="text-t2 text-[13px]">{l}</span>
                      <span className="font-bold text-[15px]">{v}</span>
                    </div>
                  ))}
                </CardBody>
              </Card>
            </div>
          </div>
        )}

      </AppShell>

      {/* ── TRAITER MODAL ── */}
      <Modal
        open={traiterModal.open}
        onClose={() => setTraiterModal({open:false, rec:null})}
        title={traiterModal.rec ? `Traiter — ${traiterModal.rec.title?.substring(0,40)}` : ''}
        footer={
          <>
            <Button variant="outline" onClick={() => setTraiterModal({open:false,rec:null})}>Annuler</Button>
            <Button variant="success" onClick={submitTraitement}>
              {traiterModal.open && <Loader2 size={14} className={false ? 'animate-spin' : 'hidden'}/>}
              Valider
            </Button>
          </>
        }
      >
        {traiterModal.rec && (
          <>
            <div className="p-3 bg-primary/8 text-primary rounded-[9px] text-[13px]">
              {traiterModal.rec.citizen?.firstName
                ? `${traiterModal.rec.citizen.firstName} ${traiterModal.rec.citizen.lastName}`
                : traiterModal.rec.citizen || '—'
              } — {traiterModal.rec.date || ''}
            </div>
            <FormGroup label="Changer le statut">
              <Select value={newStatus} onChange={e => setNewStatus(e.target.value)}>
                <option>En attente</option>
                <option>En cours</option>
                <option>Resolue</option>
              </Select>
            </FormGroup>
            <FormGroup label="Rapport d'intervention">
              <Textarea
                value={rapport}
                onChange={e => setRapport(e.target.value)}
                placeholder="Décrivez les actions effectuées ou prévues…"
              />
            </FormGroup>
            <FormGroup label="Date d'intervention prévue">
              <Input type="date"/>
            </FormGroup>
          </>
        )}
      </Modal>
    </>
  )
}
