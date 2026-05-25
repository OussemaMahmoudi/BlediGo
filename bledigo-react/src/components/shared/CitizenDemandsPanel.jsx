import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ClipboardCheck, Star, X, Check, AlertCircle, Clock, Eye } from 'lucide-react'
import { Card } from '../ui/Card'
import Button from '../ui/Button'
import Badge from '../ui/Badge'
import Modal from '../ui/Modal'
import { FormGroup, Textarea } from '../ui/Field'
import { servicesAPI } from '../../services/api'
import { useToast } from '../../hooks/useToast'

const DEM_LABEL = { Pending: 'En attente', Accepted: 'Acceptée', Rejected: 'Refusée/Annulée', Expired: 'Expirée' }
const DEM_BADGE = { Pending: 'pending', Accepted: 'resolved', Rejected: 'cancelled', Expired: 'urgent' }

function StarPicker({ value, onChange }) {
  const [hov, setHov] = useState(0)
  return (
    <div className="flex gap-1">
      {[1,2,3,4,5].map(i => (
        <button key={i} type="button"
          onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(0)}
          onClick={() => onChange(i)}
          className="text-3xl cursor-pointer hover:scale-110 transition-transform"
          style={{ color: (hov || value) >= i ? '#F59E0B' : '#D1D5DB' }}
        >★</button>
      ))}
    </div>
  )
}

export default function CitizenDemandsPanel({ demands = [], setDemands }) {
  const { toast } = useToast()
  const [detailModal, setDetailModal] = useState({ open: false, demand: null })
  const [rating, setRating]       = useState(0)
  const [comment, setComment]     = useState('')
  const [saving, setSaving]       = useState(false)

  useEffect(() => {
    if (detailModal.open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => { document.body.style.overflow = 'unset' }
  }, [detailModal.open])

  // Check if demand is within 24h cancel window
  function canCancel(d) {
    if (d.status !== 'Pending') return false
    const hrs = (Date.now() - new Date(d.createdAt)) / 3600000
    return hrs <= 24
  }

  // Returns hours remaining in cancel window
  function hoursLeft(d) {
    const hrs = 24 - ((Date.now() - new Date(d.createdAt)) / 3600000)
    return Math.max(0, hrs).toFixed(1)
  }

  async function handleCancel(d) {
    if (!window.confirm(`Annuler la demande pour "${d.serviceName}" ?`)) return
    try {
      await servicesAPI.cancelMyDemand(d.serviceId || d._id, d._id)
      setDemands(prev => prev.map(x => x._id === d._id ? { ...x, status: 'Rejected' } : x))
      toast('Demande annulée ✓', 'ok')
    } catch (e) {
      toast(e?.response?.data?.message || 'Erreur lors de l\'annulation', 'err')
    }
  }

  async function handleRate(d) {
    if (!rating) { toast('Choisissez une note', 'err'); return }
    setSaving(true)
    try {
      await servicesAPI.rate(d.serviceId || d._id, rating, comment, d._id)
      setDemands(prev => prev.map(x => x._id === d._id ? { ...x, rated: true, userRating: rating } : x))
      setDetailModal(prev => ({ ...prev, demand: { ...prev.demand, rated: true, userRating: rating } }))
      toast(`Note ${rating}/5 enregistrée ✓`, 'ok')
      setRating(0); setComment('')
    } catch (e) {
      toast(e?.response?.data?.message || 'Erreur', 'err')
    } finally {
      setSaving(false)
    }
  }

  if (demands.length === 0) {
    return (
      <div className="text-center py-16 text-t3">
        <ClipboardCheck size={36} className="mx-auto mb-3 opacity-25" />
        <p className="text-[14px] font-medium">Aucune demande de service</p>
        <p className="text-[13px] mt-1">Accédez aux services municipaux pour soumettre une demande</p>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-3">
        {demands.map(d => {
          const cancelable  = canCancel(d)
          const isCompleted = d.status === 'Accepted' || d.status === 'Resolved' || d.status === 'Resolue'
          const isRated     = d.rated || d.userRating
          return (
            <div key={d._id || d.id} className="bg-white border border-border rounded-[12px] p-4 hover:shadow-sm transition-all">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-syne text-[14px] font-bold truncate">{d.serviceName || 'Service'}</span>
                    <Badge status={DEM_BADGE[d.status] || 'pending'}>{DEM_LABEL[d.status] || d.status}</Badge>
                    {d.serviceCategory && (
                      <span className="text-[11px] px-2 py-0.5 rounded bg-muted text-t2 border border-border font-medium">{d.serviceCategory}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-[12px] text-t3">
                    <span>#{String(d._id || '').slice(-6)}</span>
                    <span>·</span>
                    <span>{d.createdAt ? new Date(d.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}</span>
                    {d.status === 'Pending' && (
                      <>
                        <span>·</span>
                        <span className={`flex items-center gap-1 ${cancelable ? 'text-warning' : 'text-danger'}`}>
                          <Clock size={11} />
                          {cancelable ? `Annulable encore ${hoursLeft(d)}h` : 'Délai d\'annulation dépassé'}
                        </span>
                      </>
                    )}
                  </div>
                  {d.notes && <p className="text-[12.5px] text-t2 mt-1 italic">Note : {d.notes}</p>}
                  {d.status === 'Rejected' && d.notes && (
                    <p className="text-[12px] text-danger mt-1">Motif : {d.notes}</p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="outline" size="sm" onClick={() => setDetailModal({ open: true, demand: d })}>
                    <Eye size={12} /> Consulter
                  </Button>
                  {isCompleted && isRated && (
                    <div className="flex items-center gap-1 text-[12px] text-success font-medium ml-2">
                      <Check size={13} /> Évalué ({d.userRating}/5)
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>



      {/* Detail Side Panel (Exact match to Services Municipaux) */}
      {createPortal(
        <>
          {detailModal.open && (
            <div className="fixed inset-0 z-40 bg-gray-900/10 backdrop-blur-sm transition-all duration-300" onClick={() => setDetailModal({ ...detailModal, open: false })} />
          )}
          
          <div className={`fixed top-0 right-0 w-[440px] max-w-full h-full bg-white shadow-2xl z-50 flex flex-col transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] font-dm ${
              detailModal.open ? 'translate-x-0' : 'translate-x-[100%]'
          }`}>
            {detailModal.demand && (() => {
              const d = detailModal.demand
              const isCompleted = d.status === 'Accepted' || d.status === 'Resolved' || d.status === 'Resolue'
              const cancelable = canCancel(d)
              
              const agentName = d.processedByName 
                || (d.responsibleAgent ? `${d.responsibleAgent.firstName || ''} ${d.responsibleAgent.lastName || ''}`.trim() : null)
                || (d.assignedAgent ? `${d.assignedAgent.firstName || ''} ${d.assignedAgent.lastName || ''}`.trim() : null)
                || '—'

              return (
                <>
                  {/* Minimalist Header */}
                  <div className="p-6 flex items-start justify-between border-b border-gray-100 bg-white/95 backdrop-blur-md shrink-0">
                    <div className="flex gap-4">
                      <div className="w-12 h-12 rounded-[14px] bg-slate-50 flex items-center justify-center text-[22px] border border-gray-200 shadow-sm flex-none">
                        📄
                      </div>
                      <div className="min-w-0">
                        <h2 className="font-syne text-[18px] font-bold text-gray-900 mb-1 truncate leading-tight">{d.serviceName || 'Demande'}</h2>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md ${
                            d.status === 'Accepted' ? 'bg-emerald-50 text-emerald-600' :
                            d.status === 'Rejected' || d.status === 'Cancelled' ? 'bg-rose-50 text-rose-600' :
                            'bg-indigo-50 text-indigo-600'
                          }`}>
                            {DEM_LABEL[d.status] || d.status}
                          </span>
                          <span className="text-[11px] text-gray-400 font-medium">/ Réf. #{String(d._id || d.id || '').slice(-6)}</span>
                        </div>
                      </div>
                    </div>
                    <button onClick={() => setDetailModal({ ...detailModal, open: false })} className="text-gray-400 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 transition-colors p-1.5 rounded-full">
                      <X size={20} strokeWidth={2} />
                    </button>
                  </div>

                  {/* Minimalist Body */}
                  <div className="flex-1 overflow-y-auto custom-scroll p-6 space-y-10 bg-white">
                    
                    {cancelable && (
                      <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex gap-3.5 items-center shadow-sm">
                        <Clock size={20} className="text-amber-500 shrink-0" strokeWidth={2.5} />
                        <span className="text-[12.5px] text-amber-900 font-medium tracking-wide">
                          Cette demande peut être annulée pendant encore {hoursLeft(d)}h.
                        </span>
                      </div>
                    )}

                    {/* Key Metrics row */}
                    <div className="grid grid-cols-2 gap-y-7 gap-x-5">
                      {[
                        { label: 'Demandeur', value: typeof d.citizen === 'object' ? `${d.citizen?.firstName} ${d.citizen?.lastName || ''}`.trim() : 'Vous' },
                        { label: 'Catégorie', value: d.serviceCategory || 'Autre' },
                        { label: 'Date de dépôt', value: d.createdAt ? new Date(d.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—' },
                        { label: 'Agent assigné', value: agentName !== '—' ? agentName : 'En attente' },
                      ].map((item, i) => (
                        <div key={i} className="min-w-0">
                          <div className="text-[10px] text-gray-400 uppercase font-bold tracking-[0.1em] mb-1.5">{item.label}</div>
                          <div className="text-[13.5px] font-semibold text-gray-800 truncate">{item.value}</div>
                        </div>
                      ))}
                    </div>

                    {/* Notes de l'agent */}
                    {d.notes && (
                      <div className="space-y-3.5">
                        <h3 className="text-[11px] text-indigo-500 uppercase font-extrabold tracking-[0.12em] flex items-center gap-2">
                          <AlertCircle size={15} strokeWidth={2.5}/> Réponse du service
                        </h3>
                        <div className="text-[14px] text-gray-700 leading-relaxed font-normal bg-indigo-50/50 p-5 rounded-[16px] border border-indigo-100/50 shadow-sm">
                          {d.notes}
                        </div>
                      </div>
                    )}

                    {/* Suivi Timeline */}
                    <div className="space-y-6 pt-2">
                      <h3 className="text-[11px] text-gray-400 uppercase font-extrabold tracking-[0.12em]">Suivi de progression</h3>
                      
                      <div className="flex flex-col relative before:absolute before:left-[15px] before:top-[16px] before:bottom-[16px] before:w-[2px] before:bg-gray-100">
                        
                        {/* Etape: Soumission */}
                        <div className="flex gap-5 pb-7 relative z-10">
                          <div className={`w-[32px] h-[32px] rounded-full shrink-0 flex items-center justify-center border-[4px] border-white ring-1 ring-gray-100 transition-colors duration-500 bg-emerald-500 shadow-sm`}>
                            <Check size={14} className="text-white font-bold" strokeWidth={3} />
                          </div>
                          <div className="pt-1">
                            <div className="text-[13.5px] font-bold text-gray-900 tracking-tight">Demande soumise</div>
                            <div className="text-[11.5px] text-gray-500 mt-1 font-medium">{d.createdAt ? new Date(d.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'} à {d.createdAt ? new Date(d.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''}</div>
                          </div>
                        </div>

                        {/* Etape: Traitement */}
                        <div className="flex gap-5 relative z-10">
                          <div className={`w-[32px] h-[32px] rounded-full shrink-0 flex items-center justify-center border-[4px] border-white transition-colors duration-500 ${
                            d.status === 'Accepted' || d.status === 'Rejected' || d.status === 'Cancelled' ? 'bg-emerald-500 ring-1 ring-gray-100 shadow-sm' : 'bg-gray-50 ring-2 ring-gray-200'
                          }`}>
                            {d.status !== 'Pending' && <Check size={14} className="text-white font-bold" strokeWidth={3} />}
                          </div>
                          <div className="pt-1">
                            <div className={`text-[13.5px] font-bold tracking-tight ${d.status === 'Pending' ? 'text-gray-400' : 'text-gray-900'}`}>
                              {d.status === 'Accepted' ? 'Demande finalisée' : d.status === 'Rejected' || d.status === 'Cancelled' ? 'Demande annulée' : 'En cours de vérification'}
                            </div>
                            <div className="text-[11.5px] text-gray-500 mt-1 font-medium">
                              {d.processedAt ? (
                                <>Le {new Date(d.processedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })} à {new Date(d.processedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</>
                              ) : (
                                'Délai estimé : 24 à 48h'
                              )}
                            </div>
                          </div>
                        </div>

                      </div>
                    </div>

                    {/* ── Evaluation Section ── */}
                    {isCompleted && (
                      <div>
                        <h3 className="text-[11px] text-gray-400 uppercase font-extrabold tracking-[0.12em] mb-4 flex items-center gap-2">
                          <Star size={13} className="text-amber-400 fill-amber-400" />
                          Évaluation du service
                        </h3>

                        {/* Already rated: show confirmation */}
                        {(d.rated || d.userRating) ? (
                          <div className="bg-emerald-50 rounded-[16px] p-5 border border-emerald-100 flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                              <Check size={22} className="text-emerald-500" strokeWidth={3} />
                            </div>
                            <div>
                              <p className="text-[13.5px] font-bold text-emerald-800">Merci pour votre évaluation !</p>
                              <div className="flex items-center gap-1 mt-1">
                                {[1,2,3,4,5].map(i => (
                                  <span key={i} className="text-xl" style={{ color: i <= (d.userRating || 0) ? '#F59E0B' : '#D1D5DB' }}>★</span>
                                ))}
                                <span className="text-[12px] text-emerald-700 font-semibold ml-1">{d.userRating}/5</span>
                              </div>
                              {d.avgRating && (
                                <p className="text-[11px] text-emerald-600/70 mt-1">Moyenne du service : {d.avgRating}/5 ⭐</p>
                              )}
                            </div>
                          </div>
                        ) : (
                          /* Not yet rated: show rating form */
                          <div className="bg-amber-50 rounded-[16px] p-5 border border-amber-100 shadow-sm">
                            <p className="text-[12px] text-amber-800/70 font-medium mb-4">Votre service a été traité. Donnez une note pour nous aider à améliorer nos services.</p>
                            <div className="space-y-4">
                              <div className="flex flex-col items-center p-4 bg-white rounded-[14px] shadow-sm border border-amber-100">
                                <p className="text-[11.5px] text-gray-400 uppercase font-bold tracking-widest mb-3">Votre note</p>
                                <StarPicker value={rating} onChange={setRating} />
                                {rating > 0 && (
                                  <p className="text-[12px] font-bold text-amber-500 mt-2">
                                    {rating === 5 ? '😍 Excellent !' : rating === 4 ? '😊 Très bien' : rating === 3 ? '🙂 Bien' : rating === 2 ? '😐 Moyen' : '😞 Décevant'}
                                  </p>
                                )}
                              </div>
                              <Textarea
                                placeholder="Commentaire optionnel…"
                                value={comment}
                                onChange={e => setComment(e.target.value)}
                                className="bg-white border-amber-200 text-[12.5px] min-h-[72px]"
                              />
                              <button
                                onClick={() => handleRate(d)}
                                disabled={saving || !rating}
                                className={`w-full h-[44px] rounded-[12px] font-bold text-[14px] transition-all flex items-center justify-center gap-2 ${
                                  rating ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-sm active:scale-[0.98]' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                }`}
                              >
                                <Star size={15} className={rating ? 'fill-white text-white' : 'text-gray-400'} />
                                {saving ? 'Envoi en cours…' : 'Soumettre mon évaluation'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                  </div>

                  {/* Minimalist Action Footer */}
                  <div className="p-4 border-t border-gray-100 bg-white shadow-[0_-4px_20px_rgba(0,0,0,0.02)]">
                    <div className="flex gap-3">
                      {cancelable && (
                        <button 
                          className="flex-1 h-[48px] bg-rose-50 text-rose-600 font-bold text-[14px] rounded-xl hover:bg-rose-100 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                          onClick={async () => { await handleCancel(d); setDetailModal({ ...detailModal, open: false }) }}
                        >
                          Annuler la demande
                        </button>
                      )}
                      {!cancelable && (
                        <button 
                          className="flex-1 h-[48px] bg-gray-100 text-gray-700 font-bold text-[14px] rounded-xl hover:bg-gray-200 active:scale-[0.98] transition-all flex items-center justify-center"
                          onClick={() => setDetailModal({ ...detailModal, open: false })}
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
