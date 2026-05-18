import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Configuración de tiempos
  const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutos de inactividad
  const SESSION_MAX_AGE = 24 * 60 * 60 * 1000; // 24 horas máximo de sesión

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('sessionTimestamp');
    setUser(null);
    // Recargar la página forzadamente para limpiar el estado de la aplicación y prevenir "glitches"
    window.location.href = '/';
  };

  useEffect(() => {
    // Check if token exists
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    const sessionTimestamp = localStorage.getItem('sessionTimestamp');

    if (token && storedUser) {
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
    if (!user) return;

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
  }, [user]);

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
      return userData;
    } catch (error) {
      console.error('Error logging in:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};
