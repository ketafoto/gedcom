import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../api/auth';
import type { Viewer } from '../types/models';
import { isPublicApp } from '../config/appMode';

// Default owner id - matches backend DEFAULT_OWNER_ID
const DEFAULT_OWNER_ID = 'inovoseltsev';

interface AuthContextType {
  // Viewer = browser identity. It may become editable in future by role.
  viewer: Viewer | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [isLoading, setIsLoading] = useState(!isPublicApp);

  useEffect(() => {
    if (isPublicApp) {
      setViewer(null);
      setIsLoading(false);
      return;
    }

    // Fetch viewer info from backend.
    const fetchViewer = async () => {
      try {
        const viewerData = await authApi.me();
        setViewer(viewerData);
      } catch {
        // Fallback to local admin viewer if backend is not available
        setViewer({
          id: 1,
          viewer_id: DEFAULT_OWNER_ID,
          role: 'admin',
          email: `${DEFAULT_OWNER_ID}@localhost`,
          is_active: true,
          is_admin: true,
          created_at: new Date().toISOString(),
        });
      } finally {
        setIsLoading(false);
      }
    };
    fetchViewer();
  }, []);

  // Logout function (no-op in this simplified auth setup)
  const logout = async () => {
    // In this app, admin local mode stays authenticated.
    window.location.reload();
  };

  return (
    <AuthContext.Provider
      value={{
        viewer,
        isLoading,
        isAuthenticated: !isPublicApp,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

