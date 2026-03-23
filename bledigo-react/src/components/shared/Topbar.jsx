import { useState, useRef, useEffect } from 'react'
import { Search, Bell, LogOut, User, ChevronDown } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import Avatar from '../ui/Avatar'
import ProfilePage from '../../pages/shared/ProfilePage'

export default function Topbar({
  title, breadcrumb, user = {}, onSearch,
  notifCount = 0, onNotifClick, userStats = {},
}) {
  const { logout } = useAuth()
  const [q,           setQ]           = useState('')
  const [menuOpen,    setMenuOpen]    = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    const handle = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false) }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  return (
    <>
      <div className="h-[58px] bg-white border-b border-border flex items-center px-4 lg:px-6 gap-3 shrink-0">
        <div className="w-8 lg:hidden shrink-0"/>

        <div className="flex items-center gap-2.5 min-w-0">
          <span className="font-syne text-[15px] font-bold text-t1 whitespace-nowrap">{title}</span>
          {breadcrumb && (
            <>
              <div className="w-px h-4 bg-border shrink-0 hidden sm:block"/>
              <span className="text-[12px] text-t3 truncate hidden sm:block">{breadcrumb}</span>
            </>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <div className="hidden md:flex items-center gap-2 bg-surface-2 border border-border rounded-[9px] px-3 py-[7px] w-[200px] xl:w-[240px]">
            <Search size={13} className="text-t3 shrink-0"/>
            <input value={q}
              onChange={e => setQ(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && q.trim()) { onSearch?.(q.trim()); setQ('') } }}
              placeholder="Rechercher…"
              className="bg-transparent border-none outline-none text-[13px] text-t1 w-full placeholder:text-t3 font-dm"/>
          </div>

          <button onClick={onNotifClick}
            className="relative w-[34px] h-[34px] rounded-[8px] border border-border bg-white flex items-center justify-center hover:bg-surface-2 transition-colors shrink-0">
            <Bell size={14} className="text-t2"/>
            {notifCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-[7px] h-[7px] bg-danger rounded-full border-[1.5px] border-white"/>
            )}
          </button>

          {/* User chip → dropdown */}
          <div className="relative" ref={menuRef}>
            <button onClick={() => setMenuOpen(v => !v)}
              className="flex items-center gap-2 pl-1 pr-2.5 py-1 border border-border rounded-full hover:bg-surface-2 transition-colors">
              <Avatar name={user.name || 'U'} color={user.color || '#E8873A'} size={27}/>
              <span className="text-[13px] font-medium text-t1 hidden sm:block max-w-[100px] truncate">
                {user.shortName || user.name?.split(' ')[0] || 'Compte'}
              </span>
              <ChevronDown size={12} className={`text-t3 hidden sm:block transition-transform duration-200 ${menuOpen ? 'rotate-180' : ''}`}/>
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-[calc(100%+8px)] w-[210px] bg-white border border-border rounded-[14px] shadow-modal overflow-hidden z-50 animate-fade-up">
                <div className="px-4 py-3.5 border-b border-border">
                  <p className="text-[13.5px] font-semibold text-t1 truncate">{user.name}</p>
                  <p className="text-[11px] text-t3 mt-0.5">{user.role}</p>
                </div>
                <div className="py-1.5">
                  <button onClick={() => { setMenuOpen(false); setProfileOpen(true) }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] text-t2 hover:bg-muted hover:text-t1 transition-colors text-left">
                    <User size={14} className="text-t3 shrink-0"/> Mon profil
                  </button>
                  <button onClick={() => { setMenuOpen(false); onNotifClick?.() }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] text-t2 hover:bg-muted hover:text-t1 transition-colors text-left">
                    <Bell size={14} className="text-t3 shrink-0"/>
                    Notifications
                    {notifCount > 0 && (
                      <span className="ml-auto bg-danger text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{notifCount}</span>
                    )}
                  </button>
                </div>
                <div className="border-t border-border py-1.5">
                  <button onClick={() => { setMenuOpen(false); logout() }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] text-danger hover:bg-danger-light transition-colors text-left">
                    <LogOut size={14} className="shrink-0"/> Se déconnecter
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {profileOpen && (
        <ProfilePage onClose={() => setProfileOpen(false)} userStats={userStats}/>
      )}
    </>
  )
}
