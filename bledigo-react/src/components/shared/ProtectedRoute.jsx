import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function ProtectedRoute({ children, roles = [] }) {
  const { isAuthenticated, user } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // If role check is required but user.role is missing,
  // don't redirect in a loop — show children and let the
  // backend API calls handle authorization.
  if (roles.length > 0 && user?.role && !roles.includes(user.role)) {
    const fallback =
      user.role === 'Admin' ? '/admin/dashboard' :
      user.role === 'Agent' ? '/agent/dashboard' :
                              '/user/dashboard'
    return <Navigate to={fallback} replace />
  }

  return children
}
