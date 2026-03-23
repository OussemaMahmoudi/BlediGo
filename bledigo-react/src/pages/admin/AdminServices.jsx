import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import AdminDashboard from './AdminDashboard'

// AdminServices just loads AdminDashboard pre-navigated to the services section
// It's kept as a separate route for direct-link access
export default function AdminServices() {
  // Redirect to admin dashboard — the services section is handled inside AdminDashboard via state
  const navigate = useNavigate()
  // We simply render AdminDashboard — it initializes with section='dashboard' but
  // the route /admin/services is kept for react-router semantics.
  // In a real app you'd pass initialSection='services' as a prop.
  return <AdminDashboard initialSection="services" />
}
