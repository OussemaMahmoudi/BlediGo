import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, ThumbsUp, MessageSquare, MapPin, Calendar } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import ProgressBar from '../../components/ui/ProgressBar'
import Avatar from '../../components/ui/Avatar'
import { usePublicFeed } from '../../hooks/useData'
import { reclamationsAPI } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../hooks/useToast'
import logoImg from '../../assets/BlediGo Logo.png'

const STATUS_BADGE = {
  'En cours':'progress',
  'En attente':'pending',
  'Resolue':'resolved',
  'Critique':'urgent',
  'Pending':'pending',
  'In Progress':'progress',
  'Resolved':'resolved',
  'Cancelled':'resolved'
}

const PROGRESS = {
  'En attente':25,
  'En cours':60,
  'Critique':15,
  'Resolue':100,
  'Pending':25,
  'In Progress':60,
  'Resolved':100
}

// Statuts français → anglais pour le filtrage
const STATUS_MAP = {
  'Tous': '',
  'En attente': 'Pending',
  'En cours': 'In Progress',
  'Resolue': 'Resolved',
  'Critique': 'Critical'
}

// Catégories complètes
const CATS = [
  'Toutes',
  'Eclairage public',
  'Voirie & Routes',
  'Propreté & Déchets',
  'Espaces verts',
  'Eau & Assainissement',
  'Signalisation',
  'Bâtiments publics',
  'Transports',
  'Autre'
]

// Fonction pour formater une date
const formatDate = (date) => {
  if (!date) return null
  const d = new Date(date)
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// Extrait les 4 étapes du timeline à partir des événements
const extractTimelineSteps = (rec) => {
  const steps = [
    { label: 'Réclamation soumise', key: 'submitted', date: null },
    { label: 'Affectée à un agent', key: 'assigned', date: null },
    { label: 'En cours de traitement', key: 'inprogress', date: null },
    { label: 'Résolution confirmée', key: 'resolved', date: null }
  ]

  // 1. Soumission
  if (rec.createdAt) steps[0].date = formatDate(rec.createdAt)

  // 2. Affectation
  if (rec.timeline?.length) {
    const assignEvent = rec.timeline.find(e =>
      (e.event && (e.event.toLowerCase().includes('affect') || e.event.toLowerCase().includes('assign'))) ||
      (e.description && (e.description.toLowerCase().includes('affect') || e.description.toLowerCase().includes('assign')))
    )
    if (assignEvent?.createdAt) steps[1].date = formatDate(assignEvent.createdAt)
  }
  if (!steps[1].date && rec.assignedAt) steps[1].date = formatDate(rec.assignedAt)
  if (!steps[1].date && rec.assignedAgent) steps[1].date = steps[0].date // fallback

  // 3. En cours
  if (rec.timeline?.length) {
    const progressEvent = rec.timeline.find(e =>
      (e.event && (e.event.toLowerCase().includes('en cours') || e.event.toLowerCase().includes('progress'))) ||
      e.toStatus === 'In Progress'
    )
    if (progressEvent?.createdAt) steps[2].date = formatDate(progressEvent.createdAt)
  }
  if (!steps[2].date && (rec.status === 'In Progress' || rec.status === 'Resolved')) {
    steps[2].date = steps[1].date || steps[0].date
  }

  // 4. Résolution
  if (rec.resolvedAt) {
    steps[3].date = formatDate(rec.resolvedAt)
  } else if (rec.timeline?.length) {
    const resolveEvent = rec.timeline.find(e => e.toStatus === 'Resolved')
    if (resolveEvent?.createdAt) steps[3].date = formatDate(resolveEvent.createdAt)
  }
  if (!steps[3].date && rec.status === 'Resolved') steps[3].date = steps[2].date || steps[1].date || steps[0].date

  return steps
}

export default function PublicFeed() {
  const navigate = useNavigate()
  const { user: authUser, isAuthenticated } = useAuth()
  const { toast } = useToast()
  const { data: apiRecs } = usePublicFeed()

  const [recs, setRecs] = useState([])
  useEffect(() => {
    if (apiRecs.length > 0)
      setRecs(apiRecs.map(r => ({ ...r, votes: r.votes?.count ?? (typeof r.votes === 'number' ? r.votes : 0), voted: false, comments: r.comments ?? [] })))
  }, [apiRecs.length])

  const [filter,    setFilter]    = useState('Tous')
  const [catFilter, setCatFilter] = useState('Toutes')
  const [sort,      setSort]      = useState('recent')
  const [search,    setSearch]    = useState('')
  const [detailId,  setDetailId]  = useState(null)
  const [newComment, setNewComment]   = useState('')
  const [commentLoading, setCommentLoading] = useState(false)
  const [commentErr, setCommentErr] = useState('')

  const filtered = useMemo(() => {
    let data = recs

    // Filtre par statut
    if (filter !== 'Tous') {
      const apiStatus = STATUS_MAP[filter]
      data = data.filter(r => r.status === apiStatus)
    }

    // Filtre par catégorie
    if (catFilter !== 'Toutes') {
      data = data.filter(r => (r.category || r.cat) === catFilter)
    }

    // Recherche texte
    if (search) {
      const q = search.toLowerCase()
      data = data.filter(r =>
        (r.title||'').toLowerCase().includes(q) ||
        (r.loc||r.location?.address||'').toLowerCase().includes(q) ||
        (r.desc||r.description||'').toLowerCase().includes(q)
      )
    }

    // Tri
    if (sort === 'votes')    return [...data].sort((a,b) => (b.votes?.count??b.votes??0)-(a.votes?.count??a.votes??0))
    if (sort === 'comments') return [...data].sort((a,b) => (b.comments?.length??0)-(a.comments?.length??0))
    return data
  }, [recs, filter, catFilter, search, sort])

  const detailRec   = recs.find(r => (r.id||r._id) === detailId)
  const detailVotes = detailRec ? (detailRec.votes?.count ?? detailRec.votes ?? 0) : 0

  // Vote
  async function vote(id, e) {
    e.stopPropagation()
    if (!isAuthenticated) {
      toast('Connectez-vous pour soutenir cette réclamation.', 'info')
      return
    }
    if (authUser?.role === 'Admin' || authUser?.role === 'Agent') {
      toast(`En tant que ${authUser.role}, vous ne pouvez pas voter.`, 'info')
      return
    }
    setRecs(prev => prev.map(r => {
      if ((r.id||r._id) !== id) return r
      const wasVoted = r.voted
      const cur = r.votes?.count ?? r.votes ?? 0
      return { ...r, votes: wasVoted ? Math.max(0, cur-1) : cur+1, voted: !wasVoted }
    }))
    try {
      const res = await reclamationsAPI.vote(id)
      setRecs(prev => prev.map(r => {
        if ((r.id||r._id) !== id) return r
        return { ...r, votes: res.voteCount, voted: res.action === 'added' }
      }))
    } catch {
      // revert
      setRecs(prev => prev.map(r => {
        if ((r.id||r._id) !== id) return r
        const wasVoted = !r.voted
        const cur = r.votes?.count ?? r.votes ?? 0
        return { ...r, votes: wasVoted ? cur+1 : Math.max(0, cur-1), voted: wasVoted }
      }))
    }
  }

  // Add comment
  async function addComment() {
    if (!newComment.trim()) return
    if (!isAuthenticated) {
      toast('Connectez-vous pour commenter.', 'info')
      return
    }
    if (authUser?.role === 'Admin' || authUser?.role === 'Agent') {
      toast(`En tant que ${authUser.role}, vous ne pouvez pas commenter.`, 'info')
      return
    }

    // Filtre automatique des commentaires inappropriés
    const text = newComment.trim()
    const BAD_WORDS = ['merde', 'putain', 'connard', 'salope', 'idiot', 'débile', 'shit', 'fuck', 'bitch', 'asshole', 'catastrophe']
    const isClean = !BAD_WORDS.some(word => text.toLowerCase().includes(word))
    
    if (!isClean) {
      toast('Commentaire supprimé : contenu inapproprié détecté.', 'err')
      setNewComment('')
      return
    }

    setCommentErr('')
    setCommentLoading(true)
    const authorName = authUser ? `${authUser.firstName} ${authUser.lastName}` : 'Anonyme'
    setRecs(prev => prev.map(r =>
      (r.id||r._id) === detailId
        ? { ...r, comments: [...(r.comments||[]), { user: authorName, text, time: "à l'instant" }] }
        : r
    ))
    setNewComment('')
    try {
      await reclamationsAPI.addComment(detailId, text)
    } catch {
      setCommentErr('Commentaire enregistré localement.')
    } finally {
      setCommentLoading(false)
    }
  }

  const timelineSteps = detailRec ? extractTimelineSteps(detailRec) : []
  const progress  = PROGRESS[detailRec?.status] ?? 25

  return (
    <div className="h-screen flex font-dm bg-muted">
      {/* LEFT FIXED HERO PANEL */}
      <div className="w-[480px] shrink-0 bg-gradient-to-br from-primary to-primary-light flex flex-col justify-between p-10 text-white">
        <div>
          <div className="flex items-center gap-3 mb-12">
            <img src={logoImg} alt="BlediGo" className="w-10 h-10 object-cover rounded-xl shadow-lg shrink-0" />
            <div>
              <div className="font-syne text-[20px] font-black leading-none">BlediGo</div>
              <div className="text-[10px] text-white/50 uppercase tracking-wider mt-0.5">Plateforme Municipale</div>
            </div>
          </div>

          <h1 className="font-syne text-[36px] font-black leading-tight mb-4">
            Réclamations<br/>publiées
          </h1>
          <p className="text-[14px] text-white/65 leading-relaxed mb-8">
            Consultez les signalements de vos concitoyens, soutenez les problèmes importants et partagez vos informations.
          </p>

          <div className="flex flex-col gap-4 mb-8">
            {[
              {v:recs.length, l:'Réclamations totales'},
              {v:recs.filter(r=>r.status==='Resolue'||r.status==='Resolved').length, l:'Résolues'},
              {v:recs.filter(r=>r.status==='En cours'||r.status==='In Progress').length, l:'En cours'},
              {v:recs.reduce((a,r)=>a+(r.comments?.length??0),0), l:'Commentaires'},
            ].map(s=>(
              <div key={s.l} className="flex justify-between items-center border-b border-white/20 pb-2">
                <span className="text-[13px] text-white/70">{s.l}</span>
                <span className="font-syne text-[24px] font-bold">{s.v}</span>
              </div>
            ))}
          </div>

          <button
            onClick={() => navigate(isAuthenticated ? (authUser?.role === 'Admin' ? '/admin/dashboard' : authUser?.role === 'Agent' ? '/agent/dashboard' : '/user/dashboard') : '/login')}
            className="w-full py-2.5 bg-white/20 hover:bg-white/30 rounded-lg text-[14px] font-semibold transition-colors border border-white/30 mb-6"
          >
            {isAuthenticated ? 'Accéder à mon espace →' : 'Se connecter →'}
          </button>

          <div className="text-[12px] text-white/40 border-t border-white/20 pt-4">
            © 2026 BlediGo — Plateforme officielle de la Municipalité de Tunis
          </div>
        </div>
      </div>

      {/* RIGHT SCROLLABLE CONTENT */}
      <div className="flex-1 overflow-y-auto custom-scroll">
        <div className="max-w-[1000px] mx-auto px-6 py-8">
          <div className="grid grid-cols-[1fr_280px] gap-6 items-start">
            {/* LEFT COLUMN (cards) */}
            <div>
              <div className="flex items-center gap-2 bg-white border-[1.5px] border-border-2 rounded-[10px] px-4 py-2.5 mb-4">
                <Search size={15} className="text-t3 shrink-0"/>
                <input value={search} onChange={e=>setSearch(e.target.value)}
                  placeholder="Rechercher un problème, une rue, un quartier…"
                  className="bg-transparent border-none outline-none text-[14px] w-full font-dm"/>
              </div>

              <div className="flex gap-2 flex-wrap mb-3">
                {['Tous','En attente','En cours','Resolue','Critique'].map(f=>(
                  <button key={f} onClick={()=>setFilter(f)} className={`px-4 py-1.5 rounded-full text-[13px] font-medium border-[1.5px] transition-all ${filter===f?'bg-primary border-primary text-white':'bg-white border-border-2 text-t2 hover:border-primary hover:text-primary'}`}>{f}</button>
                ))}
              </div>

              <div className="flex justify-between items-center mb-4">
                <span className="text-[13px] text-t3">{filtered.length} réclamation{filtered.length!==1?'s':''}</span>
                <select value={sort} onChange={e=>setSort(e.target.value)} className="bg-white border border-border-2 rounded-btn px-3 py-1.5 text-[13px] outline-none font-dm text-t1">
                  <option value="recent">Plus récentes</option>
                  <option value="votes">Plus soutenues</option>
                  <option value="comments">Plus commentées</option>
                </select>
              </div>

              <div className="flex flex-col gap-3.5">
                {filtered.map(r=>{
                  const rid = r.id||r._id
                  const voteCount = r.votes?.count ?? r.votes ?? 0
                  return (
                    <div key={rid} className="bg-white border border-border rounded-card overflow-hidden hover:shadow-card transition-shadow">
                      <div className="px-5 py-4 border-b border-border">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap mb-1.5">
                              <span className="text-[12px] font-bold text-t3">#{String(rid).slice(-6)}</span>
                              <Badge status={STATUS_BADGE[r.status]??'pending'}>{r.status}</Badge>
                              <span className="text-[11.5px] font-medium px-2 py-0.5 rounded bg-muted text-t2 border border-border">{r.category || r.cat}</span>
                            </div>
                            <h3 className="font-syne text-[15px] font-bold text-t1 leading-snug mb-1.5">{r.title}</h3>
                            <div className="flex items-center gap-3 flex-wrap">
                              {(r.loc||r.location?.address) && <span className="flex items-center gap-1 text-[12px] text-t3"><MapPin size={12}/>{r.loc||r.location?.address}</span>}
                              <span className="flex items-center gap-1 text-[12px] text-t3"><Calendar size={12}/>{r.date||new Date(r.createdAt||Date.now()).toLocaleDateString('fr-FR')}</span>
                            </div>
                          </div>
                          <div className="text-center shrink-0">
                            <button onClick={e=>vote(rid,e)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border-[1.5px] text-[12.5px] font-semibold transition-all ${r.voted?'bg-primary/10 border-primary text-primary':'bg-white border-border-2 text-t2 hover:border-primary hover:text-primary'}`}>
                              <ThumbsUp size={13}/><span>{voteCount}</span>
                            </button>
                            <p className="text-[11px] text-t3 mt-1">soutiens</p>
                          </div>
                        </div>
                      </div>
                      <div className="px-5 py-3">
                        <p className="text-[13.5px] text-t2 leading-relaxed line-clamp-2">{r.desc||r.description}</p>
                      </div>
                      <div className="px-5 py-3 bg-surface-2/60 border-t border-border flex items-center gap-3 flex-wrap">
                        <span className="flex items-center gap-1.5 text-[12.5px] text-t3"><MessageSquare size={13}/>{r.comments?.length??0} commentaire{(r.comments?.length??0)!==1?'s':''}</span>
                        <Button variant="ghost" size="sm" onClick={()=>setDetailId(rid)}>Voir détails &amp; commenter</Button>
                      </div>
                    </div>
                  )
                })}
                {filtered.length===0 && (
                  <div className="text-center py-16 text-t3"><Search size={36} className="mx-auto mb-3 opacity-30"/><p>Aucune réclamation ne correspond à votre recherche.</p></div>
                )}
              </div>
            </div>

            {/* RIGHT SIDEBAR */}
            <div className="sticky top-8 flex flex-col gap-3">
              <div className="bg-white border border-border rounded-card overflow-hidden">
                <div className="px-4 py-3 border-b border-border font-syne text-[13px] font-bold">Par catégorie</div>
                <div className="p-3 flex flex-col gap-2">
                  {CATS.map(c=>(
                    <div key={c} onClick={()=>setCatFilter(c)} className="flex items-center justify-between cursor-pointer hover:text-primary transition-colors text-[13px]">
                      <span className={`${catFilter===c?'font-semibold text-primary':''}`}>{c}</span>
                      <span className="text-[11px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                        {c==='Toutes'?recs.length:recs.filter(r=> (r.category||r.cat) === c).length}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white border border-border rounded-card p-3">
                <h3 className="font-syne text-[13px] font-bold mb-2">Statistiques globales</h3>
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between text-[12px]"><span className="text-t2">Taux de résolution</span>
                    <span className="font-bold text-success">{recs.length>0?Math.round(recs.filter(r=>r.status==='Resolue'||r.status==='Resolved').length/recs.length*100):0}%</span>
                  </div>
                  <ProgressBar value={recs.length>0?Math.round(recs.filter(r=>r.status==='Resolue'||r.status==='Resolved').length/recs.length*100):0} color="#1D8C5E" height={4}/>
                  <div className="flex justify-between text-[12px]"><span className="text-t2">Citoyens actifs</span><span className="font-bold">{recs.length > 0 ? recs.length * 2 : 0}</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      <Modal open={!!detailRec} onClose={()=>{setDetailId(null);setCommentErr('');setNewComment('')}}
        title={detailRec?`#${String(detailRec.id||detailRec._id||'').slice(-6)} — ${detailRec.title}`:''} size="lg"
        footer={<Button variant="outline" onClick={()=>setDetailId(null)}>Fermer</Button>}>
        {detailRec && (
          <>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge status={STATUS_BADGE[detailRec.status]??'pending'}>{detailRec.status}</Badge>
              <span className="text-[12px] text-t3">📅 {detailRec.date||new Date(detailRec.createdAt||Date.now()).toLocaleDateString('fr-FR')}</span>
              <span className="text-[12px] text-t3">🏷 {detailRec.category||detailRec.cat}</span>
            </div>
            <div className="bg-surface-2 rounded-[9px] p-3.5 text-[13.5px] text-t1 leading-relaxed">{detailRec.desc||detailRec.description}</div>

            <div className="flex items-center gap-3">
              <button onClick={e=>vote(detailRec.id||detailRec._id,e)} className={`flex items-center gap-2 px-3.5 py-2 rounded-full border-[1.5px] text-[13px] font-semibold transition-all ${detailRec.voted?'bg-primary/10 border-primary text-primary':'bg-white border-border-2 text-t2 hover:border-primary hover:text-primary'}`}>
                <ThumbsUp size={14}/> {detailVotes} soutiens
              </button>
              <span className="text-[12.5px] text-t3">{detailRec.comments?.length??0} commentaire{(detailRec.comments?.length??0)!==1?'s':''}</span>
            </div>

            <div>
              <div className="flex justify-between text-[12.5px] mb-1.5"><span className="text-t2">Avancement</span><span className="font-bold">{progress}%</span></div>
              <ProgressBar value={progress}/>
            </div>

            {/* Timeline */}
            <div>
              <h4 className="font-syne text-[13px] font-bold mb-3">Timeline</h4>
              <div className="flex flex-col gap-0">
                {timelineSteps.length === 0 ? (
                  <p className="text-[13px] text-t3 text-center py-2">Aucune information de suivi disponible.</p>
                ) : (
                  timelineSteps.map((step, idx) => (
                    <div key={step.key} className="flex gap-3 pb-3.5 relative">
                      {idx < timelineSteps.length - 1 && (
                        <div className="absolute left-[10px] top-[20px] bottom-0 w-px bg-border" />
                      )}
                      <div className={`w-5 h-5 rounded-full shrink-0 border-2 border-white ${
                        step.date ? 'bg-success' : 'bg-border-2'
                      }`} />
                      <div className="pt-0.5">
                        <p className={`text-[13px] font-medium ${!step.date ? 'text-t3' : 'text-t1'}`}>
                          {step.label}
                        </p>
                        <p className="text-[11.5px] text-t3">
                          {step.date || 'En attente'}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Comments */}
            <div>
              <h4 className="font-syne text-[13px] font-bold mb-3">Commentaires ({detailRec.comments?.length??0})</h4>
              {(detailRec.comments?.length??0)===0
                ? <p className="text-[13px] text-t3 text-center py-3">Soyez le premier à commenter.</p>
                : <div className="flex flex-col gap-3">
                    {detailRec.comments.map((c,i)=>(
                      <div key={i} className="flex gap-2.5">
                        <Avatar name={c.user||'?'} size={30}/>
                        <div className="flex-1 bg-surface-2 border border-border rounded-[9px] p-2.5">
                          <div className="flex justify-between mb-1">
                            <span className="text-[13px] font-semibold">{c.user}</span>
                            <span className="text-[11px] text-t3">{c.time||new Date(c.createdAt||Date.now()).toLocaleString('fr-FR')}</span>
                          </div>
                          <p className="text-[13px] text-t2">{c.text}</p>
                        </div>
                      </div>
                    ))}
                  </div>
              }

              <div className="mt-4 bg-surface-2 rounded-[10px] p-4">
                {isAuthenticated ? (
                  authUser?.role !== 'Admin' && authUser?.role !== 'Agent' ? (
                    <>
                      <p className="text-[13px] font-semibold mb-2.5">
                        Commenter en tant que <span className="text-primary">{authUser?.firstName} {authUser?.lastName}</span>
                      </p>
                      {commentErr && <p className="text-[12px] text-warning mb-2">{commentErr}</p>}
                      <textarea value={newComment} onChange={e=>setNewComment(e.target.value)}
                        placeholder="Partagez votre avis ou des informations complémentaires…"
                        className="w-full bg-white border-[1.5px] border-border-2 rounded-btn px-3 py-2 text-[13.5px] font-dm outline-none resize-y min-h-[70px] focus:border-primary"/>
                      <div className="flex justify-end mt-2">
                        <Button variant="primary" size="sm" onClick={addComment} disabled={commentLoading}>
                          {commentLoading ? 'Publication…' : 'Publier'}
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-2 flex flex-col items-center">
                      <p className="text-[13px] font-semibold text-t2 mb-1">Mode consultation uniquement</p>
                      <p className="text-[12px] text-t3">En tant que <strong className="text-primary">{authUser?.role}</strong>, vous ne pouvez pas commenter sur le portail public.</p>
                    </div>
                  )
                ) : (
                  <div className="text-center py-2">
                    <p className="text-[13px] text-t3 mb-3">Connectez-vous pour laisser un commentaire.</p>
                    <Button variant="primary" size="sm" onClick={()=>navigate('/login')}>Se connecter</Button>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}