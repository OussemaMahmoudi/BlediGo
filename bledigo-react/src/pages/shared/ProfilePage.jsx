import { useState, useEffect, useRef } from 'react'
import {
  User, Mail, Phone, MapPin, Building2, Shield,
  Lock, Eye, EyeOff, CheckCircle, AlertCircle,
  Edit3, Save, X, Camera, Loader2, Key,
  BadgeCheck, Calendar, Star, FileText, ClipboardCheck,
} from 'lucide-react'
import { profileAPI } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import Avatar from '../../components/ui/Avatar'

// ── Helpers ───────────────────────────────────────────────
const safe = (v, fb = '—') => (v != null && String(v).trim()) ? String(v) : fb

const ROLE_META = {
  Citoyen: { label: 'Citoyen',             color: '#1A3C6B', bg: '#EEF3FB' },
  Agent:   { label: 'Agent Municipal',      color: '#1D8C5E', bg: '#E1F5EE' },
  Admin:   { label: 'Administrateur',       color: '#B8760D', bg: '#FEF3DB' },
}

const AVATAR_COLORS = [
  '#1A3C6B','#E8873A','#1D8C5E','#B8760D','#7C3AED','#DB2777','#0891B2','#059669',
]

// ── Input field ───────────────────────────────────────────
function Field({ label, icon: Icon, error, success, children, required }) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-[11.5px] font-bold text-t2 uppercase tracking-wider mb-1.5">
        {Icon && <Icon size={11}/>}{label}
        {required && <span className="text-danger">*</span>}
      </label>
      {children}
      {error && (
        <p className="flex items-center gap-1 mt-1.5 text-[11.5px] text-danger font-medium">
          <AlertCircle size={10}/>{error}
        </p>
      )}
      {!error && success && (
        <p className="flex items-center gap-1 mt-1.5 text-[11.5px] text-success font-medium">
          <CheckCircle size={10}/>{success}
        </p>
      )}
    </div>
  )
}

function Input({ value, onChange, type = 'text', placeholder, disabled, error, right, ...rest }) {
  return (
    <div className="relative">
      <input
        type={type} value={value} onChange={onChange} placeholder={placeholder}
        disabled={disabled} {...rest}
        className={`w-full px-3.5 py-2.5 rounded-[10px] border-[1.5px] text-[13.5px] font-dm outline-none transition-all
          ${disabled
            ? 'bg-surface-2 border-border text-t3 cursor-not-allowed'
            : error
              ? 'bg-red-50/40 border-danger focus:border-danger focus:shadow-[0_0_0_3px_rgba(226,75,74,0.1)]'
              : 'bg-surface-2 border-border-2 focus:border-primary-light focus:bg-white focus:shadow-[0_0_0_3px_rgba(26,60,107,0.09)]'
          }
          ${right ? 'pr-10' : ''}
        `}
      />
      {right && <div className="absolute right-3 top-1/2 -translate-y-1/2">{right}</div>}
    </div>
  )
}

// ── Section card ──────────────────────────────────────────
function Section({ title, icon: Icon, children, action }) {
  return (
    <div className="bg-white border border-border rounded-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <h3 className="font-syne text-[14px] font-bold flex items-center gap-2">
          {Icon && <Icon size={15} className="text-primary"/>}{title}
        </h3>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

// ── Stat pill ─────────────────────────────────────────────
function StatPill({ icon: Icon, label, value, color = '#1A3C6B' }) {
  return (
    <div className="flex items-center gap-3 p-3.5 rounded-[10px] border border-border bg-surface-2">
      <div className="w-9 h-9 rounded-[9px] flex items-center justify-center shrink-0"
        style={{ background: color + '18' }}>
        <Icon size={16} style={{ color }}/>
      </div>
      <div>
        <div className="font-syne text-[18px] font-bold" style={{ color }}>{value}</div>
        <div className="text-[11px] text-t3">{label}</div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════
export default function ProfilePage({ onClose, userStats = {} }) {
  const { user: authUser, refreshUser } = useAuth()
  const role     = authUser?.role || 'Citoyen'
  const roleMeta = ROLE_META[role] || ROLE_META.Citoyen

  // Profile state
  const [profile,     setProfile]    = useState(null)
  const [loading,     setLoading]    = useState(true)
  const [editing,     setEditing]    = useState(false)
  const [saving,      setSaving]     = useState(false)
  const [saveMsg,     setSaveMsg]    = useState('')
  const [saveErr,     setSaveErr]    = useState('')
  const [form,        setForm]       = useState({})
  const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0])

  // Password state
  const [pwMode,   setPwMode]   = useState(false)
  const [pw,       setPw]       = useState({ current:'', next:'', confirm:'' })
  const [showPw,   setShowPw]   = useState({ current:false, next:false, confirm:false })
  const [pwSaving, setPwSaving] = useState(false)
  const [pwMsg,    setPwMsg]    = useState('')
  const [pwErr,    setPwErr]    = useState('')

  // Load profile
  useEffect(() => {
    profileAPI.getMe()
      .then(r => {
        const d = r.data || r
        setProfile(d)
        setForm({
          firstName:      d.firstName || '',
          lastName:       d.lastName  || '',
          phone:          d.phone     || '',
          municipality:   d.municipality || '',
          cin:            d.cin       || '',
          department:     d.department || '',
          specialization: Array.isArray(d.specialization) ? d.specialization.join(', ') : '',
          bio:            d.bio       || '',
        })
        setAvatarColor(AVATAR_COLORS[d.firstName?.charCodeAt(0) % AVATAR_COLORS.length] || AVATAR_COLORS[0])
      })
      .catch(() => setProfile(authUser))
      .finally(() => setLoading(false))
  }, []) // eslint-disable-line

  function set(k, v) { setForm(p => ({ ...p, [k]: v })) }

  async function handleSave() {
    setSaving(true); setSaveMsg(''); setSaveErr('')
    try {
      const payload = { ...form }
      if (payload.specialization && typeof payload.specialization === 'string') {
        payload.specialization = payload.specialization.split(',').map(s => s.trim()).filter(Boolean)
      }

      // Save to DB and get the updated document back
      const res  = await profileAPI.updateMe(payload)
      const updated = res?.data || res

      // Update local profile + form state immediately from the response
      setProfile(updated)
      setForm({
        firstName:      updated.firstName || '',
        lastName:       updated.lastName  || '',
        phone:          updated.phone     || '',
        municipality:   updated.municipality || '',
        cin:            updated.cin       || '',
        department:     updated.department || '',
        specialization: Array.isArray(updated.specialization) ? updated.specialization.join(', ') : '',
        bio:            updated.bio       || '',
      })

      setSaveMsg('Profil mis à jour avec succès ✓')
      setEditing(false)

      // Also refresh AuthContext so Topbar / Sidebar show the new name
      try { await refreshUser?.() } catch {}

      setTimeout(() => setSaveMsg(''), 3000)
    } catch(err) {
      setSaveErr(err.response?.data?.message || 'Erreur lors de la sauvegarde.')
    } finally { setSaving(false) }
  }

  async function handlePwChange() {
    setPwSaving(true); setPwMsg(''); setPwErr('')
    if (!pw.current) return (setPwErr('Mot de passe actuel requis.'), setPwSaving(false))
    if (pw.next.length < 8) return (setPwErr('Minimum 8 caractères.'), setPwSaving(false))
    if (pw.next !== pw.confirm) return (setPwErr('Les mots de passe ne correspondent pas.'), setPwSaving(false))
    try {
      await profileAPI.changePassword(pw.current, pw.next)
      setPwMsg('Mot de passe modifié avec succès ✓')
      setPw({ current:'', next:'', confirm:'' })
      setPwMode(false)
    } catch(err) {
      setPwErr(err.response?.data?.message || 'Mot de passe actuel incorrect.')
    } finally { setPwSaving(false) }
  }

  function toggleShow(k) { setShowPw(p => ({ ...p, [k]: !p[k] })) }

  const fullName = profile
    ? `${profile.firstName || ''} ${profile.lastName || ''}`.trim()
    : `${authUser?.firstName || ''} ${authUser?.lastName || ''}`.trim()

  const joined = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    : '—'

  if (loading) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl p-8 flex flex-col items-center gap-3">
        <Loader2 size={28} className="animate-spin text-primary"/>
        <p className="text-[13px] text-t3">Chargement du profil…</p>
      </div>
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
      onClick={e => e.target === e.currentTarget && onClose?.()}>
      <div className="bg-muted w-full sm:max-w-2xl sm:rounded-2xl max-h-[96vh] overflow-y-auto custom-scroll shadow-modal animate-fade-up">

        {/* ── Header ── */}
        <div className="bg-white border-b border-border px-5 py-4 flex items-center justify-between sticky top-0 z-10 sm:rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: roleMeta.bg }}>
              <User size={15} style={{ color: roleMeta.color }}/>
            </div>
            <div>
              <h2 className="font-syne text-[15px] font-bold text-t1">Mon profil</h2>
              <p className="text-[11px] text-t3">{roleMeta.label}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-t3 hover:text-t1 hover:bg-muted transition-colors">
            <X size={16}/>
          </button>
        </div>

        <div className="p-4 space-y-3.5">

          {/* ── Avatar + identity ── */}
          <div className="bg-white border border-border rounded-card p-5">
            <div className="flex items-start gap-4">
              {/* Avatar with color picker */}
              <div className="relative shrink-0">
                <Avatar name={fullName} color={avatarColor} size={72}/>
                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-white border border-border rounded-full flex items-center justify-center cursor-pointer hover:bg-muted transition-colors"
                  onClick={() => {
                    const next = (AVATAR_COLORS.indexOf(avatarColor) + 1) % AVATAR_COLORS.length
                    setAvatarColor(AVATAR_COLORS[next])
                  }}>
                  <Camera size={11} className="text-t2"/>
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <h3 className="font-syne text-[18px] font-bold text-t1 leading-tight">{fullName || '—'}</h3>
                    <p className="text-[13px] text-t3 mt-0.5">{safe(profile?.email || authUser?.email)}</p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-semibold"
                        style={{ background: roleMeta.bg, color: roleMeta.color }}>
                        <BadgeCheck size={11}/>{roleMeta.label}
                      </span>
                      <span className="flex items-center gap-1 text-[11.5px] text-t3">
                        <Calendar size={11}/>Membre depuis {joined}
                      </span>
                    </div>
                  </div>
                  {!editing ? (
                    <button onClick={() => { setEditing(true); setSaveMsg(''); setSaveErr('') }}
                      className="flex items-center gap-1.5 px-3.5 py-2 border border-border-2 rounded-[9px] text-[12.5px] font-medium text-t2 hover:bg-muted hover:border-primary-light hover:text-primary transition-all">
                      <Edit3 size={13}/> Modifier
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button onClick={() => setEditing(false)}
                        className="px-3 py-2 border border-border-2 rounded-[9px] text-[12.5px] text-t3 hover:bg-muted transition-colors">
                        Annuler
                      </button>
                      <button onClick={handleSave} disabled={saving}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-primary text-white rounded-[9px] text-[12.5px] font-semibold hover:shadow-btn-primary transition-all disabled:opacity-60">
                        {saving ? <Loader2 size={13} className="animate-spin"/> : <Save size={13}/>}
                        {saving ? 'Sauvegarde…' : 'Sauvegarder'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Color picker dots */}
            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border">
              <span className="text-[11px] text-t3 mr-1">Couleur avatar :</span>
              {AVATAR_COLORS.map(c => (
                <button key={c} onClick={() => setAvatarColor(c)}
                  className={`w-5 h-5 rounded-full transition-all ${avatarColor === c ? 'ring-2 ring-offset-2 scale-110' : 'hover:scale-110'}`}
                  style={{ background: c, ringColor: c }}/>
              ))}
            </div>
          </div>

          {/* ── Status messages ── */}
          {saveMsg && (
            <div className="flex items-center gap-2 px-4 py-3 bg-success-light text-success border border-success/20 rounded-[10px] text-[13px] font-medium">
              <CheckCircle size={14}/>{saveMsg}
            </div>
          )}
          {saveErr && (
            <div className="flex items-center gap-2 px-4 py-3 bg-danger-light text-danger border border-danger/20 rounded-[10px] text-[13px] font-medium">
              <AlertCircle size={14}/>{saveErr}
            </div>
          )}

          {/* ── Informations personnelles ── */}
          <Section title="Informations personnelles" icon={User}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Prénom" icon={User} required>
                <Input value={form.firstName || ''} disabled={!editing}
                  onChange={e => set('firstName', e.target.value)} placeholder="Prénom"/>
              </Field>
              <Field label="Nom" icon={User} required>
                <Input value={form.lastName || ''} disabled={!editing}
                  onChange={e => set('lastName', e.target.value)} placeholder="Nom"/>
              </Field>
              <Field label="Email" icon={Mail}>
                <Input value={safe(profile?.email || authUser?.email)} disabled type="email"/>
              </Field>
              <Field label="Téléphone" icon={Phone}>
                <Input value={form.phone || ''} disabled={!editing} type="tel"
                  onChange={e => set('phone', e.target.value)} placeholder="+216 XX XXX XXX"/>
              </Field>
              {role === 'Citoyen' && (
                <>
                  <Field label="Municipalité" icon={MapPin}>
                    <Input value={form.municipality || ''} disabled={!editing}
                      onChange={e => set('municipality', e.target.value)} placeholder="Tunis"/>
                  </Field>
                  <Field label="CIN" icon={BadgeCheck}>
                    <Input value={form.cin || ''} disabled={!editing}
                      onChange={e => set('cin', e.target.value.replace(/\D/g,'').slice(0,8))}
                      placeholder="12345678" maxLength={8}/>
                  </Field>
                </>
              )}
              {(role === 'Agent' || role === 'Admin') && (
                <>
                  <Field label="Département" icon={Building2}>
                    <Input value={form.department || ''} disabled={!editing}
                      onChange={e => set('department', e.target.value)} placeholder="Direction Technique"/>
                  </Field>
                  {role === 'Agent' && (
                    <Field label="Spécialisations" icon={Star}>
                      <Input value={form.specialization || ''} disabled={!editing}
                        onChange={e => set('specialization', e.target.value)}
                        placeholder="Eclairage, Routes, Eau…"/>
                    </Field>
                  )}
                </>
              )}
            </div>
          </Section>

          {/* ── Stats ── */}
          {Object.keys(userStats).length > 0 && (
            <Section title="Statistiques" icon={Star}>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {userStats.reclamations != null && (
                  <StatPill icon={FileText} label="Réclamations" value={userStats.reclamations} color="#1A3C6B"/>
                )}
                {userStats.resolved != null && (
                  <StatPill icon={CheckCircle} label="Résolues" value={userStats.resolved} color="#1D8C5E"/>
                )}
                {userStats.demandes != null && (
                  <StatPill icon={ClipboardCheck} label="Demandes" value={userStats.demandes} color="#E8873A"/>
                )}
              </div>
            </Section>
          )}

          {/* ── Password ── */}
          <Section title="Sécurité" icon={Shield}
            action={
              !pwMode ? (
                <button onClick={() => setPwMode(true)}
                  className="flex items-center gap-1.5 text-[12.5px] font-medium text-primary hover:underline">
                  <Key size={12}/> Changer le mot de passe
                </button>
              ) : null
            }>
            {!pwMode ? (
              <div className="flex items-center gap-3 text-[13px] text-t3">
                <div className="w-9 h-9 rounded-[9px] bg-surface-2 border border-border flex items-center justify-center">
                  <Lock size={15} className="text-t3"/>
                </div>
                <div>
                  <p className="font-medium text-t1">Mot de passe</p>
                  <p className="text-[12px]">••••••••••••</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {pwMsg && (
                  <p className="flex items-center gap-1.5 text-[12.5px] text-success font-medium">
                    <CheckCircle size={13}/>{pwMsg}
                  </p>
                )}
                {pwErr && (
                  <p className="flex items-center gap-1.5 text-[12.5px] text-danger font-medium">
                    <AlertCircle size={13}/>{pwErr}
                  </p>
                )}
                {[
                  { k:'current', label:'Mot de passe actuel',     placeholder:'Mot de passe actuel'     },
                  { k:'next',    label:'Nouveau mot de passe',     placeholder:'Min. 8 caractères'       },
                  { k:'confirm', label:'Confirmer le nouveau mot de passe', placeholder:'Confirmez'      },
                ].map(({ k, label, placeholder }) => (
                  <Field key={k} label={label} icon={Lock}>
                    <Input type={showPw[k] ? 'text' : 'password'}
                      value={pw[k]} onChange={e => setPw(p => ({ ...p, [k]: e.target.value }))}
                      placeholder={placeholder}
                      right={
                        <button type="button" onClick={() => toggleShow(k)}
                          className="text-t3 hover:text-t1 transition-colors">
                          {showPw[k] ? <EyeOff size={14}/> : <Eye size={14}/>}
                        </button>
                      }/>
                  </Field>
                ))}
                {/* Strength bar */}
                {pw.next && (() => {
                  const s = [pw.next.length >= 8, /[A-Z]/.test(pw.next), /[0-9]/.test(pw.next), /[^A-Za-z0-9]/.test(pw.next)].filter(Boolean).length
                  const colors = ['','#ef4444','#f97316','#eab308','#22c55e']
                  const labels = ['','Faible','Moyen','Fort','Excellent']
                  return (
                    <div>
                      <div className="flex gap-1 mb-1">
                        {[1,2,3,4].map(i => (
                          <div key={i} className="h-1.5 flex-1 rounded-full transition-all duration-300"
                            style={{ background: i<=s ? colors[s] : '#e5e7eb' }}/>
                        ))}
                      </div>
                      <p className="text-[11.5px] font-medium" style={{ color: colors[s] }}>{labels[s]}</p>
                    </div>
                  )
                })()}
                <div className="flex gap-2 pt-1">
                  <button onClick={() => { setPwMode(false); setPwErr(''); setPwMsg(''); setPw({current:'',next:'',confirm:''}) }}
                    className="flex-1 py-2.5 border border-border-2 rounded-[9px] text-[13px] text-t2 hover:bg-muted transition-colors">
                    Annuler
                  </button>
                  <button onClick={handlePwChange} disabled={pwSaving}
                    className="flex-1 py-2.5 bg-primary text-white rounded-[9px] text-[13px] font-semibold hover:shadow-btn-primary transition-all disabled:opacity-60 flex items-center justify-center gap-2">
                    {pwSaving ? <Loader2 size={13} className="animate-spin"/> : <Key size={13}/>}
                    {pwSaving ? 'Mise à jour…' : 'Mettre à jour'}
                  </button>
                </div>
              </div>
            )}
          </Section>

          {/* ── Account info ── */}
          <div className="bg-white border border-border rounded-card px-5 py-4">
            <div className="grid grid-cols-2 gap-3 text-[12.5px]">
              {[
                ['ID compte',  String(profile?._id || authUser?.id || '—').slice(-8)],
                ['Rôle',       roleMeta.label],
                ['Statut',     profile?.isActive !== false ? '✅ Actif' : '⛔ Inactif'],
                ['Municipalité', safe(profile?.municipality || authUser?.municipality)],
              ].map(([k,v]) => (
                <div key={k}>
                  <span className="text-t3 block text-[11px] uppercase tracking-wide font-bold mb-0.5">{k}</span>
                  <span className="font-medium text-t1">{v}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
