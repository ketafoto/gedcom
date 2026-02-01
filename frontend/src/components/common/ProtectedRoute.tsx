import { useAuth } from '../../contexts/AuthContext';
import { LoadingPage } from './Spinner';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isLoading } = useAuth();

  if (isLoading) {
    return <LoadingPage />;
  }

  // Authentication is disabled - always allow access
  return <>{children}</>;
}

