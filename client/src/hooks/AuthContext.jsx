import { createContext, useState, useEffect, useContext, useCallback } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('userId') || null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (authToken) => {
    if (!authToken) return null;
    try {
      const res = await fetch(`/api/users/me?uid=${authToken}`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (!res.ok) throw new Error('Failed to fetch profile');
      const data = await res.json();
      setUser(data);
      return data;
    } catch (err) {
      console.error('[AuthContext] Profile fetch failed:', err.message);
      // If profile fails and token exists, fallback to standard mock user structure
      setUser({
        uid: authToken,
        display_name: 'Citizen Hero',
        xp: 0,
        level: 1,
        gold: 50,
        title: 'Novice Watchman',
        quests: []
      });
    }
  }, []);

  useEffect(() => {
    if (token) {
      fetchProfile(token).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token, fetchProfile]);

  const login = async (email, password) => {
    setLoading(true);
    try {
      const res = await fetch('/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Invalid credentials');
      }
      const data = await res.json();
      setToken(data.uid);
      setUser(data);
      localStorage.setItem('userId', data.uid);
      return data;
    } finally {
      setLoading(false);
    }
  };

  const register = async (email, password, displayName) => {
    setLoading(true);
    try {
      const res = await fetch('/api/users/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, display_name: displayName })
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Registration failed');
      }
      const data = await res.json();
      setToken(data.uid);
      setUser(data);
      localStorage.setItem('userId', data.uid);
      return data;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('userId');
  };

  const refreshProfile = async () => {
    if (token) {
      return await fetchProfile(token);
    }
  };

  const value = {
    user,
    token,
    loading,
    login,
    register,
    logout,
    refreshProfile,
    isAuthenticated: !!token
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
