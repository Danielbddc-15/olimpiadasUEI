import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/config";
import "../styles/PublicFutbolMatchDetail.css";

export default function PublicFutbolMatchDetail() {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMatch = async () => {
      try {
        const docRef = doc(db, "matches", matchId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const matchData = { id: docSnap.id, ...docSnap.data() };
          setMatch(matchData);
        } else {
          console.error("Partido no encontrado");
          navigate(-1);
        }
      } catch (error) {
        console.error("Error al cargar partido:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMatch();
  }, [matchId, navigate]);

  const getEstadoColor = (estado) => {
    switch (estado) {
      case "programado": return "#f59e0b";
      case "en-curso": return "#10b981";
      case "finalizado": return "#22c55e";
      default: return "#6b7280";
    }
  };

  const getEstadoIcon = (estado) => {
    switch (estado) {
      case "programado": return "⏰";
      case "en-curso": return "⚽";
      case "finalizado": return "✅";
      default: return "📋";
    }
  };

  const getFaseInfo = (fase) => {
    const fases = {
      "grupos1": { nombre: "Fase de Grupos", icono: "👥" },
      "grupos3": { nombre: "Fase de Grupos", icono: "👥" },
      "octavos": { nombre: "Octavos de Final", icono: "🎯" },
      "cuartos": { nombre: "Cuartos de Final", icono: "🏆" },
      "semifinales": { nombre: "Semifinales", icono: "🥉" },
      "finales": { nombre: "Final", icono: "🥇" }
    };
    return fases[fase] || { nombre: "Fase de Grupos", icono: "👥" };
  };

  // Función para agrupar goleadores por nombre y contar apariciones
  const agruparGoleadores = (goleadores) => {
    if (!goleadores || goleadores.length === 0) return [];
    
    const agrupados = {};
    goleadores.forEach(goleador => {
      if (agrupados[goleador]) {
        agrupados[goleador]++;
      } else {
        agrupados[goleador] = 1;
      }
    });
    
    return Object.entries(agrupados).map(([nombre, goles]) => ({
      nombre,
      goles
    }));
  };

  if (loading) {
    return (
      <div className="public-futbol-loading">
        <div className="loading-spinner"></div>
        <p>Cargando partido...</p>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="public-futbol-error">
        <h2>❌ Partido no encontrado</h2>
        <button onClick={() => navigate(-1)} className="public-back-btn">
          ← Volver
        </button>
      </div>
    );
  }

  const faseInfo = getFaseInfo(match.fase);
  const goleadoresAAgrupados = agruparGoleadores(match.goleadoresA);
  const goleadoresBAgrupados = agruparGoleadores(match.goleadoresB);

  return (
    <div className="public-futbol-match-detail">
      {/* Header con botón volver */}
      <div className="public-futbol-header">
        <button onClick={() => navigate(-1)} className="public-back-btn">
          ← Volver
        </button>
        <h1>Detalle del Partido</h1>
        <div className="public-phase-badge">
          <span className="phase-icon">{faseInfo.icono}</span>
          {faseInfo.nombre}
        </div>
      </div>

      {/* Información del partido */}
      <div className="public-futbol-info">
        <div className="match-category">
          🎓 {match.categoria || 'Sin categoría'} - {match.genero || 'Sin género'}
        </div>
        {match.grupo && (
          <div className="match-group">
            👥 Grupo {match.grupo}
          </div>
        )}
      </div>

      {/* Estado del partido */}
      <div className="public-futbol-status">
        <div 
          className="status-badge"
          style={{ backgroundColor: getEstadoColor(match.estado) }}
        >
          <span className="status-icon">{getEstadoIcon(match.estado)}</span>
          {match.estado?.charAt(0).toUpperCase() + match.estado?.slice(1) || 'Programado'}
        </div>
      </div>

      {/* Marcador principal */}
      <div className="public-futbol-scoreboard">
        <div className="team-section">
          <div className="team-header">
            <span className="team-icon">🏠</span>
            <h2 className="team-name">
              {match.equipoA?.curso || 'Equipo A'} {match.equipoA?.paralelo || ''}
            </h2>
          </div>
          <div className="team-score">{match.marcadorA || 0}</div>
        </div>

        <div className="vs-divider">
          <div className="vs-text">VS</div>
        </div>

        <div className="team-section">
          <div className="team-header">
            <span className="team-icon">⚽</span>
            <h2 className="team-name">
              {match.equipoB?.curso || 'Equipo B'} {match.equipoB?.paralelo || ''}
            </h2>
          </div>
          <div className="team-score">{match.marcadorB || 0}</div>
        </div>
      </div>

      {/* Información adicional */}
      <div className="public-futbol-match-info">
        <div className="info-grid">
          <div className="info-card">
            <div className="info-icon">📅</div>
            <div className="info-content">
              <div className="info-label">Fecha</div>
              <div className="info-value">
                {match.fechaCompleta 
                  ? new Date(match.fechaCompleta).toLocaleDateString('es-ES', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })
                  : match.fecha || 'Por definir'
                }
              </div>
            </div>
          </div>

          <div className="info-card">
            <div className="info-icon">⏰</div>
            <div className="info-content">
              <div className="info-label">Hora</div>
              <div className="info-value">{match.hora || 'Por definir'}</div>
            </div>
          </div>

          <div className="info-card">
            <div className="info-icon">📍</div>
            <div className="info-content">
              <div className="info-label">Ubicación</div>
              <div className="info-value">{match.ubicacion || 'Cancha de fútbol'}</div>
            </div>
          </div>

          <div className="info-card">
            <div className="info-icon">⚽</div>
            <div className="info-content">
              <div className="info-label">Disciplina</div>
              <div className="info-value">Fútbol</div>
            </div>
          </div>
        </div>
      </div>

      {/* Goleadores */}
      <div className="public-futbol-scorers">
        <h3 className="scorers-title">⚽ Goleadores</h3>
        <div className="scorers-grid">
          {/* Goleadores Equipo A */}
          <div className="team-scorers">
            <h4 className="team-subtitle">
              🏠 {match.equipoA?.curso || 'Equipo A'} {match.equipoA?.paralelo || ''}
            </h4>
            <div className="scorers-list">
              {goleadoresAAgrupados.length > 0 ? (
                goleadoresAAgrupados.map((goleador, index) => (
                  <div key={index} className="scorer-item">
                    <span className="player-name">{goleador.nombre}</span>
                    <span className="goal-count">
                      {goleador.goles} {goleador.goles === 1 ? 'gol' : 'goles'}
                    </span>
                  </div>
                ))
              ) : (
                <div className="no-scorers">Sin goles</div>
              )}
            </div>
          </div>

          {/* Goleadores Equipo B */}
          <div className="team-scorers">
            <h4 className="team-subtitle">
              ⚽ {match.equipoB?.curso || 'Equipo B'} {match.equipoB?.paralelo || ''}
            </h4>
            <div className="scorers-list">
              {goleadoresBAgrupados.length > 0 ? (
                goleadoresBAgrupados.map((goleador, index) => (
                  <div key={index} className="scorer-item">
                    <span className="player-name">{goleador.nombre}</span>
                    <span className="goal-count">
                      {goleador.goles} {goleador.goles === 1 ? 'gol' : 'goles'}
                    </span>
                  </div>
                ))
              ) : (
                <div className="no-scorers">Sin goles</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Resultado final si está terminado */}
      {match.estado === 'finalizado' && (
        <div className="public-futbol-result">
          <h3>🏆 Resultado Final</h3>
          <div className="final-score">
            <span className="final-team">
              {match.equipoA?.curso} {match.equipoA?.paralelo}
            </span>
            <span className="final-score-numbers">
              {match.marcadorA} - {match.marcadorB}
            </span>
            <span className="final-team">
              {match.equipoB?.curso} {match.equipoB?.paralelo}
            </span>
          </div>
          
          {/* Determinar ganador */}
          {match.marcadorA !== match.marcadorB && (
            <div className="winner-announcement">
              🎉 ¡Ganador: {
                match.marcadorA > match.marcadorB 
                  ? `${match.equipoA?.curso} ${match.equipoA?.paralelo}`
                  : `${match.equipoB?.curso} ${match.equipoB?.paralelo}`
              }!
            </div>
          )}
          
          {match.marcadorA === match.marcadorB && (
            <div className="tie-announcement">
              🤝 ¡Empate!
            </div>
          )}
        </div>
      )}
    </div>
  );
}
