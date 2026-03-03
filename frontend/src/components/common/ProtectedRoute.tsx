import { useAuth } from '../../contexts/AuthContext';
import { LoadingPage } from './Spinner';
import { isPublicApp } from '../../config/appMode';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return <LoadingPage />;
  }

  if (isPublicApp || !isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}

