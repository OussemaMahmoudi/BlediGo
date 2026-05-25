import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, FileText, Settings,
  Bell, CheckCircle, Globe, Plus, ClipboardCheck, MessageCircle,
} from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import AppShell    from '../../components/shared/AppShell'
import { Card, CardHeader, CardTitle, CardBody } from '../../components/ui/Card'
import StatCard    from '../../components/ui/StatCard'
import Badge       from '../../components/ui/Badge'
import Button      from '../../components/ui/Button'
import ProgressBar from '../../components/ui/ProgressBar'
import { PageLoader } from '../../components/ui/Skeleton'
import { useToast }   from '../../hooks/useToast'
import { useMyReclamations, useMyDemands, useNotifications, useServices, useUnreadMessages } from '../../hooks/useData'
import { useAuth }    from '../../context/AuthContext'
import { notificationsAPI } from '../../services/api'
import MessageriePanel    from '../../components/shared/MessageriePanel'
import CitizenServicesPage from '../../components/shared/CitizenServicesPage'
import CitizenDemandsPanel from '../../components/shared/CitizenDemandsPanel'

// ── Helpers ───────────────────────────────────────────────
const safe      = (v, fb = '—') => (v != null && v !== '') ? String(v) : fb
const safeId    = (r) => safe(r?._id || r?.id || r?.ref, String(Math.random()).slice(2,8)).slice(-6)
const safeDate  = (r) => r?.date || (r?.createdAt ? new Date(r.createdAt).toLocaleDateString('fr-FR') : '—')
const safeNDate = (n) => n?.time || (n?.createdAt ? new Date(n.createdAt).toLocaleString('fr-FR') : '')
const safeText  = (n) => safe(n?.text || n?.message || n?.title, 'Notification')

const STATUS_BADGE = {
  'En cours':'progress','En attente':'pending','Resolue':'resolved','Critique':'urgent',
  'Pending':'pending','In Progress':'progress','Resolved':'resolved','Cancelled':'resolved','Rejected':'resolved',
  'Critical':'urgent','High':'progress',
}

export default function UserDashboard() {
  const navigate = useNavigate()
  const { user: authUser } = useAuth()
  const { toasts, toast }  = useToast()
  
  // Read section from URL query param to support cross-page navigation
  const querySection = new URLSearchParams(window.location.search).get('section')
  const [section, setSection] = useState(querySection || 'dashboard')

  const USER = {
    name:      authUser ? `${authUser.firstName||''} ${authUser.lastName||''}`.trim() || 'Citoyen' : 'Citoyen',
    shortName: authUser?.firstName || 'Citoyen',
    color:     '#E8873A',
    role:      'Citoyen',
  }

  const { data: reclamations = [], loading: recLoading } = useMyReclamations()
  const { data: myDemands = [], setData: setMyDemands }  = useMyDemands()  // BF10
  const { data: notifs = [], setData: setNotifs }        = useNotifications()
  const { data: services = [] }                          = useServices()

  const unread       = notifs.filter(n => !n?.isRead || n?.unread).length
  const ACTIVE_STATUSES   = ['Pending','In Progress','En attente','En cours','Critical','Critique']
  const RESOLVED_STATUSES = ['Resolved','Resolue']
  const activeRecs   = reclamations.filter(r => ACTIVE_STATUSES.includes(r?.status))
  const resolvedRecs = reclamations.filter(r => RESOLVED_STATUSES.includes(r?.status))
  const activeDems   = myDemands.filter(d => d?.status === 'Pending')
  const unreadMsg    = useUnreadMessages()

  async function markNotifRead(n) {
    const id = n?._id || n?.id
    if (!id) return
    try { await notificationsAPI.markRead(id) } catch {}
    setNotifs(prev => prev.map(x => (x?._id||x?.id)===id ? {...x,unread:false,isRead:true} : x))
  }

  async function markAllRead() {
    try { await notificationsAPI.markAllRead() } catch {}
    setNotifs(prev => prev.map(n => ({...n,unread:false,isRead:true})))
    toast('Notifications marquées comme lues', 'ok')
  }

  const NAV = [
    { label:'Principal', items:[
      { section:'dashboard',     label:'Tableau de bord',     icon:<LayoutDashboard size={15}/> },
    ]},
    { label:'Réclamations', items:[
      { href:'/user/history',    label:'Historique & PDF',    icon:<FileText size={15}/> },
      { section:'signal',        label:'Nouveau signalement', icon:<Plus size={15}/> },
    ]},
    { label:'Services', items:[
      { section:'services',      label:'Services municipaux', icon:<Settings size={15}/> },
      { section:'demandes',      label:'Mes demandes',        icon:<ClipboardCheck size={15}/>,  badge:activeDems.length||undefined },
    ]},
    { label:'Communauté', items:[
      { href:'/public-feed',     label:'Feed public',         icon:<Globe size={15}/> },
      { section:'messagerie',    label:'Messagerie',          icon:<MessageCircle size={15}/>,   badge:unreadMsg||undefined, badgeRed:true },
      { section:'notifications', label:'Notifications',       icon:<Bell size={15}/>,            badge:unread||undefined, badgeRed:true },
    ]},
  ]

  const TITLES = {
    dashboard:     { title:'Tableau de bord',     bread:`Bonjour, ${USER.shortName} 👋` },
    reclamations:  { title:'Mes réclamations',    bread:'Historique & suivi' },
    signal:        { title:'Signalement',         bread:'Soumettre un problème' },
    services:      { title:'Services municipaux', bread:'Catalogue des services' },
    demandes:      { title:'Mes demandes',        bread:'Historique des demandes' },
    messagerie:    { title:'Messagerie',          bread:'Vos conversations' },
    notifications: { title:'Notifications',       bread:`${unread} non lue${unread!==1?'s':''}` },
  }
  const meta = TITLES[section] || TITLES.dashboard

  return (
    <AppShell
      role="user" navItems={NAV} user={USER}
      activeSection={section}
      onSectionChange={s => {
        if (s === 'signal') navigate('/user/signal')
        else setSection(s)
      }}
      topTitle={meta.title} topBreadcrumb={meta.bread}
      notifCount={unread} onNotifClick={() => setSection('notifications')}
      userStats={{ reclamations: reclamations.length, resolved: resolvedRecs.length, demandes: activeDems.length }}
      toasts={toasts}
    >
      {/* DASHBOARD */}
      {section === 'dashboard' && (
        <div className="animate-fade-up space-y-5">
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <h1 className="font-syne text-xl font-bold text-t1">Bienvenue, {USER.shortName} 👋</h1>
              <p className="text-[13px] text-t3 mt-0.5">
                {new Date().toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}
              </p>
            </div>
            <Button variant="accent" size="sm" onClick={() => navigate('/user/signal')}>
              <Plus size={14}/> Nouvelle réclamation
            </Button>
          </div>

          {recLoading
            ? <div className="h-24 flex items-center justify-center"><PageLoader message="Chargement…"/></div>
            : (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard icon={<FileText size={18}/>}       value={reclamations.length} label="Soumises"         color="blue"/>
                <StatCard icon={<CheckCircle size={18}/>}    value={resolvedRecs.length} label="Résolues"         color="green"/>
                <StatCard icon={<ClipboardCheck size={18}/>} value={activeDems.length}   label="Demandes actives" color="orange"/>
                <StatCard icon={<Bell size={18}/>}           value={unread}              label="Notifications"    color={unread>0?'red':'blue'}/>
              </div>
            )
          }

          <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-4">
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Mes réclamations récentes</CardTitle>
                  <Button variant="ghost" size="sm" onClick={()=>navigate('/user/history')}>Voir tout →</Button>
                </CardHeader>
                {reclamations.length === 0 ? (
                  <div className="p-10 text-center text-t3">
                    <FileText size={36} className="mx-auto mb-3 opacity-25"/>
                    <p className="text-[14px] font-medium mb-1">Aucune réclamation</p>
                    <p className="text-[13px] mb-4">Signalez un problème dans votre quartier</p>
                    <Button variant="accent" size="sm" onClick={()=>navigate('/user/signal')}>
                      <Plus size={13}/> Soumettre une réclamation
                    </Button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse min-w-[480px]">
                      <thead>
                        <tr>
                          {['Réf.','Titre','Catégorie','Statut','Date'].map(h => (
                            <th key={h} className="text-[11px] font-bold text-t3 uppercase tracking-wide px-4 py-2.5 text-left bg-surface-2 border-b border-border">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {reclamations.slice(0,5).map((r,i) => (
                          <tr key={r?._id||r?.id||i} className="hover:bg-surface-2 transition-colors border-b border-border last:border-0">
                            <td className="px-4 py-3 font-bold text-primary text-[13px]">#{safeId(r)}</td>
                            <td className="px-4 py-3 text-[13px] max-w-[160px] truncate">{safe(r?.title)}</td>
                            <td className="px-4 py-3"><span className="text-[11.5px] font-medium px-2 py-0.5 rounded bg-muted text-t2 border border-border">{safe(r?.category||r?.cat)}</span></td>
                            <td className="px-4 py-3"><Badge status={STATUS_BADGE[r?.status]||'pending'}>{safe(r?.status,'En attente')}</Badge></td>
                            <td className="px-4 py-3 text-[12px] text-t3">{safeDate(r)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>

              <Card>
                <CardHeader><CardTitle>Répartition par Statut</CardTitle></CardHeader>
                <CardBody className="flex items-center justify-center p-0 pt-2 pb-4">
                  {reclamations.length === 0 ? (
                    <p className="text-t3 text-[13px] py-10">Aucune donnée</p>
                  ) : (
                    <div className="w-full h-[140px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={[
                              { name: 'En attente', value: reclamations.filter(r=>['Pending','En attente'].includes(r?.status)).length, color: '#FCD34D' },
                              { name: 'En cours', value: activeRecs.length, color: '#3B82F6' },
                              { name: 'Résolues', value: resolvedRecs.length, color: '#10B981' }
                            ].filter(d=>d.value>0)}
                            cx="50%" cy="50%" innerRadius={35} outerRadius={60}
                            paddingAngle={3} dataKey="value" stroke="none"
                          >
                            { [{}].map((_, index) => (
                              // Workaround map for cells, we'll map inside dynamically
                              null
                            )) }
                          </Pie>
                          {/* Proper dynamic cell mapping wrapper: */}
                          <Pie
                            data={[
                              { name: 'En attente', value: reclamations.filter(r=>['Pending','En attente'].includes(r?.status)).length, color: '#E8873A' },
                              { name: 'En cours', value: activeRecs.length, color: '#1A3C6B' },
                              { name: 'Résolues', value: resolvedRecs.length, color: '#1D8C5E' }
                            ].filter(d=>d.value>0)}
                            cx="50%" cy="50%" innerRadius={35} outerRadius={60}
                            paddingAngle={3} dataKey="value" stroke="none"
                          >
                            { [
                              { name: 'En attente', value: reclamations.filter(r=>['Pending','En attente'].includes(r?.status)).length, color: '#E8873A' },
                              { name: 'En cours', value: activeRecs.length, color: '#1A3C6B' },
                              { name: 'Résolues', value: resolvedRecs.length, color: '#1D8C5E' }
                            ].filter(d=>d.value>0).map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardBody>
              </Card>

              {activeRecs.find(r=>r?.status==='En cours') && (()=>{
                const r = activeRecs.find(r=>r?.status==='En cours')
                return (
                  <Card>
                    <CardHeader><CardTitle>Suivi en cours</CardTitle><Badge status="progress">En cours</Badge></CardHeader>
                    <CardBody>
                      <p className="text-[13.5px] font-semibold mb-1">{safe(r?.title)}</p>
                      <p className="text-[12px] text-t3 mb-3">Agent : {safe(r?.assignedAgent?.firstName||r?.agent)}</p>
                      <div className="flex justify-between text-[12.5px] mb-1.5"><span>Progression</span><span className="font-bold text-primary">60%</span></div>
                      <ProgressBar value={60}/>
                    </CardBody>
                  </Card>
                )
              })()}
            </div>

            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Notifications</CardTitle>
                  {unread>0 && <span className="text-[11px] bg-danger text-white px-2 py-0.5 rounded-full font-bold">{unread}</span>}
                </CardHeader>
                {notifs.length===0
                  ? <p className="px-4 py-8 text-center text-t3 text-[13px]">Aucune notification</p>
                  : notifs.slice(0,6).map((n,i) => {
                    const isUnread = !n?.isRead||n?.unread
                    return (
                      <div key={n?._id||n?.id||i} onClick={()=>markNotifRead(n)}
                        className={`flex gap-2.5 px-4 py-3 cursor-pointer border-b border-border last:border-0 transition-colors hover:bg-surface-2 ${isUnread?'bg-primary/[0.04]':''}`}>
                        <div className={`w-2 h-2 rounded-full shrink-0 mt-[5px] ${isUnread?'bg-primary':'bg-transparent border border-border-2'}`}/>
                        <div className="min-w-0">
                          <p className={`text-[13px] leading-snug ${isUnread?'font-medium':''}`}>{safeText(n)}</p>
                          <p className="text-[11px] text-t3 mt-0.5">{safeNDate(n)}</p>
                        </div>
                      </div>
                    )
                  })
                }
                {unread>0 && (
                  <div className="px-4 py-3 border-t border-border">
                    <Button variant="ghost" size="sm" full onClick={markAllRead}>Tout marquer lu</Button>
                  </div>
                )}
              </Card>

              <Card>
                <CardHeader><CardTitle>Actions rapides</CardTitle></CardHeader>
                <CardBody className="space-y-2">
                  {[
                    {label:'Signaler un problème', icon:'🔔', fn:()=>navigate('/user/signal')},
                    {label:'Voir les services',    icon:'🏛️', fn:()=>setSection('services')},
                    {label:'Feed public',          icon:'🌐', fn:()=>navigate('/public-feed')},
                  ].map(a => (
                    <button key={a.label} onClick={a.fn}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[8px] text-[13px] text-t2 hover:bg-muted transition-colors text-left">
                      <span className="text-base">{a.icon}</span>{a.label}
                    </button>
                  ))}
                </CardBody>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* SERVICES — BF7 */}
      {section === 'services' && (
        <CitizenServicesPage services={services} onDemandSubmitted={() => {}} />
      )}

      {/* DEMANDES — BF10 */}
      {section === 'demandes' && (
        <div className="animate-fade-up">
          <div className="flex items-start justify-between mb-5">
            <div>
              <h1 className="font-syne text-xl font-bold">Mes demandes de services</h1>
              <p className="text-[13px] text-t3 mt-0.5">{myDemands.length} demande{myDemands.length !== 1 ? 's' : ''} · {activeDems.length} en attente</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setSection('services')}>
              + Nouvelle demande
            </Button>
          </div>
          <CitizenDemandsPanel demands={myDemands} setDemands={setMyDemands} />
        </div>
      )}

      {/* MESSAGERIE */}
      {section === 'messagerie' && (
        <MessageriePanel role="Citoyen" />
      )}

      {/* NOTIFICATIONS */}
      {section === 'notifications' && (

        <div className="animate-fade-up">
          <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
            <div><h1 className="font-syne text-xl font-bold">Notifications</h1><p className="text-[13px] text-t3 mt-0.5">{unread} non lue{unread!==1?'s':''}</p></div>
            {unread>0 && <Button variant="outline" size="sm" onClick={markAllRead}>Tout marquer lu</Button>}
          </div>
          <Card>
            {notifs.length===0
              ? <div className="p-12 text-center text-t3"><Bell size={36} className="mx-auto mb-3 opacity-25"/><p className="text-[14px] font-medium">Aucune notification</p></div>
              : notifs.map((n,i)=>{
                const isUnread = !n?.isRead||n?.unread
                return (
                  <div key={n?._id||n?.id||i} onClick={()=>markNotifRead(n)}
                    className={`flex items-start gap-3 px-4 py-3.5 border-b border-border last:border-0 cursor-pointer transition-colors hover:bg-surface-2 ${isUnread?'bg-primary/[0.04]':''}`}>
                    <div className={`w-2 h-2 rounded-full shrink-0 mt-[5px] ${isUnread?'bg-primary':'bg-transparent border border-border-2'}`}/>
                    <div className="flex-1 min-w-0">
                      <p className={`text-[13px] leading-snug ${isUnread?'font-medium text-t1':'text-t2'}`}>{safeText(n)}</p>
                      <p className="text-[11px] text-t3 mt-1">{safeNDate(n)}</p>
                    </div>
                  </div>
                )
              })
            }
          </Card>
        </div>
      )}
    </AppShell>
  )
}