import { useNavigate } from 'react-router-dom'
import { Home, FileText, Settings, Users } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import Button from '../components/ui/Button'

export default function NotFound() {
  const navigate = useNavigate()
  const { isAuthenticated, user } = useAuth()
  const home = !isAuthenticated ? '/login' : user?.role === 'Admin' ? '/admin/dashboard' : user?.role === 'Agent' ? '/agent/dashboard' : '/user/dashboard'

  return (
    <div className="flex flex-col w-screen h-screen font-dm overflow-hidden">
      {/* Navbar */}
      <nav className="bg-primary px-10 h-[62px] flex items-center gap-3 shrink-0">
        <div
          className="flex items-center gap-2.5 cursor-pointer"
          onClick={() => navigate(home)}
        >
          <div
            className="w-[34px] h-[34px] bg-accent rounded-[9px] flex items-center justify-center"
            style={{ boxShadow: '0 3px 10px rgba(232,135,58,0.4)' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
              <path d="M12 2L2 7v10l10 5 10-5V7L12 2zm0 2.5 7.5 3.75v6.5L12 18.5 4.5 14.75v-6.5z" />
            </svg>
          </div>
          <span className="font-syne text-[18px] font-extrabold text-white">BlediGo</span>
        </div>
      </nav>

      {/* Main */}
      <div className="flex-1 flex items-center justify-center bg-muted">
        <div className="text-center max-w-md px-6">
          {/* Floating icon */}
          <div className="animate-float mb-8">
            <svg width="90" height="90" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" fill="#EEF3FB" />
              <path d="M12 8v5" stroke="#1A3C6B" strokeWidth="2" strokeLinecap="round" />
              <circle cx="12" cy="16" r="1" fill="#1A3C6B" />
            </svg>
          </div>

          {/* 404 number */}
          <div className="font-syne text-[96px] font-extrabold text-primary leading-none tracking-[-4px] mb-3">
            4<span className="text-accent">0</span>4
          </div>

          <h1 className="font-syne text-2xl font-bold text-t1 mb-2.5">
            Page introuvable
          </h1>
          <p className="text-[14px] text-t3 leading-relaxed mb-8 max-w-sm mx-auto">
            Oops ! La page que vous recherchez n'existe pas ou a été déplacée.
            Pas d'inquiétude, votre ville est toujours là pour vous.
          </p>

          {/* Main actions */}
          <div className="flex gap-3 justify-center mb-8">
            <Button variant="primary" onClick={() => navigate(home)}>
              <Home size={15} /> Retour à l'accueil
            </Button>
            <Button variant="outline" onClick={() => navigate('/public-feed')}>
              Voir les réclamations
            </Button>
          </div>

          {/* Quick links */}
          <div className="flex gap-2 justify-center flex-wrap">
            {[
              { label: 'Espace citoyen',        icon: <Home size={13} />,     href: '/user/dashboard'  },
              { label: 'Administration',        icon: <Settings size={13} />, href: '/admin/dashboard' },
              { label: 'Espace agent',          icon: <Users size={13} />,    href: '/agent/dashboard' },
              { label: 'Réclamations publiques',icon: <FileText size={13} />, href: '/public-feed'     },
            ].map(l => (
              <button
                key={l.href}
                onClick={() => navigate(l.href)}
                className="flex items-center gap-1.5 text-[13px] text-primary font-medium px-3.5 py-1.5 rounded-[7px] hover:bg-primary/10 transition-colors"
              >
                {l.icon}{l.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="shrink-0 py-4 text-center text-[12.5px] text-t3 border-t border-border bg-white">
        © 2026 BlediGo — Plateforme de gestion des services municipaux
      </footer>
    </div>
  )
}
