import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Upload, Sparkles, Loader2, MapPin,
  CheckCircle, X, AlertCircle, FileText, Navigation,
  LayoutDashboard, Bell, Globe, Plus, ClipboardCheck, Settings,
} from 'lucide-react'
import { aiAPI, reclamationsAPI } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../hooks/useToast'
import AppShell from '../../components/shared/AppShell'
import { Card, CardHeader, CardTitle, CardBody } from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import ProgressBar from '../../components/ui/ProgressBar'
import { PageLoader } from '../../components/ui/Skeleton'

// ── Constants ────────────────────────────────────────────
const CATEGORIES = [
  'Eclairage public',
  'Voirie & Routes',
  'Propreté & Déchets',
  'Espaces verts',
  'Eau & Assainissement',
  'Signalisation',
  'Bâtiments publics',
  'Transports',
  'Autre',
]

const URGENCY = {
  Critical: { bg:'bg-red-50', text:'text-red-600', border:'border-red-200', bar:'#E24B4A', label:'🔴 Critique' },
  High:     { bg:'bg-amber-50', text:'text-amber-700', border:'border-amber-200', bar:'#B8760D', label:'🟠 Élevée' },
  Medium:   { bg:'bg-blue-50', text:'text-blue-700', border:'border-blue-200', bar:'#1A3C6B', label:'🔵 Modérée' },
  Low:      { bg:'bg-green-50', text:'text-green-700', border:'border-green-200', bar:'#1D8C5E', label:'🟢 Faible' },
}

const TUNISIA_CENTER = [36.8065, 10.1815]
const TUNISIA_BOUNDS = [[30.2, 7.5], [37.7, 11.8]]

// ── Field wrapper ────────────────────────────────────────
function Field({ label, required, error, hint, children }) {
  return (
    <div>
      <label className="block text-[12px] font-semibold text-t2 uppercase tracking-[0.06em] mb-1.5">
        {label}{required && <span className="text-danger ml-0.5">*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-[11.5px] text-t3 mt-1 leading-snug">{hint}</p>}
      {error && (
        <p className="flex items-center gap-1 text-[11.5px] text-danger mt-1.5 font-medium animate-fade-up">
          <AlertCircle size={11} className="shrink-0"/>{error}
        </p>
      )}
    </div>
  )
}

const cls = (err) =>
  `w-full bg-surface-2 border-[1.5px] rounded-btn px-3.5 py-2.5 text-[13.5px] text-t1 font-dm outline-none transition-all focus:bg-white focus:shadow-[0_0_0_3px_rgba(26,60,107,0.09)] ${
    err ? 'border-danger bg-red-50/40 focus:border-danger' : 'border-border-2 focus:border-primary-light'
  }`

// ── Tunisia Map Component ─────────────────────────────────
function TunisiaMap({ coords, onPick }) {
  const mapRef   = useRef(null)
  const leafRef  = useRef(null)
  const markerRef = useRef(null)

  useEffect(() => {
    if (leafRef.current) return

    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link')
      link.id   = 'leaflet-css'
      link.rel  = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(link)
    }

    const script = document.createElement('script')
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    script.onload = () => {
      const L = window.L
      if (!mapRef.current || leafRef.current) return

      const map = L.map(mapRef.current, {
        center: TUNISIA_CENTER,
        zoom: 8,
        maxBounds: TUNISIA_BOUNDS,
        maxBoundsViscosity: 0.8,
      })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 19,
      }).addTo(map)

      const icon = L.divIcon({
        className: '',
        html: `<div style="
          width:32px;height:32px;border-radius:50% 50% 50% 0;
          background:#1A3C6B;border:3px solid white;
          box-shadow:0 2px 8px rgba(0,0,0,0.3);
          transform:rotate(-45deg);
        "></div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
      })

      map.on('click', (e) => {
        const { lat, lng } = e.latlng
        if (markerRef.current) map.removeLayer(markerRef.current)
        markerRef.current = L.marker([lat, lng], { icon }).addTo(map)
          .bindPopup(`📍 ${lat.toFixed(5)}, ${lng.toFixed(5)}`).openPopup()
        onPick({ lat, lng })
      })

      leafRef.current = { map, L, icon }

      if (coords) {
        markerRef.current = L.marker([coords.lat, coords.lng], { icon }).addTo(map)
        map.setView([coords.lat, coords.lng], 13)
      }
    }
    document.body.appendChild(script)

    return () => {
      if (leafRef.current) {
        leafRef.current.map.remove()
        leafRef.current = null
        markerRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!leafRef.current || !coords) return
    const { map, L, icon } = leafRef.current
    if (markerRef.current) map.removeLayer(markerRef.current)
    markerRef.current = L.marker([coords.lat, coords.lng], { icon }).addTo(map)
      .bindPopup(`📍 ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`).openPopup()
    map.setView([coords.lat, coords.lng], 14)
  }, [coords?.lat, coords?.lng])

  return (
    <div
      ref={mapRef}
      style={{ height: 280, borderRadius: 10, overflow: 'hidden', border: '1.5px solid #DDE3EE' }}
    />
  )
}

// ── Navigation items (matching dashboard structure) ─────────
const NAV_ITEMS = [
  {
    label: 'Principal',
    items: [
      { section: 'dashboard', label: 'Tableau de bord', icon: <LayoutDashboard size={15} /> },
    ],
  },
  {
    label: 'Réclamations',
    items: [
      { section: 'reclamations', label: 'Mes réclamations', icon: <FileText size={15} />, badge: 0 },
      { section: 'signal', label: 'Nouveau signalement', icon: <Plus size={15} /> },
      { href: '/user/history', label: 'Historique & PDF', icon: <FileText size={15} /> },
    ],
  },
  {
    label: 'Services',
    items: [
      { section: 'services', label: 'Services municipaux', icon: <Settings size={15} /> },
      { section: 'demandes', label: 'Mes demandes', icon: <ClipboardCheck size={15} />, badge: 0 },
    ],
  },
  {
    label: 'Communauté',
    items: [
      { section: 'notifications', label: 'Notifications', icon: <Bell size={15} />, badge: 0, badgeRed: true },
      { href: '/public-feed', label: 'Feed public', icon: <Globe size={15} /> },
    ],
  },
]

// ════════════════════════════════════════════════════════
export default function UserSignal() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { toast, toasts } = useToast()

  // Form state
  const [form, setForm] = useState({
    category: '', title: '', description: '', address: '',
  })
  const [errors, setErrors]   = useState({})
  const [photos, setPhotos]   = useState([])
  const [coords, setCoords]   = useState(null)
  const [geoLoading, setGeoLoading] = useState(false)

  // AI state
  const [aiState,  setAiState]  = useState('idle')
  const [aiResult, setAiResult] = useState(null)
  const descTimer = useRef(null)

  // Submit state
  const [submitting,   setSubmitting]   = useState(false)
  const [submitError,  setSubmitError]  = useState('')
  const [submitted,    setSubmitted]    = useState(false)
  const [savedRec,     setSavedRec]     = useState(null)

  // Sidebar user object
  const sidebarUser = {
    name: `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Citoyen',
    shortName: user?.firstName || 'Citoyen',
    color: '#E8873A',
    role: 'Citoyen',
  }

  // ── AI debounce ──────────────────────────────────────
  useEffect(() => {
    clearTimeout(descTimer.current)
    const desc = form.description.trim()
    if (desc.length < 20) { setAiState('idle'); setAiResult(null); return }
    setAiState('loading'); setAiResult(null)
    descTimer.current = setTimeout(async () => {
      try {
        const res = await aiAPI.predict(desc, form.category)
        setAiResult(res); setAiState('done')
      } catch { setAiState('error') }
    }, 1200)
    return () => clearTimeout(descTimer.current)
  }, [form.description, form.category])

  // ── Geolocation ──────────────────────────────────────
  function locateMe() {
    if (!navigator.geolocation) return
    setGeoLoading(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords
        setCoords({ lat, lng })
        fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`)
          .then(r => r.json())
          .then(d => {
            const addr = d.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`
            setForm(f => ({ ...f, address: addr }))
            setErrors(e => ({ ...e, location: '' }))
          })
          .catch(() => setForm(f => ({ ...f, address: `${lat.toFixed(5)}, ${lng.toFixed(5)}` })))
          .finally(() => setGeoLoading(false))
      },
      () => setGeoLoading(false),
      { timeout: 8000 }
    )
  }

  // ── Map click handler ────────────────────────────────
  const handleMapPick = useCallback(({ lat, lng }) => {
    setCoords({ lat, lng })
    setErrors(e => ({ ...e, location: '' }))
    fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`)
      .then(r => r.json())
      .then(d => {
        const addr = d.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`
        setForm(f => ({ ...f, address: addr }))
      })
      .catch(() => {})
  }, [])

  // ── Photos ───────────────────────────────────────────
  function handlePhoto(e) {
    const files = Array.from(e.target.files).filter(f => f.type.startsWith('image/'))
    const previews = files.map(f => ({
      name: f.name, url: URL.createObjectURL(f), file: f, size: f.size,
    }))
    setPhotos(prev => [...prev, ...previews].slice(0, 5))
  }
  function removePhoto(i) { setPhotos(prev => prev.filter((_, j) => j !== i)) }

  // ── Validation ───────────────────────────────────────
  function validate() {
    const e = {}
    if (!form.category)               e.category    = 'Sélectionnez une catégorie.'
    if (!form.title.trim())           e.title       = 'Le titre est obligatoire.'
    else if (form.title.length < 5)   e.title       = 'Min. 5 caractères.'
    if (!form.description.trim())     e.description = 'La description est obligatoire.'
    else if (form.description.length < 20) e.description = 'Min. 20 caractères.'
    if (!coords && !form.address.trim()) e.location = 'Indiquez une adresse ou cliquez sur la carte.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  // ── Submit ───────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault()
    if (!validate()) return
    setSubmitting(true); setSubmitError('')

    try {
      const data = {
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category,
        'location[address]': form.address.trim() || (coords ? `${coords.lat},${coords.lng}` : ''),
        'location[municipality]': user?.municipality || 'Tunis',
      }
      if (coords) {
        data['location[coordinates][0]'] = coords.lng
        data['location[coordinates][1]'] = coords.lat
      }
      const files = photos.map(p => p.file).filter(Boolean)
      const res = await reclamationsAPI.create(data, files)
      setSavedRec(res.data)
      setSubmitted(true)
      toast('Réclamation soumise avec succès !', 'ok')
    } catch (err) {
      setSubmitError(err.response?.data?.message || 'Erreur lors de la soumission. Réessayez.')
      toast('Erreur lors de la soumission', 'err')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Reset after success ──────────────────────────────
  function reset() {
    setSubmitted(false); setSavedRec(null)
    setForm({ category:'', title:'', description:'', address:'' })
    setPhotos([]); setCoords(null)
    setAiResult(null); setAiState('idle')
    setErrors({}); setSubmitError('')
  }

  const urgencyStyle = aiResult ? URGENCY[aiResult.urgency_level] : null
  const recId = savedRec?._id ? String(savedRec._id).slice(-6).toUpperCase() : '——'

  // ── Sidebar section change handler ───────────────────
  const handleSectionChange = (section) => {
    if (section === 'signal') return // stay on this page
    if (section === 'dashboard') {
      navigate('/user/dashboard')
    } else {
      // For other sections, navigate to dashboard with section query param
      navigate(`/user/dashboard?section=${section}`)
    }
  }

  // ── Success screen ───────────────────────────────────
  if (submitted) {
    return (
      <AppShell
        role="user"
        navItems={NAV_ITEMS}
        user={sidebarUser}
        activeSection="signal"
        onSectionChange={handleSectionChange}
        topTitle="Réclamation soumise"
        topBreadcrumb="Merci pour votre contribution"
        notifCount={0}
        toasts={toasts}
      >
        <div className="flex items-center justify-center min-h-[calc(100vh-58px)]">
          <div className="bg-white rounded-card border border-border p-8 max-w-md w-full text-center animate-fade-up shadow-card">
            <div className="w-16 h-16 bg-success-light rounded-full flex items-center justify-center mx-auto mb-5 animate-pop-in">
              <CheckCircle size={32} className="text-success"/>
            </div>
            <h2 className="font-syne text-2xl font-bold text-t1 mb-2">Réclamation soumise !</h2>
            <p className="text-[13.5px] text-t3 mb-1">Référence : <span className="font-bold text-primary">#{recId}</span></p>
            <p className="text-[13px] text-t3 mb-5 leading-relaxed">
              Votre réclamation a été enregistrée et analysée par notre IA. Un agent municipal sera assigné sous peu.
            </p>

            {aiResult && (() => {
              const s = URGENCY[aiResult.urgency_level]
              return s ? (
                <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-[13px] font-semibold mb-5 border ${s.bg} ${s.text} ${s.border}`}>
                  <Sparkles size={13}/> Urgence IA : {s.label}
                  <span className="text-[11px] font-normal opacity-70 ml-1">
                    {Math.round((aiResult.confidence||0)*100)}% confiance
                  </span>
                </div>
              ) : null
            })()}

            {aiResult?.reason && (
              <p className="text-[12.5px] text-t3 mb-5 italic">"{aiResult.reason}"</p>
            )}

            <div className="flex gap-3 justify-center">
              <button onClick={() => navigate('/user/dashboard')}
                className="px-5 py-2.5 bg-primary text-white text-[13.5px] font-semibold rounded-btn hover:shadow-btn-primary transition-all">
                Mon tableau de bord
              </button>
              <button onClick={reset}
                className="px-5 py-2.5 bg-white text-t2 text-[13.5px] font-semibold rounded-btn border border-border-2 hover:bg-muted transition-all">
                Nouvelle réclamation
              </button>
            </div>
          </div>
        </div>
      </AppShell>
    )
  }

  // ── Main form layout with AppShell ────────────────────
  return (
    <AppShell
      role="user"
      navItems={NAV_ITEMS}
      user={sidebarUser}
      activeSection="signal"
      onSectionChange={handleSectionChange}
      topTitle="Nouveau signalement"
      topBreadcrumb="Soumettre une réclamation"
      notifCount={0}
      toasts={toasts}
    >
      <div className="max-w-[960px] mx-auto p-4 lg:p-6">
        {submitError && (
          <div className="flex items-start gap-3 px-4 py-3.5 bg-danger-light text-danger border border-danger/20 rounded-[10px] text-[13.5px] mb-5 animate-fade-up">
            <AlertCircle size={16} className="shrink-0 mt-0.5"/>
            <span>{submitError}</span>
            <button onClick={() => setSubmitError('')} className="ml-auto shrink-0"><X size={14}/></button>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_310px] gap-5">

            {/* ═══ LEFT COLUMN ═══ */}
            <div className="space-y-4">

              {/* Info card */}
              <div className="bg-white border border-border rounded-card">
                <div className="px-5 py-4 border-b border-border">
                  <h2 className="font-syne text-[14px] font-bold flex items-center gap-2">
                    <FileText size={15} className="text-primary"/> Informations
                  </h2>
                </div>
                <div className="p-5 space-y-4">

                  <Field label="Catégorie" required error={errors.category}>
                    <select value={form.category} className={cls(errors.category)}
                      onChange={e => { setForm(f => ({...f, category:e.target.value})); setErrors(p=>({...p,category:''})) }}>
                      <option value="">— Choisissez une catégorie —</option>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </Field>

                  <Field label="Titre du problème" required error={errors.title}
                    hint="Court et précis — ex: Lampadaire cassé Rue Ibn Khaldoun">
                    <input type="text" value={form.title} maxLength={120} placeholder="Décrivez en une phrase…"
                      className={cls(errors.title)}
                      onChange={e => { setForm(f => ({...f, title:e.target.value})); setErrors(p=>({...p,title:''})) }}/>
                    <p className="text-[11px] text-t3 text-right mt-0.5">{form.title.length}/120</p>
                  </Field>

                  <Field label="Description détaillée" required error={errors.description}
                    hint="Min. 20 caractères — l'IA analyse votre texte en temps réel">
                    <textarea value={form.description} rows={5} maxLength={2000}
                      placeholder="Depuis quand, fréquence, impact sur les habitants, risques…"
                      className={`${cls(errors.description)} resize-y min-h-[120px]`}
                      onChange={e => { setForm(f => ({...f, description:e.target.value})); setErrors(p=>({...p,description:''})) }}/>
                    <div className="flex justify-between mt-0.5">
                      <span className={`text-[11px] ${form.description.length < 20 ? 'text-danger' : 'text-t3'}`}>
                        {form.description.length}/20 min
                      </span>
                      <span className="text-[11px] text-t3">{form.description.length}/2000</span>
                    </div>

                    {(aiState === 'loading' || aiState === 'done' || aiState === 'error') && (
                      <div className={`mt-3 flex items-start gap-3 px-3.5 py-3 rounded-[10px] border transition-all ${
                        aiState === 'loading' ? 'bg-muted border-border' :
                        aiState === 'error'   ? 'bg-red-50 border-red-200' :
                        urgencyStyle ? `${urgencyStyle.bg} ${urgencyStyle.border}` : 'bg-muted border-border'
                      }`}>
                        <span className={`shrink-0 mt-0.5 ${aiState==='loading'?'text-t3':urgencyStyle?.text||'text-t3'}`}>
                          {aiState === 'loading' ? <Loader2 size={15} className="animate-spin"/> : <Sparkles size={15}/>}
                        </span>
                        <div className={`flex-1 min-w-0 ${urgencyStyle?.text||'text-t3'}`}>
                          {aiState === 'loading' && <p className="text-[13px] font-medium text-t3">Analyse IA en cours…</p>}
                          {aiState === 'error'   && <p className="text-[13px] text-red-500">IA hors ligne — urgence déterminée manuellement.</p>}
                          {aiState === 'done' && aiResult && (
                            <>
                              <p className="text-[13px] font-semibold">
                                {urgencyStyle?.label || aiResult.urgency_level}
                                <span className="ml-2 text-[11.5px] font-normal opacity-70">
                                  ({Math.round((aiResult.confidence||0)*100)}% de confiance)
                                </span>
                              </p>
                              {aiResult.reason && (
                                <p className="text-[12px] opacity-75 mt-0.5 leading-snug">{aiResult.reason}</p>
                              )}
                              <div className="mt-2 h-1.5 bg-white/50 rounded-full overflow-hidden">
                                <div className="h-full rounded-full transition-all duration-700"
                                  style={{ width:`${Math.round((aiResult.confidence||0)*100)}%`, background: urgencyStyle?.bar || '#1A3C6B' }}/>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </Field>
                </div>
              </div>

              {/* Map card */}
              <div className="bg-white border border-border rounded-card">
                <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                  <h2 className="font-syne text-[14px] font-bold flex items-center gap-2">
                    <MapPin size={15} className="text-primary"/> Localisation
                  </h2>
                  <button type="button" onClick={locateMe} disabled={geoLoading}
                    className="flex items-center gap-1.5 text-[12px] text-primary font-medium hover:underline disabled:opacity-50">
                    {geoLoading ? <Loader2 size={13} className="animate-spin"/> : <Navigation size={13}/>}
                    Ma position
                  </button>
                </div>
                <div className="p-5 space-y-3">
                  <Field label="Adresse" required error={errors.location}
                    hint="Cliquez sur la carte pour sélectionner le lieu exact">
                    <div className="relative">
                      <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-t3 pointer-events-none"/>
                      <input type="text" value={form.address} placeholder="Ex : 14 Rue de la République, Tunis"
                        className={`${cls(errors.location)} pl-8`}
                        onChange={e => { setForm(f => ({...f, address:e.target.value})); setErrors(p=>({...p,location:''})) }}/>
                    </div>
                  </Field>
                  <TunisiaMap coords={coords} onPick={handleMapPick}/>
                  {coords && (
                    <p className="text-[11.5px] text-success flex items-center gap-1.5">
                      <CheckCircle size={12}/> Position sélectionnée : {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
                    </p>
                  )}
                  {!coords && (
                    <p className="text-[11.5px] text-t3 text-center">
                      Cliquez sur la carte pour placer un marqueur précis
                    </p>
                  )}
                </div>
              </div>

              {/* Photos card */}
              <div className="bg-white border border-border rounded-card">
                <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                  <h2 className="font-syne text-[14px] font-bold flex items-center gap-2">
                    <Upload size={15} className="text-primary"/> Photos
                  </h2>
                  <span className="text-[12px] text-t3">{photos.length}/5</span>
                </div>
                <div className="p-5">
                  {photos.length < 5 && (
                    <label className="block border-2 border-dashed border-border-2 rounded-[10px] p-6 text-center cursor-pointer hover:border-primary-light hover:bg-primary/5 transition-all">
                      <Upload size={24} className="mx-auto text-t3 mb-2"/>
                      <p className="text-[13.5px] text-t2">
                        <span className="text-primary font-semibold">Cliquez</span> ou glissez vos photos
                      </p>
                      <p className="text-[11.5px] text-t3 mt-1">JPG, PNG, WEBP — max 5 Mo par photo</p>
                      <input type="file" accept="image/*" multiple className="hidden" onChange={handlePhoto}/>
                    </label>
                  )}
                  {photos.length > 0 && (
                    <div className={`grid grid-cols-3 sm:grid-cols-5 gap-2 ${photos.length < 5 ? 'mt-3' : ''}`}>
                      {photos.map((p, i) => (
                        <div key={i} className="relative group aspect-square">
                          <img src={p.url} alt={p.name}
                            className="w-full h-full object-cover rounded-[8px] border border-border"/>
                          <button type="button" onClick={() => removePhoto(i)}
                            className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-danger rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity shadow-md">
                            <X size={11}/>
                          </button>
                          <span className="absolute bottom-1 right-1 text-[9px] bg-black/50 text-white rounded px-1">
                            {(p.size/1024).toFixed(0)}k
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ═══ RIGHT COLUMN ═══ */}
<div className="space-y-4 lg:sticky lg:top-6 self-start">
  {/* Summary card */}
  <div className="bg-white border border-border rounded-card">
    <div className="px-5 py-4 border-b border-border">
      <h2 className="font-syne text-[14px] font-bold">Récapitulatif</h2>
    </div>
    <div className="p-5 space-y-3">
      {[
        ['Citoyen',   `${user?.firstName||''} ${user?.lastName||''}`.trim() || '—'],
        ['Catégorie', form.category || '—'],
        ['Localisation', coords ? '📍 Sélectionnée' : form.address ? '✏️ Adresse saisie' : '—'],
        ['Photos',    `${photos.length} photo${photos.length!==1?'s':''}`],
        ['Urgence IA',
          aiState === 'loading' ? '⏳ Analyse…' :
          aiState === 'done' && aiResult && urgencyStyle ? urgencyStyle.label :
          aiState === 'error' ? '⚠ IA hors ligne' : '—'
        ],
      ].map(([k, v]) => (
        <div key={k} className="flex justify-between items-start text-[13px] gap-2">
          <span className="text-t3 shrink-0">{k}</span>
          <span className="font-semibold text-right max-w-[160px] truncate">{v}</span>
        </div>
      ))}

      {aiState === 'done' && aiResult && urgencyStyle && (
        <div className="pt-1">
          <div className="flex justify-between text-[11px] mb-1">
            <span className="text-t3">Confiance IA</span>
            <span className={`font-bold ${urgencyStyle.text}`}>
              {Math.round((aiResult.confidence||0)*100)}%
            </span>
          </div>
          <div className="w-full h-2 bg-border rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width:`${Math.round((aiResult.confidence||0)*100)}%`, background: urgencyStyle.bar }}/>
          </div>
        </div>
      )}

      <div className="pt-2 space-y-2">
        <button type="submit" disabled={submitting}
          className="w-full flex items-center justify-center gap-2 bg-accent text-white font-semibold text-[14px] py-3 rounded-btn hover:shadow-btn-accent hover:-translate-y-px transition-all disabled:opacity-60 disabled:pointer-events-none">
          {submitting
            ? <><Loader2 size={14} className="animate-spin"/> Envoi en cours…</>
            : <><CheckCircle size={14}/> Soumettre la réclamation</>
          }
        </button>
        <button type="button" onClick={() => navigate('/user/dashboard')}
          className="w-full py-2.5 text-[13.5px] font-medium text-t2 bg-white border border-border-2 rounded-btn hover:bg-muted transition-all">
          Annuler
        </button>
      </div>
    </div>
  </div>

  {/* How it works */}
  <div className="bg-primary/8 border border-primary/20 rounded-[10px] p-4">
    <p className="flex items-center gap-2 font-semibold text-[13px] text-primary mb-3">
      <Sparkles size={13}/> Comment ça marche ?
    </p>
    {[
      ['1.', 'Décrivez le problème — l\'IA analyse l\'urgence automatiquement'],
      ['2.', 'Localisez sur la carte de Tunisie pour un suivi précis'],
      ['3.', 'Ajoutez des photos comme preuve visuelle'],
      ['4.', 'Un agent est assigné et vous recevez des notifications'],
    ].map(([n, t]) => (
      <p key={n} className="text-[12.5px] text-t2 leading-relaxed mb-1">
        <span className="font-bold text-primary">{n}</span> {t}
      </p>
    ))}
  </div>
</div>

          </div>
        </form>
      </div>
    </AppShell>
  )
}