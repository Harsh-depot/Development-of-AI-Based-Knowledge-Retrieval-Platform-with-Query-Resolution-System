/**
 * AuthContext.jsx — Global JWT Authentication Context
 * =====================================================
 * Provides authentication state and actions to the entire React app.
 *
 * Context values:
 *   user        — { user_id, email, full_name } or null when logged out
 *   token       — raw JWT string stored in localStorage ("auth_token") or null
 *   login()     — POST /api/login, stores token, sets user state
 *   register()  — POST /api/register, auto-logs in on success
 *   logout()    — clears token from localStorage and resets state
 *   isLoading   — true while the context is reading localStorage on mount
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { loginUser, registerUser } from '../utils/api';

// ---------------------------------------------------------------------------
// Context + custom hook
// ---------------------------------------------------------------------------

const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

// ---------------------------------------------------------------------------
// JWT helpers (client-side only — never trust these for security decisions)
// ---------------------------------------------------------------------------

const TOKEN_KEY = 'auth_token';

function parseTokenPayload(token) {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

function isTokenExpired(token) {
  const payload = parseTokenPayload(token);
  if (!payload || !payload.exp) return true;
  // exp is in seconds; Date.now() is in ms
  return Date.now() >= payload.exp * 1000;
}

// ---------------------------------------------------------------------------
// Provider component
// ---------------------------------------------------------------------------

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true); // true while hydrating from localStorage

  // On mount: read token from localStorage and validate it
  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    if (storedToken && !isTokenExpired(storedToken)) {
      const payload = parseTokenPayload(storedToken);
      setToken(storedToken);
      setUser({
        user_id: payload.sub,
        email: payload.email,
        full_name: payload.full_name || null,
      });
    } else {
      // Clear stale / expired token
      localStorage.removeItem(TOKEN_KEY);
    }
    setIsLoading(false);
  }, []);

  // ------------------------------------------------------------------
  // Actions
  // ------------------------------------------------------------------

  const login = useCallback(async (email, password) => {
    const data = await loginUser(email, password);
    localStorage.setItem(TOKEN_KEY, data.access_token);
    setToken(data.access_token);
    setUser({
      user_id: data.user_id,
      email: data.email,
      full_name: data.full_name || null,
    });
    return data;
  }, []);

  const register = useCallback(async (email, password, fullName) => {
    const data = await registerUser(email, password, fullName);
    // Auto-login after successful registration
    localStorage.setItem(TOKEN_KEY, data.access_token);
    setToken(data.access_token);
    setUser({
      user_id: data.user_id,
      email: data.email,
      full_name: data.full_name || null,
    });
    return data;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    // Also clear the session id so a fresh session starts on next login
    localStorage.removeItem('query_sys_session_id');
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}
