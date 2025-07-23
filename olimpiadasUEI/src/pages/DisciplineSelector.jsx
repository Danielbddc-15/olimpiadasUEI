import { useNavigate } from "react-router-dom";
import "../styles/Disciplinas.css";

function DisciplineSelector() {
  const navigate = useNavigate();

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
