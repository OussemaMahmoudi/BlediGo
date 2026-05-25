import Sidebar from './Sidebar'
import Topbar from './Topbar'
import ToastContainer from '../ui/Toast'

export default function AppShell({
  role, navItems, user,
  activeSection, onSectionChange,
  topTitle, topBreadcrumb,
  notifCount = 0, onNotifClick,
  toasts = [],
  userStats = {},
  children,
}) {
  return (
    <div className="flex w-screen h-screen overflow-hidden">
      <Sidebar
        role={role} navItems={navItems} user={user}
        activeSection={activeSection} onSectionChange={onSectionChange}
      />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Topbar
          title={topTitle} breadcrumb={topBreadcrumb}
          user={user} notifCount={notifCount} onNotifClick={onNotifClick}
          userStats={userStats}
        />
        <main className="flex-1 overflow-y-auto custom-scroll p-4 lg:p-6 bg-muted">
          {children}
        </main>
      </div>
      <ToastContainer toasts={toasts}/>
    </div>
  )
}
