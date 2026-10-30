import { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';
import { applyAppearance } from '../lib/theme';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('itsa_token');
    const storedUser = localStorage.getItem('itsa_user');
    if (!token || !storedUser) {
      setLoading(false);
      return;
    }
    try {
      applyAppearance(JSON.parse(storedUser));
    } catch (err) {
      // ignora usuário armazenado inválido
    }
    authAPI.me()
      .then((res) => {
        const me = res.data.user || res.data;
        setUser(me);
        applyAppearance(me);
        localStorage.setItem('itsa_user', JSON.stringify(me));
      })
      .catch(() => {
        localStorage.removeItem('itsa_token');
        localStorage.removeItem('itsa_user');
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (data) => {
    const res = await authAPI.login(data);
    localStorage.setItem('itsa_token', res.data.token);
    localStorage.setItem('itsa_user', JSON.stringify(res.data.user));
    applyAppearance(res.data.user);
    setUser(res.data.user);
    return res;
  };

  const logout = () => {
    localStorage.removeItem('itsa_token');
    localStorage.removeItem('itsa_user');
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.style.removeProperty('--brand-600');
    setUser(null);
  };

  const updateUser = (data) => {
    setUser((prev) => {
      const next = { ...(prev || {}), ...data };
      localStorage.setItem('itsa_user', JSON.stringify(next));
      return next;
    });
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return context;
};
