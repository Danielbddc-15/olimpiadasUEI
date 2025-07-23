import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase/config";
import "../styles/PublicMatchDetail.css";

export default function PublicMatchDetail() {
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

  const getEstadoColor = (estado) => {
    switch (estado) {
      case "finalizado":
        return "#4CAF50";
      case "en curso":
        return "#2196F3";
      case "pendiente":
        return "#FF9800";
      default:
        return "#757575";
    }
  };

  const getEstadoIcon = (estado) => {
    switch (estado) {
      case "finalizado":
        return "✅";
      case "en curso":
        return "🟢";
      case "pendiente":
        return "⏳";
      default:
        return "❓";
    }
  };

  const getFaseInfo = (fase) => {
    switch (fase) {
      case "grupos1":
        return { nombre: "Fase de Grupos 1", icon: "👥", color: "#4CAF50" };
      case "grupos3":
        return { nombre: "Fase de Grupos 3", icon: "🎯", color: "#FF9800" };
      case "semifinales":
        return { nombre: "Semifinales", icon: "🥈", color: "#2196F3" };
      case "finales":
        return { nombre: "Finales", icon: "🏆", color: "#F44336" };
      default:
        return { nombre: "Sin clasificar", icon: "❓", color: "#757575" };
    }
  };

  // Función para agrupar goleadores por nombre y contar apariciones
  const agruparGoleadores = (goleadores) => {
    if (!goleadores || goleadores.length === 0) return [];
    
    const conteo = {};
    goleadores.forEach(goleador => {
      conteo[goleador] = (conteo[goleador] || 0) + 1;
    });
    
    return Object.entries(conteo).map(([nombre, cantidad]) => ({
      nombre,
      cantidad
    }));
  };

  if (loading) {
    return (
      <div className="public-match-detail-container">
        <div className="loading-section">
          <div className="loading-spinner"></div>
          <p>Cargando información del partido...</p>
        </div>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="public-match-detail-container">
        <div className="error-section">
          <div className="error-icon">❌</div>
          <h3>Partido no encontrado</h3>
          <p>El partido que buscas no existe o ha sido eliminado.</p>
          <button onClick={() => navigate(-1)} className="back-btn">
            Volver
          </button>
        </div>
      </div>
    );
  }

  const faseInfo = getFaseInfo(match.fase);
  const goleadoresAAgrupados = agruparGoleadores(match.goleadoresA);
  const goleadoresBAgrupados = agruparGoleadores(match.goleadoresB);

  return (
    <div className="public-match-detail-container">
      {/* Header */}
      <div className="public-detail-header">
        <button onClick={() => navigate(-1)} className="back-button">
          <span className="back-icon">←</span>
          Volver
        </button>
        <h1 className="page-title">Detalle del Partido</h1>
      </div>

      {/* Información principal del partido */}
      <div className="match-main-info">
        <div className="match-header-card">
          <div className="fase-badge" style={{ backgroundColor: faseInfo.color }}>
            <span className="fase-icon">{faseInfo.icon}</span>
            <span className="fase-text">{faseInfo.nombre}</span>
          </div>
          <div className="grupo-info">
            <span className="grupo-icon">🏆</span>
            <span className="grupo-text">{match.grupo}</span>
          </div>
        </div>

        {/* Equipos y marcador */}
        <div className="teams-score-card">
          <div className="team-section">
            <div className="team-info">
              <div className="team-icon">🏫</div>
              <div className="team-details">
                <h3 className="team-name">
                  {match.equipoA?.curso} {match.equipoA?.paralelo}
                </h3>
                <span className="team-label">Equipo A</span>
              </div>
            </div>
            <div className="team-score">{match.marcadorA ?? 0}</div>
          </div>

          <div className="vs-divider">
            <span className="vs-text">VS</span>
          </div>

          <div className="team-section">
            <div className="team-score">{match.marcadorB ?? 0}</div>
            <div className="team-info">
              <div className="team-icon">🏫</div>
              <div className="team-details">
                <h3 className="team-name">
                  {match.equipoB?.curso} {match.equipoB?.paralelo}
                </h3>
                <span className="team-label">Equipo B</span>
              </div>
            </div>
          </div>
        </div>

        {/* Estado del partido */}
        <div className="match-status-card">
          <div className="status-info">
            <span 
              className="status-icon"
              style={{ color: getEstadoColor(match.estado) }}
            >
              {getEstadoIcon(match.estado)}
            </span>
            <span 
              className="status-text"
              style={{ color: getEstadoColor(match.estado) }}
            >
              {match.estado === "finalizado" ? "Finalizado" :
               match.estado === "en curso" ? "En Curso" :
               match.estado === "pendiente" ? "Pendiente" : 
               "Sin estado"}
            </span>
          </div>
        </div>
      </div>

      {/* Información adicional */}
      <div className="match-additional-info">
        <div className="info-grid">
          <div className="info-card">
            <div className="info-icon">📅</div>
            <div className="info-content">
              <span className="info-label">Fecha</span>
              <span className="info-value">
                {match.fecha || "Por definir"}
              </span>
            </div>
          </div>

          <div className="info-card">
            <div className="info-icon">🕐</div>
            <div className="info-content">
              <span className="info-label">Hora</span>
              <span className="info-value">
                {match.hora || "Por definir"}
              </span>
            </div>
          </div>

          <div className="info-card">
            <div className="info-icon">🏟️</div>
            <div className="info-content">
              <span className="info-label">Disciplina</span>
              <span className="info-value">
                {match.disciplina === "futbol" ? "Fútbol" :
                 match.disciplina === "voley" ? "Vóley" :
                 match.disciplina === "basquet" ? "Básquet" :
                 "No especificada"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Goleadores (solo para fútbol) */}
      {match.disciplina === "futbol" && 
       (goleadoresAAgrupados.length > 0 || goleadoresBAgrupados.length > 0) && (
        <div className="scorers-section">
          <h3 className="section-title">
            <span className="section-icon">⚽</span>
            Goleadores
          </h3>
          <div className="scorers-grid">
            <div className="team-scorers">
              <h4 className="team-scorers-title">
                {match.equipoA?.curso} {match.equipoA?.paralelo}
              </h4>
              <div className="scorers-list">
                {goleadoresAAgrupados.length > 0 ? (
                  goleadoresAAgrupados.map((goleador, index) => (
                    <div key={index} className="scorer-item">
                      <span className="scorer-icon">⚽</span>
                      <span className="scorer-name">
                        {goleador.nombre} {goleador.cantidad > 1 && `(${goleador.cantidad})`}
                      </span>
                    </div>
                  ))
                ) : (
                  <span className="no-scorers">Sin goles</span>
                )}
              </div>
            </div>

            <div className="team-scorers">
              <h4 className="team-scorers-title">
                {match.equipoB?.curso} {match.equipoB?.paralelo}
              </h4>
              <div className="scorers-list">
                {goleadoresBAgrupados.length > 0 ? (
                  goleadoresBAgrupados.map((goleador, index) => (
                    <div key={index} className="scorer-item">
                      <span className="scorer-icon">⚽</span>
                      <span className="scorer-name">
                        {goleador.nombre} {goleador.cantidad > 1 && `(${goleador.cantidad})`}
                      </span>
                    </div>
                  ))
                ) : (
                  <span className="no-scorers">Sin goles</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Resultado del partido */}
      {match.estado === "finalizado" && (
        <div className="match-result-section">
          <h3 className="section-title">
            <span className="section-icon">🏆</span>
            Resultado Final
          </h3>
          <div className="result-card">
            {match.marcadorA > match.marcadorB ? (
              <div className="winner-announcement">
                <span className="winner-icon">🎉</span>
                <span className="winner-text">
                  Ganador: {match.equipoA?.curso} {match.equipoA?.paralelo}
                </span>
                <span className="final-score">
                  {match.marcadorA} - {match.marcadorB}
                </span>
              </div>
            ) : match.marcadorB > match.marcadorA ? (
              <div className="winner-announcement">
                <span className="winner-icon">🎉</span>
                <span className="winner-text">
                  Ganador: {match.equipoB?.curso} {match.equipoB?.paralelo}
                </span>
                <span className="final-score">
                  {match.marcadorA} - {match.marcadorB}
                </span>
              </div>
            ) : (
              <div className="tie-announcement">
                <span className="tie-icon">🤝</span>
                <span className="tie-text">Empate</span>
                <span className="final-score">
                  {match.marcadorA} - {match.marcadorB}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
