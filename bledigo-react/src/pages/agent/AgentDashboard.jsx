import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  LayoutDashboard, FileText, Clock, ClipboardCheck,
  MessageCircle, Bell, UserCircle, CheckCircle, Loader2,
  AlertTriangle, Plus, Globe, Eye, X, Check, AlertCircle, Star
} from 'lucide-react'
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, RadialBarChart, RadialBar, Cell } from 'recharts'
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
import { useNotifications, useDemandes, useUnreadMessages } from '../../hooks/useData'
import MessageriePanel from '../../components/shared/MessageriePanel'

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
  const unreadMsg = useUnreadMessages()
  
  const querySection = new URLSearchParams(window.location.search).get('section')
  const [section,  setSection]  = useState(querySection || 'dashboard')
  
  const [traiterModal, setTraiterModal] = useState({ open:false, rec:null })
  const [newStatus,    setNewStatus]    = useState('In Progress')
  const [rapport,      setRapport]      = useState('')
  const [detailDemandeModal, setDetailDemandeModal] = useState({ open: false, demand: null })

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
    
    let matchS = true
    if (recStatus === 'Critique') {
      matchS = (r.urgency?.level || r.urg) === 'Critical'
    } else if (recStatus) {
      const STATUS_MAP = { 'En attente':'Pending', 'En cours':'In Progress', 'Resolue':'Resolved' }
      const apiStat = STATUS_MAP[recStatus] || recStatus
      matchS = r.status === apiStat
    }

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

  const [confirmModal, setConfirmModal] = useState({ open: false })

  function submitTraitement() {
    const STATUS_MAP = { 'En attente':'Pending','En cours':'In Progress','Resolue':'Resolved' }
    const apiStatus = STATUS_MAP[newStatus] || newStatus

    if (apiStatus === 'Resolved') {
      setConfirmModal({ open: true })
      return
    }
    executeTraitement()
  }

  async function executeTraitement() {
    const rec = traiterModal.rec
    const id  = rec._id || rec.id
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
    if (!svcId) { toast('Service introuvable', 'err'); return }
    try {
      await servicesAPI.processDemand(svcId, demId, 'Accepted')
      setDems(prev => prev.map(d => (d._id||d.id)===demId ? {...d, status:'Accepted'} : d))
      toast('Demande acceptée ✓', 'ok')
    } catch(e) {
      toast(e?.response?.data?.message || 'Erreur lors de l\'acceptation', 'err')
    }
  }

  async function refuseDem(demId, svcId) {
    if (!svcId) { toast('Service introuvable', 'err'); return }
    const motif = window.prompt('Motif du refus (optionnel) :') ?? ''
    try {
      await servicesAPI.processDemand(svcId, demId, 'Rejected', motif)
      setDems(prev => prev.map(d => (d._id||d.id)===demId ? {...d, status:'Rejected'} : d))
      toast('Demande refusée', 'ok')
    } catch(e) {
      toast(e?.response?.data?.message || 'Erreur lors du refus', 'err')
    }
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
      badge: dems.filter(d => d.status==='Pending').length || undefined },
  ]},
  { label:'Communication', items:[
    { href:'/public-feed',       label:'Feed public',         icon:<Globe size={15}/> },
    { section:'messagerie',      label:'Messagerie',         icon:<MessageCircle size={15}/>, badge: unreadMsg || undefined, badgeRed: true },
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
                        {['Réf.','Titre','Citoyen','Urgence','Statut','Date',''].map(h => (
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
                            <td className="px-4 py-3 text-[12.5px] text-t2 truncate max-w-[120px]">
                              {r.citizen?.firstName ? `${r.citizen.firstName} ${r.citizen.lastName}`.trim() : r.citizen || '—'}
                            </td>
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
                    <div className="w-full h-[180px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadialBarChart cx="50%" cy="50%" innerRadius="70%" outerRadius="100%" data={[
                          { name: 'Charge', value: Math.round(recs.filter(r=>r.status!=='Resolue').length / Math.max(recs.length,1) * 100), fill: '#E8873A' }
                        ]} startAngle={90} endAngle={-270}>
                          <RadialBar minAngle={15} background dataKey="value" cornerRadius={10} />
                          <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}/>
                          <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="font-syne font-bold text-xl" fill="#111827">
                            {Math.round(recs.filter(r=>r.status!=='Resolue').length / Math.max(recs.length,1) * 100)}%
                          </text>
                        </RadialBarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardBody>
                </Card>
              </div>

              <div className="space-y-4">
                <Card>
                  <CardHeader><CardTitle>Activité Hebdomadaire</CardTitle></CardHeader>
                  <CardBody>
                    <div className="w-full h-[180px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={[
                          { day: 'Lun', assignées: 4, résolues: 3 },
                          { day: 'Mar', assignées: 3, résolues: 4 },
                          { day: 'Mer', assignées: 6, résolues: 2 },
                          { day: 'Jeu', assignées: 2, résolues: 5 },
                          { day: 'Ven', assignées: 5, résolues: 3 }
                        ]} margin={{ top: 10, right: 0, bottom: 0, left: 0 }} barSize={12}>
                          <XAxis dataKey="day" axisLine={false} tickLine={false} dy={10} fontSize={11} stroke="#9CA3AF" />
                          <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} cursor={{fill: '#F3F4F6'}}/>
                          <Bar dataKey="assignées" fill="#1D8C5E" radius={[4,4,0,0]} />
                          <Bar dataKey="résolues" fill="#E8873A" radius={[4,4,0,0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardBody>
                </Card>
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
                          <Button variant="primary" size="sm" onClick={() => openTraiter(r)}>Traiter</Button>
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
                      <Button variant="primary" full size="sm" onClick={() => openTraiter(r)}>Traiter</Button>
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
                            <Button variant="outline" size="sm" onClick={() => setDetailDemandeModal({ open: true, demand: d })}>
                              <Eye size={12} /> Consulter
                            </Button>
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
          <MessageriePanel role="Agent" />
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
            <Button variant="outline" onClick={() => setTraiterModal({open:false,rec:null})}>
              {(traiterModal.rec?.status === 'Resolved' || traiterModal.rec?.status === 'Resolue') ? 'Fermer' : 'Annuler'}
            </Button>
            {traiterModal.rec?.status !== 'Resolved' && traiterModal.rec?.status !== 'Resolue' && (
              <Button variant="success" onClick={submitTraitement}>
                {traiterModal.open && <Loader2 size={14} className={false ? 'animate-spin' : 'hidden'}/>}
                Valider
              </Button>
            )}
          </>
        }
      >
        {traiterModal.rec && (
          <>
            {/* Header d'informations complètes */}
            <div className="bg-surface-2 rounded-[12px] p-4 mb-4 border border-border">
              <div className="flex justify-between items-start mb-3">
                <div className="pr-3">
                  <h3 className="font-syne text-[15.5px] font-bold text-t1 leading-snug">
                    {traiterModal.rec.title || 'Réclamation'}
                  </h3>
                  <p className="text-[12px] text-t3 font-medium mt-1">
                    #{String(traiterModal.rec._id || traiterModal.rec.id || '').slice(-6).toUpperCase()} · {traiterModal.rec.category || traiterModal.rec.cat || 'Autre'}
                  </p>
                </div>
                {traiterModal.rec.urgency?.level && (
                  <span className={`px-2.5 py-1 rounded-full text-[10.5px] font-bold text-white shrink-0 ${
                    traiterModal.rec.urgency.level === 'Critical' || traiterModal.rec.urgency.level === 'Critique' ? 'bg-danger' :
                    traiterModal.rec.urgency.level === 'High' || traiterModal.rec.urgency.level === 'Urgent' ? 'bg-warning' : 'bg-primary'
                  }`}>
                    {traiterModal.rec.urgency.level}
                  </span>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="bg-white rounded-[8px] p-2.5 shadow-sm border border-border-2">
                  <p className="text-[10px] font-bold text-t3 uppercase tracking-wide mb-0.5">Citoyen</p>
                  <p className="text-[13px] font-bold text-t1 truncate">
                    {traiterModal.rec.citizen?.firstName
                      ? `${traiterModal.rec.citizen.firstName} ${traiterModal.rec.citizen.lastName}`
                      : traiterModal.rec.citizen || '—'}
                  </p>
                </div>
                <div className="bg-white rounded-[8px] p-2.5 shadow-sm border border-border-2">
                  <p className="text-[10px] font-bold text-t3 uppercase tracking-wide mb-0.5">Date & Lieu</p>
                  <p className="text-[12px] font-medium text-t2 truncate">
                    {traiterModal.rec.date || (traiterModal.rec.createdAt ? new Date(traiterModal.rec.createdAt).toLocaleDateString('fr-FR') : '—')}
                    {traiterModal.rec.location?.address ? ` · ${traiterModal.rec.location.address}` : ''}
                  </p>
                </div>
              </div>
              
              <div className="bg-white text-[12.5px] text-t2 border border-border-2 rounded-[8px] p-3 max-h-[80px] overflow-y-auto custom-scroll shadow-sm">
                <span className="font-bold text-t1">Description :</span> {traiterModal.rec.description || 'Aucune description fournie.'}
              </div>
            </div>

            {traiterModal.rec.status === 'Resolved' || traiterModal.rec.status === 'Resolue' ? (
              <div className="bg-success-light/30 border border-success/30 rounded-[10px] p-4 text-center mt-2">
                <CheckCircle className="mx-auto text-success mb-2" size={26} />
                <p className="text-[14px] text-success font-bold mb-1">Réclamation clôturée</p>
                <p className="text-[12.5px] text-success/80">
                  Le statut de cette réclamation est définitif. Vous ne pouvez plus le modifier.
                </p>
                {traiterModal.rec.resolutionReport?.text && (
                  <div className="mt-4 text-left bg-white rounded-[8px] p-3 border border-success/20 text-[12.5px] text-t1 shadow-sm font-medium">
                    {traiterModal.rec.resolutionReport.text}
                  </div>
                )}
              </div>
            ) : (
              <>
                <FormGroup label="Changer le statut">
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: 'En attente', label: 'En attente',  activeCls: 'bg-warning text-white border-transparent shadow-sm' },
                      { value: 'En cours',   label: 'En cours',    activeCls: 'bg-primary text-white border-transparent shadow-sm' },
                      { value: 'Resolue',    label: 'Résolue',     activeCls: 'bg-success text-white border-transparent shadow-sm' }
                    ].map(s => (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => setNewStatus(s.value)}
                        className={`flex items-center justify-center py-2.5 rounded-btn border text-[13px] font-semibold transition-all ${
                          newStatus === s.value ? s.activeCls : 'border-border bg-surface-2 text-t2 hover:bg-muted'
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </FormGroup>
                <FormGroup label="Rapport d'intervention">
                  <Textarea
                    value={rapport}
                    onChange={e => setRapport(e.target.value)}
                    placeholder="Décrivez les actions effectuées ou prévues…"
                  />
                </FormGroup>
                <FormGroup label="Date d'intervention prévue">
                  <Input type="date" value={new Date().toISOString().split('T')[0]} readOnly className="opacity-70 bg-surface-2 cursor-not-allowed" title="Date remplie automatiquement avec la date du jour"/>
                </FormGroup>
              </>
            )}
          </>
        )}
      </Modal>

      {/* ── CONFIRMATION MODAL ── */}
      <Modal
        open={confirmModal.open}
        onClose={() => setConfirmModal({ open: false })}
        title="Confirmation requise"
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmModal({ open: false })}>Annuler</Button>
            <Button variant="success" onClick={() => { setConfirmModal({ open: false }); executeTraitement(); }}>
              Confirmer la résolution
            </Button>
          </>
        }
      >
        <div className="p-4 text-center">
          <AlertTriangle className="mx-auto text-warning mb-3" size={36}/>
          <p className="text-[14px] font-bold text-t1 mb-2">Marquer comme résolue ?</p>
          <p className="text-[12.5px] text-t2 leading-relaxed">
            ⚠ Cette action est <b>IRRÉVERSIBLE</b>. Vous ne pourrez plus modifier le statut ou le rapport de cette réclamation une fois confirmée.
          </p>
        </div>
      </Modal>
      {/* ── DEMANDE SIDE PANEL ── */}
      {createPortal(
        <>
          {detailDemandeModal.open && (
            <div className="fixed inset-0 z-40 bg-gray-900/10 backdrop-blur-sm transition-all duration-300" onClick={() => setDetailDemandeModal({ ...detailDemandeModal, open: false })} />
          )}
          
          <div className={`fixed top-0 right-0 w-[440px] max-w-full h-full bg-white shadow-2xl z-50 flex flex-col transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] font-dm ${
              detailDemandeModal.open ? 'translate-x-0' : 'translate-x-[100%]'
          }`}>
            {detailDemandeModal.demand && (() => {
              const d = detailDemandeModal.demand
              const did = d._id || d.id
              const isPending = d.status === 'Pending'
              const cName = typeof d.citizen === 'object' && d.citizen ? `${d.citizen?.firstName || ''} ${d.citizen?.lastName || ''}`.trim() : d.citizen || '—'
              const cEmail = typeof d.citizen === 'object' && d.citizen ? d.citizen.email : '—'
              const DEM_LABEL = { Pending: 'En attente', Accepted: 'Acceptée', Rejected: 'Refusée', Cancelled: 'Annulée', Expired: 'Expirée' }

              return (
                <>
                  {/* Minimalist Header */}
                  <div className="p-6 flex items-start justify-between border-b border-gray-100 bg-white/95 backdrop-blur-md shrink-0">
                    <div className="flex gap-4">
                      <div className="w-12 h-12 rounded-[14px] bg-slate-50 flex items-center justify-center text-[22px] border border-gray-200 shadow-sm flex-none">
                        📄
                      </div>
                      <div className="min-w-0">
                        <h2 className="font-syne text-[18px] font-bold text-gray-900 mb-1 truncate leading-tight">{d.serviceName || 'Demande de service'}</h2>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md ${
                            d.status === 'Accepted' ? 'bg-emerald-50 text-emerald-600' :
                            d.status === 'Rejected' || d.status === 'Cancelled' ? 'bg-rose-50 text-rose-600' :
                            'bg-yellow-50 text-yellow-600'
                          }`}>
                            {DEM_LABEL[d.status] || d.status}
                          </span>
                          <span className="text-[11px] text-gray-400 font-medium">/ Réf. #{String(did).slice(-6)}</span>
                        </div>
                      </div>
                    </div>
                    <button onClick={() => setDetailDemandeModal({ ...detailDemandeModal, open: false })} className="text-gray-400 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 transition-colors p-1.5 rounded-full">
                      <X size={20} strokeWidth={2} />
                    </button>
                  </div>

                  {/* Minimalist Body */}
                  <div className="flex-1 overflow-y-auto custom-scroll p-6 space-y-10 bg-white">
                    
                    {isPending && (
                      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex gap-3.5 items-center shadow-sm">
                        <ClipboardCheck size={20} className="text-blue-500 shrink-0" strokeWidth={2.5} />
                        <span className="text-[12.5px] text-blue-900 font-medium tracking-wide">
                          Nécessite votre validation ou refus.
                        </span>
                      </div>
                    )}

                    {/* Key Metrics row */}
                    <div className="grid grid-cols-2 gap-y-7 gap-x-5">
                      {[
                        { label: 'Citoyen demandeur', value: cName },
                        { label: 'Email', value: cEmail },
                        { label: 'Catégorie de service', value: d.serviceCategory || 'Autre' },
                        { label: 'Date de soumission', value: d.createdAt ? new Date(d.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—' },
                        { label: 'Moyenne Globale Service', value: d.avgRating ? `${d.avgRating} / 5 ⭐` : 'Aucune note globale' },
                        { label: 'Évaluation Citoyen', value: d.userRating ? `${d.userRating} / 5 ⭐` : 'Aucune évaluation' },
                      ].map((item, i) => (
                        <div key={i} className="min-w-0">
                          <div className="text-[10px] text-gray-400 uppercase font-bold tracking-[0.1em] mb-1.5">{item.label}</div>
                          <div className="text-[13.5px] font-semibold text-gray-800 truncate" title={item.value}>{item.value}</div>
                        </div>
                      ))}
                    </div>

                    {/* Notes citoyen */}
                    {d.notes && (
                      <div className="space-y-3.5">
                        <h3 className="text-[11px] text-gray-500 uppercase font-extrabold tracking-[0.12em] flex items-center gap-2">
                          <FileText size={15} strokeWidth={2.5}/> Notes du citoyen
                        </h3>
                        <div className="text-[14px] text-gray-700 leading-relaxed font-normal bg-gray-50 p-5 rounded-[16px] border border-gray-200/60 shadow-sm">
                          {d.notes}
                        </div>
                      </div>
                    )}

                  </div>

                  {/* Minimalist Action Footer */}
                  <div className="p-4 border-t border-gray-100 bg-white shadow-[0_-4px_20px_rgba(0,0,0,0.02)]">
                    <div className="flex flex-col gap-3">
                      {isPending ? (
                        <div className="flex gap-3">
                          <button 
                            className="flex-1 h-[48px] bg-rose-50 text-rose-600 font-bold text-[14px] rounded-xl hover:bg-rose-100 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                            onClick={async () => { await refuseDem(did, d.serviceId); setDetailDemandeModal({ ...detailDemandeModal, open: false }) }}
                          >
                            <X size={18} strokeWidth={2.5} /> Refuser
                          </button>
                          <button 
                            className="flex-1 h-[48px] bg-emerald-500 text-white font-bold text-[14px] rounded-xl hover:bg-emerald-600 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-sm"
                            onClick={async () => { await acceptDem(did, d.serviceId); setDetailDemandeModal({ ...detailDemandeModal, open: false }) }}
                          >
                            <Check size={18} strokeWidth={2.5} /> Accepter
                          </button>
                        </div>
                      ) : (
                        <button 
                          className="w-full h-[48px] bg-gray-100 text-gray-700 font-bold text-[14px] rounded-xl hover:bg-gray-200 active:scale-[0.98] transition-all flex items-center justify-center"
                          onClick={() => setDetailDemandeModal({ ...detailDemandeModal, open: false })}
                        >
                          Fermer
                        </button>
                      )}
                    </div>
                  </div>
                </>
              )
            })()}
          </div>
        </>,
        document.body
      )}

    </>
  )
}
