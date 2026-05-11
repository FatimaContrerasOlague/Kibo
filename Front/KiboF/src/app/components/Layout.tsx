import { Outlet, useLocation, Navigate } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { Navbar } from './Navbar';
import { FloatingElephant } from './FloatingElephant';

export function Layout() {
  const { user, isAuthReady } = useAuth();
  const location = useLocation();

  const isAuthPage = location.pathname === '/' || location.pathname === '/register';
  const showFloatingElephant = !isAuthPage && location.pathname !== '/chatbot';

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Cargando sesión...</p>
      </div>
    );
  }

  if (!isAuthPage && !user) {
    return <Navigate to="/" replace />;
  }

  if (isAuthPage) {
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
      {showFloatingElephant && <FloatingElephant />}
    </div>
  );
}
