import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider }   from './context/AuthContext'
import ProtectedRoute     from './components/shared/ProtectedRoute'
import ErrorBoundary      from './components/shared/ErrorBoundary'

import LoginPage          from './pages/auth/LoginPage'
import UserDashboard      from './pages/user/UserDashboard'
import UserSignal         from './pages/user/UserSignal'
import UserHistory        from './pages/user/UserHistory'
import AdminDashboard     from './pages/admin/AdminDashboard'
import AdminServices      from './pages/admin/AdminServices'
import AgentDashboard     from './pages/agent/AgentDashboard'
import PublicFeed         from './pages/public/PublicFeed'
import NotFound           from './pages/NotFound'

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />

          <Route path="/login"       element={<LoginPage />} />
          <Route path="/public-feed" element={<PublicFeed />} />

          <Route path="/user/dashboard" element={
            <ProtectedRoute roles={['Citoyen']}>
              <ErrorBoundary>
                <UserDashboard />
              </ErrorBoundary>
            </ProtectedRoute>
          }/>
          <Route path="/user/signal" element={
            <ProtectedRoute roles={['Citoyen']}>
              <ErrorBoundary>
                <UserSignal />
              </ErrorBoundary>
            </ProtectedRoute>
          }/>
          <Route path="/user/history" element={
            <ProtectedRoute roles={['Citoyen']}>
              <ErrorBoundary>
                <UserHistory />
              </ErrorBoundary>
            </ProtectedRoute>
          }/>

          <Route path="/admin/dashboard" element={
            <ProtectedRoute roles={['Admin']}>
              <ErrorBoundary>
                <AdminDashboard />
              </ErrorBoundary>
            </ProtectedRoute>
          }/>
          <Route path="/admin/services" element={
            <ProtectedRoute roles={['Admin']}>
              <ErrorBoundary>
                <AdminServices />
              </ErrorBoundary>
            </ProtectedRoute>
          }/>

          <Route path="/agent/dashboard" element={
            <ProtectedRoute roles={['Agent']}>
              <ErrorBoundary>
                <AgentDashboard />
              </ErrorBoundary>
            </ProtectedRoute>
          }/>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </ErrorBoundary>
  )
}
