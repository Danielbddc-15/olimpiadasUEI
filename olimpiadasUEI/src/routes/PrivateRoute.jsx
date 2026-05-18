import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function PrivateRoute({ children, allowedRoles = ["admin"] }) {
  const { user, loading } = useAuth();

  // Mostrar loading mientras verifica
  if (loading) {
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

  // Si no hay usuario autenticado, redirigir al login
  if (!user) {
    return <Navigate to="/" replace />;
  }

  // Si el rol no está permitido, redirigir a inicio
  // Nota: Firebase guardaba "admin", PostgreSQL guarda "ADMIN". Comparamos en minúscula.
  const userRoleLower = user.role.toLowerCase();
  const isAllowed = allowedRoles.some(role => role.toLowerCase() === userRoleLower);

  if (!isAllowed) {
    return <Navigate to="/" replace />;
  }

  // Todo está bien, mostrar el componente
  return children;
}