// src/contexts/AuthContext.tsx

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '../services/apiService';

interface User {
  id: string;
  username: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Verify token on mount
  useEffect(() => {
    const verifyAuth = async () => {
      try {
        const token = api.tokenManager.getToken();
        if (token) {
          const response = await api.auth.verify();
          if (response.valid && response.user) {
            setUser(response.user);
          }
        }
      } catch (error) {
        console.error('Auth verification failed:', error);
        api.tokenManager.removeToken();
      } finally {
        setLoading(false);
      }
    };

    verifyAuth();
  }, []);

  const login = async (username: string, password: string) => {
    try {
      const response = await api.auth.login(username, password);
      if (response.success && response.user) {
        setUser(response.user);
      }
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  const logout = () => {
    api.auth.logout();
    setUser(null);
  };

  const value: AuthContextType = {
    user,
    loading,
    login,
    logout,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Protected Route Component
interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requiredRole 
}) => {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    window.location.href = '/login';
    return null;
  }

  if (requiredRole && user?.role !== requiredRole) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-red-600">
          Access Denied: You don't have permission to view this page.
        </div>
      </div>
    );
  }

  return <>{children}</>;
};