import { useState } from "react";
import { useParams } from "react-router-dom";
import PublicTeams from "./PublicTeams";
import PublicStandings from "./PublicStandings";
import PublicMatches from "./PublicMatches";
import PublicReport from "./PublicReport";
import PublicHorarios from "./PublicHorarios";
import "../styles/PublicTournament.css";

export default function PublicTournament() {
  const [vista, setVista] = useState("equipos");
  const { discipline } = useParams();

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

        <nav className="modern-nav">
          <div className="nav-tabs">
            <button
              onClick={() => setVista("equipos")}
              className={`nav-tab ${vista === "equipos" ? "active" : ""}`}
            >
              <span className="tab-icon">👥</span>
              <span className="tab-text">Equipos</span>
            </button>
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
        {vista === "equipos" && <PublicTeams />}
        {vista === "posiciones" && <PublicStandings />}
        {vista === "partidos" && <PublicMatches />}
        {vista === "horarios" && <PublicHorarios />}
        {vista === "reporte" && <PublicReport />}
      </div>
    </div>
  );
}