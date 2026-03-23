import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, LogOut, Menu } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import Avatar from '../ui/Avatar'
import logoImg from '../../assets/BlediGo Logo.png'

const ROLE_LABELS = { user:'Espace Citoyen', agent:'Espace Agent', admin:'Administration' }

function SidebarContent({ role, navItems, user, activeSection, onSectionChange, onClose, collapsed = false, onToggleCollapse, enableToggle = false }) {
  const navigate = useNavigate()
  const { logout } = useAuth()
  // Track current path so href items also highlight correctly
  const [currentPath, setCurrentPath] = React.useState(window.location.pathname)

  function handleItemClick(item) {
    if (item.href) {
      navigate(item.href)
      setCurrentPath(item.href)
      onClose?.()
    } else {
      onSectionChange?.(item.section)
      setCurrentPath('')
      onClose?.()
    }
  }

  const handleLogoClick = () => {
    if (enableToggle && onToggleCollapse) {
      onToggleCollapse()
    }
  }

  return (
    <div className="flex flex-col h-full relative">
      {/* Header with logo (clickable on desktop) */}
      <div className="relative px-4 py-5 border-b border-white/10 flex items-center gap-3 shrink-0 bg-primary/95">
        <div className="absolute inset-0 bg-gradient-to-r from-white/5 to-transparent pointer-events-none" />
        <button
          onClick={handleLogoClick}
          className={`shrink-0 focus:outline-none transition-transform duration-200 hover:scale-105 ${enableToggle ? 'cursor-pointer' : 'cursor-default'}`}
        >
          <img
            src={logoImg}
            alt="BlediGo"
            className={`object-contain transition-all duration-300 ${
              collapsed ? 'w-9 h-9' : 'w-11 h-11'
            }`}
          />
        </button>
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <div className="font-syne text-[18px] font-extrabold text-white leading-tight tracking-tight">
              BlediGo
            </div>
            <div className="text-[10px] text-white/50 uppercase tracking-wider mt-0.5 truncate">
              {ROLE_LABELS[role]}
            </div>
          </div>
        )}
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden text-white/60 hover:text-white p-1 rounded-md transition-colors"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto hide-scroll px-3 py-4 space-y-4">
        {navItems.map((group, gi) => (
          <div key={gi} className="space-y-1.5">
            {group.label && !collapsed && (
              <p className="text-[10px] font-bold text-white/40 uppercase tracking-wider px-2 mb-2">
                {group.label}
              </p>
            )}
            {group.items.map((item) => {
              const isActive = item.href
                ? currentPath === item.href || window.location.pathname === item.href
                : activeSection === item.section
              return (
                <button
                  key={item.section || item.href}
                  onClick={() => handleItemClick(item)}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium
                    transition-all duration-200 cursor-pointer text-left relative
                    ${isActive
                      ? `bg-white/15 text-white shadow-sm ${!collapsed ? 'border-l-2 border-accent' : ''}`
                      : 'text-white/70 hover:bg-white/10 hover:text-white'
                    }
                    ${collapsed ? 'justify-center px-2' : ''}
                  `}
                  style={isActive && !collapsed ? { paddingLeft: 'calc(0.75rem - 2px)' } : {}}
                >
                  {/* Icon container */}
                  <span className={`shrink-0 relative ${isActive ? 'opacity-100' : 'opacity-70'}`}>
                    {item.icon}
                    {collapsed && !!item.badge && (
                      <span
                        className={`absolute -top-2 -right-3 text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white whitespace-nowrap ${
                          item.badgeRed ? 'bg-danger' : 'bg-accent'
                        }`}
                        style={{ transform: 'translate(30%, -30%)' }}
                      >
                        {item.badge}
                      </span>
                    )}
                  </span>
                  {!collapsed && (
                    <>
                      <span className="flex-1 min-w-0 truncate">{item.label}</span>
                      {!!item.badge && (
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center text-white ${
                            item.badgeRed ? 'bg-danger' : 'bg-accent'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </>
                  )}
                </button>
              )
            })}
          </div>
        ))}
      </nav>

      {/* User section */}
      <button
        onClick={logout}
        className={`mx-3 mb-4 flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/10 transition-colors text-left group ${
          collapsed ? 'justify-center' : ''
        }`}
      >
        <Avatar name={user.name || 'U'} color={user.color || '#E8873A'} size={collapsed ? 32 : 34} />
        {!collapsed && (
          <>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold text-white truncate">{user.name}</div>
              <div className="text-[11px] text-white/40 truncate">Se déconnecter</div>
            </div>
            <LogOut size={14} className="text-white/40 group-hover:text-white/70 transition-colors shrink-0" />
          </>
        )}
      </button>
    </div>
  )
}

export default function Sidebar({ role, navItems, user, activeSection, onSectionChange }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  const toggleCollapse = () => setCollapsed(prev => !prev)

  const [isDesktop, setIsDesktop] = useState(false)
  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 1024)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  return (
    <>
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-3 left-3 z-50 w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-md hover:bg-primary-dark transition-colors"
      >
        <Menu size={20} className="text-white" />
      </button>

      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <div
        className={`
          lg:hidden fixed left-0 top-0 bottom-0 z-50 w-[280px] bg-primary
          transition-transform duration-300 ease-out dot-texture overflow-hidden
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <SidebarContent
          role={role}
          navItems={navItems}
          user={user}
          activeSection={activeSection}
          onSectionChange={onSectionChange}
          onClose={() => setMobileOpen(false)}
          collapsed={false}
          enableToggle={false}
        />
      </div>

      <div
        className={`
          hidden lg:flex flex-col h-screen bg-primary relative shadow-xl transition-all duration-300 ease-out
          ${collapsed ? 'w-[80px]' : 'w-[260px]'}
        `}
      >
        <div className="absolute inset-0 dot-texture pointer-events-none" />
        <SidebarContent
          role={role}
          navItems={navItems}
          user={user}
          activeSection={activeSection}
          onSectionChange={onSectionChange}
          collapsed={collapsed}
          onToggleCollapse={toggleCollapse}
          enableToggle={isDesktop}
        />
      </div>
    </>
  )
}