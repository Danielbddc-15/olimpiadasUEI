import { useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase/config";
import "../styles/AdminHome.css";

export default function AdminHome() {
  const navigate = useNavigate();

  const irA = (discipline, section) => {
    navigate(`/admin/${discipline}/${section}`);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      // Limpiar localStorage
      localStorage.removeItem('userRole');
      localStorage.removeItem('userEmail');
      localStorage.removeItem('sessionTimestamp');
      // Redirigir al login
      navigate("/");
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
      alert("Error al cerrar sesión");
    }
  };

  const disciplinas = [
    {
      nombre: "futbol",
      label: "Fútbol",
      icon: "⚽",
      color: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      description: "Gestión completa del torneo de fútbol",
    },
    {
      nombre: "voley",
      label: "Vóley",
      icon: "🏐",
      color: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
      description: "Administración del campeonato de voleibol",
    },
    {
      nombre: "basquet",
      label: "Básquetbol",
      icon: "🏀",
      color: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
      description: "Control de la liga de baloncesto",
    },
  ];

  const adminActions = [
    {
      action: "equipos",
      label: "Gestionar Equipos",
      icon: "👥",
      description: "Crear, editar y administrar equipos",
    },
    {
      action: "partidos",
      label: "Gestionar Partidos",
      icon: "⚽",
      description: "Programar y gestionar encuentros",
    },
    {
      action: "tabla",
      label: "Ver Posiciones",
      icon: "🏆",
      description: "Consultar tablas de clasificación",
    },
    {
      action: "horarios",
      label: "Gestionar Horarios",
      icon: "📅",
      description: "Organizar partidos por días de la semana",
    },
  ];

  return (
    <div className="admin-home-container">
      {/* Header del panel admin con botón de logout */}
      <div className="admin-header">
        <div className="header-left">
          <div className="admin-icon">🛠️</div>
          <div className="header-info">
            <h1 className="admin-title">Panel de Administración</h1>
            <p className="admin-subtitle">Gestiona las Olimpiadas UEI desde aquí</p>
          </div>
        </div>
        <button onClick={handleLogout} className="logout-button">
          <span className="logout-icon">🚪</span>
          <span className="logout-text">Cerrar Sesión</span>
        </button>
      </div>

      {/* Grid de disciplinas */}
      <div className="disciplines-grid">
        {disciplinas.map((disc, index) => (
          <div
            key={disc.nombre}
            className="discipline-admin-card"
            style={{
              background: disc.color,
              animationDelay: `${index * 0.1}s`,
            }}
          >
            <div className="discipline-card-header">
              <div className="discipline-card-icon">{disc.icon}</div>
              <div className="discipline-card-info">
                <h3 className="discipline-card-title">{disc.label}</h3>
                <p className="discipline-card-description">
                  {disc.description}
                </p>
              </div>
            </div>

            <div className="admin-actions-grid">
              {adminActions.map((actionItem) => (
                <button
                  key={actionItem.action}
                  onClick={() => irA(disc.nombre, actionItem.action)}
                  className="admin-action-button"
                  title={actionItem.description}
                >
                  <div className="action-button-content">
                    <span className="action-icon">{actionItem.icon}</span>
                    <span className="action-label">{actionItem.label}</span>
                  </div>
                  <div className="action-arrow">→</div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Panel de información */}
      <div className="admin-info-panel">
        <div className="info-card">
          <div className="info-icon">📊</div>
          <h4 className="info-title">Estadísticas en Tiempo Real</h4>
          <p className="info-text">
            Monitorea el progreso de todos los torneos
          </p>
        </div>
        <div className="info-card">
          <div className="info-icon">⚡</div>
          <h4 className="info-title">Gestión Rápida</h4>
          <p className="info-text">
            Administra equipos y partidos de manera eficiente
          </p>
        </div>
        <div className="info-card">
          <div className="info-icon">🏆</div>
          <h4 className="info-title">Control Total</h4>
          <p className="info-text">
            Supervisa todas las disciplinas desde un lugar
          </p>
        </div>
      </div>
    </div>
  );
}
