import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase/config";
import "../styles/PublicMatchDetail.css";

export default function PublicVoleyMatchDetail() {
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

  // Función para agrupar anotadores por nombre y contar apariciones
  const agruparAnotadores = (anotadores) => {
    if (!anotadores || anotadores.length === 0) return [];
    
    const conteo = {};
    anotadores.forEach(anotador => {
      conteo[anotador] = (conteo[anotador] || 0) + 1;
    });
    
    return Object.entries(conteo).map(([nombre, cantidad]) => ({
      nombre,
      cantidad
    }));
  };

  // Función para determinar el ganador de un set
  const ganadorSet = (setData, limitePuntos) => {
    if (!setData) return null;
    if (setData.A >= limitePuntos && setData.A - setData.B >= 2) return 'A';
    if (setData.B >= limitePuntos && setData.B - setData.A >= 2) return 'B';
    return null;
  };

  // Función para determinar si es fase de grupos
  const esFaseGrupos = match?.fase === 'grupos1' || match?.fase === 'grupos3' || !match?.fase;
  const esSemifinal = match?.fase === "semifinales";
  const esFinal = match?.fase === "finales";

  // Obtener reglas del juego según la fase
  const reglasJuego = esFaseGrupos 
    ? { sets: 1, puntosPorSet: 20, descripcion: "1 set de 20 puntos" }
    : esSemifinal
    ? { sets: 3, puntosPorSet: [20, 20, 15], descripcion: "Al mejor de 3 sets: 20-20-15" }
    : esFinal
    ? { sets: 3, puntosPorSet: [5, 5, 15], descripcion: "Al mejor de 3 sets: 5-5-15" }
    : { sets: 3, puntosPorSet: [20, 20, 15], descripcion: "Al mejor de 3 sets: 20-20-15" };

  // Función para determinar si un set debe mostrarse
  const deberMostrarSet = (setIndex, sets) => {
    if (esFaseGrupos) return setIndex === 0; // Solo mostrar el primer set en fases de grupos
    
    // Para semifinales y finales (al mejor de 3 sets):
    if (setIndex <= 1) return true; // Siempre mostrar los primeros 2 sets
    
    // Para el set 3 (decisivo): solo mostrar si está empatado 1-1
    if (setIndex === 2) {
      const { setsA, setsB } = calcularSetsGanados(sets.slice(0, 2));
      return setsA === 1 && setsB === 1; // Set decisivo cuando está empatado 1-1
    }
    
    return false;
  };

  // Calcular sets ganados por cada equipo
  const calcularSetsGanados = (sets) => {
    let setsA = 0, setsB = 0;
    
    sets.forEach((set, index) => {
      if (set && (set.A > 0 || set.B > 0)) {
        const puntosLimite = esFaseGrupos 
          ? reglasJuego.puntosPorSet 
          : reglasJuego.puntosPorSet[index];
        
        if (set.A >= puntosLimite && set.A - set.B >= 2) {
          setsA++;
        } else if (set.B >= puntosLimite && set.B - set.A >= 2) {
          setsB++;
        }
      }
    });
    
    return { setsA, setsB };
  };

  // Obtener el límite de puntos para un set específico
  const obtenerPuntosSet = (setIndex, sets) => {
    if (esFaseGrupos) {
      return reglasJuego.puntosPorSet;
    }
    
    // Para semifinales y finales, verificar si algún equipo ya tiene 1 set ganado
    const { setsA, setsB } = calcularSetsGanados(sets.slice(0, setIndex));
    
    // Si algún equipo tiene 1 set ganado, el siguiente set es decisivo de 15 puntos
    if (setsA === 1 || setsB === 1) {
      return 15; // Set decisivo
    }
    
    // Si no, usar los puntos normales del array
    return reglasJuego.puntosPorSet[setIndex] || (esFinal ? 5 : 20);
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
  const anotadoresAAgrupados = agruparAnotadores(match.anotadoresA);
  const anotadoresBAgrupados = agruparAnotadores(match.anotadoresB);

  return (
    <div className="public-match-detail-container">
      {/* Header */}
      <div className="public-detail-header">
        <button onClick={() => navigate(-1)} className="back-button">
          <span className="back-icon">←</span>
          Volver
        </button>
        <h1 className="page-title">Detalle del Partido de Vóley</h1>
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
            <div className="info-icon">🏐</div>
            <div className="info-content">
              <span className="info-label">Disciplina</span>
              <span className="info-value">Vóley</span>
            </div>
          </div>
        </div>
      </div>

      {/* Marcador por Sets */}
      {match.sets && Object.keys(match.sets).length > 0 && (
        <div className="sets-section">
          <h3 className="section-title">
            <span className="section-icon">🏐</span>
            Marcador por Sets
          </h3>
          <div className="sets-table-container">
            <table className="sets-table">
              <thead>
                <tr>
                  <th>Equipo</th>
                  {Object.entries(match.sets)
                    .sort(([a], [b]) => parseInt(a.replace('set', '')) - parseInt(b.replace('set', '')))
                    .map(([setKey, setData], index) => {
                      const setNumber = parseInt(setKey.replace('set', ''));
                      if (!deberMostrarSet(setNumber - 1, Object.values(match.sets))) return null;
                      
                      return (
                        <th key={setKey}>
                          Set {setNumber}
                          {!esFaseGrupos && setNumber >= 4 && " (Decisivo - 15 pts)"}
                        </th>
                      );
                    })}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="team-name">{match.equipoA?.curso} {match.equipoA?.paralelo}</td>
                  {Object.entries(match.sets)
                    .sort(([a], [b]) => parseInt(a.replace('set', '')) - parseInt(b.replace('set', '')))
                    .map(([setKey, setData], index) => {
                      const setNumber = parseInt(setKey.replace('set', ''));
                      if (!deberMostrarSet(setNumber - 1, Object.values(match.sets))) return null;
                      
                      const limitePuntos = obtenerPuntosSet(setNumber - 1, Object.values(match.sets));
                      const ganador = ganadorSet(setData, limitePuntos);
                      
                      return (
                        <td key={setKey} className={`set-score ${ganador === 'A' ? 'winner' : ''}`}>
                          <div className="set-points">
                            {setData?.A || 0}
                          </div>
                          <div className="set-limit">/{limitePuntos}</div>
                        </td>
                      );
                    })}
                </tr>
                <tr>
                  <td className="team-name">{match.equipoB?.curso} {match.equipoB?.paralelo}</td>
                  {Object.entries(match.sets)
                    .sort(([a], [b]) => parseInt(a.replace('set', '')) - parseInt(b.replace('set', '')))
                    .map(([setKey, setData], index) => {
                      const setNumber = parseInt(setKey.replace('set', ''));
                      if (!deberMostrarSet(setNumber - 1, Object.values(match.sets))) return null;
                      
                      const limitePuntos = obtenerPuntosSet(setNumber - 1, Object.values(match.sets));
                      const ganador = ganadorSet(setData, limitePuntos);
                      
                      return (
                        <td key={setKey} className={`set-score ${ganador === 'B' ? 'winner' : ''}`}>
                          <div className="set-points">
                            {setData?.B || 0}
                          </div>
                          <div className="set-limit">/{limitePuntos}</div>
                        </td>
                      );
                    })}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Anotadores */}
      {(anotadoresAAgrupados.length > 0 || anotadoresBAgrupados.length > 0) && (
        <div className="scorers-section">
          <h3 className="section-title">
            <span className="section-icon">🏐</span>
            Anotadores
          </h3>
          <div className="scorers-grid">
            <div className="team-scorers">
              <h4 className="team-scorers-title">
                {match.equipoA?.curso} {match.equipoA?.paralelo}
              </h4>
              <div className="scorers-list">
                {anotadoresAAgrupados.length > 0 ? (
                  anotadoresAAgrupados.map((anotador, index) => (
                    <div key={index} className="scorer-item">
                      <span className="scorer-icon">🏐</span>
                      <span className="scorer-name">
                        {anotador.nombre} {anotador.cantidad > 1 && `(${anotador.cantidad})`}
                      </span>
                    </div>
                  ))
                ) : (
                  <span className="no-scorers">Sin puntos</span>
                )}
              </div>
            </div>

            <div className="team-scorers">
              <h4 className="team-scorers-title">
                {match.equipoB?.curso} {match.equipoB?.paralelo}
              </h4>
              <div className="scorers-list">
                {anotadoresBAgrupados.length > 0 ? (
                  anotadoresBAgrupados.map((anotador, index) => (
                    <div key={index} className="scorer-item">
                      <span className="scorer-icon">🏐</span>
                      <span className="scorer-name">
                        {anotador.nombre} {anotador.cantidad > 1 && `(${anotador.cantidad})`}
                      </span>
                    </div>
                  ))
                ) : (
                  <span className="no-scorers">Sin puntos</span>
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
