import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase/config";
import "../styles/AdminVoleyMatchDetail.css";

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

  // Función para determinar el ganador de un set
  const ganadorSet = (setData, limitePuntos) => {
    if (!setData) return null;
    if (setData.A >= limitePuntos && setData.A - setData.B >= 2) return 'A';
    if (setData.B >= limitePuntos && setData.B - setData.A >= 2) return 'B';
    return null;
  };

  // Inicializar sets según las reglas del juego
  const inicializarSets = () => {
    const sets = [];
    const numSets = 5; // Máximo 5 sets en vóley
    
    for (let i = 1; i <= numSets; i++) {
      const setKey = `set${i}`;
      sets.push(match?.[setKey] || { A: 0, B: 0 });
    }
    
    return sets;
  };

  // Determinar si se debe mostrar un set
  const deberMostrarSet = (setIndex, sets) => {
    const setData = sets[setIndex];
    
    // Siempre mostrar los primeros 3 sets si hay datos o si es el primer set
    if (setIndex <= 2) {
      return setIndex === 0 || (setData && (setData.A > 0 || setData.B > 0)) || 
             (setIndex > 0 && sets[setIndex - 1] && (sets[setIndex - 1].A > 0 || sets[setIndex - 1].B > 0));
    }
    
    // Para sets 4 y 5, solo mostrar si hay datos
    return setData && (setData.A > 0 || setData.B > 0);
  };

  // Obtener puntos límite para cada set
  const obtenerPuntosSet = (setIndex, sets) => {
    const esFaseGrupos = match?.fase === 'grupos1' || match?.fase === 'grupos3' || !match?.fase;
    const esSemifinal = match?.fase === "semifinales";
    const esFinal = match?.fase === "finales";

    if (esFaseGrupos) {
      return 20; // Solo 1 set de 20 puntos
    } else if (esSemifinal) {
      return setIndex === 2 ? 15 : 20; // 20-20-15
    } else if (esFinal) {
      return setIndex === 2 ? 15 : 5; // 5-5-15
    } else {
      return setIndex === 4 ? 15 : 20; // Set decisivo de 15, otros de 20
    }
  };

  const fasesNombres = {
    'grupos1': 'Fase de Grupos 1',
    'grupos3': 'Fase de Grupos 3', 
    'semifinales': 'Semifinales',
    'finales': 'Final'
  };

  if (loading) {
    return (
      <div className="admin-voley-detail-container">
        <div className="admin-loading">Cargando partido...</div>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="admin-voley-detail-container">
        <div className="admin-error">Partido no encontrado</div>
      </div>
    );
  }

  const equipoA = `${match.equipoA?.curso} ${match.equipoA?.paralelo}`;
  const equipoB = `${match.equipoB?.curso} ${match.equipoB?.paralelo}`;
  const sets = inicializarSets();
  
  const esFaseGrupos = match?.fase === 'grupos1' || match?.fase === 'grupos3' || !match?.fase;
  const esSemifinal = match?.fase === "semifinales";
  const esFinal = match?.fase === "finales";

  const reglasJuego = esFaseGrupos
    ? { sets: 1, puntosPorSet: 20, descripcion: "1 set de 20 puntos" }
    : esSemifinal
    ? { sets: 3, puntosPorSet: [20, 20, 15], descripcion: "Al mejor de 3 sets: 20-20-15" }
    : esFinal
    ? { sets: 3, puntosPorSet: [5, 5, 15], descripcion: "Al mejor de 3 sets: 5-5-15" }
    : { sets: 3, puntosPorSet: [20, 20, 15], descripcion: "Al mejor de 3 sets: 20-20-15" };

  return (
    <div className="admin-voley-detail-container">
      {/* Header */}
      <div className="admin-voley-header">
        <button onClick={() => navigate(-1)} className="admin-back-button">
          ← Volver
        </button>
        <h1 className="admin-voley-title">🏐 Detalle del Partido - Vóley</h1>
        <div className="admin-voley-info">
          <span className="admin-voley-group">{match.grupo}</span>
          <span className="admin-voley-phase">{fasesNombres[match.fase] || "Fase de Grupos 1"}</span>
          <span className="admin-voley-rules">{reglasJuego.descripcion}</span>
        </div>
      </div>

      {/* Estado del partido */}
      <div className="admin-voley-status">
        <div className="admin-status-info">
          <span className={`admin-status-badge ${match.estado?.replace(' ', '-')}`}>
            {(match.estado === "pendiente" || match.estado === "programado") && "⏳ Programado"}
            {match.estado === "en curso" && "🟢 En Curso"}
            {match.estado === "finalizado" && "✅ Finalizado"}
          </span>
        </div>
      </div>

      {/* Marcador principal */}
      <div className="admin-voley-scoreboard">
        <div className="admin-team-section">
          <div className="admin-team-header">
            <div className="admin-team-icon">🏆</div>
            <h2 className="admin-team-name">{equipoA}</h2>
          </div>
          <div className="admin-score-display">
            <span className="admin-score">{match.marcadorA || 0}</span>
            <span className="admin-score-label">puntos totales</span>
          </div>
        </div>

        <div className="admin-vs-separator">
          <span className="admin-vs-text">VS</span>
        </div>

        <div className="admin-team-section">
          <div className="admin-team-header">
            <div className="admin-team-icon">🏆</div>
            <h2 className="admin-team-name">{equipoB}</h2>
          </div>
          <div className="admin-score-display">
            <span className="admin-score">{match.marcadorB || 0}</span>
            <span className="admin-score-label">puntos totales</span>
          </div>
        </div>
      </div>

      {/* Tabla de sets */}
      <div className="admin-sets-section">
        <h3 className="admin-section-title">📊 Marcador por Sets</h3>
        <div className="admin-sets-table">
          <table>
            <thead>
              <tr>
                <th>Equipo</th>
                {sets.map((_, index) => 
                  deberMostrarSet(index, sets) ? (
                    <th key={index}>
                      Set {index + 1}
                      {!esFaseGrupos && index === 4 && " (Decisivo - 15 pts)"}
                      {!esFaseGrupos && index < 4 && ` (${obtenerPuntosSet(index, sets)} pts)`}
                      {esFaseGrupos && " (20 pts)"}
                    </th>
                  ) : null
                )}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="team-name">{equipoA}</td>
                {sets.map((set, index) => {
                  if (!deberMostrarSet(index, sets)) return null;
                  
                  const limitePuntos = obtenerPuntosSet(index, sets);
                  const ganador = ganadorSet(set, limitePuntos);
                  return (
                    <td key={index} className={`set-score ${ganador === 'A' ? 'winner' : ''}`}>
                      <div className="set-points">
                        {set?.A || 0}
                      </div>
                      <div className="set-limit">/{limitePuntos}</div>
                    </td>
                  );
                })}
              </tr>
              <tr>
                <td className="team-name">{equipoB}</td>
                {sets.map((set, index) => {
                  if (!deberMostrarSet(index, sets)) return null;
                  
                  const limitePuntos = obtenerPuntosSet(index, sets);
                  const ganador = ganadorSet(set, limitePuntos);
                  return (
                    <td key={index} className={`set-score ${ganador === 'B' ? 'winner' : ''}`}>
                      <div className="set-points">
                        {set?.B || 0}
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

      {/* Anotadores */}
      {(match.anotadoresA?.length > 0 || match.anotadoresB?.length > 0) && (
        <div className="admin-goalscorers-section">
          <h3 className="admin-section-title">📝 Anotadores del Partido</h3>
          <div className="admin-goalscorers-grid">
            <div className="admin-team-goalscorers">
              <h4 className="admin-team-title">{equipoA}</h4>
              <div className="admin-goalscorer-list">
                {(match.anotadoresA || []).map((anotador, index) => (
                  <div key={index} className="admin-goalscorer-item">
                    <span className="admin-goalscorer-name">📝 {anotador}</span>
                  </div>
                ))}
                {(!match.anotadoresA || match.anotadoresA.length === 0) && (
                  <div className="admin-no-goals">Sin anotadores registrados</div>
                )}
              </div>
            </div>

            <div className="admin-team-goalscorers">
              <h4 className="admin-team-title">{equipoB}</h4>
              <div className="admin-goalscorer-list">
                {(match.anotadoresB || []).map((anotador, index) => (
                  <div key={index} className="admin-goalscorer-item">
                    <span className="admin-goalscorer-name">📝 {anotador}</span>
                  </div>
                ))}
                {(!match.anotadoresB || match.anotadoresB.length === 0) && (
                  <div className="admin-no-goals">Sin anotadores registrados</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Información adicional */}
      <div className="admin-additional-info">
        <div className="admin-info-grid">
          <div className="admin-info-item">
            <span className="admin-info-label">📅 Fecha:</span>
            <span className="admin-info-value">
              {match.fecha ? new Date(match.fecha).toLocaleDateString() : "No definida"}
            </span>
          </div>
          <div className="admin-info-item">
            <span className="admin-info-label">⏰ Hora:</span>
            <span className="admin-info-value">{match.hora || "No definida"}</span>
          </div>
          <div className="admin-info-item">
            <span className="admin-info-label">🏟️ Grupo:</span>
            <span className="admin-info-value">{match.grupo}</span>
          </div>
          <div className="admin-info-item">
            <span className="admin-info-label">🏆 Fase:</span>
            <span className="admin-info-value">{fasesNombres[match.fase] || "Fase de Grupos 1"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
