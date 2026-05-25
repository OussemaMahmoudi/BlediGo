/**
 * useData hooks — real API only, empty array on failure (no mock fallback)
 */
import { useState, useEffect, useCallback } from 'react'
import {
  reclamationsAPI, servicesAPI, usersAPI, agentsAPI, notificationsAPI, messagesAPI
} from '../services/api'

function useApiData(apiFn, deps = []) {
  const [data,    setData]    = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res     = await apiFn()
      const payload = res?.data
      if (Array.isArray(payload)) {
        setData(payload)
      } else if (payload && typeof payload === 'object') {
        const arr = Object.values(payload).find(Array.isArray)
        setData(arr ?? [])
      } else {
        setData([])
      }
    } catch (err) {
      console.warn('[useData] API error:', err.message)
      setError(err.message)
      setData([])
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => { refetch() }, [refetch])

  return { data, loading, error, refetch, setData }
}

export function useMyReclamations(params = {}) {
  return useApiData(() => reclamationsAPI.getMyHistory(params), [JSON.stringify(params)])
}

export function useReclamations(params = {}) {
  return useApiData(() => reclamationsAPI.getAll(params), [JSON.stringify(params)])
}

export function usePublicFeed(params = {}) {
  return useApiData(() => reclamationsAPI.getPublic(params), [JSON.stringify(params)])
}

export function useServices(params = {}) {
  return useApiData(() => servicesAPI.getAll(params), [JSON.stringify(params)])
}

// BF10: citizen's own demand history
export function useMyDemands() {
  const [data,    setData]    = useState([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    setLoading(true)
    try {
      const res = await servicesAPI.getMyDemands()
      // API returns { success, data: [...] }
      const arr = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : []
      setData(arr)
    } catch {
      setData([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refetch() }, [refetch])
  return { data, loading, setData, refetch }
}

// Demands: fetched from all services, flattened
export function useDemandes() {
  const [data,    setData]    = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    try {
      const res = await servicesAPI.getAll({ limit: 100 })
      // servicesAPI.getAll → axio → unwrap → res.data (whatever structure)
      // The server returns { success, data: { services: [...], pagination: {} } }
      const payload  = res?.data ?? res
      const services = Array.isArray(payload) ? payload
                     : Array.isArray(payload?.services) ? payload.services
                     : []
      // Flatten all demands from all services, attach service info
      const all = []
      services.forEach(svc => {
        ;(svc.demands || []).forEach(d => {
          all.push({
            ...d,
            serviceId:   svc._id || svc.id,
            serviceName: svc.name,
            serviceCategory: svc.category,
            avgRating:   svc.stats?.avgRating,
            userRating:  (d.evaluation?.score >= 1) ? d.evaluation.score : null,
            rated:       (d.evaluation?.score >= 1),
          })
        })
      })
      // Sort newest first
      all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      setData(all)
    } catch (err) {
      console.warn('[useDemandes]', err.message)
      setData([])
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refetch() }, [refetch])
  return { data, loading, error, setData, refetch }
}

export function useUsers(params = {}) {
  return useApiData(() => usersAPI.getAll(params), [JSON.stringify(params)])
}

export function useAgents() {
  return useApiData(() => agentsAPI.getAll(), [])
}

export function useAgentReclamations(agentId, params = {}) {
  return useApiData(
    () => agentsAPI.getReclamations(agentId, params),
    [agentId, JSON.stringify(params)]
  )
}

export function useAgentDashboard() {
  return useApiData(() => agentsAPI.getMyDashboard(), [])
}

export function useNotifications(params = {}) {
  return useApiData(() => notificationsAPI.getAll(params), [JSON.stringify(params)])
}

// Comments: fetched from reclamations (admin moderation view)
export function useComments() {
  const [data,    setData]    = useState([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await reclamationsAPI.getAll({ limit: 100 })
      const recs = Array.isArray(res) ? res : res?.reclamations || res?.data?.reclamations || []
      const all  = []
      recs.forEach(r => {
        ;(r.comments || []).forEach(c => {
          all.push({
            id: c._id || c.id,
            text: c.text,
            user: c.authorName || 'Citoyen', // Assuming authorName or fallback
            time: c.createdAt ? new Date(c.createdAt).toLocaleString('fr-FR') : 'Récemment',
            timestamp: c.createdAt ? new Date(c.createdAt).getTime() : 0,
            rec: r.title || 'Réclamation',
            reclamationId: r._id || r.id,
            flagged: false, // backend auto-rejects banned words; flagged = false by default
            deleted: false
          })
        })
      })
      setData(all)
    } catch {
      setData([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refetch() }, [refetch])
  return { data, loading, error: null, setData, refetch }
}

export function useUnreadMessages() {
  const [unread, setUnread] = useState(0)
  
  const fetchUnread = useCallback(async () => {
    try {
      const res = await messagesAPI.getUnreadCount()
      if (res?.data?.count !== undefined) {
        setUnread(res.data.count)
      }
    } catch { }
  }, [])

  useEffect(() => {
    fetchUnread()
    const interval = setInterval(fetchUnread, 15000) // update every 15s in the background
    return () => clearInterval(interval)
  }, [fetchUnread])

  return unread
}
