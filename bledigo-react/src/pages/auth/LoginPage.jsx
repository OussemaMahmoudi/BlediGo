import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Mail, Lock, Eye, EyeOff, User, Phone, CreditCard,
  Check, X, AlertCircle, ChevronRight, ShieldCheck,
  Building2, HardHat, Home, Info, Globe,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { authAPI } from '../../services/api'

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

// ── Country list with flag emoji and code ───────────────
const COUNTRIES = [
  { code: '+216', flag: '🇹🇳', name: 'Tunisie' },
  { code: '+213', flag: '🇩🇿', name: 'Algérie' },
  { code: '+212', flag: '🇲🇦', name: 'Maroc' },
  { code: '+33',  flag: '🇫🇷', name: 'France' },
  { code: '+49',  flag: '🇩🇪', name: 'Allemagne' },
  { code: '+44',  flag: '🇬🇧', name: 'Royaume-Uni' },
  { code: '+1',   flag: '🇺🇸', name: 'États-Unis' },
  { code: '+20',  flag: '🇪🇬', name: 'Égypte' },
  { code: '+966', flag: '🇸🇦', name: 'Arabie Saoudite' },
  { code: '+971', flag: '🇦🇪', name: 'Émirats Arabes Unis' },
  { code: '+32',  flag: '🇧🇪', name: 'Belgique' },
  { code: '+41',  flag: '🇨🇭', name: 'Suisse' },
  { code: '+39',  flag: '🇮🇹', name: 'Italie' },
  { code: '+34',  flag: '🇪🇸', name: 'Espagne' },
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
const isPhone = v => /^\d+$/.test(v) // digits only

// ── Field component with inline error ────────────────────
function Field({ label, required, error, success, hint, children }) {
  return (
    <div>
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
      {!error && !success && hint && (
        <p className="mt-1 text-[10px] text-gray-400 flex items-center gap-1">
          <Info size={8} /> {hint}
        </p>
      )}
    </div>
  )
}

// ── Input component (standard) ───────────────────────────
function Input({
  type = 'text', value, onChange, onBlur, placeholder,
  icon: Icon, right, autoComplete, maxLength, error, touched, className = '',
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
      ${className}
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

// ── Custom phone input component (country code + number) ──
function PhoneInput({ value, onChange, error, touched, onBlur }) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selectedCountry = COUNTRIES.find(c => c.code === value.code) || COUNTRIES[0]

  return (
    <div className="relative" ref={dropdownRef}>
      <div className={`
        flex items-center rounded-xl border-2 bg-white transition-all duration-200
        ${error && touched
          ? 'border-red-400 bg-red-50/30'
          : 'border-gray-200 hover:border-gray-300 focus-within:border-[#1A3C6B] focus-within:shadow-[0_0_0_3px_rgba(26,60,107,0.08)]'}
      `}>
        {/* Country code selector */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 pl-3 pr-2 py-2.5 border-r border-gray-200 hover:bg-gray-50 transition-colors shrink-0"
        >
          <span className="text-base">{selectedCountry.flag}</span>
          <span className="text-[13px] font-medium text-gray-700">{selectedCountry.code}</span>
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-400">
            <path d="M3 4.5L6 7.5L9 4.5" />
          </svg>
        </button>

        {/* Phone number input */}
        <input
          type="tel"
          value={value.number}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, '')
            onChange({ ...value, number: digits })
          }}
          onBlur={onBlur}
          placeholder="12345678"
          className="flex-1 bg-transparent outline-none font-dm text-[13px] text-gray-800 py-2.5 px-3"
        />
      </div>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-1 w-56 bg-white border border-gray-200 rounded-xl shadow-lg z-50 max-h-60 overflow-y-auto custom-scroll">
          {COUNTRIES.map((country) => (
            <button
              key={country.code}
              type="button"
              onClick={() => {
                onChange({ ...value, code: country.code })
                setIsOpen(false)
              }}
              className="flex items-center gap-2.5 w-full px-3 py-2 text-left hover:bg-gray-50 transition-colors"
            >
              <span className="text-base">{country.flag}</span>
              <span className="text-[13px] font-medium">{country.code}</span>
              <span className="text-[12px] text-gray-500">{country.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Select component (for other dropdowns) ───────────────
function Select({
  value, onChange, onBlur, placeholder,
  icon: Icon, error, touched, children, className = '',
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
      ${className}
    `}>
      {Icon && (
        <Icon
          size={14}
          className={`absolute left-3 pointer-events-none transition-colors duration-150 ${
            showError ? 'text-red-400' : focused ? 'text-[#1A3C6B]' : 'text-gray-400'
          }`}
        />
      )}
      <select
        value={value}
        onChange={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => { setFocused(false); onBlur?.() }}
        className={`w-full bg-transparent outline-none font-dm text-[13px] text-gray-800 appearance-none
          ${Icon ? 'pl-9' : 'pl-4'}
          pr-8
          ${active ? 'pt-4 pb-1' : 'py-2.5'}
        `}
      >
        <option value="" disabled>{placeholder || 'Sélectionner'}</option>
        {children}
      </select>
      <div className="absolute right-3 pointer-events-none">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-400">
          <path d="M3 4.5L6 7.5L9 4.5" />
        </svg>
      </div>
      <label className={`
        absolute pointer-events-none font-dm transition-all duration-200
        ${Icon ? 'left-9' : 'left-4'}
        ${active
          ? `top-1 text-[9px] font-semibold tracking-wide ${showError ? 'text-red-400' : focused ? 'text-[#1A3C6B]' : 'text-gray-400'}`
          : 'top-1/2 -translate-y-1/2 text-[13px] text-gray-400'}
      `}>
        {placeholder || ''}
      </label>
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
  const [rPhone, setRPhone] = useState({ code: '+216', number: '' })
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

  // ── Verification state ──────────────────────────────────
  const [isVerifying, setIsVerifying] = useState(false)
  const [vCode, setVCode] = useState('')
  const [vLoading, setVLoading] = useState(false)
  const [vTouch, setVTouch] = useState(false)
  const [resendMsg, setResendMsg] = useState('')

  // ── Forgot Password state ───────────────────────────────
  const [fPhase, setFPhase]   = useState('email') // 'email' | 'code'
  const [fEmail, setFEmail]   = useState('')
  const [fCode,  setFCode]    = useState('')
  const [fPass,  setFPass]    = useState('')
  const [fConf,  setFConf]    = useState('')
  const [showFP, setShowFP]   = useState(false)
  const [fErr,   setFErr]     = useState({})
  const [fTouch, setFTouch]   = useState({})
  const [fBanner,setFBanner]  = useState('')

  const selectedRole = ROLES.find(r => r.id === lRole)
  const pwStr = getStrength(rPass)

  // ── Real-time validation ───────────────────────────────
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
    if (!rSubmitted && !rTouch.phone) return
    if (rPhone.number && !isPhone(rPhone.number)) {
      setRErr(p => ({...p, phone: 'Le numéro ne doit contenir que des chiffres'}))
    } else {
      setRErr(p => ({...p, phone: undefined}))
    }
  }, [rPhone.number, rTouch.phone, rSubmitted])

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
  function touchF(f) { setFTouch(p => ({...p, [f]: true})) }

  function switchTo(v) {
    setView(v)
    setLErr({}); setLBanner(''); setLTouch({}); setLSubmitted(false)
    setRErr({}); setRBanner(''); setRTouch({}); setRSubmitted(false)
    setIsVerifying(false); setVCode(''); setVLoading(false); setVTouch(false)
    setFPhase('email'); setFEmail(''); setFCode(''); setFPass(''); setFConf(''); setFErr({}); setFTouch({}); setFBanner('')
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

  async function handleResendCode() {
    setVLoading(true)
    setResendMsg('')
    try {
      const res = await authAPI.sendVerification(rEmail.trim(), rFirst.trim())
      if (res.success) {
        setResendMsg('Nouveau code envoyé !')
        setTimeout(() => setResendMsg(''), 4000)
      } else {
        setRBanner(res.message || 'Erreur lors de l\'envoi.')
      }
    } catch (err) {
      setRBanner(err.response?.data?.message || 'Erreur lors de l\'envoi.')
    } finally {
      setVLoading(false)
    }
  }

  // ── FORGOT PASSWORD ─────────────────────────────────────────
  async function handleForgotEmail(e) {
    e.preventDefault()
    setFTouch({ email: true })
    if (!fEmail.trim() || !isEmail(fEmail)) {
      setFErr({ email: 'Format invalide.' })
      return
    }
    setFErr({})
    setVLoading(true)
    try {
      const res = await authAPI.requestPasswordReset(fEmail.trim(), lRole)
      if (res.success) {
        setFBanner('')
        setFPhase('code')
        setResendMsg('')
      } else {
        setFBanner(res.message || 'Erreur lors de l\'envoi.')
      }
    } catch (err) {
      setFBanner(err.response?.data?.message || 'Erreur lors de l\'envoi.')
    } finally {
      setVLoading(false)
    }
  }

  async function handleForgotVerifyCode(e) {
    e.preventDefault()
    setFTouch(p => ({...p, code: true}))
    if (!fCode || fCode.length !== 6) {
      setFErr(p => ({...p, code: '6 chiffres requis.'}))
      return
    }
    setFErr(p => ({...p, code: undefined}))
    setVLoading(true)
    try {
      const res = await authAPI.verifyResetCode(fEmail.trim(), fCode)
      if (res.success) {
        setFBanner('')
        setFPhase('password')
      } else {
        setFErr(p => ({...p, code: res.message || 'Code invalide.'}))
      }
    } catch (err) {
      setFErr(p => ({...p, code: err.response?.data?.message || 'Code invalide ou expiré.'}))
    } finally {
      setVLoading(false)
    }
  }

  async function handleForgotReset(e) {
    e.preventDefault()
    setFTouch(p => ({...p, password: true, confirm: true}))
    const errs = {}
    if (!fPass || fPass.length < 8) errs.password = 'Min. 8 caractères.'
    if (fPass !== fConf)            errs.confirm  = 'Correspondance requise.'
    if (Object.keys(errs).length) { setFErr(errs); return }

    setVLoading(true)
    try {
      const res = await authAPI.resetPasswordWithCode(fEmail.trim(), lRole, fCode, fPass)
      if (res.success) {
        setSuccessMsg({ title: 'Succès ! 🎉', sub: 'Votre mot de passe a été réinitialisé. Vous pouvez vous connecter.' })
        setView('success')
        setTimeout(() => switchTo('login'), 3000)
      } else {
        setFBanner(res.message || 'Erreur.')
      }
    } catch (err) {
      setFBanner(err.response?.data?.message || 'Erreur.')
    } finally {
      setVLoading(false)
    }
  }

  // ── REGISTER ─────────────────────────────────────────────
  async function handleRegister(e) {
    e.preventDefault()

    if (isVerifying) {
      setVTouch(true)
      if (!vCode || vCode.length !== 6) {
        setRBanner('Le code de vérification doit contenir 6 chiffres.')
        return
      }
      setRBanner('')

      const fullPhone = rPhone.number ? rPhone.code + rPhone.number : ''
      const res = await register({
        firstName:    rFirst.trim(),
        lastName:     rLast.trim(),
        email:        rEmail.trim(),
        password:     rPass,
        phone:        fullPhone || undefined,
        cin:          lRole === 'Citoyen' ? (rCin.trim() || undefined) : undefined,
        department:   lRole === 'Agent'   ? (rDept.trim() || undefined) : undefined,
        municipality: 'Tunis',
        role:         lRole === 'Agent' ? 'Agent' : 'Citoyen',
        verificationCode: vCode,
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
        setRBanner(res.message || "Erreur lors de l'inscription. Réessayez.")
      }
      return
    }

    setRSubmitted(true)
    setRTouch({
      firstName: true, lastName: true, email: true,
      phone: true, cin: true, password: true,
      confirm: true, terms: true,
    })

    const errs = {}
    if (!rFirst.trim())                errs.firstName = 'Le prénom est requis.'
    else if (rFirst.trim().length < 2) errs.firstName = 'Minimum 2 caractères.'
    if (!rLast.trim())                 errs.lastName  = 'Le nom est requis.'
    else if (rLast.trim().length < 2)  errs.lastName  = 'Minimum 2 caractères.'
    if (!rEmail.trim())                errs.email     = 'L\'email est requis.'
    else if (!isEmail(rEmail))         errs.email     = 'Format invalide. Ex: nom@exemple.com'
    if (rPhone.number && !isPhone(rPhone.number)) errs.phone = 'Le numéro ne doit contenir que des chiffres.'
    if (rCin && !isCin(rCin))          errs.cin       = 'Le CIN doit contenir exactement 8 chiffres.'
    if (!rPass)                        errs.password  = 'Le mot de passe est requis.'
    else if (rPass.length < 8)         errs.password  = 'Minimum 8 caractères requis.'
    if (!rConf)                        errs.confirm   = 'Confirmez votre mot de passe.'
    else if (rPass !== rConf)          errs.confirm   = 'Les mots de passe ne correspondent pas.'
    if (!rTerms)                       errs.terms     = 'Vous devez accepter les conditions pour continuer.'

    if (Object.keys(errs).length) { setRErr(errs); return }
    setRBanner('')

    setVLoading(true)
    try {
      const res = await authAPI.sendVerification(rEmail.trim(), rFirst.trim())
      if (res.success) {
        setIsVerifying(true)
        setRBanner('')
      } else {
        setRBanner(res.message || 'Erreur lors de l\'envoi de l\'email.')
      }
    } catch (err) {
      setRBanner(err.response?.data?.message || 'Erreur lors de l\'envoi de l\'email de vérification.')
    } finally {
      setVLoading(false)
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

      {/* ── RIGHT FORM ───────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6 relative">
        <div className="w-full max-w-[460px] mx-auto">

          {/* Mobile logo + Public feed button */}
          <div className="flex items-center justify-between mb-4 lg:hidden">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-[#1A3C6B] rounded-xl flex items-center justify-center">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="white">
                  <path d="M12 2L2 7v10l10 5 10-5V7L12 2zm0 2.5 7.5 3.75v6.5L12 18.5 4.5 14.75v-6.5z"/>
                </svg>
              </div>
              <span className="font-syne text-lg font-bold text-[#1A3C6B]">BlediGo</span>
            </div>
            <button
              onClick={() => navigate('/public-feed')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12.5px] font-medium rounded-full border border-border-2 text-t2 hover:border-primary hover:text-primary transition-colors"
            >
              <Globe size={13} /> Feed public
            </button>
          </div>

          {/* Desktop top-right button */}
          <div className="hidden lg:block absolute top-6 right-6">
            <button
              onClick={() => navigate('/public-feed')}
              className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium rounded-full border border-border-2 text-t2 hover:border-primary hover:text-primary transition-colors bg-white/80 backdrop-blur-sm shadow-sm"
            >
              <Globe size={14} /> Voir les réclamations publiques
            </button>
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

                <div className="flex items-center gap-2 mt-2 px-2.5 py-1.5 rounded-lg text-[11.5px] font-medium transition-all"
                  style={{ backgroundColor: selectedRole?.bg, color: selectedRole?.color }}>
                  <div className="w-1 h-1 rounded-full shrink-0" style={{ backgroundColor: selectedRole?.color }}/>
                  <span>{selectedRole?.desc}</span>
                </div>
              </div>

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
                  {lRole !== 'Admin' && (
                    <button type="button" onClick={() => { switchTo('forgot_password'); setFEmail(lEmail) }} className="text-[12px] font-medium hover:underline"
                      style={{ color: selectedRole?.color }}>
                      Mot de passe oublié ?
                    </button>
                  )}
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
              FORGOT PASSWORD
          ══════════════════════════════════════════════ */}
          {view === 'forgot_password' && (
            <div className="animate-fade-up">
              <div className="mb-4">
                <h2 className="font-syne text-[24px] font-black text-gray-900 mb-1">Mot de passe oublié</h2>
                <p className="text-[13px] text-gray-500">
                  {fPhase === 'email'    && `Saisissez votre adresse email pour recevoir un code (${lRole}).`}
                  {fPhase === 'code'     && `Un code a été envoyé à ${fEmail}. Saisissez-le ci-dessous.`}
                  {fPhase === 'password' && 'Créez un nouveau mot de passe sécurisé.'}
                </p>
              </div>

              {fBanner && (
                <div className="flex items-start gap-2 px-3 py-2.5 bg-red-50 border-2 border-red-200 rounded-xl text-[12px] text-red-700 mb-4 animate-fade-up">
                  <AlertCircle size={14} className="shrink-0 mt-0.5 text-red-500"/>
                  <span className="flex-1">{fBanner}</span>
                  <button type="button" onClick={() => setFBanner('')} className="text-red-400 hover:text-red-600 shrink-0"><X size={13}/></button>
                </div>
              )}

              {/* PHASE 1: EMAIL */}
              {fPhase === 'email' && (
                <form onSubmit={handleForgotEmail} noValidate className="flex flex-col gap-3">
                  <Field label="Adresse email" required error={fTouch.email ? fErr.email : undefined}>
                    <Input type="email" value={fEmail} placeholder="votre@email.com"
                      onChange={e => setFEmail(e.target.value)} onBlur={() => touchF('email')}
                      icon={Mail} autoComplete="email"
                      error={fErr.email} touched={fTouch.email}/>
                  </Field>
                  <button type="submit" disabled={vLoading}
                    className="w-full mt-2 flex items-center justify-center gap-2 text-white font-semibold text-[13px] py-2.5 rounded-xl transition-all hover:-translate-y-px active:translate-y-0 disabled:opacity-60"
                    style={{ backgroundColor: selectedRole?.color }}>
                    {vLoading ? (
                      <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><circle cx="12" cy="12" r="10" strokeOpacity="0.3"/><path d="M12 2a10 10 0 0 1 10 10"/></svg> Envoi…</>
                    ) : (
                      <>Envoyer le code <ChevronRight size={15}/></>
                    )}
                  </button>
                  <button type="button" onClick={() => switchTo('login')}
                    className="mt-1 text-[12px] font-medium text-gray-500 hover:text-gray-700 underline text-center w-full">
                    Retour à la connexion
                  </button>
                </form>
              )}

              {/* PHASE 2: CODE VERIFICATION */}
              {fPhase === 'code' && (
                <form onSubmit={handleForgotVerifyCode} noValidate className="flex flex-col gap-3 animate-fade-up">
                  <div className="bg-[#EEF3FB] p-4 rounded-xl border border-[#1A3C6B]/20 mb-1 text-center">
                    <p className="text-[13px] text-[#1A3C6B] leading-snug">
                      Code envoyé à <strong>{fEmail}</strong>.<br/>
                      Valable 10 minutes.
                    </p>
                  </div>
                  <Field label="Code de vérification (6 chiffres)" required error={fTouch.code ? fErr.code : undefined}>
                    <Input value={fCode} placeholder="123456" maxLength={6}
                      onChange={e => { setFCode(e.target.value.replace(/\D/g, '')); setFTouch(p => ({...p, code: true})) }}
                      icon={Lock} touched={fTouch.code} error={fErr.code}/>
                  </Field>
                  <button type="submit" disabled={vLoading}
                    className="w-full mt-2 flex items-center justify-center gap-2 text-white font-semibold text-[13px] py-2.5 rounded-xl transition-all hover:-translate-y-px active:translate-y-0 disabled:opacity-60"
                    style={{ backgroundColor: selectedRole?.color }}>
                    {vLoading ? (
                      <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><circle cx="12" cy="12" r="10" strokeOpacity="0.3"/><path d="M12 2a10 10 0 0 1 10 10"/></svg> Vérification…</>
                    ) : (
                      <>Vérifier le code <ShieldCheck size={15}/></>
                    )}
                  </button>
                  <div className="flex items-center justify-between mt-1">
                    <button type="button" onClick={() => setFPhase('email')}
                      className="text-[12px] font-medium text-gray-500 hover:text-gray-700 underline">
                      Retour
                    </button>
                    <button type="button" onClick={async () => {
                      setVLoading(true); setResendMsg('');
                      try {
                        const r = await authAPI.requestPasswordReset(fEmail.trim(), lRole)
                        if (r.success) { setResendMsg('Code renvoyé !'); setTimeout(() => setResendMsg(''), 3000) }
                        else setFBanner(r.message || 'Erreur')
                      } catch(e) { setFBanner('Erreur.') }
                      finally { setVLoading(false) }
                    }} disabled={vLoading} className="text-[12px] font-medium text-[#1A3C6B] hover:text-[#0b1c34] underline disabled:opacity-50">
                      {resendMsg || 'Renvoyer le code'}
                    </button>
                  </div>
                </form>
              )}

              {/* PHASE 3: NEW PASSWORD */}
              {fPhase === 'password' && (
                <form onSubmit={handleForgotReset} noValidate className="flex flex-col gap-3 animate-fade-up">
                  <Field label="Nouveau mot de passe" required error={fTouch.password ? fErr.password : undefined}>
                    <Input type={showFP ? 'text' : 'password'} value={fPass} placeholder="Nouveau mot de passe"
                      onChange={e => setFPass(e.target.value)} onBlur={() => touchF('password')}
                      icon={Lock} autoComplete="new-password"
                      error={fErr.password} touched={fTouch.password}
                      right={
                        <button type="button" onClick={() => setShowFP(v => !v)}
                          className="text-gray-400 hover:text-gray-600 p-0.5">
                          {showFP ? <EyeOff size={14}/> : <Eye size={14}/>}
                        </button>
                      }/>
                  </Field>
                  <Field label="Confirmer le mot de passe" required error={fTouch.confirm ? fErr.confirm : undefined}
                    success={fConf && fPass === fConf && !fErr.confirm ? 'Correspond' : undefined}>
                    <Input type="password" value={fConf} placeholder="Confirmer le mot de passe"
                      onChange={e => setFConf(e.target.value)} onBlur={() => touchF('confirm')}
                      icon={Lock} autoComplete="new-password"
                      error={fErr.confirm} touched={fTouch.confirm}
                      right={
                        fConf ? fPass === fConf
                          ? <Check size={14} className="text-green-500"/>
                          : <X size={14} className="text-red-400"/>
                        : null
                      }/>
                  </Field>
                  <button type="submit" disabled={vLoading}
                    className="w-full mt-2 flex items-center justify-center gap-2 text-white font-semibold text-[13px] py-2.5 rounded-xl transition-all hover:-translate-y-px active:translate-y-0 disabled:opacity-60"
                    style={{ backgroundColor: selectedRole?.color }}>
                    {vLoading ? (
                      <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><circle cx="12" cy="12" r="10" strokeOpacity="0.3"/><path d="M12 2a10 10 0 0 1 10 10"/></svg> Enregistrement…</>
                    ) : (
                      <>Enregistrer le mot de passe <ShieldCheck size={15}/></>
                    )}
                  </button>
                  <button type="button" onClick={() => setFPhase('code')}
                    className="mt-1 text-[12px] font-medium text-gray-500 hover:text-gray-700 underline text-center w-full">
                    Retour
                  </button>
                </form>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════
              REGISTER
          ══════════════════════════════════════════════ */}
          {view === 'register' && (
            <div className="animate-fade-up">
              <div className="mb-3">
                <h2 className="font-syne text-[24px] font-black text-gray-900 mb-1">Créer un compte</h2>
              </div>

              {rBanner && (
                <div className="flex items-start gap-2 px-3 py-2.5 bg-red-50 border-2 border-red-200 rounded-xl text-[12px] text-red-700 mb-4 animate-fade-up">
                  <AlertCircle size={14} className="shrink-0 mt-0.5 text-red-500"/>
                  <span className="flex-1">{rBanner}</span>
                  <button onClick={() => setRBanner('')} className="text-red-400 hover:text-red-600 shrink-0"><X size={13}/></button>
                </div>
              )}

              {isVerifying ? (
                <form onSubmit={handleRegister} noValidate className="flex flex-col gap-3 animate-fade-up">
                  <div className="bg-[#EEF3FB] p-4 rounded-xl border border-[#1A3C6B] border-opacity-20 mb-2">
                    <p className="text-[13px] text-[#1A3C6B] leading-snug text-center">
                      Un code de vérification a été envoyé à <strong>{rEmail}</strong>.<br/>
                      Veuillez le saisir ci-dessous pour valider votre inscription.
                    </p>
                  </div>
                  <Field label="Code de vérification (6 chiffres)" required error={vTouch && (!vCode || vCode.length !== 6) ? 'Le code de vérification doit contenir 6 chiffres.' : undefined}>
                    <Input value={vCode} placeholder="123456" maxLength={6}
                      onChange={e => { setVCode(e.target.value.replace(/\D/g, '')); setVTouch(true); }}
                      icon={Lock} touched={vTouch} error={vTouch && (!vCode || vCode.length !== 6) ? 'Erreur' : undefined} className="text-center tracking-[0.5em] font-bold text-lg" />
                  </Field>
                  <button type="submit" disabled={loading}
                    className="w-full mt-2 flex items-center justify-center gap-2 bg-[#1A3C6B] text-white font-semibold text-[13px] py-2.5 rounded-xl transition-all hover:bg-[#122b4d] hover:-translate-y-px disabled:opacity-60">
                    {loading ? (
                      <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><circle cx="12" cy="12" r="10" strokeOpacity="0.3"/><path d="M12 2a10 10 0 0 1 10 10"/></svg> Vérification…</>
                    ) : (
                      <>Valider et créer le compte <ShieldCheck size={15}/></>
                    )}
                  </button>
                  <div className="flex items-center justify-between mt-1">
                    <button type="button" onClick={() => setIsVerifying(false)}
                      className="text-[12px] font-medium text-gray-500 hover:text-gray-700 underline">
                      Retour
                    </button>
                    <div className="flex items-center gap-2">
                      {resendMsg && <span className="text-[11px] text-green-600 font-medium animate-fade-up">{resendMsg}</span>}
                      <button type="button" onClick={handleResendCode} disabled={vLoading}
                        className="text-[12px] font-medium text-[#1A3C6B] hover:text-[#0b1c34] underline disabled:opacity-50 flex items-center gap-1">
                        {vLoading ? (
                          <><svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" strokeOpacity="0.3"/><path d="M12 2a10 10 0 0 1 10 10"/></svg> Envoi...</>
                        ) : (
                          'Renvoyer le code'
                        )}
                      </button>
                    </div>
                  </div>
                </form>
              ) : (
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

                {/* Phone + Département/CIN on the same row */}
                <div className="grid grid-cols-2 gap-2.5">
                  {/* Phone field (left column) */}
                  <div>
                    <Field label="Téléphone" error={rTouch.phone || rSubmitted ? rErr.phone : undefined}>
                      <PhoneInput
                        value={rPhone}
                        onChange={(newPhone) => setRPhone(newPhone)}
                        error={rErr.phone}
                        touched={rTouch.phone || rSubmitted}
                        onBlur={() => touchR('phone')}
                      />
                    </Field>
                  </div>

                  {/* Right column: Département (if Agent) or CIN (if Citoyen) */}
                  <div>
                    {lRole === 'Agent' ? (
                      <Field label="Département">
                        <Select
                          value={rDept}
                          onChange={e => setRDept(e.target.value)}
                          onBlur={() => touchR('department')}
                          placeholder="Département"
                          icon={Building2}
                          error={rErr.department}
                          touched={rTouch.department}
                        >
                          <option value="Direction Technique">Direction Technique</option>
                          <option value="Service Voirie">Service Voirie</option>
                          <option value="Service Propreté">Service Propreté</option>
                          <option value="Service Transport">Service Transport</option>
                          <option value="Service Espaces verts">Service Espaces verts</option>
                          <option value="Service Eau & Assainissement">Service Eau & Assainissement</option>
                          <option value="Service Bâtiments publics">Service Bâtiments publics</option>
                          <option value="Administration">Administration</option>
                        </Select>
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

                <button type="submit" disabled={vLoading || loading}
                  className="w-full mt-1 flex items-center justify-center gap-2 bg-[#E8873A] text-white font-semibold text-[13px] py-2.5 rounded-xl transition-all hover:bg-[#d4762c] hover:-translate-y-px disabled:opacity-60">
                  {vLoading ? (
                    <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><circle cx="12" cy="12" r="10" strokeOpacity="0.3"/><path d="M12 2a10 10 0 0 1 10 10"/></svg> Envoi du code…</>
                  ) : (
                    <>Continuer <ChevronRight size={15}/></>
                  )}
                </button>
              </form>
              )}

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