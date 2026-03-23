import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { authAPI } from '../services/api'

const TOKEN_KEY = 'bledigo_token'
const USER_KEY  = 'bledigo_user'

const ROLE_ROUTES = {
  Citoyen: '/user/dashboard',
  Agent:   '/agent/dashboard',
  Admin:   '/admin/dashboard',
}

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const navigate = useNavigate()

  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY))
  const [user,  setUser]  = useState(() => {
    try { return JSON.parse(localStorage.getItem(USER_KEY)) } catch { return null }
  })
  const [loading, setLoading] = useState(false)

  const persist = useCallback((tok, usr) => {
    if (tok) {
      localStorage.setItem(TOKEN_KEY, tok)
      localStorage.setItem(USER_KEY,  JSON.stringify(usr))
    } else {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USER_KEY)
    }
    setToken(tok)
    setUser(usr)
  }, [])

  // ── LOGIN — role is sent to backend, which queries the correct collection ──
  const login = useCallback(async (email, password, role) => {
    setLoading(true)
    try {
      const res = await authAPI.login(email, password, role)
      persist(res.token, res.user)
      const dest = ROLE_ROUTES[res.user.role] || '/user/dashboard'
      return { success: true, dest, user: res.user }
    } catch (err) {
      const data    = err.response?.data || {}
      const message = data.message || 'Email ou mot de passe incorrect.'
      const errors  = data.errors  || []
      return { success: false, message, errors }
    } finally {
      setLoading(false)
    }
  }, [persist])

  // ── REGISTER — always creates a Citoyen ──────────────
  const register = useCallback(async (data) => {
    setLoading(true)
    try {
      const res = await authAPI.register(data)
      persist(res.token, res.user)
      return { success: true, user: res.user }
    } catch (err) {
      const d = err.response?.data || {}
      return { success: false, message: d.message || "Erreur lors de l'inscription.", errors: d.errors || [] }
    } finally {
      setLoading(false)
    }
  }, [persist])

  // ── LOGOUT ────────────────────────────────────────────
  const logout = useCallback(() => {
    persist(null, null)
    navigate('/login', { replace: true })
  }, [persist, navigate])

  // ── REFRESH — re-fetches user from correct collection ─
  const refreshUser = useCallback(async () => {
    if (!token) return
    try {
      const res = await authAPI.getMe()
      if (res?.user) {
        setUser(res.user)
        localStorage.setItem(USER_KEY, JSON.stringify(res.user))
      }
    } catch (err) {
      // Only logout on 401 — not on network errors or 500s
      if (err?.response?.status === 401) logout()
    }
  }, [token, logout])

  useEffect(() => {
    if (token && !user) refreshUser()
  }, []) // eslint-disable-line

  return (
    <AuthContext.Provider value={{
      user, token, loading,
      isAuthenticated: !!token && !!user,
      isAdmin:   user?.role === 'Admin',
      isAgent:   user?.role === 'Agent',
      isCitoyen: user?.role === 'Citoyen',
      login, register, logout, refreshUser,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
