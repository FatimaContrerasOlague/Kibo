import { Outlet, useLocation, Navigate } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { Navbar } from './Navbar';

export function Layout() {
  const { user } = useAuth();
  const location = useLocation();

  const isAuthPage = location.pathname === '/' || location.pathname === '/register';

  if (isAuthPage || !user) {
    return (
      <div className="min-h-screen bg-background">
        <Outlet />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <Outlet />
      </main>
    </div>
  );
}
