import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase/config";
import "../styles/ProfesorMatchDetail.css";

export default function PublicMatchDetail() {
  const { matchId, discipline } = useParams();
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

  // Función para agrupar goleadores (para fútbol)
  const agruparGoleadores = (goleadores) => {
    if (!goleadores) return [];
    
    const conteo = {};
    goleadores.forEach(goleador => {
      conteo[goleador] = (conteo[goleador] || 0) + 1;
    });

    return Object.entries(conteo).map(([nombre, cantidad]) => ({
      nombre,
      cantidad
    }));
  };

  // Funciones específicas para vóley
  const ganadorSet = (setData, limitePuntos) => {
    if (!setData) return null;
    if (setData.A >= limitePuntos && setData.A - setData.B >= 2) return 'A';
    if (setData.B >= limitePuntos && setData.B - setData.A >= 2) return 'B';
    return null;
  };

  const inicializarSets = () => {
    const sets = [];
    const numSets = match?.disciplina === 'voley' ? 3 : 1;
    
    for (let i = 1; i <= numSets; i++) {
      const setKey = `set${i}`;
      sets.push(match?.[setKey] || { A: 0, B: 0 });
    }
    
    return sets;
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

  return (
    <div className="profesor-match-detail-container">
      {/* Header */}
      <div className="profesor-match-header">
        <button 
          onClick={() => discipline ? navigate(`/matches/${discipline}`) : navigate(-1)} 
          className="profesor-back-button"
        >
          ← Volver
        </button>
        <h1 className="profesor-match-title">Detalle del Partido</h1>
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
            <div className="profesor-team-icon">🏆</div>
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
            <div className="profesor-team-icon">🏆</div>
            <h2 className="profesor-team-name">{equipoB}</h2>
          </div>
          <div className="profesor-score-display">
            <span className="profesor-score">{match.marcadorB || 0}</span>
          </div>
        </div>
      </div>

      {/* Contenido específico por disciplina */}
      {match.disciplina === 'futbol' && (
        <>
          {/* Goleadores */}
          {(match.goleadoresA?.length > 0 || match.goleadoresB?.length > 0) && (
            <div className="profesor-goalscorers">
              <h3 className="profesor-section-title">⚽ Goleadores</h3>
              <div className="profesor-goalscorers-grid">
                <div className="profesor-team-goalscorers">
                  <h4 className="profesor-team-title">{equipoA}</h4>
                  <div className="profesor-goalscorer-list">
                    {agruparGoleadores(match.goleadoresA).map((goleador, index) => (
                      <div key={index} className="profesor-goalscorer-item">
                        <span className="profesor-goalscorer-name">⚽ {goleador.nombre}</span>
                        {goleador.cantidad > 1 && (
                          <span className="profesor-goalscorer-count">x{goleador.cantidad}</span>
                        )}
                      </div>
                    ))}
                    {(!match.goleadoresA || match.goleadoresA.length === 0) && (
                      <div className="profesor-no-goals">Sin goles</div>
                    )}
                  </div>
                </div>

                <div className="profesor-team-goalscorers">
                  <h4 className="profesor-team-title">{equipoB}</h4>
                  <div className="profesor-goalscorer-list">
                    {agruparGoleadores(match.goleadoresB).map((goleador, index) => (
                      <div key={index} className="profesor-goalscorer-item">
                        <span className="profesor-goalscorer-name">⚽ {goleador.nombre}</span>
                        {goleador.cantidad > 1 && (
                          <span className="profesor-goalscorer-count">x{goleador.cantidad}</span>
                        )}
                      </div>
                    ))}
                    {(!match.goleadoresB || match.goleadoresB.length === 0) && (
                      <div className="profesor-no-goals">Sin goles</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {match.disciplina === 'voley' && (
        <>
          {/* Sets de vóley */}
          <div className="profesor-sets-display">
            <h3 className="profesor-section-title">🏐 Desarrollo por Sets</h3>
            <div className="profesor-sets-grid">
              {inicializarSets().map((setData, index) => {
                const setNumber = index + 1;
                const ganador = ganadorSet(setData, 20);
                
                return (
                  <div key={setNumber} className={`profesor-set-card ${ganador ? 'completed' : ''}`}>
                    <div className="profesor-set-header">
                      <h4>Set {setNumber}</h4>
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

          {/* Anotadores de vóley */}
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
                      <div className="profesor-no-scorers">Sin anotadores</div>
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
                      <div className="profesor-no-scorers">Sin anotadores</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {match.disciplina === 'basquet' && (
        <>
          {/* Anotadores de básquet */}
          {(match.anotadoresA?.length > 0 || match.anotadoresB?.length > 0) && (
            <div className="profesor-scorers">
              <h3 className="profesor-section-title">🏀 Anotadores</h3>
              <div className="profesor-scorers-grid">
                <div className="profesor-team-scorers">
                  <h4 className="profesor-team-title">{equipoA}</h4>
                  <div className="profesor-scorer-list">
                    {(match.anotadoresA || []).map((anotador, index) => (
                      <div key={index} className="profesor-scorer-item">
                        🏀 {anotador}
                      </div>
                    ))}
                    {(!match.anotadoresA || match.anotadoresA.length === 0) && (
                      <div className="profesor-no-scorers">Sin anotadores</div>
                    )}
                  </div>
                </div>

                <div className="profesor-team-scorers">
                  <h4 className="profesor-team-title">{equipoB}</h4>
                  <div className="profesor-scorer-list">
                    {(match.anotadoresB || []).map((anotador, index) => (
                      <div key={index} className="profesor-scorer-item">
                        🏀 {anotador}
                      </div>
                    ))}
                    {(!match.anotadoresB || match.anotadoresB.length === 0) && (
                      <div className="profesor-no-scorers">Sin anotadores</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
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
