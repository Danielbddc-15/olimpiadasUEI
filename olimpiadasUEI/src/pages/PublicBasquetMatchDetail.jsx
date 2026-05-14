import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, onSnapshot } from "../api/firestoreCompat";
import { db } from "../firebase/config";
import "../styles/AdminBasquetMatchDetail.css";

export default function PublicBasquetMatchDetail() {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!matchId) return;

    const unsubscribe = onSnapshot(doc(db, "matches", matchId), (docSnap) => {
      if (docSnap.exists()) {
        setMatch({ id: docSnap.id, ...docSnap.data() });
      } else {
        console.error("Partido no encontrado");
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [matchId]);

  // Función para agrupar anotadores por nombre y sumar puntos
  const agruparAnotadores = (anotadores) => {
    if (!anotadores || anotadores.length === 0) return [];
    
    const agrupados = {};
    anotadores.forEach(anotacion => {
      // En básquet, cada anotación es un objeto con 'jugador' y 'puntos'
      const nombreJugador = typeof anotacion === 'string' 
        ? anotacion.replace(/\s*\(\d+\s*pts?\)\s*$/i, '').replace(/\s*\d+\s*pts?\s*$/i, '').trim()
        : anotacion.jugador || anotacion.nombre || 'Jugador desconocido';
      
      const puntosAnotacion = typeof anotacion === 'string' 
        ? 1 
        : anotacion.puntos || 1;
      
      if (agrupados[nombreJugador]) {
        agrupados[nombreJugador] += puntosAnotacion;
      } else {
        agrupados[nombreJugador] = puntosAnotacion;
      }
    });
    
    return Object.entries(agrupados)
      .map(([nombre, puntos]) => ({ nombre, puntos }))
      .sort((a, b) => b.puntos - a.puntos); // Ordenar por puntos descendente
  };

  if (loading) {
    return (
      <div className="profesor-match-detail-container">
        <div className="profesor-loading">Cargando partido...</div>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="profesor-match-detail-container">
        <div className="profesor-error">Partido no encontrado</div>
      </div>
    );
  }

  const equipoA = `${match.equipoA?.curso} ${match.equipoA?.paralelo}`;
  const equipoB = `${match.equipoB?.curso} ${match.equipoB?.paralelo}`;

  // Agrupar anotadores por jugador
  const anotadoresAAgrupados = agruparAnotadores(match.anotadoresA);
  const anotadoresBAgrupados = agruparAnotadores(match.anotadoresB);

  return (
    <div className="profesor-match-detail-container">
      {/* Header */}
      <div className="profesor-match-header">
        <button onClick={() => navigate(-1)} className="profesor-back-button">
          ← Volver
        </button>
        <h1 className="profesor-match-title">Detalle del Partido - Básquetbol</h1>
        <div className="profesor-match-info">
          <span className="profesor-match-group">{match.grupo}</span>
          <span className="profesor-match-phase">{match.fase || "Grupos"}</span>
        </div>
      </div>

      {/* Estado del partido */}
      <div className="profesor-match-status">
        <div className="profesor-status-info">
          <span className={`profesor-status-badge ${match.estado}`}>
            {(match.estado === "pendiente" || match.estado === "programado") && "⏳ Programado"}
            {match.estado === "en curso" && "🟢 En Curso"}
            {match.estado === "finalizado" && "✅ Finalizado"}
          </span>
        </div>
      </div>

      {/* Marcador principal */}
      <div className="profesor-scoreboard">
        {/* Equipo A */}
        <div className="profesor-team-section">
          <div className="profesor-team-header">
            <div className="profesor-team-icon">🏀</div>
            <h2 className="profesor-team-name">{equipoA}</h2>
          </div>
          <div className="profesor-score-display">
            <span className="profesor-score">{match.marcadorA || 0}</span>
          </div>
        </div>

        {/* Separador */}
        <div className="profesor-vs-separator">
          <span className="profesor-vs-text">VS</span>
        </div>

        {/* Equipo B */}
        <div className="profesor-team-section">
          <div className="profesor-team-header">
            <div className="profesor-team-icon">🏀</div>
            <h2 className="profesor-team-name">{equipoB}</h2>
          </div>
          <div className="profesor-score-display">
            <span className="profesor-score">{match.marcadorB || 0}</span>
          </div>
        </div>
      </div>

      {/* Anotadores */}
      {(anotadoresAAgrupados.length > 0 || anotadoresBAgrupados.length > 0) && (
        <div className="profesor-scorers">
          <h3 className="profesor-section-title">🏀 Anotadores</h3>
          <div className="profesor-scorers-grid">
            <div className="profesor-team-scorers">
              <h4 className="profesor-team-title">{equipoA}</h4>
              <div className="profesor-scorer-list">
                {anotadoresAAgrupados.length > 0 ? (
                  anotadoresAAgrupados.map((anotador, index) => (
                    <div key={index} className="profesor-scorer-item">
                      <span className="scorer-name">🏀 {anotador.nombre}</span>
                      <span className="scorer-points">{anotador.puntos} pts</span>
                    </div>
                  ))
                ) : (
                  <div className="profesor-no-scorers">Sin anotadores registrados</div>
                )}
              </div>
            </div>

            <div className="profesor-team-scorers">
              <h4 className="profesor-team-title">{equipoB}</h4>
              <div className="profesor-scorer-list">
                {anotadoresBAgrupados.length > 0 ? (
                  anotadoresBAgrupados.map((anotador, index) => (
                    <div key={index} className="profesor-scorer-item">
                      <span className="scorer-name">🏀 {anotador.nombre}</span>
                      <span className="scorer-points">{anotador.puntos} pts</span>
                    </div>
                  ))
                ) : (
                  <div className="profesor-no-scorers">Sin anotadores registrados</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Información adicional */}
      <div className="profesor-match-additional-info">
        <div className="profesor-info-grid">
          <div className="profesor-info-item">
            <span className="profesor-info-label">📅 Fecha:</span>
            <span className="profesor-info-value">
              {match.fecha ? new Date(match.fecha).toLocaleDateString() : "No definida"}
            </span>
          </div>
          <div className="profesor-info-item">
            <span className="profesor-info-label">⏰ Hora:</span>
            <span className="profesor-info-value">{match.hora || "No definida"}</span>
          </div>
          <div className="profesor-info-item">
            <span className="profesor-info-label">🏟️ Grupo:</span>
            <span className="profesor-info-value">{match.grupo}</span>
          </div>
          <div className="profesor-info-item">
            <span className="profesor-info-label">🏆 Fase:</span>
            <span className="profesor-info-value">{match.fase || "Fase de Grupos"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
