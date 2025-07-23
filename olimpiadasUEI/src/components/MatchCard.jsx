import React from "react";

function MatchCard({ match }) {
  return (
    <div className="match-card">
      <h3 className="match-title">{match.teamA} vs {match.teamB}</h3>
      <p className="match-info">Fecha: {match.date} - Hora: {match.time}</p>
      <p className="match-info">Categoría: {match.category}</p>
    </div>
  );
}

export default MatchCard;