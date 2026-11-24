import { Routes, Route, Navigate } from 'react-router-dom'
import { MainLayout } from '@/components/layout/MainLayout'
import { DashboardPage } from '@/pages/DashboardPage'
import { DayPlanningPage } from '@/pages/DayPlanningPage'
import { MapViewPage } from '@/pages/MapViewPage'
import { OrdersPage } from '@/pages/OrdersPage'
import { StaffPage } from '@/pages/StaffPage'
import { BuildingsPage } from '@/pages/BuildingsPage'
import { WorkTypesPage } from '@/pages/WorkTypesPage'
import { EventsPage } from '@/pages/EventsPage'
import { PgpGroupsPage } from '@/pages/PgpGroupsPage'
import { AlertsPage } from '@/pages/AlertsPage'
import { AdminPage } from '@/pages/AdminPage'
import { LoginPage } from '@/pages/LoginPage'
import { useAuthStore } from '@/store/authStore'
import { useAuthCheck } from '@/hooks/useAuth'

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const user = useAuthStore((state) => state.user)
  const { isLoading, isError, error } = useAuthCheck()

  const isAuthError = isError && (error as { response?: { status: number } })?.response?.status === 401

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  if (!isAuthenticated || !user || isAuthError) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

const RoleRoute = ({ children, allow }: { children: React.ReactNode; allow: string[] }) => {
  const user = useAuthStore((state) => state.user)
  if (!user || !allow.includes(user.role)) {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}

const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const user = useAuthStore((state) => state.user)

  // If user is authenticated in store, redirect to dashboard
  if (isAuthenticated && user) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/map" element={<MapViewPage />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/day-planning" element={<DayPlanningPage />} />
        <Route path="/events" element={<EventsPage />} />
        <Route path="/alerts" element={<AlertsPage />} />
        <Route path="/pgp-groups" element={<PgpGroupsPage />} />
        {/* Admin-only routes */}
        <Route path="/admin" element={<RoleRoute allow={['ADMIN']}><AdminPage /></RoleRoute>} />
        <Route path="/staff" element={<RoleRoute allow={['ADMIN']}><StaffPage /></RoleRoute>} />
        <Route path="/buildings" element={<RoleRoute allow={['ADMIN']}><BuildingsPage /></RoleRoute>} />
        <Route path="/work-types" element={<RoleRoute allow={['ADMIN']}><WorkTypesPage /></RoleRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
