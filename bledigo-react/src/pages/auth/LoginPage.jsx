import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Mail, Lock, Eye, EyeOff, User, Phone, CreditCard,
  Check, X, AlertCircle, ChevronRight, ShieldCheck,
  Building2, HardHat, Home, Info,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

// ── Role config ──────────────────────────────────────────
const ROLES = [
  {
    id:    'Citoyen',
    label: 'Citoyen',
    sub:   'Je suis un habitant',
    icon:  Home,
    color: '#1A3C6B',
    bg:    '#EEF3FB',
    desc:  'Signalez des problèmes et accédez aux services municipaux',
  },
  {
    id:    'Agent',
    label: 'Agent',
    sub:   'Je travaille pour la mairie',
    icon:  HardHat,
    color: '#1D8C5E',
    bg:    '#E1F5EE',
    desc:  'Traitez les réclamations et gérez les demandes citoyens',
  },
  {
    id:    'Admin',
    label: 'Admin',
    sub:   'Administration',
    icon:  Building2,
    color: '#B8760D',
    bg:    '#FEF3DB',
    desc:  'Accès complet à la plateforme municipale BlediGo',
  },
]

// ── Password strength ────────────────────────────────────
function getStrength(pw) {
  if (!pw) return 0
  let s = 0
  if (pw.length >= 8)            s++
  if (/[A-Z]/.test(pw))          s++
  if (/[0-9]/.test(pw))          s++
  if (/[^A-Za-z0-9]/.test(pw))   s++
  return s
}
const STR = [
  { label: '',          color: '#e5e7eb' },
  { label: 'Faible',    color: '#ef4444' },
  { label: 'Moyen',     color: '#f97316' },
  { label: 'Fort',      color: '#eab308' },
  { label: 'Excellent', color: '#22c55e' },
]

// ── Validators ───────────────────────────────────────────
const isEmail = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
const isCin   = v => /^\d{8}$/.test(v.trim())

// ── Field component with inline error ────────────────────
function Field({ label, required, error, success, hint, children }) {
  return (
    <div>
      {/* Label row with error on the right */}
      <div className="flex justify-between items-baseline mb-1">
        <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-[0.07em]">
          {label}{required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
        {error && (
          <span className="text-[10px] text-red-500 font-medium flex items-center gap-1">
            <AlertCircle size={9} className="shrink-0" /> {error}
          </span>
        )}
        {!error && success && (
          <span className="text-[10px] text-green-600 font-medium flex items-center gap-1">
            <Check size={9} className="shrink-0" /> {success}
          </span>
        )}
      </div>
      {children}
      {/* Hint (only when no error/success) */}
      {!error && !success && hint && (
        <p className="mt-1 text-[10px] text-gray-400 flex items-center gap-1">
          <Info size={8} /> {hint}
        </p>
      )}
    </div>
  )
}

// ── Input component (compact) ────────────────────────────
function Input({
  type = 'text', value, onChange, onBlur, placeholder,
  icon: Icon, right, autoComplete, maxLength, error, touched,
}) {
  const [focused, setFocused] = useState(false)
  const active = focused || value?.length > 0
  const showError = error && touched

  return (
    <div className={`
      relative flex items-center rounded-xl border-2 bg-white transition-all duration-200
      ${showError
        ? 'border-red-400 bg-red-50/30'
        : focused
          ? 'border-[#1A3C6B] shadow-[0_0_0_3px_rgba(26,60,107,0.08)]'
          : 'border-gray-200 hover:border-gray-300'}
    `}>
      {Icon && (
        <Icon
          size={14}
          className={`absolute left-3 pointer-events-none transition-colors duration-150 ${
            showError ? 'text-red-400' : focused ? 'text-[#1A3C6B]' : 'text-gray-400'
          }`}
        />
      )}
      <input
        type={type}
        value={value}
        onChange={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => { setFocused(false); onBlur?.() }}
        autoComplete={autoComplete}
        maxLength={maxLength}
        placeholder={active ? placeholder || '' : ''}
        className={`w-full bg-transparent outline-none font-dm text-[13px] text-gray-800
          ${Icon ? 'pl-9' : 'pl-4'}
          ${right ? 'pr-9' : 'pr-4'}
          ${active ? 'pt-4 pb-1' : 'py-2.5'}
        `}
      />
      {/* Floating label */}
      <label className={`
        absolute pointer-events-none font-dm transition-all duration-200
        ${Icon ? 'left-9' : 'left-4'}
        ${active
          ? `top-1 text-[9px] font-semibold tracking-wide ${showError ? 'text-red-400' : focused ? 'text-[#1A3C6B]' : 'text-gray-400'}`
          : 'top-1/2 -translate-y-1/2 text-[13px] text-gray-400'}
      `}>
        {placeholder || ''}
      </label>
      {right && <div className="absolute right-3">{right}</div>}
    </div>
  )
}

// ════════════════════════════════════════════════════════
export default function LoginPage() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const { login, register, loading } = useAuth()
  const from = location.state?.from?.pathname || null

  const [view, setView]       = useState('login')
  const [successMsg, setSuccessMsg] = useState({ title: '', sub: '' })

  // ── Login state ─────────────────────────────────────────
  const [lRole,  setLRole]  = useState('Citoyen')
  const [lEmail, setLEmail] = useState('')
  const [lPass,  setLPass]  = useState('')
  const [showLP, setShowLP] = useState(false)
  const [lErr,   setLErr]   = useState({})
  const [lTouch, setLTouch] = useState({})
  const [lBanner,setLBanner]= useState('')
  const [lSubmitted, setLSubmitted] = useState(false)

  // ── Register state ──────────────────────────────────────
  const [rFirst,  setRFirst]  = useState('')
  const [rLast,   setRLast]   = useState('')
  const [rEmail,  setREmail]  = useState('')
  const [rPhone,  setRPhone]  = useState('')
  const [rCin,    setRCin]    = useState('')
  const [rDept,   setRDept]   = useState('')
  const [rPass,   setRPass]   = useState('')
  const [rConf,   setRConf]   = useState('')
  const [showRP,  setShowRP]  = useState(false)
  const [rTerms,  setRTerms]  = useState(false)
  const [rErr,    setRErr]    = useState({})
  const [rTouch,  setRTouch]  = useState({})
  const [rBanner, setRBanner] = useState('')
  const [rSubmitted, setRSubmitted] = useState(false)

  const selectedRole = ROLES.find(r => r.id === lRole)
  const pwStr = getStrength(rPass)

  // ── Real-time validation (unchanged) ───────────────────
  useEffect(() => {
    if (!lSubmitted && !lTouch.email) return
    const e = {}
    if (!lEmail.trim())          e.email = 'L\'adresse email est requise.'
    else if (!isEmail(lEmail))   e.email = 'Format invalide. Ex: nom@exemple.com'
    setLErr(p => ({...p, email: e.email || undefined}))
  }, [lEmail, lTouch.email, lSubmitted])

  useEffect(() => {
    if (!lSubmitted && !lTouch.password) return
    const e = {}
    if (!lPass) e.password = 'Le mot de passe est requis.'
    setLErr(p => ({...p, password: e.password || undefined}))
  }, [lPass, lTouch.password, lSubmitted])

  useEffect(() => {
    if (!rSubmitted && !rTouch.firstName) return
    setRErr(p => ({...p, firstName: !rFirst.trim() ? 'Prénom requis' : rFirst.trim().length < 2 ? 'Min 2 car.' : undefined}))
  }, [rFirst, rTouch.firstName, rSubmitted])

  useEffect(() => {
    if (!rSubmitted && !rTouch.lastName) return
    setRErr(p => ({...p, lastName: !rLast.trim() ? 'Nom requis' : rLast.trim().length < 2 ? 'Min 2 car.' : undefined}))
  }, [rLast, rTouch.lastName, rSubmitted])

  useEffect(() => {
    if (!rSubmitted && !rTouch.email) return
    setRErr(p => ({...p, email: !rEmail.trim() ? 'Email requis' : !isEmail(rEmail) ? 'Email invalide' : undefined}))
  }, [rEmail, rTouch.email, rSubmitted])

  useEffect(() => {
    if (!rSubmitted && !rTouch.cin) return
    if (!rCin) { setRErr(p => ({...p, cin: undefined})); return }
    setRErr(p => ({...p, cin: !isCin(rCin) ? '8 chiffres' : undefined}))
  }, [rCin, rTouch.cin, rSubmitted])

  useEffect(() => {
    if (!rSubmitted && !rTouch.password) return
    setRErr(p => ({...p, password: !rPass ? 'Mot de passe requis' : rPass.length < 8 ? '8 car. min' : undefined}))
  }, [rPass, rTouch.password, rSubmitted])

  useEffect(() => {
    if (!rSubmitted && !rTouch.confirm) return
    setRErr(p => ({...p, confirm: !rConf ? 'Confirmation requise' : rPass !== rConf ? 'Ne correspond pas' : undefined}))
  }, [rConf, rPass, rTouch.confirm, rSubmitted])

  // ── Helpers ─────────────────────────────────────────────
  function touchL(f) { setLTouch(p => ({...p, [f]: true})) }
  function touchR(f) { setRTouch(p => ({...p, [f]: true})) }

  function switchTo(v) {
    setView(v)
    setLErr({}); setLBanner(''); setLTouch({}); setLSubmitted(false)
    setRErr({}); setRBanner(''); setRTouch({}); setRSubmitted(false)
  }

  // ── LOGIN ────────────────────────────────────────────────
  async function handleLogin(e) {
    e.preventDefault()
    setLSubmitted(true)
    setLTouch({ email:true, password:true })

    const errs = {}
    if (!lEmail.trim())        errs.email    = 'L\'adresse email est requise.'
    else if (!isEmail(lEmail)) errs.email    = 'Format invalide. Ex: nom@exemple.com'
    if (!lPass)                errs.password = 'Le mot de passe est requis.'

    if (Object.keys(errs).length) { setLErr(errs); return }
    setLBanner('')

    const res = await login(lEmail.trim(), lPass, lRole)

    if (res.success) {
      setSuccessMsg({
        title: `Bonjour, ${res.user.firstName} 👋`,
        sub:   `Connecté en tant que ${lRole}.`,
      })
      setView('success')
      navigate(from || res.dest, { replace: true })
    } else {
      const fe = {}
      res.errors?.forEach(err => { fe[err.field] = err.message })
      if (Object.keys(fe).length) {
        setLErr(fe)
        setLTouch({ email: !!fe.email, password: !!fe.password })
      } else {
        setLBanner(res.message || 'Email ou mot de passe incorrect.')
      }
    }
  }

  // ── REGISTER ─────────────────────────────────────────────
  async function handleRegister(e) {
    e.preventDefault()
    setRSubmitted(true)
    setRTouch({ firstName:true, lastName:true, email:true, cin:true, password:true, confirm:true, terms:true })

    const errs = {}
    if (!rFirst.trim())                errs.firstName = 'Le prénom est requis.'
    else if (rFirst.trim().length < 2) errs.firstName = 'Minimum 2 caractères.'
    if (!rLast.trim())                 errs.lastName  = 'Le nom est requis.'
    else if (rLast.trim().length < 2)  errs.lastName  = 'Minimum 2 caractères.'
    if (!rEmail.trim())                errs.email     = 'L\'email est requis.'
    else if (!isEmail(rEmail))         errs.email     = 'Format invalide. Ex: nom@exemple.com'
    if (rCin && !isCin(rCin))          errs.cin       = 'Le CIN doit contenir exactement 8 chiffres.'
    if (!rPass)                        errs.password  = 'Le mot de passe est requis.'
    else if (rPass.length < 8)         errs.password  = 'Minimum 8 caractères requis.'
    if (!rConf)                        errs.confirm   = 'Confirmez votre mot de passe.'
    else if (rPass !== rConf)          errs.confirm   = 'Les mots de passe ne correspondent pas.'
    if (!rTerms)                       errs.terms     = 'Vous devez accepter les conditions pour continuer.'

    if (Object.keys(errs).length) { setRErr(errs); return }
    setRBanner('')

    const res = await register({
      firstName:    rFirst.trim(),
      lastName:     rLast.trim(),
      email:        rEmail.trim(),
      password:     rPass,
      phone:        rPhone.trim() || undefined,
      cin:          lRole === 'Citoyen' ? (rCin.trim() || undefined) : undefined,
      department:   lRole === 'Agent'   ? (rDept.trim() || undefined) : undefined,
      municipality: 'Tunis',
      role:         lRole === 'Agent' ? 'Agent' : 'Citoyen',
    })

    if (res.success) {
      setSuccessMsg({ title: `Bienvenue, ${rFirst} ! 🎉`, sub: 'Compte créé.' })
      setView('success')
      const dest = lRole === 'Agent' ? '/agent/dashboard' : '/user/dashboard'
      navigate(dest, { replace: true })
    } else {
      const fe = {}
      res.errors?.forEach(err => { fe[err.field] = err.message })
      if (Object.keys(fe).length) setRErr(fe)
      else setRBanner(res.message || "Erreur lors de l'inscription. Réessayez.")
    }
  }

  // ════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen w-screen flex font-dm bg-gray-50 overflow-hidden">

      {/* ── LEFT HERO (unchanged) ─────────────────────────── */}
      <div className="hidden lg:flex w-[44%] xl:w-[46%] shrink-0 bg-[#1A3C6B] flex-col relative overflow-hidden">
        <div className="absolute inset-0 dot-texture opacity-60 pointer-events-none"/>
        <div className="absolute -top-40 -right-40 w-[480px] h-[480px] rounded-full border border-white/10 pointer-events-none"/>
        <div className="absolute -bottom-32 -left-32 w-[360px] h-[360px] rounded-full border border-white/10 pointer-events-none"/>

        <div className="relative flex flex-col justify-between h-full p-12">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 flex items-center justify-center">
            <img 
              src="../src/assets/BlediGo Logo.png" 
              alt="Logo" 
              className="w-11 h-11 object-cover rounded-2xl shadow-lg shrink-0"
              />
            </div>
            <div>
              <div className="font-syne text-[20px] font-black text-white leading-none">BlediGo</div>
              <div className="text-[10px] text-white/40 uppercase tracking-[0.14em] mt-0.5">Plateforme Municipale</div>
            </div>
          </div>

          {/* Copy */}
          <div>
            <div className="inline-flex items-center gap-2 bg-white/10 text-white/70 text-[12px] font-medium px-3.5 py-1.5 rounded-full border border-white/15 mb-6">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"/>
              Municipalité de Tunis — Plateforme officielle
            </div>
            <h1 className="font-syne text-[42px] font-black text-white leading-[1.1] mb-5">
              Votre ville,<br/>
              <span className="text-[#E8873A]">plus proche</span><br/>
              de vous.
            </h1>
            <p className="text-[15px] text-white/55 leading-[1.75] max-w-sm mb-8">
              Signalez des problèmes dans votre quartier, suivez leur résolution et accédez aux services municipaux.
            </p>
            <div className="flex flex-col gap-3">
              {[
                { icon:'🤖', t:'Analyse IA de l\'urgence automatique'     },
                { icon:'📡', t:'Notifications et suivi en temps réel'      },
                { icon:'🏛️', t:'3 espaces : Citoyen, Agent, Administration' },
              ].map(f => (
                <div key={f.t} className="flex items-center gap-3">
                  <span className="text-[18px] w-7 text-center shrink-0">{f.icon}</span>
                  <span className="text-[13.5px] text-white/65">{f.t}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            {[{n:'3 200+',l:'Réclamations résolues'},{n:'49',l:'Services disponibles'},{n:'94%',l:'Satisfaction'}].map(s => (
              <div key={s.n} className="bg-white/10 border border-white/15 rounded-2xl px-4 py-4">
                <div className="font-syne text-[22px] font-black text-white">{s.n}</div>
                <div className="text-[11px] text-white/45 mt-1 leading-snug">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── RIGHT FORM (centered, no top tabs) ─────────────── */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-[460px] mx-auto">

          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 mb-4 lg:hidden">
            <div className="w-9 h-9 bg-[#1A3C6B] rounded-xl flex items-center justify-center">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="white">
                <path d="M12 2L2 7v10l10 5 10-5V7L12 2zm0 2.5 7.5 3.75v6.5L12 18.5 4.5 14.75v-6.5z"/>
              </svg>
            </div>
            <span className="font-syne text-lg font-bold text-[#1A3C6B]">BlediGo</span>
          </div>

          {/* ── SUCCESS ───────────────────────────────────── */}
          {view === 'success' && (
            <div className="text-center animate-fade-up">
              <div className="w-20 h-20 bg-green-50 border-4 border-green-100 rounded-full flex items-center justify-center mx-auto mb-5 animate-pop-in">
                <Check size={36} className="text-green-500" strokeWidth={2.5}/>
              </div>
              <h2 className="font-syne text-2xl font-bold text-gray-900 mb-2">{successMsg.title}</h2>
              <p className="text-[14px] text-gray-500 mb-6">{successMsg.sub}</p>
              <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-green-500 rounded-full" style={{ animation:'grow 1.5s linear forwards' }}/>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════
              LOGIN
          ══════════════════════════════════════════════ */}
          {view === 'login' && (
            <div className="animate-fade-up">
              <div className="mb-4">
                <h2 className="font-syne text-[24px] font-black text-gray-900 mb-1">Bon retour 👋</h2>
                <p className="text-[13px] text-gray-500">Sélectionnez votre rôle et connectez-vous.</p>
              </div>

              {/* Role selector */}
              <div className="mb-4">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">Je me connecte en tant que…</p>
                <div className="grid grid-cols-3 gap-2">
                  {ROLES.map(r => {
                    const Icon = r.icon
                    const active = lRole === r.id
                    return (
                      <button key={r.id} type="button"
                        onClick={() => { setLRole(r.id); setLBanner('') }}
                        className="relative flex flex-col items-center gap-1 py-2 px-1 rounded-2xl border-2 transition-all duration-200 cursor-pointer group"
                        style={active
                          ? { borderColor: r.color, backgroundColor: r.bg, boxShadow: `0 0 0 3px ${r.color}18` }
                          : { borderColor: '#e5e7eb', backgroundColor: '#fff' }
                        }
                      >
               
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors"
                          style={{ backgroundColor: active ? r.color : '#F3F4F6' }}>
                          <Icon size={15} className={active ? 'text-white' : 'text-gray-400'}/>
                        </div>
                        <span className="text-[12px] font-bold" style={{ color: active ? r.color : '#6B7280' }}>
                          {r.label}
                        </span>
                        <span className="text-[9px] text-center leading-tight"
                          style={{ color: active ? r.color+'aa' : '#9CA3AF' }}>
                          {r.sub}
                        </span>
                      </button>
                    )
                  })}
                </div>

                {/* Role description pill */}
                <div className="flex items-center gap-2 mt-2 px-2.5 py-1.5 rounded-lg text-[11.5px] font-medium transition-all"
                  style={{ backgroundColor: selectedRole?.bg, color: selectedRole?.color }}>
                  <div className="w-1 h-1 rounded-full shrink-0" style={{ backgroundColor: selectedRole?.color }}/>
                  <span>{selectedRole?.desc}</span>
                </div>
              </div>

              {/* Global error banner */}
              {lBanner && (
                <div className="flex items-start gap-2 px-3 py-2.5 bg-red-50 border-2 border-red-200 rounded-xl text-[12px] text-red-700 mb-4 animate-fade-up">
                  <AlertCircle size={14} className="shrink-0 mt-0.5 text-red-500"/>
                  <span className="flex-1">{lBanner}</span>
                  <button onClick={() => setLBanner('')} className="text-red-400 hover:text-red-600 shrink-0">
                    <X size={13}/>
                  </button>
                </div>
              )}

              <form onSubmit={handleLogin} noValidate className="flex flex-col gap-3">

                <Field label="Adresse email" required error={lTouch.email || lSubmitted ? lErr.email : undefined}>
                  <Input
                    type="email" value={lEmail} placeholder="Adresse email"
                    onChange={e => setLEmail(e.target.value)}
                    onBlur={() => touchL('email')}
                    icon={Mail} autoComplete="email"
                    error={lErr.email} touched={lTouch.email || lSubmitted}
                  />
                </Field>

                <Field label="Mot de passe" required error={lTouch.password || lSubmitted ? lErr.password : undefined}>
                  <Input
                    type={showLP ? 'text' : 'password'} value={lPass} placeholder="Mot de passe"
                    onChange={e => setLPass(e.target.value)}
                    onBlur={() => touchL('password')}
                    icon={Lock} autoComplete="current-password"
                    error={lErr.password} touched={lTouch.password || lSubmitted}
                    right={
                      <button type="button" onClick={() => setShowLP(v => !v)}
                        className="text-gray-400 hover:text-gray-600 p-0.5">
                        {showLP ? <EyeOff size={14}/> : <Eye size={14}/>}
                      </button>
                    }
                  />
                </Field>

                <div className="flex items-center justify-between -mt-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" defaultChecked className="w-3.5 h-3.5 rounded accent-[#1A3C6B]"/>
                    <span className="text-[12px] text-gray-600">Se souvenir de moi</span>
                  </label>
                  <button type="button" className="text-[12px] font-medium hover:underline"
                    style={{ color: selectedRole?.color }}>
                    Mot de passe oublié ?
                  </button>
                </div>

                <button type="submit" disabled={loading}
                  className="w-full mt-1 flex items-center justify-center gap-2 text-white font-semibold text-[13px] py-2.5 rounded-xl transition-all hover:-translate-y-px active:translate-y-0 disabled:opacity-60"
                  style={{ backgroundColor: selectedRole?.color }}>
                  {loading ? (
                    <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><circle cx="12" cy="12" r="10" strokeOpacity="0.3"/><path d="M12 2a10 10 0 0 1 10 10"/></svg> Connexion…</>
                  ) : (
                    <>Se connecter en tant que {lRole} <ChevronRight size={15}/></>
                  )}
                </button>
              </form>

              <p className="text-center text-[12.5px] text-gray-500 mt-4">
                {lRole !== 'Admin' && (
                  <>
                    {lRole === 'Agent' ? 'Pas encore de compte agent ?' : 'Pas de compte citoyen ?'}{' '}
                    <button onClick={() => switchTo('register')} className="text-[#1A3C6B] font-bold hover:underline">
                      Créer un compte {lRole === 'Agent' ? 'agent' : 'gratuit'}
                    </button>
                  </>
                )}
                {lRole === 'Admin' && (
                  <span className="text-gray-400 italic">Les comptes administrateurs sont créés par le système.</span>
                )}
              </p>
            </div>
          )}

          {/* ══════════════════════════════════════════════
              REGISTER (compact, inline errors)
          ══════════════════════════════════════════════ */}
          {view === 'register' && (
            <div className="animate-fade-up">
              <div className="mb-3">
                <h2 className="font-syne text-[24px] font-black text-gray-900 mb-1">Créer un compte</h2>
              </div>

              {/* Global error */}
              {rBanner && (
                <div className="flex items-start gap-2 px-3 py-2.5 bg-red-50 border-2 border-red-200 rounded-xl text-[12px] text-red-700 mb-4 animate-fade-up">
                  <AlertCircle size={14} className="shrink-0 mt-0.5 text-red-500"/>
                  <span className="flex-1">{rBanner}</span>
                  <button onClick={() => setRBanner('')} className="text-red-400 hover:text-red-600 shrink-0"><X size={13}/></button>
                </div>
              )}

              <form onSubmit={handleRegister} noValidate className="flex flex-col gap-2.5">

                <div className="grid grid-cols-2 gap-2.5">
                  <Field label="Prénom" required error={rTouch.firstName || rSubmitted ? rErr.firstName : undefined}>
                    <Input value={rFirst} placeholder="Ahmed"
                      onChange={e => setRFirst(e.target.value)} onBlur={() => touchR('firstName')}
                      icon={User} autoComplete="given-name"
                      error={rErr.firstName} touched={rTouch.firstName || rSubmitted}/>
                  </Field>
                  <Field label="Nom" required error={rTouch.lastName || rSubmitted ? rErr.lastName : undefined}>
                    <Input value={rLast} placeholder="Mansour"
                      onChange={e => setRLast(e.target.value)} onBlur={() => touchR('lastName')}
                      icon={User} autoComplete="family-name"
                      error={rErr.lastName} touched={rTouch.lastName || rSubmitted}/>
                  </Field>
                </div>

                <Field label="Adresse email" required error={rTouch.email || rSubmitted ? rErr.email : undefined}>
                  <Input type="email" value={rEmail} placeholder="votre@email.com"
                    onChange={e => setREmail(e.target.value)} onBlur={() => touchR('email')}
                    icon={Mail} autoComplete="email"
                    error={rErr.email} touched={rTouch.email || rSubmitted}/>
                </Field>

                <div className="grid grid-cols-2 gap-2.5">
                  <Field label="Téléphone">
                    <Input type="tel" value={rPhone} placeholder="XX XXX XXX"
                      onChange={e => setRPhone(e.target.value)}
                      icon={Phone} autoComplete="tel"/>
                  </Field>
                  {lRole === 'Agent' ? (
                    <Field label="Département">
                      <Input value={rDept} placeholder="Direction Technique"
                        onChange={e => setRDept(e.target.value)}
                        icon={CreditCard}/>
                    </Field>
                  ) : (
                    <Field label="CIN" error={rTouch.cin || rSubmitted ? rErr.cin : undefined}>
                      <Input value={rCin} placeholder="12345678"
                        onChange={e => { setRCin(e.target.value.replace(/\D/g,'').slice(0,8)); touchR('cin') }}
                        icon={CreditCard} maxLength={8}
                        error={rErr.cin} touched={rTouch.cin || rSubmitted}/>
                    </Field>
                  )}
                </div>

                <Field label="Mot de passe" required
                  error={rTouch.password || rSubmitted ? rErr.password : undefined}
                  hint={!rPass ? 'Min. 8 caractères, incluez majuscules et chiffres' : undefined}>
                  <Input type={showRP ? 'text' : 'password'} value={rPass} placeholder="Mot de passe"
                    onChange={e => setRPass(e.target.value)} onBlur={() => touchR('password')}
                    icon={Lock} autoComplete="new-password"
                    error={rErr.password} touched={rTouch.password || rSubmitted}
                    right={
                      <button type="button" onClick={() => setShowRP(v => !v)}
                        className="text-gray-400 hover:text-gray-600 p-0.5">
                        {showRP ? <EyeOff size={14}/> : <Eye size={14}/>}
                      </button>
                    }/>
                  {rPass && (
                    <div className="mt-1.5">
                      <div className="flex gap-1 mb-0.5">
                        {[1,2,3,4].map(i => (
                          <div key={i} className="h-1 flex-1 rounded-full transition-all duration-300"
                            style={{ background: i <= pwStr ? STR[pwStr].color : '#e5e7eb' }}/>
                        ))}
                      </div>
                      <p className="text-[10px] font-semibold" style={{ color: STR[pwStr].color }}>
                        {STR[pwStr].label}
                        {pwStr < 3 && <span className="text-gray-400 font-normal ml-1">— Ajoutez majuscules, chiffres et symboles</span>}
                      </p>
                    </div>
                  )}
                </Field>

                <Field label="Confirmer le mot de passe" required
                  error={rTouch.confirm || rSubmitted ? rErr.confirm : undefined}
                  success={rConf && rPass === rConf && !rErr.confirm ? 'Correspond' : undefined}>
                  <Input type="password" value={rConf} placeholder="Confirmer le mot de passe"
                    onChange={e => setRConf(e.target.value)} onBlur={() => touchR('confirm')}
                    icon={Lock} autoComplete="new-password"
                    error={rErr.confirm} touched={rTouch.confirm || rSubmitted}
                    right={
                      rConf
                        ? rPass === rConf
                          ? <Check size={14} className="text-green-500"/>
                          : <X size={14} className="text-red-400"/>
                        : null
                    }/>
                </Field>

                {/* Terms */}
                <div className={`rounded-xl p-2 transition-colors ${(rTouch.terms || rSubmitted) && rErr.terms ? 'bg-red-50 border-2 border-red-200' : 'bg-gray-50 border border-gray-100'}`}>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input type="checkbox" checked={rTerms}
                      onChange={e => { setRTerms(e.target.checked); touchR('terms') }}
                      className="w-3.5 h-3.5 mt-0.5 shrink-0 accent-[#1A3C6B]"/>
                    <span className="text-[11px] text-gray-600 leading-snug">
                      J'accepte les{' '}
                      <a href="#" className="text-[#1A3C6B] font-semibold hover:underline">conditions d'utilisation</a>
                      {' '}et la{' '}
                      <a href="#" className="text-[#1A3C6B] font-semibold hover:underline">politique de confidentialité</a>
                    </span>
                  </label>
                  {(rTouch.terms || rSubmitted) && rErr.terms && (
                    <p className="mt-1 text-[10px] text-red-500 font-medium">
                      {rErr.terms}
                    </p>
                  )}
                </div>

                <button type="submit" disabled={loading}
                  className="w-full mt-1 flex items-center justify-center gap-2 bg-[#E8873A] text-white font-semibold text-[13px] py-2.5 rounded-xl transition-all hover:bg-[#d4762c] hover:-translate-y-px disabled:opacity-60">
                  {loading ? (
                    <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><circle cx="12" cy="12" r="10" strokeOpacity="0.3"/><path d="M12 2a10 10 0 0 1 10 10"/></svg> Création…</>
                  ) : (
                    <>Créer mon compte <ChevronRight size={15}/></>
                  )}
                </button>
              </form>

              <p className="text-center text-[12.5px] text-gray-500 mt-4">
                Déjà un compte ?{' '}
                <button onClick={() => switchTo('login')} className="text-[#1A3C6B] font-bold hover:underline">
                  Se connecter
                </button>
              </p>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}