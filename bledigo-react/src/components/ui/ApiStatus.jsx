/**
 * ApiStatus
 * ─────────
 * Shows a subtle banner at the bottom of the screen when the backend
 * API is not reachable. The app continues to work with mock data.
 *
 * Usage: place once inside AppShell or App.jsx.
 */

import { useState, useEffect } from 'react'
import { WifiOff } from 'lucide-react'
import api from '../../services/api'

export default function ApiStatus() {
  const [offline, setOffline] = useState(false)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    let mounted = true
    async function ping() {
      try {
        await api.get('/health', { timeout: 3000 })
        if (mounted) setOffline(false)
      } catch {
        if (mounted) setOffline(true)
      } finally {
        if (mounted) setChecked(true)
      }
    }

    // Check immediately, then every 30 s
    ping()
    const interval = setInterval(ping, 30_000)
    return () => { mounted = false; clearInterval(interval) }
  }, [])

  if (!checked || !offline) return null

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-4 py-2.5 bg-warning-light text-warning border border-yellow-300 rounded-full text-[12.5px] font-medium shadow-md animate-fade-up">
      <WifiOff size={14} />
      Mode hors-ligne — données de démonstration actives
    </div>
  )
}
