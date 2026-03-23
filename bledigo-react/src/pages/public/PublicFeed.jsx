import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, ThumbsUp, MessageSquare, MapPin, Calendar, Sparkles } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import ProgressBar from '../../components/ui/ProgressBar'
import Avatar from '../../components/ui/Avatar'
import { usePublicFeed } from '../../hooks/useData'
import { reclamationsAPI } from '../../services/api'
import { useAuth } from '../../context/AuthContext'

const STATUS_BADGE = { 'En cours':'progress','En attente':'pending','Resolue':'resolved','Critique':'urgent','Pending':'pending','In Progress':'progress','Resolved':'resolved','Cancelled':'resolved' }
const PROGRESS    = { 'En attente':25,'En cours':60,'Critique':15,'Resolue':100,'Pending':25,'In Progress':60,'Resolved':100 }
const FILTERS     = ['Tous','En cours','En attente','Resolue','Critique']
const CATS        = ['Toutes','Eclairage','Routes','Voirie','Propreté','Espaces verts','Eau']

export default function PublicFeed() {
  const navigate = useNavigate()
  const { user: authUser, isAuthenticated } = useAuth()
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
    if (filter !== 'Tous')      data = data.filter(r => r.status === filter)
    if (catFilter !== 'Toutes') data = data.filter(r => r.cat === catFilter || r.category === catFilter)
    if (search) {
      const q = search.toLowerCase()
      data = data.filter(r =>
        (r.title||'').toLowerCase().includes(q) ||
        (r.loc||r.location?.address||'').toLowerCase().includes(q) ||
        (r.desc||r.description||'').toLowerCase().includes(q)
      )
    }
    if (sort === 'votes')    return [...data].sort((a,b) => (b.votes?.count??b.votes??0)-(a.votes?.count??a.votes??0))
    if (sort === 'comments') return [...data].sort((a,b) => (b.comments?.length??0)-(a.comments?.length??0))
    return data
  }, [recs, filter, catFilter, search, sort])

  const detailRec   = recs.find(r => (r.id||r._id) === detailId)
  const detailVotes = detailRec ? (detailRec.votes?.count ?? detailRec.votes ?? 0) : 0

  // ── Vote: optimistic + real API ───────────────────────
  async function vote(id, e) {
    e.stopPropagation()
    if (!isAuthenticated) { navigate('/login'); return }
    setRecs(prev => prev.map(r => {
      if ((r.id||r._id) !== id) return r
      const wasVoted = r.voted
      const cur = r.votes?.count ?? r.votes ?? 0
      return { ...r, votes: wasVoted ? Math.max(0, cur-1) : cur+1, voted: !wasVoted }
    }))
    try { await reclamationsAPI.vote(id) } catch {
      // revert on error
      setRecs(prev => prev.map(r => {
        if ((r.id||r._id) !== id) return r
        const wasVoted = !r.voted
        const cur = r.votes?.count ?? r.votes ?? 0
        return { ...r, votes: wasVoted ? cur+1 : Math.max(0, cur-1), voted: wasVoted }
      }))
    }
  }

  // ── Add comment: real API, auth required ─────────────
  async function addComment() {
    if (!newComment.trim()) return
    if (!isAuthenticated) { navigate('/login'); return }
    setCommentErr('')
    setCommentLoading(true)
    const text       = newComment.trim()
    const authorName = authUser ? `${authUser.firstName} ${authUser.lastName}` : 'Anonyme'
    // Optimistic
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

  const progress  = PROGRESS[detailRec?.status] ?? 25
  const stepsDone = progress===100?4:progress>=60?3:progress>=25?2:1

  return (
    <div className="min-h-screen bg-muted font-dm overflow-y-auto">

      {/* Navbar */}
      <nav className="bg-primary px-10 h-[62px] flex items-center gap-4 sticky top-0 z-50">
        <div className="flex items-center gap-2.5 cursor-pointer" onClick={()=>navigate('/login')}>
          <div className="w-[34px] h-[34px] bg-accent rounded-[9px] flex items-center justify-center" style={{boxShadow:'0 3px 10px rgba(232,135,58,0.4)'}}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M12 2L2 7v10l10 5 10-5V7L12 2zm0 2.5 7.5 3.75v6.5L12 18.5 4.5 14.75v-6.5z"/></svg>
          </div>
          <span className="font-syne text-[18px] font-extrabold text-white">BlediGo</span>
        </div>
        <div className="flex gap-1 ml-6">
          <span className="text-[13.5px] font-semibold text-white bg-white/14 px-3.5 py-1.5 rounded-[7px]">Réclamations publiées</span>
          <button onClick={()=>navigate('/user/dashboard')} className="text-[13.5px] text-white/60 hover:text-white hover:bg-white/8 px-3.5 py-1.5 rounded-[7px] transition-colors">Espace citoyen</button>
        </div>
        <div className="ml-auto flex gap-2">
          {isAuthenticated ? (
            <Button variant="accent" size="sm" onClick={()=>navigate('/user/dashboard')}>Mon espace →</Button>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={()=>navigate('/login')}>Se connecter</Button>
              <Button variant="accent"  size="sm" onClick={()=>navigate('/login')}>Créer un compte</Button>
            </>
          )}
        </div>
      </nav>

      {/* Hero */}
      <div className="bg-gradient-to-br from-primary to-primary-light px-10 py-14 text-center">
        <h1 className="font-syne text-[32px] font-extrabold text-white mb-2.5">Réclamations publiées</h1>
        <p className="text-[15px] text-white/65 max-w-lg mx-auto mb-8 leading-relaxed">
          Consultez les signalements de vos concitoyens, soutenez les problèmes importants et partagez vos informations.
        </p>
        <div className="flex gap-8 justify-center flex-wrap">
          {[
            {v:recs.length,                                             l:'Réclamations totales'},
            {v:recs.filter(r=>r.status==='Resolue'||r.status==='Resolved').length, l:'Résolues'},
            {v:recs.filter(r=>r.status==='En cours'||r.status==='In Progress').length, l:'En cours'},
            {v:recs.reduce((a,r)=>a+(r.comments?.length??0),0),        l:'Commentaires'},
          ].map(s=>(
            <div key={s.l} className="text-center">
              <div className="font-syne text-[26px] font-bold text-white">{s.v}</div>
              <div className="text-[12px] text-white/45 mt-1">{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-[1180px] mx-auto px-6 py-8">
        <div className="grid grid-cols-[1fr_300px] gap-6 items-start">

          {/* LEFT */}
          <div>
            <div className="flex items-center gap-2 bg-white border-[1.5px] border-border-2 rounded-[10px] px-4 py-2.5 mb-4">
              <Search size={15} className="text-t3 shrink-0"/>
              <input value={search} onChange={e=>setSearch(e.target.value)}
                placeholder="Rechercher un problème, une rue, un quartier…"
                className="bg-transparent border-none outline-none text-[14px] w-full font-dm"/>
            </div>

            <div className="flex gap-2 flex-wrap mb-3">
              {FILTERS.map(f=>(
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
                            <span className="text-[11.5px] font-medium px-2 py-0.5 rounded bg-muted text-t2 border border-border">{r.cat||r.category}</span>
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

          {/* RIGHT sidebar */}
          <div className="sticky top-[70px] flex flex-col gap-4">
            <div className="bg-white border border-border rounded-card overflow-hidden">
              <div className="px-4 py-3.5 border-b border-border font-syne text-[14px] font-bold">Par catégorie</div>
              <div className="p-4 flex flex-col gap-2.5">
                {CATS.map(c=>(
                  <div key={c} onClick={()=>setCatFilter(c)} className="flex items-center justify-between cursor-pointer hover:text-primary transition-colors">
                    <span className={`text-[13px] ${catFilter===c?'font-semibold text-primary':''}`}>{c}</span>
                    <span className="text-[12px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                      {c==='Toutes'?recs.length:recs.filter(r=>r.cat===c||r.category===c).length}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white border-2 border-primary rounded-card p-6 text-center">
              <div className="text-3xl mb-2.5">📢</div>
              <h3 className="font-syne text-[15px] font-bold mb-2">Signaler un problème</h3>
              <p className="text-[13px] text-t3 leading-relaxed mb-4">Soumettez une réclamation en quelques secondes.</p>
              <Button variant="primary" full onClick={()=>navigate(isAuthenticated?'/user/signal':'/login')}>Soumettre une réclamation</Button>
              {!isAuthenticated && <p className="text-[11.5px] text-t3 mt-2">Compte requis · Inscription gratuite</p>}
            </div>

            <div className="bg-white border border-border rounded-card p-4">
              <h3 className="font-syne text-[14px] font-bold mb-3">Statistiques globales</h3>
              <div className="flex flex-col gap-2.5">
                <div className="flex justify-between text-[13px]"><span className="text-t2">Taux de résolution</span>
                  <span className="font-bold text-success">{recs.length>0?Math.round(recs.filter(r=>r.status==='Resolue'||r.status==='Resolved').length/recs.length*100):0}%</span>
                </div>
                <ProgressBar value={recs.length>0?Math.round(recs.filter(r=>r.status==='Resolue'||r.status==='Resolved').length/recs.length*100):0} color="#1D8C5E"/>
                <div className="flex justify-between text-[13px]"><span className="text-t2">Citoyens actifs</span><span className="font-bold">{recs.length > 0 ? recs.length * 2 : 0}</span></div>
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
              <span className="text-[12px] text-t3">🏷 {detailRec.cat||detailRec.category}</span>
            </div>
            <div className="bg-surface-2 rounded-[9px] p-3.5 text-[13.5px] text-t1 leading-relaxed">{detailRec.desc||detailRec.description}</div>

            {/* Vote in detail */}
            <div className="flex items-center gap-3">
              <button onClick={e=>vote(detailRec.id||detailRec._id,e)} className={`flex items-center gap-2 px-3.5 py-2 rounded-full border-[1.5px] text-[13px] font-semibold transition-all ${detailRec.voted?'bg-primary/10 border-primary text-primary':'bg-white border-border-2 text-t2 hover:border-primary hover:text-primary'}`}>
                <ThumbsUp size={14}/> {detailVotes} soutiens
              </button>
              <span className="text-[12.5px] text-t3">{detailRec.comments?.length??0} commentaire{(detailRec.comments?.length??0)!==1?'s':''}</span>
            </div>

            {/* Progress */}
            <div>
              <div className="flex justify-between text-[12.5px] mb-1.5"><span className="text-t2">Avancement</span><span className="font-bold">{progress}%</span></div>
              <ProgressBar value={progress}/>
            </div>

            {/* Timeline */}
            <div>
              <h4 className="font-syne text-[13px] font-bold mb-3">Timeline</h4>
              <div className="flex flex-col gap-0">
                {['Réclamation soumise','Affectée à un agent','En cours d\'intervention','Résolution confirmée'].map((s,i)=>{
                  const done=i<stepsDone; const active=i===stepsDone-1&&progress<100
                  return (
                    <div key={i} className="flex gap-3 pb-3.5 relative">
                      {i<3 && <div className="absolute left-[10px] top-[20px] bottom-0 w-px bg-border"/>}
                      <div className={`w-5 h-5 rounded-full shrink-0 border-2 border-white ${progress===100?'bg-success':done&&active?'bg-primary':done?'bg-success':'bg-border-2'}`}/>
                      <div className="pt-0.5">
                        <p className={`text-[13px] font-medium ${!done&&!active?'text-t3':''}`}>{s}</p>
                        <p className="text-[11.5px] text-t3">{done?detailRec.date||'—':'En attente'}</p>
                      </div>
                    </div>
                  )
                })}
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

              {/* Comment form */}
              <div className="mt-4 bg-surface-2 rounded-[10px] p-4">
                {isAuthenticated ? (
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
