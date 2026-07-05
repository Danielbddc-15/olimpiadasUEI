import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../styles/Disciplinas.css";

function DisciplineSelector() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const disciplines = [
    {
      name: "Fútbol",
      route: "/matches/futbol",
      icon: "⚽",
      color: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      description: "Torneos de fútbol",
    },
    {
      name: "Vóley",
      route: "/matches/voley",
      icon: "🏐",
      color: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
      description: "Campeonato de voleibol",
    },
    {
      name: "Básquet",
      route: "/matches/basquet",
      icon: "🏀",
      color: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
      description: "Liga de baloncesto",
    },
  ];

  return (
    <div className="disciplinas-container">
      <div className="disciplinas-content">
        <button
          onClick={logout}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            padding: '8px 16px',
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: '30px',
            color: '#4a5568',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.2s ease',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)',
            zIndex: 10
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = '#f7fafc';
            e.currentTarget.style.color = '#2d3748';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = '#fff';
            e.currentTarget.style.color = '#4a5568';
            e.currentTarget.style.transform = 'none';
          }}
        >
          🚪 Salir al Login
        </button>

        <div className="header-section">
          <div className="main-icon">🏆</div>
          <h1 className="disciplinas-title">Olimpiadas UEI</h1>
          <p className="disciplinas-subtitle">
            Selecciona una disciplina para comenzar
          </p>
        </div>

        <div className="disciplinas-grid">
          {disciplines.map((discipline, index) => (
            <div
              key={discipline.name}
              className="discipline-card"
              onClick={() => navigate(discipline.route)}
              style={{
                background: discipline.color,
                animationDelay: `${index * 0.1}s`,
              }}
            >
              <div className="card-content">
                <div className="discipline-icon">{discipline.icon}</div>
                <h3 className="discipline-name">{discipline.name}</h3>
                <p className="discipline-description">
                  {discipline.description}
                </p>
                <div className="card-arrow">→</div>
              </div>
            </div>
          ))}
        </div>

        <div className="footer-section">
          <p className="welcome-text">¡Bienvenido a las Olimpiadas UEI!</p>
        </div>
      </div>
    </div>
  );
}

export default DisciplineSelector;
