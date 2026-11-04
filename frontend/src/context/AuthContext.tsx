import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import axios from 'axios';
import { api, setAuthToken } from '../lib/api';
import type { User } from '../types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  updateUser: (patch: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const readSavedUser = (): User | null => {
  try {
    const saved = localStorage.getItem('user');
    return saved ? (JSON.parse(saved) as User) : null;
  } catch {
    return null;
  }
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [token, setToken] = useState<string | null>(() => {
    const saved = localStorage.getItem('token');
    setAuthToken(saved); // set synchronously so the very first request is authenticated
    return saved;
  });
  const [user, setUser] = useState<User | null>(readSavedUser);

  const login = (newToken: string, newUser: User) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
    setAuthToken(newToken);
    setToken(newToken);
    setUser(newUser);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setAuthToken(null);
    setToken(null);
    setUser(null);
  };

  const updateUser = (patch: Partial<User>) => {
    setUser((current) => {
      if (!current) return current;
      const next = { ...current, ...patch };
      localStorage.setItem('user', JSON.stringify(next));
      return next;
    });
  };

  // An expired or invalid session signs the user out instead of leaving a broken dashboard.
  useEffect(() => {
    const id = api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (axios.isAxiosError(error) && error.response?.status === 401 && !String(error.config?.url || '').includes('/auth/login')) {
          logout();
        }
        return Promise.reject(error);
      }
    );
    return () => api.interceptors.response.eject(id);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
