/**
 * ╔══════════════════════════════════════════════════════╗
 * ║   BlediGo  –  API Service Layer                      ║
 * ║   Axios instance + JWT interceptors + all endpoints  ║
 * ╚══════════════════════════════════════════════════════╝
 */

import axios from 'axios'

// ── Base URL from env variable (set in .env) ────────────
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

// ── Create configured axios instance ───────────────────
const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
})

// ── REQUEST interceptor: attach JWT token ──────────────
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('bledigo_token')
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
  },
  (error) => Promise.reject(error)
)

// ── RESPONSE interceptor: handle 401 on AUTH routes only ──
// Only redirect to login on 401 from /auth/ endpoints.
// Data endpoints (reclamations, notifications, etc.) return 401
// when the backend is offline — we handle that in useData with
// mock fallback. A hard redirect would wipe the session incorrectly.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const url = error.config?.url || ''
      // Only force logout on auth-specific 401s
      const isAuthRoute = url.includes('/auth/me') || url.includes('/auth/login')
      if (isAuthRoute) {
        localStorage.removeItem('bledigo_token')
        localStorage.removeItem('bledigo_user')
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

// ═══════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════

/** Extract the data.data from a standard API response */
const unwrap = (res) => res.data

/** Build multipart form from a plain object + files array */
function toFormData(obj, files = [], fileField = 'images') {
  const fd = new FormData()
  Object.entries(obj).forEach(([k, v]) => {
    if (v !== undefined && v !== null) {
      if (typeof v === 'object' && !(v instanceof File)) {
        fd.append(k, JSON.stringify(v))
      } else {
        fd.append(k, v)
      }
    }
  })
  files.forEach((f) => fd.append(fileField, f))
  return fd
}

// ═══════════════════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════════════════
export const authAPI = {
  register: (data) =>
    api.post('/auth/register', data).then(unwrap),

  login: (email, password, role) =>
    api.post('/auth/login', { email, password, role }).then(unwrap),

  getMe: () =>
    api.get('/auth/me').then(unwrap),

  changePassword: (currentPassword, newPassword) =>
    api.post('/auth/change-password', { currentPassword, newPassword }).then(unwrap),
}

// ═══════════════════════════════════════════════════════
// RECLAMATIONS
// ═══════════════════════════════════════════════════════
export const reclamationsAPI = {
  /** Citizen: submit a new reclamation (multipart for images) */
  create: (data, files = []) => {
    const fd = toFormData(data, files)
    return api.post('/reclamations', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(unwrap)
  },

  /** Citizen: submit a new reclamation via multipart/form-data */
  createRaw: (formData) =>
    api.post('/reclamations', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 30_000,
    }).then(unwrap),

  /** Citizen: own history with optional filters */
  getMyHistory: (params = {}) =>
    api.get('/reclamations/my-history', { params }).then(unwrap),

  /** Admin / Agent: all reclamations with filters */
  getAll: (params = {}) =>
    api.get('/reclamations/all', { params }).then(unwrap),

  /** Public feed (no auth required) */
  getPublic: (params = {}) =>
    api.get('/reclamations/public', { params }).then(unwrap),

  /** Single reclamation detail */
  getById: (id) =>
    api.get(`/reclamations/${id}`).then(unwrap),

  /** Agent / Admin: update status */
  updateStatus: (id, status, extra = {}) =>
    api.patch(`/reclamations/${id}/status`, { status, ...extra }).then(unwrap),

  /** Admin: assign an agent */
  assignAgent: (id, agentId) =>
    api.patch(`/reclamations/${id}/assign`, { agentId }).then(unwrap),

  /** Toggle vote */
  vote: (id) =>
    api.post(`/reclamations/${id}/vote`).then(unwrap),

  /** Add comment */
  addComment: (id, text) =>
    api.post(`/reclamations/${id}/comments`, { text }).then(unwrap),

  /** Admin: delete */
  delete: (id) =>
    api.delete(`/reclamations/${id}`).then(unwrap),

  /** Citizen: cancel own reclamation (2h window) */
  cancel: (id) =>
    api.patch(`/reclamations/${id}/cancel`).then(unwrap),

  /** Admin: delete a comment */
  deleteComment: (recId, commentId) =>
    api.delete(`/reclamations/${recId}/comments/${commentId}`).then(unwrap),
}

// ═══════════════════════════════════════════════════════
// SERVICES
// ═══════════════════════════════════════════════════════
export const servicesAPI = {
  getAll: (params = {}) =>
    api.get('/services', { params }).then(unwrap),

  getById: (id) =>
    api.get(`/services/${id}`).then(unwrap),

  create: (data) =>
    api.post('/services', data).then(unwrap),

  update: (id, data) =>
    api.patch(`/services/${id}`, data).then(unwrap),

  delete: (id) =>
    api.delete(`/services/${id}`).then(unwrap),

  submitDemand: (id, data = {}) =>
    api.post(`/services/${id}/demand`, data).then(unwrap),

  processDemand: (id, demandId, status, notes = '') =>
    api.patch(`/services/${id}/demand/${demandId}`, { status, notes }).then(unwrap),

  rate: (id, score, comment = '') =>
    api.post(`/services/${id}/rate`, { score, comment }).then(unwrap),
}

// ═══════════════════════════════════════════════════════
// USERS
// ═══════════════════════════════════════════════════════
export const usersAPI = {
  getAll: (params = {}) =>
    api.get('/users', { params }).then(unwrap),

  getStats: () =>
    api.get('/users/stats').then(unwrap),

  getById: (id) =>
    api.get(`/users/${id}`).then(unwrap),

  update: (id, data) =>
    api.patch(`/users/${id}`, data).then(unwrap),

  toggleActive: (id) =>
    api.patch(`/users/${id}/toggle-active`).then(unwrap),

  delete: (id) =>
    api.delete(`/users/${id}`).then(unwrap),
}

// ═══════════════════════════════════════════════════════
// AGENTS
// ═══════════════════════════════════════════════════════
export const agentsAPI = {
  getAll: () =>
    api.get('/agents').then(unwrap),

  getWorkload: () =>
    api.get('/agents/workload').then(unwrap),

  getMyDashboard: () =>
    api.get('/agents/my-dashboard').then(unwrap),

  submitReport: (reclamationId, text, newStatus) =>
    api.post('/agents/report', { reclamationId, text, newStatus }).then(unwrap),

  toggleActive: (id) =>
    api.patch(`/agents/${id}/toggle-active`).then(unwrap),

  getReclamations: (id, params = {}) =>
    api.get(`/agents/${id}/reclamations`, { params }).then(unwrap),
}

// ═══════════════════════════════════════════════════════
// NOTIFICATIONS
// ═══════════════════════════════════════════════════════
export const notificationsAPI = {
  getAll: (params = {}) =>
    api.get('/notifications', { params }).then(unwrap),

  markRead: (id) =>
    api.patch(`/notifications/${id}/read`).then(unwrap),

  markAllRead: () =>
    api.patch('/notifications/read-all').then(unwrap),
}

// ═══════════════════════════════════════════════════════
// AI MICROSERVICE (called directly from frontend for live preview)
// In production this is called server-side; exposed here for dev
// ═══════════════════════════════════════════════════════
const AI_URL = import.meta.env.VITE_AI_URL || 'http://localhost:5000'

export const aiAPI = {
  health: () =>
    axios.get(`${AI_URL}/health`, { timeout: 2000 }).then((r) => r.data).catch(() => ({ status: 'offline' })),

  // Routes through Node backend (/api/ai/predict) to avoid CORS issues
  predict: (description, category = '') =>
    api.post('/ai/predict', { description, category }, { timeout: 8000 })
      .then((r) => r.data)
      .catch(() => ({
        urgency_level: 'Medium',
        confidence:    0.5,
        reason:        'Microservice IA hors ligne — urgence modérée par défaut.',
        classifier:    'fallback',
      })),
}


export const profileAPI = {
  getMe:          () => api.get('/profile/me').then(unwrap),
  updateMe:       (data) => api.patch('/profile/me', data).then(unwrap),
  changePassword: (currentPassword, newPassword) =>
    api.post('/auth/change-password', { currentPassword, newPassword }).then(unwrap),
}

export default api
