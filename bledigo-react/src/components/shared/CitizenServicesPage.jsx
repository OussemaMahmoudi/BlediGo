import { useState, useEffect } from 'react'
import { MapPin, Clock, Search, X, ChevronRight, Globe, ClipboardCheck, Download, Loader2 } from 'lucide-react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import Badge from '../ui/Badge'
import { FormGroup, Textarea } from '../ui/Field'
import { useToast } from '../../hooks/useToast'
import { servicesAPI } from '../../services/api'
import { SVGMap } from 'react-svg-map'
import Tunisia from '@svg-maps/tunisia'
import 'react-svg-map/lib/index.css'

// ─── Category config ─────────────────────────────────────────────────────────
const CAT_CONFIG = {
  'Etat civil': { emoji: '🪪', color: '#1A3C6B', bg: '#1A3C6B10', border: '#1A3C6B25' },
  'Urbanisme': { emoji: '🏗️', color: '#E8873A', bg: '#E8873A10', border: '#E8873A25' },
  'Proprete': { emoji: '♻️', color: '#1D8C5E', bg: '#1D8C5E10', border: '#1D8C5E25' },
  'Transport': { emoji: '🚌', color: '#8C96AE', bg: '#8C96AE10', border: '#8C96AE35' },
  'Culture': { emoji: '🎭', color: '#B8760D', bg: '#B8760D10', border: '#B8760D25' },
  'Education': { emoji: '📚', color: '#7C3AED', bg: '#7C3AED10', border: '#7C3AED25' },
  'Sante': { emoji: '🏥', color: '#E24B4A', bg: '#E24B4A10', border: '#E24B4A25' },
  'Autre': { emoji: '🏛️', color: '#555555', bg: '#55555510', border: '#55555525' },
}

// ─── Star Rating ─────────────────────────────────────────────────────────────
function StarRating({ value = 0, max = 5, size = 16, interactive = false, onChange }) {
  const [hovered, setHovered] = useState(0)
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: max }).map((_, i) => {
        const filled = interactive ? (hovered || value) > i : value > i
        return (
          <button key={i} type="button" disabled={!interactive}
            className={interactive ? 'cursor-pointer hover:scale-110 transition-transform' : 'cursor-default'}
            style={{ fontSize: size }}
            onMouseEnter={() => interactive && setHovered(i + 1)}
            onMouseLeave={() => interactive && setHovered(0)}
            onClick={() => interactive && onChange?.(i + 1)}
          >
            <span style={{ color: filled ? '#F59E0B' : '#D1D5DB' }}>★</span>
          </button>
        )
      })}
    </div>
  )
}

// ─── Service Detail Panel ─────────────────────────────────────────────────────
function ServiceDetailPanel({ service, open, onClose, onSubmitDemand }) {
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [qrImg, setQrImg] = useState(service?.qrCode?.imageUrl || '')
  const { toast } = useToast()

  useEffect(() => {
    if (open && service && !qrImg) {
      const sid = service._id || service.id
      servicesAPI.getQR(sid).then(res => {
        setQrImg(res?.data?.qrImage || res?.qrImage || '')
      }).catch(() => { })
    }
  }, [open, service, qrImg])

  if (!service) return null
  const sid = service._id || service.id
  const isActive = service.isActive !== false
  const cat = CAT_CONFIG[service.category] || CAT_CONFIG['Autre']
  const avg = service.stats?.avgRating ?? 0
  const hours = service.schedule
    ? `${service.schedule.days || 'Lun-Ven'} · ${service.schedule.openTime || '08:00'} – ${service.schedule.closeTime || '16:00'}`
    : '—'
  
  async function handleDemand() {
    setLoading(true)
    try {
      await servicesAPI.submitDemand(sid, { notes })
      toast(`Demande envoyée pour "${service.name}" ✓`, 'ok')
      setNotes('')
      onClose()
    } catch (e) {
      toast(e?.response?.data?.message || 'Erreur lors de la demande', 'err')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {open && (
        <div className="fixed inset-0  z-40 transition-all duration-300" onClick={onClose} />
      )}
      <div
        className={`fixed top-0 right-0 w-[440px] max-w-full h-full bg-white shadow-2xl z-50 flex flex-col transition-transform duration-500 ease-out font-dm ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Minimalist Header */}
        <div className="p-6 flex items-start justify-between border-b border-gray-50 shrink-0">
          <div className="flex gap-4">
            <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center text-2xl border border-gray-100 flex-none">
              {cat.emoji}
            </div>
            <div className="min-w-0">
              <h2 className="font-syne text-lg font-bold text-gray-900 mb-1 truncate leading-tight">{service.name}</h2>
              <div className="flex items-center gap-2">
                 <span className={`text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded ${isActive ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                  {isActive ? 'Actif' : 'Indisponible'}
                </span>
                <span className="text-[11px] text-gray-400 font-medium">/ {service.category}</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-900 transition-colors p-1">
            <X size={22} strokeWidth={1.5} />
          </button>
        </div>

        {/* minimalist Body */}
        <div className="flex-1 overflow-y-auto custom-scroll p-6 space-y-10">
          
          {/* Key Metrics row */}
          <div className="grid grid-cols-2 gap-y-6 gap-x-4">
            {[
              { label: 'Mode', value: service.mode || 'Sur place' },
              { label: 'Délai approx.', value: `${service.processingDays || 5} jours` },
              { label: 'Municipalité', value: service.location?.municipality || 'Tunis' },
              { label: 'Horaires', value: hours.split(' · ')[1] || hours },
            ].map((item, i) => (
              <div key={i} className="min-w-0">
                <div className="text-[10px] text-gray-400 uppercase font-bold tracking-[0.1em] mb-1.5">{item.label}</div>
                <div className="text-[13px] font-semibold text-gray-800 truncate">{item.value}</div>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <h3 className="text-[11px] text-gray-400 uppercase font-bold tracking-[0.1em]">À propos du service</h3>
            <div className="text-[13.5px] text-gray-600 leading-relaxed font-normal">
              {service.description || "Consulter les bureaux municipaux pour plus de détails sur les pièces à fournir."}
            </div>
          </div>

          {/* Minimal QR section */}
          <div className="space-y-4 pt-2">
            <h3 className="text-[11px] text-gray-400 uppercase font-bold tracking-[0.1em]">Accès mobile</h3>
            <div className="flex items-center gap-4 rounded-xl p-4 bg-gray-50 border border-gray-100">
              <div className="bg-white p-1 rounded border border-gray-100 flex-none">
                {qrImg ? (
                  <img src={qrImg} alt="QR" className="w-12 h-12" />
                ) : (
                  <div className="w-12 h-12 bg-gray-50 flex items-center justify-center text-[8px] text-gray-300">QR</div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-bold text-gray-800">Passeport numérique</p>
                <p className="text-[11px] text-gray-500 mt-0.5 truncate">Suivez votre demande sur mobile.</p>
              </div>
              {qrImg && (
                <a href={qrImg} download className="text-gray-400 hover:text-primary transition-colors p-2">
                  <Download size={18} strokeWidth={1.5} />
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Minimalist Submission Footer */}
        {isActive && (
          <div className="p-3 border-t border-gray-50 bg-white">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[11px] text-gray-400 uppercase font-bold tracking-[0.1em] ml-1">
                  Observations / Notes
                </label>
                <textarea
                  className="w-full bg-gray-50 border border-transparent focus:border-gray-200 focus:bg-white rounded-xl px-4 py-3 text-[13px] text-gray-800 outline-none transition-all resize-none font-dm h-12"
                  placeholder="Notes optionnelles..."
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                />
              </div>
              <button 
                className="w-full h-12 bg-gray-900 text-white font-bold text-[14px] rounded-xl hover:bg-black active:scale-[0.99] transition-all flex items-center justify-center gap-2 group"
                onClick={handleDemand} 
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="animate-spin text-white/50" size={18} />
                ) : (
                  <>
                    Envoyer ma demande
                    <ChevronRight size={16} className="text-white/40 group-hover:text-white transition-colors" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

// ─── SVG Tunisia Map ──────────────────────────────────────────────────────────
function ServicesMap({ services }) {
  const [selectedSvc, setSelectedSvc] = useState('')
  const [hoveredRegion, setHoveredRegion] = useState(null)

  const svcNames = [...new Set(services.map(s => s.name))]

  const normalize = (s) =>
    (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()

  const getRegionStatus = (locationName) => {
    const normLoc = normalize(locationName)
    const rSvcs = services.filter(s => {
      const sRegion = normalize(s.location?.municipality || 'Tunis')
      return (sRegion === normLoc || sRegion.includes(normLoc) || normLoc.includes(sRegion)) && s.isActive !== false
    })
    const count = rSvcs.length
    const hasSelected = selectedSvc ? rSvcs.some(s => s.name === selectedSvc) : false
    return { count, hasSelected }
  }

  const getLocationClassName = (location) => {
    const status = getRegionStatus(location.name)
    const base = 'svg-map__location cursor-pointer outline-none transition-colors duration-300'
    if (selectedSvc) {
      return status.hasSelected
        ? base + ' !fill-[#10B981] hover:!fill-[#059669]'
        : base + ' !fill-[#EF4444] !opacity-60 hover:!opacity-85'
    }
    return status.count > 0
      ? base + ' !fill-[#3B82F6] !fill-opacity-50 hover:!fill-opacity-80'
      : base + ' !fill-[#CBD5E1] hover:!fill-[#94A3B8]'
  }

  return (
    <div className="bg-white border border-border rounded-card p-5 flex flex-col gap-5 h-full">
      <div>
        <h3 className="font-syne text-[16px] font-bold">🗺 Carte de disponibilité</h3>
      </div>

      <select
        value={selectedSvc}
        onChange={e => setSelectedSvc(e.target.value)}
        className="px-3 py-2 text-[13px] border-2 border-primary/20 rounded-[10px] bg-primary/5 text-primary font-bold outline-none cursor-pointer hover:bg-primary/10 transition-colors w-full"
      >
        <option value="">-- Sélectionner un service --</option>
        {svcNames.map(n => <option key={n} value={n}>{n}</option>)}
      </select>

      <div className="flex gap-4 text-[11px] font-semibold flex-wrap">
        {selectedSvc ? (
          <>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-[#10B981] inline-block" />Disponible</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-[#EF4444] inline-block" />Non disponible</span>
          </>
        ) : (
          <>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-[#3B82F6] opacity-60 inline-block" />Services actifs</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-[#CBD5E1] inline-block" />Aucun service</span>
          </>
        )}
      </div>

      <div className="relative flex-1 flex justify-center items-center overflow-hidden">
        <style>{`
          .svg-map { width: 100%; max-height: calc(100vh - 280px); height: auto; stroke: white; stroke-width: 0.8; }
          .svg-map__location:focus { outline: 2px solid #3B82F6; outline-offset: 1px; }
        `}</style>
        <div className="relative">
          <SVGMap
            map={Tunisia}
            locationClassName={getLocationClassName}
            onLocationMouseOver={e => {
              const name = e.target.getAttribute('name')
              setHoveredRegion({ name, ...getRegionStatus(name) })
            }}
            onLocationMouseOut={() => setHoveredRegion(null)}
          />
          {hoveredRegion && (
            <div className="absolute top-2 right-2 bg-white border border-border shadow-card p-3 rounded-[10px] pointer-events-none z-20 min-w-[140px]">
              <p className="font-syne font-bold text-[13px]">{hoveredRegion.name}</p>
              {selectedSvc ? (
                <span className={`mt-1 text-[10px] font-bold uppercase rounded px-2 py-0.5 inline-block ${hoveredRegion.hasSelected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                  {hoveredRegion.hasSelected ? '✓ Disponible' : '✗ Non dispo'}
                </span>
              ) : (
                <p className="text-[11.5px] text-t3 mt-0.5">{hoveredRegion.count} service{hoveredRegion.count !== 1 ? 's' : ''}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CitizenServicesPage({ services = [], onDemandSubmitted }) {
  const [search, setSearch] = useState('')
  const [catFilter, setCat] = useState('')
  const [modeFilter, setMode] = useState('')
  const [selected, setSelected] = useState(null)
  const [detailOpen, setDetail] = useState(false)

  const CATEGORIES = [...new Set(services.map(s => s.category).filter(Boolean))]

  const filtered = services.filter(s => {
    const q = search.toLowerCase()
    const matchQ = !q || s.name?.toLowerCase().includes(q) || s.description?.toLowerCase().includes(q) || s.category?.toLowerCase().includes(q)
    const matchC = !catFilter || s.category === catFilter
    const matchM = !modeFilter || s.mode === modeFilter
    return matchQ && matchC && matchM
  })

  function openDetail(svc) {
    setSelected(svc)
    setDetail(true)
  }

  // Group filtered services by category
  const grouped = filtered.reduce((acc, s) => {
    const cat = s.category || 'Autre'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(s)
    return acc
  }, {})

  return (
    <div className="animate-fade-up h-[calc(100vh-112px)] flex flex-col overflow-hidden px-1">
      {/* ── Two-column: categories left, map right ── */}
      <div className="flex flex-col xl:flex-row gap-6 items-start relative h-full">

        {/* LEFT – Main Content (Search + Categories) */}
        <div className="flex-1 min-w-0 flex flex-col w-full h-full">

          {/* Search + Filters (fixed block) */}
          <div className="flex flex-wrap gap-2 mb-4 shrink-0 bg-[#fbfafe]">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-t3" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher un service…"
                className="w-full pl-8 pr-3 py-2 text-[13px] border border-border rounded-btn bg-white outline-none focus:ring-2 focus:ring-primary/20 font-dm shadow-sm"
              />
            </div>
            <select value={catFilter} onChange={e => setCat(e.target.value)}
              className="px-3 py-2 text-[13px] border border-border rounded-btn bg-white outline-none font-dm cursor-pointer shadow-sm">
              <option value="">Toutes catégories</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{CAT_CONFIG[c]?.emoji} {c}</option>)}
            </select>
            <select value={modeFilter} onChange={e => setMode(e.target.value)}
              className="px-3 py-2 text-[13px] border border-border rounded-btn bg-white outline-none font-dm cursor-pointer shadow-sm">
              <option value="">Tous les modes</option>
              <option value="En ligne">🌐 En ligne</option>
              <option value="Presentiel">🏛️ Présentiel</option>
              <option value="Hybride">🔀 Hybride</option>
            </select>
            {(search || catFilter || modeFilter) && (
              <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setCat(''); setMode('') }}>
                <X size={13} /> Effacer
              </Button>
            )}
          </div>

          {/* Categories Grid (Scrollable Box) */}
          <div className="flex-1 overflow-y-auto custom-scroll pr-3 pb-12">
            {filtered.length === 0 ? (
              <div className="text-center py-16 text-t3">
                <Search size={36} className="mx-auto mb-3 opacity-25" />
                <p className="font-medium text-[14px]">Aucun service trouvé</p>
                <p className="text-[13px] mt-1">Modifiez vos critères de recherche</p>
              </div>
            ) : (
              <div className="columns-1 md:columns-2 gap-[5px] w-full">
                {Object.entries(grouped).map(([catName, catSvcs]) => {
                  const cfg = CAT_CONFIG[catName] || CAT_CONFIG['Autre']
                  return (
                    <div key={catName} className="rounded-[16px] border-2 p-5 mb-[5px] break-inside-avoid w-full inline-block"
                      style={{ backgroundColor: cfg.bg, borderColor: cfg.border }}>
                      <div className="flex items-center gap-3 mb-5">
                        <div className="w-11 h-11 flex items-center justify-center text-xl rounded-[10px] bg-white shadow-sm border border-border shrink-0">
                          {cfg.emoji}
                        </div>
                        <div>
                          <h2 className="font-syne text-[16px] font-bold" style={{ color: cfg.color }}>{catName}</h2>
                          <p className="text-[11.5px] font-semibold" style={{ color: cfg.color + 'AA' }}>
                            {catSvcs.length} service{catSvcs.length > 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col gap-4">
                        {catSvcs.map(s => {
                          const sid = s._id || s.id
                          const avail = s.isActive !== false
                          const hours = s.schedule
                            ? `${s.schedule.days || 'Lun-Ven'} · ${s.schedule.openTime || '08:00'}–${s.schedule.closeTime || '16:00'}`
                            : '—'
                          const avg = s.stats?.avgRating ?? 0
                          return (
                            <div key={sid}
                              className={`bg-white border border-border shadow-sm rounded-card p-4 hover:shadow-card hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col ${!avail ? 'opacity-70' : ''}`}
                              style={{ borderBottomWidth: '4px', borderBottomColor: cfg.color }}
                              onClick={() => openDetail(s)}
                            >
                              <div className="flex items-start justify-between gap-2 mb-3">
                                <div className="flex-1 min-w-0">
                                  <h3 className="font-syne text-[13.5px] font-bold truncate">{s.name}</h3>
                                  <p className="text-[11.5px] text-t3 mt-0.5">{s.mode || 'Presentiel'}</p>
                                </div>
                                <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full shrink-0 ${avail ? 'bg-green-100 text-green-700' : 'bg-muted text-t3'}`}>
                                  {avail ? 'Actif' : 'Inactif'}
                                </span>
                              </div>
                              {s.description && <p className="text-[12px] text-t2 line-clamp-2 flex-1 mb-3">{s.description}</p>}
                              <div className="mt-auto space-y-1.5">
                                {avg > 0 && (
                                  <div className="flex items-center gap-1.5">
                                    <StarRating value={avg} size={12} />
                                    <span className="text-[11px] text-t3">{avg.toFixed(1)}</span>
                                  </div>
                                )}
                                <div className="flex items-center gap-1.5 text-[11.5px] text-t3">
                                  <Clock size={11} className="shrink-0" />{hours}
                                </div>
                                <div className="flex items-center gap-1.5 text-[11.5px] text-t3">
                                  <MapPin size={11} className="shrink-0" />{s.location?.municipality || 'Tunis'}
                                </div>
                              </div>
                              <div className="flex items-center justify-end mt-3 pt-2 border-t border-border">
                                <span className="flex items-center gap-1 text-[11.5px] font-bold" style={{ color: cfg.color }}>
                                  Voir détails <ChevronRight size={13} />
                                </span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT – Tunisia SVG map (fixed alongside) */}
        {services.length > 0 && (
          <div className="w-full xl:w-[280px] shrink-0 h-full z-0 hidden xl:flex items-start">
            <div className="w-full">
              <ServicesMap services={services} />
            </div>
          </div>
        )}
      </div>

      {/* Detail Panel */}
      <ServiceDetailPanel
        service={selected}
        open={detailOpen}
        onClose={() => setDetail(false)}
        onSubmitDemand={onDemandSubmitted}
      />
    </div>
  )
}
