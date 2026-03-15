import { BrowserRouter, Routes, Route } from 'react-router';
import { QueryProvider } from '@/providers/query-provider';
import { AuthProvider } from '@/providers/auth-provider';
import { ProtectedRoute } from '@/components/layout/protected-route';
import { AppShell } from '@/components/layout/app-shell';
import LoginPage from '@/pages/login';
import TripsPage from '@/pages/trips';
import TripDashboardPage from '@/pages/trip-dashboard';
import RoutePlannerPage from '@/pages/route-planner';
import RouteEditorPage from '@/pages/route-editor';
import CalendarPage from '@/pages/calendar';
import DayDetailPage from '@/pages/day-detail';
import BudgetPage from '@/pages/budget';
import SharingPage from '@/pages/sharing';

export default function App() {
  return (
    <QueryProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              element={
                <ProtectedRoute>
                  <AppShell />
                </ProtectedRoute>
              }
            >
              <Route index element={<TripsPage />} />
              <Route path="trips/:tripId" element={<TripDashboardPage />} />
              <Route path="trips/:tripId/routes" element={<RoutePlannerPage />} />
              <Route path="trips/:tripId/routes/:routeId" element={<RouteEditorPage />} />
              <Route path="trips/:tripId/calendar" element={<CalendarPage />} />
              <Route path="trips/:tripId/calendar/:date" element={<DayDetailPage />} />
              <Route path="trips/:tripId/budget" element={<BudgetPage />} />
              <Route path="trips/:tripId/sharing" element={<SharingPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryProvider>
  );
}
