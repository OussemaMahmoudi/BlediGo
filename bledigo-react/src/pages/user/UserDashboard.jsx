import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, FileText, Settings,
  Bell, CheckCircle, Globe, Plus, ClipboardCheck,
} from 'lucide-react'
import AppShell    from '../../components/shared/AppShell'
import { Card, CardHeader, CardTitle, CardBody } from '../../components/ui/Card'
import StatCard    from '../../components/ui/StatCard'
import Badge       from '../../components/ui/Badge'
import Button      from '../../components/ui/Button'
import ProgressBar from '../../components/ui/ProgressBar'
import { PageLoader } from '../../components/ui/Skeleton'
import { useToast }   from '../../hooks/useToast'
import { useMyReclamations, useDemandes, useNotifications, useServices } from '../../hooks/useData'
import { useAuth }    from '../../context/AuthContext'
import { notificationsAPI, servicesAPI } from '../../services/api'

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
  const [section, setSection] = useState('dashboard')

  const USER = {
    name:      authUser ? `${authUser.firstName||''} ${authUser.lastName||''}`.trim() || 'Citoyen' : 'Citoyen',
    shortName: authUser?.firstName || 'Citoyen',
    color:     '#E8873A',
    role:      'Citoyen',
  }

  const { data: reclamations = [], loading: recLoading } = useMyReclamations()
  const { data: demandes = [] }                           = useDemandes()
  const { data: notifs = [], setData: setNotifs }         = useNotifications()
  const { data: services = [] }                             = useServices()

  const unread       = notifs.filter(n => !n?.isRead || n?.unread).length
  const ACTIVE_STATUSES   = ['Pending','In Progress','En attente','En cours','Critical','Critique']
  const RESOLVED_STATUSES = ['Resolved','Resolue']
  const activeRecs   = reclamations.filter(r => ACTIVE_STATUSES.includes(r?.status))
  const resolvedRecs = reclamations.filter(r => RESOLVED_STATUSES.includes(r?.status))
  const activeDems   = demandes.filter(d => d?.status === 'En attente' || d?.status === 'En cours')

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
      { section:'reclamations',  label:'Mes réclamations',    icon:<FileText size={15}/>,        badge:activeRecs.length||undefined },
      { section:'signal',        label:'Nouveau signalement', icon:<Plus size={15}/> },
      { href:'/user/history',    label:'Historique & PDF',    icon:<FileText size={15}/> },
    ]},
    { label:'Services', items:[
      { section:'services',      label:'Services municipaux', icon:<Settings size={15}/> },
      { section:'demandes',      label:'Mes demandes',        icon:<ClipboardCheck size={15}/>,  badge:activeDems.length||undefined },
    ]},
    { label:'Communauté', items:[
      { section:'notifications', label:'Notifications',       icon:<Bell size={15}/>,            badge:unread||undefined, badgeRed:true },
      { href:'/public-feed',     label:'Feed public',         icon:<Globe size={15}/> },
    ]},
  ]

  const TITLES = {
    dashboard:     { title:'Tableau de bord',     bread:`Bonjour, ${USER.shortName} 👋` },
    reclamations:  { title:'Mes réclamations',    bread:'Historique & suivi' },
    signal:        { title:'Signalement',         bread:'Soumettre un problème' },
    services:      { title:'Services municipaux', bread:'Catalogue des services' },
    demandes:      { title:'Mes demandes',        bread:'Historique des demandes' },
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

      {/* ── DASHBOARD ── */}
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
                  <Button variant="ghost" size="sm" onClick={()=>setSection('reclamations')}>Voir tout →</Button>
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
                      <thead><tr>
                        {['Réf.','Titre','Catégorie','Statut','Date'].map(h => (
                          <th key={h} className="text-[11px] font-bold text-t3 uppercase tracking-wide px-4 py-2.5 text-left bg-surface-2 border-b border-border">{h}</th>
                        ))}
                      </tr></thead>
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

      {/* ── RECLAMATIONS ── */}
      {section==='reclamations' && (
        <div className="animate-fade-up">
          <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
            <div>
              <h1 className="font-syne text-xl font-bold">Mes réclamations</h1>
              <p className="text-[13px] text-t3 mt-0.5">{reclamations.length} réclamation{reclamations.length!==1?'s':''}</p>
            </div>
            <Button variant="accent" size="sm" onClick={()=>navigate('/user/signal')}><Plus size={14}/> Nouvelle réclamation</Button>
          </div>
          {recLoading ? <PageLoader/> : (
            <Card>
              {reclamations.length===0
                ? <div className="p-12 text-center text-t3"><FileText size={40} className="mx-auto mb-3 opacity-25"/><p className="text-[15px] font-medium mb-4">Aucune réclamation</p><Button variant="accent" size="sm" onClick={()=>navigate('/user/signal')}><Plus size={13}/> Soumettre</Button></div>
                : <div className="overflow-x-auto"><table className="w-full border-collapse min-w-[580px]">
                    <thead><tr>{['Réf.','Titre','Catégorie','Agent','Statut','Date'].map(h=><th key={h} className="text-[11px] font-bold text-t3 uppercase tracking-wide px-4 py-2.5 text-left bg-surface-2 border-b border-border">{h}</th>)}</tr></thead>
                    <tbody>
                      {reclamations.map((r,i)=>(
                        <tr key={r?._id||r?.id||i} className="hover:bg-surface-2 border-b border-border last:border-0">
                          <td className="px-4 py-3 font-bold text-primary text-[13px]">#{safeId(r)}</td>
                          <td className="px-4 py-3 text-[13px] max-w-[140px] truncate">{safe(r?.title)}</td>
                          <td className="px-4 py-3"><span className="text-[11.5px] font-medium px-2 py-0.5 rounded bg-muted text-t2 border border-border">{safe(r?.category||r?.cat)}</span></td>
                          <td className="px-4 py-3 text-[12.5px] text-t2">{safe(r?.assignedAgent?.firstName||r?.agent)}</td>
                          <td className="px-4 py-3"><Badge status={STATUS_BADGE[r?.status]||'pending'}>{safe(r?.status,'En attente')}</Badge></td>
                          <td className="px-4 py-3 text-[12px] text-t3">{safeDate(r)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table></div>
              }
            </Card>
          )}
        </div>
      )}

      {/* ── SERVICES ── */}
      {section==='services' && (
        <div className="animate-fade-up">
          <h1 className="font-syne text-xl font-bold mb-5">Services municipaux</h1>
          {services.length === 0 ? (
            <div className="text-center py-16 text-t3"><Settings size={36} className="mx-auto mb-3 opacity-25"/><p>Aucun service disponible</p></div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {services.map(s => {
                const sid    = s._id || s.id
                const avail  = s.isActive !== false && s.active !== false
                const hours  = s.schedule ? `${s.schedule.days||''} ${s.schedule.openTime||''}–${s.schedule.closeTime||''}`.trim() : '—'
                const catEmojis = {'Etat civil':'🪪','Urbanisme':'🏗️','Proprete':'♻️','Transport':'🚌','Culture':'🎭','Education':'📚','Sante':'🏥','Autre':'🏛️'}
                const emoji = catEmojis[s.category] || '🏛️'
                return (
                  <div key={sid} className="bg-white border border-border rounded-card p-5 hover:shadow-card hover:-translate-y-0.5 transition-all">
                    <div className="w-11 h-11 rounded-[10px] bg-muted flex items-center justify-center text-xl mb-3">{emoji}</div>
                    <h3 className="font-syne text-[14px] font-bold mb-1">{s.name}</h3>
                    <p className="text-[12px] text-t3 mb-1">{s.category}</p>
                    {s.description && <p className="text-[12px] text-t2 mb-3 line-clamp-2">{s.description}</p>}
                    <div className="flex items-center justify-between mb-3">
                      <span className={`text-[11.5px] font-semibold px-2 py-1 rounded-[6px] ${avail?'bg-success-light text-success':'bg-danger-light text-danger'}`}>
                        {avail ? 'Disponible' : 'Indisponible'}
                      </span>
                      <span className="text-[11px] text-t3">{hours}</span>
                    </div>
                    {avail && (
                      <Button variant="primary" full size="sm" onClick={async () => {
                        try {
                          await servicesAPI.submitDemand(sid, {})
                          toast(`Demande envoyée pour "${s.name}" ✓`, 'ok')
                        } catch(e) {
                          toast(e?.response?.data?.message || 'Erreur lors de la demande', 'err')
                        }
                      }}>
                        Faire une demande
                      </Button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── NOTIFICATIONS ── */}
      {section==='notifications' && (
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

      {/* ── DEMANDES ── */}
      {section==='demandes' && (
        <div className="animate-fade-up">
          <h1 className="font-syne text-xl font-bold mb-5">Mes demandes de services</h1>
          <Card>
            {demandes.length===0
              ? <div className="p-12 text-center text-t3"><ClipboardCheck size={36} className="mx-auto mb-3 opacity-25"/><p className="text-[14px] font-medium">Aucune demande</p></div>
              : <div className="overflow-x-auto"><table className="w-full border-collapse min-w-[480px]">
                  <thead><tr>{['Réf.','Service','Date','Statut'].map(h=><th key={h} className="text-[11px] font-bold text-t3 uppercase tracking-wide px-4 py-2.5 text-left bg-surface-2 border-b border-border">{h}</th>)}</tr></thead>
                  <tbody>
                    {demandes.map((d,i)=>(
                      <tr key={d?._id||d?.id||i} className="hover:bg-surface-2 border-b border-border last:border-0">
                        <td className="px-4 py-3 font-bold text-primary text-[13px]">#{safeId(d)}</td>
                        <td className="px-4 py-3 text-[13px]">{safe(d?.svc||d?.service)}</td>
                        <td className="px-4 py-3 text-[12.5px] text-t3">{safe(d?.date||(d?.createdAt?new Date(d.createdAt).toLocaleDateString('fr-FR'):null))}</td>
                        <td className="px-4 py-3"><Badge status={STATUS_BADGE[d?.status==='Expire'?'Critique':d?.status]||'pending'}>{safe(d?.status,'En attente')}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
            }
          </Card>
        </div>
      )}

    </AppShell>
  )
}
