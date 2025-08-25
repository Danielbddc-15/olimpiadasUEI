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
    for (let i = 1; i <= reglasJuego.sets; i++) {
      const setKey = `set${i}`;
      sets.push(match?.[setKey] || { A: 0, B: 0 });
    }
    
    return { sets, reglas: reglasJuego };
  };

  const fasesNombres = {
    'grupos1': 'Fase de Grupos 1',
    'grupos3': 'Fase de Grupos 3', 
    'semifinales': 'Semifinales',
    'finales': 'Final'
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
  const { sets, reglas } = inicializarSets();

  return (
    <div className="profesor-match-detail-container">
      {/* Header */}
      <div className="profesor-match-header">
        <button onClick={() => navigate(-1)} className="profesor-back-button">
          ← Volver
        </button>
        <h1 className="profesor-match-title">Detalle del Partido - Vóley</h1>
        <div className="profesor-match-info">
          <span className="profesor-match-group">{match.grupo}</span>
          <span className="profesor-match-phase">{fasesNombres[match.fase] || "Fase de Grupos 1"}</span>
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
            <div className="profesor-team-icon">🏐</div>
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
            <div className="profesor-team-icon">🏐</div>
            <h2 className="profesor-team-name">{equipoB}</h2>
          </div>
          <div className="profesor-score-display">
            <span className="profesor-score">{match.marcadorB || 0}</span>
          </div>
        </div>
      </div>

      {/* Información de reglas */}
      <div className="profesor-game-rules">
        <h3 className="profesor-section-title">📋 Reglas del Partido</h3>
        <div className="profesor-rules-info">
          <span className="profesor-rules-text">{reglas.descripcion}</span>
        </div>
      </div>

      {/* Sets de vóley */}
      <div className="profesor-sets-display">
        <h3 className="profesor-section-title">🏐 Desarrollo por Sets</h3>
        <div className="profesor-sets-grid">
          {sets.map((setData, index) => {
            const setNumber = index + 1;
            const limitePuntos = Array.isArray(reglas.puntosPorSet) 
              ? reglas.puntosPorSet[index] 
              : reglas.puntosPorSet;
            const ganador = ganadorSet(setData, limitePuntos);
            
            // Solo mostrar sets que tienen datos o son el próximo a jugar
            if (!setData || (setData.A === 0 && setData.B === 0 && index > 0 && !ganadorSet(sets[index - 1], limitePuntos))) {
              return null;
            }
            
            return (
              <div key={setNumber} className={`profesor-set-card ${ganador ? 'completed' : ''}`}>
                <div className="profesor-set-header">
                  <h4>Set {setNumber}</h4>
                  <span className="profesor-set-limit">Hasta {limitePuntos} pts</span>
                  {ganador && <span className="profesor-set-winner">✓</span>}
                </div>
                <div className="profesor-set-score">
                  <div className={`profesor-team-score ${ganador === 'A' ? 'winner' : ''}`}>
                    <span className="profesor-team-name-short">{equipoA}</span>
                    <span className="profesor-score">{setData.A}</span>
                  </div>
                  <div className="profesor-score-separator">-</div>
                  <div className={`profesor-team-score ${ganador === 'B' ? 'winner' : ''}`}>
                    <span className="profesor-team-name-short">{equipoB}</span>
                    <span className="profesor-score">{setData.B}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Anotadores */}
      {(match.anotadoresA?.length > 0 || match.anotadoresB?.length > 0) && (
        <div className="profesor-scorers">
          <h3 className="profesor-section-title">📝 Anotadores</h3>
          <div className="profesor-scorers-grid">
            <div className="profesor-team-scorers">
              <h4 className="profesor-team-title">{equipoA}</h4>
              <div className="profesor-scorer-list">
                {(match.anotadoresA || []).map((anotador, index) => (
                  <div key={index} className="profesor-scorer-item">
                    📝 {anotador}
                  </div>
                ))}
                {(!match.anotadoresA || match.anotadoresA.length === 0) && (
                  <div className="profesor-no-scorers">Sin anotadores registrados</div>
                )}
              </div>
            </div>

            <div className="profesor-team-scorers">
              <h4 className="profesor-team-title">{equipoB}</h4>
              <div className="profesor-scorer-list">
                {(match.anotadoresB || []).map((anotador, index) => (
                  <div key={index} className="profesor-scorer-item">
                    📝 {anotador}
                  </div>
                ))}
                {(!match.anotadoresB || match.anotadoresB.length === 0) && (
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
            <span className="profesor-info-value">{fasesNombres[match.fase] || "Fase de Grupos 1"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
