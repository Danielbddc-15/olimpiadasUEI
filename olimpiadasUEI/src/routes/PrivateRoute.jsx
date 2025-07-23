import { Navigate } from "react-router-dom";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, db } from "../firebase/config";
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";

export default function PrivateRoute({ children, allowedRoles = ["admin"] }) {
  const [user, loading, error] = useAuthState(auth);
  const [role, setRole] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const verify = async () => {
      setChecking(true);
      
      if (user) {
        try {
          // Verificar si el token sigue siendo válido
          await user.getIdToken(true);
          
          // Obtener rol desde Firestore
          const docSnap = await getDoc(doc(db, "users", user.uid));
          const userRole = docSnap.exists() ? docSnap.data().role : "visitor";
          
          // Actualizar localStorage con información de sesión
          localStorage.setItem('userRole', userRole);
          localStorage.setItem('userEmail', user.email);
          localStorage.setItem('sessionTimestamp', Date.now().toString());
          
          setRole(userRole);
        } catch (authError) {
          console.error("Error verificando autenticación:", authError);
          // Limpiar localStorage si hay error de autenticación
          localStorage.removeItem('userRole');
          localStorage.removeItem('userEmail');
          localStorage.removeItem('sessionTimestamp');
          setRole(null);
        }
      } else {
        // No hay usuario, limpiar localStorage
        localStorage.removeItem('userRole');
        localStorage.removeItem('userEmail');
        localStorage.removeItem('sessionTimestamp');
        setRole(null);
      }
      
      setChecking(false);
    };

    // Solo verificar si no está cargando
    if (!loading) {
      verify();
    }
  }, [user, loading]);

  // Mostrar loading mientras verifica
  if (loading || checking) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '50px',
            height: '50px',
            border: '3px solid rgba(255,255,255,0.3)',
            borderTop: '3px solid white',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 1rem'
          }}></div>
          <p>Verificando autenticación...</p>
        </div>
      </div>
    );
  }

  // Si hay error de autenticación, redirigir al login
  if (error) {
    console.error("Error de autenticación:", error);
    return <Navigate to="/" replace />;
  }

  // Si no hay usuario autenticado, redirigir al login
  if (!user) {
    return <Navigate to="/" replace />;
  }

  // Si el rol no está permitido, redirigir a inicio
  if (!allowedRoles.includes(role)) {
    return <Navigate to="/" replace />;
  }

  // Todo está bien, mostrar el componente
  return children;
}