import React, { createContext, useContext, useState, useEffect } from 'react';
import { IAuthService, User } from './IAuthService';
import apiClient, { TokenManager } from '../lib/apiClient';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<User>;
  signOut: () => Promise<void>;
  getCurrentAuthenticatedUser: () => Promise<User | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check if user is authenticated on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = TokenManager.getToken();
      if (token && !TokenManager.isTokenExpired(token)) {
        try {
          const currentUser = await getCurrentAuthenticatedUser();
          if (currentUser) {
            setUser(currentUser);
          } else {
            // Invalid token, clear it
            TokenManager.clearTokens();
          }
        } catch (error) {
          console.error('Auth check failed:', error);
          TokenManager.clearTokens();
        }
      } else if (token && TokenManager.isTokenExpired(token)) {
        // Token expired, try to refresh
        try {
          const refreshToken = TokenManager.getRefreshToken();
          if (refreshToken) {
            const refreshResponse = await apiClient<{ access_token: string; refresh_token: string }>(
              '/auth/refresh-token',
              {
                method: 'POST',
                body: { refresh_token: refreshToken },
                requireAuth: false // Don't require auth for refresh
              }
            );
            
            TokenManager.setToken(refreshResponse.access_token);
            TokenManager.setRefreshToken(refreshResponse.refresh_token);
            
            const currentUser = await getCurrentAuthenticatedUser();
            if (currentUser) {
              setUser(currentUser);
            }
          } else {
            TokenManager.clearTokens();
          }
        } catch (error) {
          console.error('Token refresh failed:', error);
          TokenManager.clearTokens();
        }
      }
      setIsLoading(false);
    };

    checkAuth();
  }, []);

  const signIn = async (email: string, password: string): Promise<User> => {
    const data = await apiClient<{ user: User; access_token: string; refresh_token: string }>(
      '/auth/signin',
      { 
        body: { email, password },
        requireAuth: false // Don't require auth for signin
      }
    );
    
    // Store tokens
    TokenManager.setToken(data.access_token);
    TokenManager.setRefreshToken(data.refresh_token);
    
    setUser(data.user);
    return data.user;
  };

  const signOut = async (): Promise<void> => {
    try {
      await apiClient('/auth/signout', { 
        method: 'POST',
        requireAuth: true
      });
    } catch (error) {
      console.error('Sign out error:', error);
    } finally {
      // Always clear tokens and user state
      setUser(null);
      TokenManager.clearTokens();
    }
  };

  const getCurrentAuthenticatedUser = async (): Promise<User | null> => {
    try {
      const userData = await apiClient<User>('/auth/me', {
        requireAuth: true
      });
      return userData;
    } catch (error) {
      console.error('Get current user error:', error);
      return null;
    }
  };

  const value = {
    user,
    isAuthenticated: !!user,
    isLoading,
    signIn,
    signOut,
    getCurrentAuthenticatedUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};