import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isGuest, setIsGuest] = useState(() => {
    return localStorage.getItem('userRole') === 'guest';
  });
  const [loading, setLoading] = useState(true);

  // Configuración de tiempos
  const INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutos de inactividad
  const SESSION_MAX_AGE = 24 * 60 * 60 * 1000; // 24 horas máximo de sesión

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('sessionTimestamp');
    setUser(null);
    setIsGuest(false);
    // Recargar la página forzadamente para limpiar el estado de la aplicación y prevenir "glitches"
    window.location.href = '/';
  };

  const loginAsGuest = () => {
    localStorage.setItem('userRole', 'guest');
    localStorage.setItem('sessionTimestamp', Date.now().toString());
    setIsGuest(true);
    setUser(null);
  };

  useEffect(() => {
    // Check if token exists
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    const sessionTimestamp = localStorage.getItem('sessionTimestamp');
    const userRole = localStorage.getItem('userRole');

    if (userRole === 'guest') {
      try {
        if (sessionTimestamp && (Date.now() - parseInt(sessionTimestamp) > SESSION_MAX_AGE)) {
          throw new Error('Sesión de invitado expirada');
        }
        setIsGuest(true);
      } catch (error) {
        logout();
      }
    } else if (token && storedUser) {
      try {
        // Verificar si la sesión expiró por tiempo máximo (24h)
        if (sessionTimestamp && (Date.now() - parseInt(sessionTimestamp) > SESSION_MAX_AGE)) {
          throw new Error('Sesión expirada');
        }
        setUser(JSON.parse(storedUser));
      } catch (error) {
        logout();
      }
    }
    setLoading(false);
  }, []);

  // Control de inactividad
  useEffect(() => {
    if (!user && !isGuest) return;

    let inactivityTimer;

    const resetInactivityTimer = () => {
      if (inactivityTimer) clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(() => {
        alert("Sesión cerrada por inactividad");
        logout();
      }, INACTIVITY_TIMEOUT);
    };

    // Eventos a monitorear para la actividad del usuario
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    
    events.forEach(event => {
      document.addEventListener(event, resetInactivityTimer);
    });

    // Iniciar temporizador
    resetInactivityTimer();

    return () => {
      if (inactivityTimer) clearTimeout(inactivityTimer);
      events.forEach(event => {
        document.removeEventListener(event, resetInactivityTimer);
      });
    };
  }, [user, isGuest]);

  const login = async (email, password) => {
    try {
      const response = await api.post('/auth/login', { email, password });
      const { token, user: userData } = response.data;
      
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(userData));
      localStorage.setItem('userRole', userData.role.toLowerCase());
      localStorage.setItem('userEmail', userData.email);
      localStorage.setItem('sessionTimestamp', Date.now().toString());

      setUser(userData);
      setIsGuest(false);
      return userData;
    } catch (error) {
      console.error('Error logging in:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, isGuest, login, loginAsGuest, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};
