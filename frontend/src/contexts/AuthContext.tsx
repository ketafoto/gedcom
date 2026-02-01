import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../api/auth';
import type { User } from '../types/models';

// Default username - matches backend DEFAULT_USERNAME
const DEFAULT_USERNAME = 'inovoseltsev';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Fetch user info from backend (no auth required)
    const fetchUser = async () => {
      try {
        const userData = await authApi.me();
        setUser(userData);
      } catch {
        // Fallback to default user if backend is not available
        setUser({
          id: 1,
          username: DEFAULT_USERNAME,
          email: `${DEFAULT_USERNAME}@localhost`,
          is_active: true,
          is_admin: true,
          created_at: new Date().toISOString(),
        });
      } finally {
        setIsLoading(false);
      }
    };
    fetchUser();
  }, []);

  // Logout function (no-op in this simplified auth setup)
  const logout = async () => {
    // In this app, user is always authenticated, so logout just reloads the page
    window.location.reload();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: true, // Always authenticated
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

