import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase/config";
import "../styles/PublicVoleyMatchDetail.css";

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
  const esFaseGrupos = match?.fase === 'grupos' || match?.fase === 'grupos1' || match?.fase === 'grupos3' || !match?.fase;
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

  // Mapeo de fases para mostrar nombres legibles
  const fasesNombres = {
    "grupos": "Fase de Grupos",
    "grupos1": "Fase de Grupos 1", 
    "grupos3": "Fase de Grupos 3",
    "semifinal": "Semifinales",
    "semifinales": "Semifinales",
    "final": "Finales",
    "finales": "Finales"
  };

  // Nombres de equipos
  const equipoA = match.equipoA ? `${match.equipoA.curso} ${match.equipoA.paralelo}` : "Equipo A";
  const equipoB = match.equipoB ? `${match.equipoB.curso} ${match.equipoB.paralelo}` : "Equipo B";

  return (
    <div className="public-voley-detail-container">
      {/* Header */}
      <div className="public-voley-header">
        <button onClick={() => navigate(-1)} className="public-back-button">
          ← Volver
        </button>
        <h1 className="public-voley-title">🏐 Detalle del Partido - Vóley</h1>
        <div className="public-voley-info">
          <span className="public-voley-group">{match.grupo}</span>
          <span className="public-voley-phase">{fasesNombres[match.fase] || "Fase de Grupos"}</span>
          <span className="public-voley-rules">{reglasJuego.descripcion}</span>
        </div>
      </div>

      {/* Estado del partido */}
      <div className="public-voley-status">
        <div className="public-status-info">
          <span className={`public-status-badge ${match.estado?.replace(' ', '-')}`}>
            {(match.estado === "pendiente" || match.estado === "programado") && "⏳ Programado"}
            {match.estado === "en curso" && "🟢 En Curso"}
            {match.estado === "finalizado" && "✅ Finalizado"}
          </span>
        </div>
      </div>

      {/* Marcador principal */}
      <div className="public-voley-scoreboard">
        <div className="public-team-section">
          <div className="public-team-header">
            <div className="public-team-icon">🏆</div>
            <h2 className="public-team-name">{equipoA}</h2>
          </div>
          <div className="public-team-score">{match.marcadorA ?? 0}</div>
        </div>

        <div className="public-vs-divider">
          <span className="public-vs-text">VS</span>
        </div>

        <div className="public-team-section">
          <div className="public-team-header">
            <div className="public-team-icon">🏆</div>
            <h2 className="public-team-name">{equipoB}</h2>
          </div>
          <div className="public-team-score">{match.marcadorB ?? 0}</div>
        </div>
      </div>

      {/* Información adicional */}
      <div className="public-match-info">
        <div className="public-info-grid">
          <div className="public-info-card">
            <div className="public-info-icon">📅</div>
            <div className="public-info-content">
              <span className="public-info-label">Fecha</span>
              <span className="public-info-value">{match.fecha || "Por definir"}</span>
            </div>
          </div>
          <div className="public-info-card">
            <div className="public-info-icon">🕐</div>
            <div className="public-info-content">
              <span className="public-info-label">Hora</span>
              <span className="public-info-value">{match.hora || "Por definir"}</span>
            </div>
          </div>
          <div className="public-info-card">
            <div className="public-info-icon">🏐</div>
            <div className="public-info-content">
              <span className="public-info-label">Disciplina</span>
              <span className="public-info-value">Vóley</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabla de Sets */}
      <div className="public-sets-section">
        <h3 className="public-section-title">
          <span className="public-section-icon">📊</span>
          Marcador por Sets
        </h3>
        <div className="public-sets-table-container">
          <table className="public-sets-table">
            <thead>
              <tr>
                <th className="public-team-header-cell">Equipo</th>
                {/* Mostrar sets según las reglas del juego */}
                {Array.from({ length: reglasJuego.sets }, (_, index) => {
                  const setNumber = index + 1;
                  const showSet = esFaseGrupos ? setNumber === 1 : setNumber <= 3;
                  
                  if (!showSet) return null;
                  
                  return (
                    <th key={`set${setNumber}`} className="public-set-header">
                      Set {setNumber}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="public-team-name-cell">{equipoA}</td>
                {Array.from({ length: reglasJuego.sets }, (_, index) => {
                  const setNumber = index + 1;
                  const showSet = esFaseGrupos ? setNumber === 1 : setNumber <= 3;
                  
                  if (!showSet) return null;
                  
                  const setKey = `set${setNumber}`;
                  const setData = match.sets?.[setKey];
                  const limitePuntos = esFaseGrupos 
                    ? reglasJuego.puntosPorSet 
                    : reglasJuego.puntosPorSet[index] || 20;
                  const ganador = setData ? ganadorSet(setData, limitePuntos) : null;
                  
                  return (
                    <td key={setKey} className={`public-set-score ${ganador === 'A' ? 'public-winner' : ''}`}>
                      <div className="public-score-display">
                        <span className="public-score-value">{setData?.A || 0}</span>
                        <div className="public-score-limit">/{limitePuntos}</div>
                      </div>
                    </td>
                  );
                })}
              </tr>
              <tr>
                <td className="public-team-name-cell">{equipoB}</td>
                {Array.from({ length: reglasJuego.sets }, (_, index) => {
                  const setNumber = index + 1;
                  const showSet = esFaseGrupos ? setNumber === 1 : setNumber <= 3;
                  
                  if (!showSet) return null;
                  
                  const setKey = `set${setNumber}`;
                  const setData = match.sets?.[setKey];
                  const limitePuntos = esFaseGrupos 
                    ? reglasJuego.puntosPorSet 
                    : reglasJuego.puntosPorSet[index] || 20;
                  const ganador = setData ? ganadorSet(setData, limitePuntos) : null;
                  
                  return (
                    <td key={setKey} className={`public-set-score ${ganador === 'B' ? 'public-winner' : ''}`}>
                      <div className="public-score-display">
                        <span className="public-score-value">{setData?.B || 0}</span>
                        <div className="public-score-limit">/{limitePuntos}</div>
                      </div>
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Anotadores */}
      <div className="public-scorers-section">
        <h3 className="public-section-title">
          <span className="public-section-icon">👤</span>
          Anotadores del Partido
        </h3>
        <div className="public-scorers-grid">
          {/* Anotadores Equipo A */}
          <div className="public-team-scorers">
            <h4 className="public-team-subtitle">{equipoA}</h4>
            <div className="public-scorers-list">
              {anotadoresAAgrupados.length > 0 ? (
                anotadoresAAgrupados.map((anotador, index) => (
                  <div key={index} className="public-scorer-item">
                    <span className="public-player-name">{anotador.nombre}</span>
                    <span className="public-point-count">{anotador.cantidad} pts</span>
                  </div>
                ))
              ) : (
                <p className="public-no-points">Sin puntos aún</p>
              )}
            </div>
          </div>

          {/* Anotadores Equipo B */}
          <div className="public-team-scorers">
            <h4 className="public-team-subtitle">{equipoB}</h4>
            <div className="public-scorers-list">
              {anotadoresBAgrupados.length > 0 ? (
                anotadoresBAgrupados.map((anotador, index) => (
                  <div key={index} className="public-scorer-item">
                    <span className="public-player-name">{anotador.nombre}</span>
                    <span className="public-point-count">{anotador.cantidad} pts</span>
                  </div>
                ))
              ) : (
                <p className="public-no-points">Sin puntos aún</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Resultado final */}
      {match.estado === "finalizado" && (
        <div className="admin-result-section">
          <h3 className="admin-section-title">
            <span className="admin-section-icon">🏆</span>
            Resultado Final
          </h3>
          <div className="admin-result-card">
            {match.marcadorA > match.marcadorB ? (
              <div className="admin-winner-announcement">
                <span className="admin-winner-icon">🎉</span>
                <span className="admin-winner-text">Ganador: {equipoA}</span>
                <span className="admin-final-score">{match.marcadorA} - {match.marcadorB}</span>
              </div>
            ) : match.marcadorB > match.marcadorA ? (
              <div className="admin-winner-announcement">
                <span className="admin-winner-icon">🎉</span>
                <span className="admin-winner-text">Ganador: {equipoB}</span>
                <span className="admin-final-score">{match.marcadorA} - {match.marcadorB}</span>
              </div>
            ) : (
              <div className="admin-tie-announcement">
                <span className="admin-tie-icon">🤝</span>
                <span className="admin-tie-text">Empate</span>
                <span className="admin-final-score">{match.marcadorA} - {match.marcadorB}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
