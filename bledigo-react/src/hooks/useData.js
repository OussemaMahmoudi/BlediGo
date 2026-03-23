/**
 * useData hooks — real API only, empty array on failure (no mock fallback)
 */
import { useState, useEffect, useCallback } from 'react'
import {
  reclamationsAPI, servicesAPI, usersAPI, agentsAPI, notificationsAPI,
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

// Demands: fetched from all services, flattened
export function useDemandes() {
  const [data,    setData]    = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    try {
      const res      = await servicesAPI.getAll({ limit: 100 })
      const services = Array.isArray(res?.data) ? res.data
                     : res?.data?.services ?? []
      // Flatten all demands from all services, attach service info
      const all = []
      services.forEach(svc => {
        ;(svc.demands || []).forEach(d => {
          all.push({
            ...d,
            serviceId:   svc._id || svc.id,
            serviceName: svc.name,
            serviceCategory: svc.category,
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
      const recs = Array.isArray(res?.data) ? res.data : res?.data?.reclamations ?? []
      const all  = []
      recs.forEach(r => {
        ;(r.comments || []).forEach(c => {
          all.push({
            ...c,
            reclamationId:    r._id || r.id,
            reclamationTitle: r.title,
            flagged: false, // backend auto-rejects banned words; flagged = false by default
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
