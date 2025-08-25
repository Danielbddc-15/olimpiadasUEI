import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import PublicStandings from "./PublicStandings";
import PublicMatches from "./PublicMatches";
import PublicReport from "./PublicReport";
import PublicHorarios from "./PublicHorarios";
import "../styles/PublicTournament.css";

export default function PublicTournament() {
  const [vista, setVista] = useState("posiciones");
  const { discipline } = useParams();
  const navigate = useNavigate();

  // Funciones de navegación
  const goToDisciplineSelector = () => {
    navigate('/selector');
  };

  const goToLogin = () => {
    navigate('/');
  };

  return (
    <div className="tournament-container">
      {/* Header con información del torneo */}
      <div className="tournament-header">
        <div className="tournament-info">
          <div className="sport-icon">
            {discipline === "futbol"
              ? "⚽"
              : discipline === "voley"
                ? "🏐"
                : "🏀"}
          </div>
          <div className="header-content">
            <h1 className="tournament-title">
              {discipline === "futbol"
                ? "Torneo de Fútbol"
                : discipline === "voley"
                  ? "Campeonato de Vóley"
                  : "Liga de Básquet"}
            </h1>
            <p className="tournament-subtitle">Olimpiadas UEI 2025</p>
          </div>
        </div>
        
        <div className="tournament-controls">
          <button 
            onClick={goToDisciplineSelector}
            className="nav-btn secondary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <span style={{ color: '#000' }}>←</span> 📋 Disciplinas
          </button>
          <button 
            onClick={goToLogin}
            className="nav-btn primary"
          >
            🚪 Salir
          </button>
        </div>

        <nav className="modern-nav">
          <div className="nav-tabs">
            <button
              onClick={() => setVista("posiciones")}
              className={`nav-tab ${vista === "posiciones" ? "active" : ""}`}
            >
              <span className="tab-icon">🏆</span>
              <span className="tab-text">Posiciones</span>
            </button>
            <button
              onClick={() => setVista("partidos")}
              className={`nav-tab ${vista === "partidos" ? "active" : ""}`}
            >
              <span className="tab-icon">⚽</span>
              <span className="tab-text">Partidos</span>
            </button>
            <button
              onClick={() => setVista("horarios")}
              className={`nav-tab ${vista === "horarios" ? "active" : ""}`}
            >
              <span className="tab-icon">📅</span>
              <span className="tab-text">Horarios</span>
            </button>
            <button
              onClick={() => setVista("reporte")}
              className={`nav-tab ${vista === "reporte" ? "active" : ""}`}
            >
              <span className="tab-icon">📊</span>
              <span className="tab-text">Reportes</span>
            </button>
          </div>
        </nav>
      </div>

      <div className="tournament-content">
        {vista === "posiciones" && <PublicStandings />}
        {vista === "partidos" && <PublicMatches />}
        {vista === "horarios" && <PublicHorarios />}
        {vista === "reporte" && <PublicReport />}
      </div>
    </div>
  );
}