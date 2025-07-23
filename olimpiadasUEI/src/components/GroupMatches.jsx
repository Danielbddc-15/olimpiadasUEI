import React from "react";
import "../styles/GroupMatches.css";

export default function GroupMatches({ matches = [], currentGroup = "" }) {
  const renderMatch = (match, index) => {
    const equipoA = `${match.equipoA?.curso} ${match.equipoA?.paralelo}`;
    const equipoB = `${match.equipoB?.curso} ${match.equipoB?.paralelo}`;
    const scoreA = match.marcadorA ?? 0;
    const scoreB = match.marcadorB ?? 0;
    const isCompleted = match.estado === "finalizado";
    const isInProgress = match.estado === "en curso";

    return (
      <div key={index} className="group-match-card">
        <div className="group-header">
          <span className="group-name">{match.grupo || currentGroup}</span>
          <div className="match-status-badge">
            {isCompleted ? "CLOSED" : isInProgress ? "LIVE" : "PENDING"}
          </div>
        </div>

        <div className="match-content">
          <div className="team-section">
            <div className="team-logo">
              {isCompleted && scoreA > scoreB && (
                <div className="crown-icon">👑</div>
              )}
              <div className="trophy-icon">🏆</div>
            </div>
            <div className="team-info">
              <span className="team-name">{equipoA}</span>
            </div>
          </div>

          <div className="score-section">
            <span className="score">{scoreA}</span>
            <span className="score-separator">:</span>
            <span className="score">{scoreB}</span>
          </div>

          <div className="team-section">
            <div className="team-info">
              <span className="team-name">{equipoB}</span>
            </div>
            <div className="team-logo">
              {isCompleted && scoreB > scoreA && (
                <div className="crown-icon">👑</div>
              )}
              <div className="trophy-icon">🏆</div>
            </div>
          </div>
        </div>

        {match.fecha && (
          <div className="match-info">
            <span className="match-date">{match.fecha}</span>
            {match.hora && <span className="match-time">{match.hora}</span>}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="group-matches-container">
      <h3 className="group-title">Partidos de Grupos - {currentGroup}</h3>
      <div className="matches-grid">
        {matches.length > 0 ? (
          matches.map((match, index) => renderMatch(match, index))
        ) : (
          <div className="no-matches">
            <p>No hay partidos disponibles para este grupo.</p>
          </div>
        )}
      </div>
    </div>
  );
}
