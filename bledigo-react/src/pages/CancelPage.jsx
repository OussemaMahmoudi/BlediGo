import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import api from '../services/api'

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

export default function CancelPage() {
  const [params] = useSearchParams()
  const token = params.get('token')
  const type  = params.get('type') || 'reclamation'  // 'reclamation' | 'service'

  const [state, setState] = useState('loading') // loading | success | error | expired | already
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!token) { setState('error'); setMessage('Lien invalide : token manquant.'); return }

    const endpoint = type === 'service'
      ? `${BASE}/services/cancel-via-email?token=${token}`
      : `${BASE}/reclamations/cancel-via-email?token=${token}`

    // Backend returns HTML — we use fetch directly and inspect the response text
    fetch(endpoint)
      .then(async res => {
        const text = await res.text()
        if (res.ok) {
          if (text.includes('Annulation confirmée') || text.includes('annulée')) {
            setState('success')
          } else if (text.includes('déjà été traitée') || text.includes('Impossible')) {
            setState('already')
            setMessage('Cette demande a déjà été traitée ou annulée.')
          } else {
            setState('success')
          }
        } else {
          if (text.includes('expiré') || text.includes('TokenExpiredError')) {
            setState('expired')
          } else {
            setState('error')
            setMessage(text.replace(/<[^>]*>/g, '').trim() || 'Une erreur est survenue.')
          }
        }
      })
      .catch(() => { setState('error'); setMessage('Impossible de joindre le serveur.') })
  }, [token, type])

  const configs = {
    loading: {
      icon: '⏳', color: '#1A3C6B', bg: '#EEF3FB',
      title: 'Annulation en cours…',
      desc: 'Veuillez patienter quelques secondes.',
    },
    success: {
      icon: '✅', color: '#1D8C5E', bg: '#F0FFF6',
      title: 'Annulation confirmée',
      desc: 'Votre demande a bien été annulée et supprimée du système.',
    },
    already: {
      icon: '⚠️', color: '#F59E0B', bg: '#FFFBEB',
      title: 'Impossible d\'annuler',
      desc: message || 'Cette demande a déjà été traitée ou annulée.',
    },
    expired: {
      icon: '⏰', color: '#E24B4A', bg: '#FFF5F5',
      title: 'Lien expiré',
      desc: 'Ce lien d\'annulation a expiré (valable 2 heures après la soumission). Si vous souhaitez annuler, connectez-vous à votre espace citoyen.',
    },
    error: {
      icon: '❌', color: '#E24B4A', bg: '#FFF5F5',
      title: 'Erreur',
      desc: message || 'Une erreur inattendue est survenue. Veuillez réessayer.',
    },
  }

  const cfg = configs[state] || configs.error

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#F7F8FA', fontFamily: 'Arial, sans-serif', padding: '20px',
    }}>
      <div style={{
        maxWidth: '480px', width: '100%', background: '#fff',
        borderRadius: '16px', padding: '48px 36px', textAlign: 'center',
        boxShadow: '0 8px 40px rgba(0,0,0,0.08)', border: '1px solid #eee',
      }}>
        {/* Logo */}
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ color: '#1A3C6B', fontSize: '28px', fontWeight: '800', margin: 0 }}>BlediGo</h1>
          <p style={{ color: '#9CA3AF', fontSize: '13px', margin: '4px 0 0' }}>Plateforme Municipale</p>
        </div>

        {/* Icon */}
        <div style={{
          width: '80px', height: '80px', borderRadius: '50%',
          background: cfg.bg, display: 'flex', alignItems: 'center',
          justifyContent: 'center', margin: '0 auto 24px', fontSize: '36px',
          border: `2px solid ${cfg.color}22`,
        }}>
          {cfg.icon}
        </div>

        {/* Title */}
        <h2 style={{ color: cfg.color, fontSize: '22px', fontWeight: '700', margin: '0 0 12px' }}>
          {cfg.title}
        </h2>

        {/* Description */}
        <p style={{ color: '#6B7280', fontSize: '15px', lineHeight: '1.6', margin: '0 0 32px' }}>
          {cfg.desc}
        </p>

        {/* Actions */}
        {state !== 'loading' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <a
              href="http://localhost:5173/login"
              style={{
                display: 'block', padding: '13px 24px', background: '#1A3C6B',
                color: '#fff', textDecoration: 'none', borderRadius: '10px',
                fontWeight: '700', fontSize: '15px',
              }}
            >
              Accéder à mon espace citoyen
            </a>
            <button
              onClick={() => window.close()}
              style={{
                padding: '11px 24px', background: 'transparent',
                border: '1px solid #E5E7EB', borderRadius: '10px',
                color: '#6B7280', cursor: 'pointer', fontSize: '14px', fontWeight: '600',
              }}
            >
              Fermer cette fenêtre
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
