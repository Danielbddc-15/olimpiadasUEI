import { useNavigate } from "react-router-dom";
// auth import removed
import { useAuth } from "../context/AuthContext";
import "../styles/ProfesorHome.css";

export default function ProfesorHome() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const irA = (discipline, section) => {
    navigate(`/profesor/${discipline}/${section}`);
  };

  const handleLogout = async () => {
    try {
      logout();
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
      color: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
      description: "Supervisar torneos de fútbol",
    },
    {
      nombre: "voley",
      label: "Vóley",
      icon: "🏐",
      color: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
      description: "Monitorear campeonato de voleibol",
    },
    {
      nombre: "basquet",
      label: "Básquetbol",
      icon: "🏀",
      color: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
      description: "Seguir liga de baloncesto",
    },
  ];

  const profesorActions = [
    {
      action: "partidos",
      label: "Supervisar Partidos",
      icon: "👀",
      description: "Monitorear y actualizar resultados",
    },
    {
      action: "tabla",
      label: "Ver Posiciones",
      icon: "📊",
      description: "Consultar clasificaciones actuales",
    },
    {
      action: "horarios",
      label: "Gestionar Horarios",
      icon: "📅",
      description: "Organizar partidos por días de la semana",
    },
    {
      action: "equipos",
      label: "Gestionar Equipos",
      icon: "👥",
      description: "Administrar equipos y jugadores",
    },
  ];

  return (
    <div className="profesor-home-container">
      {/* Header del panel profesor con botón de logout */}
      <div className="profesor-header">
        <div className="header-left">
          <div className="profesor-icon">👨‍🏫</div>
          <div className="header-info">
            <h1 className="profesor-title">Panel del Profesor</h1>
            <p className="profesor-subtitle">
              Supervisa y monitorea las Olimpiadas UEI
            </p>
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
            className="discipline-profesor-card"
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

            <div className="profesor-actions-grid">
              {profesorActions.map((actionItem) => (
                <button
                  key={actionItem.action}
                  onClick={() => irA(disc.nombre, actionItem.action)}
                  className="profesor-action-button"
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

      {/* Panel de información para profesores */}
      <div className="profesor-info-panel">
        <div className="info-card">
          <div className="info-icon">👁️</div>
          <h4 className="info-title">Supervisión en Tiempo Real</h4>
          <p className="info-text">
            Monitorea el progreso de todos los torneos en vivo
          </p>
        </div>
        <div className="info-card">
          <div className="info-icon">📝</div>
          <h4 className="info-title">Actualización de Resultados</h4>
          <p className="info-text">Registra marcadores y gestiona encuentros</p>
        </div>
        <div className="info-card">
          <div className="info-icon">🎯</div>
          <h4 className="info-title">Seguimiento Académico</h4>
          <p className="info-text">Supervisa la participación estudiantil</p>
        </div>
      </div>
    </div>
  );
}
