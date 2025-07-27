import React, { createContext, useContext, useState, useEffect } from 'react';
import { IAuthService, User } from './IAuthService';
import apiClient from '../lib/apiClient';

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
  const [sessionToken, setSessionToken] = useState<string | null>(localStorage.getItem('sessionToken'));

  // Check if user is authenticated on mount
  useEffect(() => {
    const checkAuth = async () => {
      if (sessionToken) {
        try {
          const currentUser = await getCurrentAuthenticatedUser();
          if (currentUser) {
            setUser(currentUser);
          } else {
            // Invalid session token, clear it
            localStorage.removeItem('sessionToken');
            setSessionToken(null);
          }
        } catch (error) {
          console.error('Auth check failed:', error);
          localStorage.removeItem('sessionToken');
          setSessionToken(null);
        }
      }
      setIsLoading(false);
    };

    checkAuth();
  }, [sessionToken]);

  const signIn = async (email: string, password: string): Promise<User> => {
    const data = await apiClient<{ user: User; sessionToken: string }>('/auth/signin', { 
      body: { email, password } 
    });
    
    setUser(data.user);
    setSessionToken(data.sessionToken);
    localStorage.setItem('sessionToken', data.sessionToken);
    return data.user;
  };

  const signOut = async (): Promise<void> => {
    if (sessionToken) {
      try {
        await apiClient('/auth/signout', { 
          method: 'POST',
          body: { session_token: sessionToken }
        });
      } catch (error) {
        console.error('Sign out error:', error);
      }
    }
    
    setUser(null);
    setSessionToken(null);
    localStorage.removeItem('sessionToken');
  };

  const getCurrentAuthenticatedUser = async (): Promise<User | null> => {
    if (!sessionToken) {
      return null;
    }
    
    try {
      // For local testing, we'll just return the stored user
      // In a real app, you'd validate the session token with the backend
      return user;
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