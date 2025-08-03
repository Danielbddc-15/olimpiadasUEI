import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase/config";
import "../styles/AdminMatchDetail.css";

export default function AdminMatchDetail() {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [goleadorInput, setGoleadorInput] = useState("");
  const [mostrarInputGoleador, setMostrarInputGoleador] = useState(null); // 'A' o 'B'
  const [jugadoresEquipoA, setJugadoresEquipoA] = useState([]);
  const [jugadoresEquipoB, setJugadoresEquipoB] = useState([]);

  // Estados para edición de goleadores
  const [editandoGoleadores, setEditandoGoleadores] = useState(false);
  const [goleadoresTemporal, setGoleadoresTemporal] = useState({ A: [], B: [] });
  const [nuevoGoleador, setNuevoGoleador] = useState({ A: "", B: "" });

  // Cargar datos del partido
  useEffect(() => {
    const fetchMatch = async () => {
      try {
        const docRef = doc(db, "matches", matchId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const matchData = { id: docSnap.id, ...docSnap.data() };
          setMatch(matchData);
          
          // Inicializar valores temporales
          setGoleadoresTemporal({
            A: [...(matchData.goleadoresA || [])],
            B: [...(matchData.goleadoresB || [])]
          });
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

  // Cargar jugadores de los equipos
  useEffect(() => {
    const fetchJugadores = async () => {
      if (!match?.equipoA || !match?.equipoB) return;

      try {
        // Cargar jugadores del equipo A
        const queryA = query(
          collection(db, "jugadores"),
          where("curso", "==", match.equipoA.curso),
          where("paralelo", "==", match.equipoA.paralelo),
          where("categoria", "==", match.equipoA.categoria || match.categoria),
          where("genero", "==", match.equipoA.genero || match.genero),
          where("disciplina", "==", match.disciplina)
        );
        const snapshotA = await getDocs(queryA);
        const jugadoresA = snapshotA.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data() 
        })).sort((a, b) => (a.numero || 0) - (b.numero || 0));

        // Cargar jugadores del equipo B
        const queryB = query(
          collection(db, "jugadores"),
          where("curso", "==", match.equipoB.curso),
          where("paralelo", "==", match.equipoB.paralelo),
          where("categoria", "==", match.equipoB.categoria || match.categoria),
          where("genero", "==", match.equipoB.genero || match.genero),
          where("disciplina", "==", match.disciplina)
        );
        const snapshotB = await getDocs(queryB);
        const jugadoresB = snapshotB.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data() 
        })).sort((a, b) => (a.numero || 0) - (b.numero || 0));

        setJugadoresEquipoA(jugadoresA);
        setJugadoresEquipoB(jugadoresB);
        
        // Debug para verificar que se cargan los jugadores
        console.log("Jugadores Equipo A:", jugadoresA);
        console.log("Jugadores Equipo B:", jugadoresB);
        console.log("Match data:", match);
      } catch (error) {
        console.error("Error al cargar jugadores:", error);
      }
    };

    fetchJugadores();
  }, [match]);

  // Actualizar marcador y goleadores
  const marcarGol = async (equipo) => {
    if (!goleadorInput.trim()) {
      alert("Por favor, ingresa el nombre del goleador");
      return;
    }

    try {
      const nuevoMarcador = equipo === 'A' 
        ? { marcadorA: (match.marcadorA || 0) + 1 }
        : { marcadorB: (match.marcadorB || 0) + 1 };

      // Obtener goleadores actuales
      const goleadoresActuales = equipo === 'A' 
        ? match.goleadoresA || []
        : match.goleadoresB || [];

      // Agregar nuevo goleador
      const nuevosGoleadores = [...goleadoresActuales, goleadorInput.trim()];

      const updateData = {
        ...nuevoMarcador,
        ...(equipo === 'A' 
          ? { goleadoresA: nuevosGoleadores }
          : { goleadoresB: nuevosGoleadores }
        ),
        estado: "en curso"
      };

      await updateDoc(doc(db, "matches", matchId), updateData);

      // Actualizar estado local
      setMatch(prev => ({
        ...prev,
        ...updateData
      }));

      // Actualizar valores temporales
      setGoleadoresTemporal(prev => ({
        ...prev,
        [equipo]: nuevosGoleadores
      }));

      // Limpiar input
      setGoleadorInput("");
      setMostrarInputGoleador(null);

    } catch (error) {
      console.error("Error al marcar gol:", error);
      alert("Error al marcar gol");
    }
  };

  // Agregar goleador en edición
  const agregarGoleador = (equipo) => {
    if (!nuevoGoleador[equipo].trim()) return;
    
    setGoleadoresTemporal(prev => ({
      ...prev,
      [equipo]: [...prev[equipo], nuevoGoleador[equipo].trim()]
    }));
    
    setNuevoGoleador(prev => ({
      ...prev,
      [equipo]: ""
    }));
  };

  // Eliminar goleador en edición
  const eliminarGoleador = (equipo, indice) => {
    setGoleadoresTemporal(prev => ({
      ...prev,
      [equipo]: prev[equipo].filter((_, i) => i !== indice)
    }));
  };

  // Editar nombre de goleador
  const editarNombreGoleador = (equipo, indice, nuevoNombre) => {
    setGoleadoresTemporal(prev => ({
      ...prev,
      [equipo]: prev[equipo].map((nombre, i) => 
        i === indice ? nuevoNombre : nombre
      )
    }));
  };

  // Guardar goleadores editados
  const guardarGoleadores = async () => {
    try {
      const updateData = {
        goleadoresA: goleadoresTemporal.A,
        goleadoresB: goleadoresTemporal.B,
        marcadorA: goleadoresTemporal.A.length,
        marcadorB: goleadoresTemporal.B.length
      };

      await updateDoc(doc(db, "matches", matchId), updateData);

      setMatch(prev => ({
        ...prev,
        ...updateData
      }));

      setEditandoGoleadores(false);
      alert("Goleadores actualizados correctamente");
    } catch (error) {
      console.error("Error al actualizar goleadores:", error);
      alert("Error al actualizar goleadores");
    }
  };

  // Cancelar edición de goleadores
  const cancelarEdicionGoleadores = () => {
    setGoleadoresTemporal({
      A: [...(match.goleadoresA || [])],
      B: [...(match.goleadoresB || [])]
    });
    setNuevoGoleador({ A: "", B: "" });
    setEditandoGoleadores(false);
  };

  // Cambiar estado del partido
  const cambiarEstado = async (nuevoEstado) => {
    try {
      await updateDoc(doc(db, "matches", matchId), {
        estado: nuevoEstado
      });

      setMatch(prev => ({
        ...prev,
        estado: nuevoEstado
      }));
    } catch (error) {
      console.error("Error al cambiar estado:", error);
      alert("Error al cambiar estado");
    }
  };

  // Función para contar goleadores
  const contarGoleadores = (goleadores) => {
    const conteo = {};
    (goleadores || []).forEach(nombre => {
      conteo[nombre] = (conteo[nombre] || 0) + 1;
    });
    return conteo;
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Cargando partido...</p>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="error-container">
        <p>Partido no encontrado</p>
        <button onClick={() => navigate(-1)} className="back-btn">
          Volver
        </button>
      </div>
    );
  }

  const equipoA = `${match.equipoA?.curso} ${match.equipoA?.paralelo}`;
  const equipoB = `${match.equipoB?.curso} ${match.equipoB?.paralelo}`;
  const goleadoresA = contarGoleadores(match.goleadoresA);
  const goleadoresB = contarGoleadores(match.goleadoresB);

  return (
    <div className="admin-match-detail-container">
      {/* Header */}
      <div className="admin-match-header">
        <button onClick={() => navigate(-1)} className="admin-back-button">
          ← Volver
        </button>
        <h1 className="admin-match-title">Gestión de Partido - Admin</h1>
        <div className="admin-match-info">
          <span className="admin-match-group">{match.grupo}</span>
          <span className="admin-match-phase">{match.fase || "Grupos"}</span>
        </div>
      </div>

      {/* Estado del partido */}
      <div className="admin-match-status">
        <div className="admin-status-info">
          <span className={`admin-status-badge ${match.estado}`}>
            {(match.estado === "pendiente" || match.estado === "programado") && "⏳ Programado"}
            {match.estado === "en curso" && "🟢 En Curso"}
            {match.estado === "finalizado" && "✅ Finalizado"}
          </span>
        </div>
        <div className="admin-status-actions">
          {(match.estado === "pendiente" || match.estado === "programado") && (
            <>
              <button 
                onClick={() => cambiarEstado("en curso")}
                className="admin-btn admin-btn-start"
                title="Como administrador, puedes iniciar el partido en cualquier momento"
              >
                ▶️ Iniciar Partido
              </button>
              <div className="admin-privilege-info">
                <span className="privilege-icon">🛡️</span>
                <span className="privilege-text">Como administrador, puedes iniciar partidos sin restricciones de horario</span>
              </div>
            </>
          )}
          {match.estado === "en curso" && (
            <button 
              onClick={() => cambiarEstado("finalizado")}
              className="admin-btn admin-btn-finish"
            >
              🏁 Finalizar Partido
            </button>
          )}
          {match.estado === "finalizado" && (
            <button 
              onClick={() => cambiarEstado("en curso")}
              className="admin-btn admin-btn-resume"
            >
              ⏯️ Reanudar Partido
            </button>
          )}
        </div>
      </div>

      {/* Marcador principal */}
      <div className="admin-scoreboard">
        {/* Equipo A */}
        <div className="admin-team-section">
          <div className="admin-team-header">
            <div className="admin-team-icon">🏆</div>
            <h2 className="admin-team-name">{equipoA}</h2>
          </div>
          <div className="admin-score-display">
            <span className="admin-score">{match.marcadorA || 0}</span>
          </div>
          <button
            onClick={() => setMostrarInputGoleador('A')}
            className="admin-goal-btn"
            disabled={match.estado !== "en curso"}
          >
            ⚽ Marcar Gol
          </button>
        </div>

        {/* Separador */}
        <div className="admin-vs-separator">
          <span className="admin-vs-text">VS</span>
        </div>

        {/* Equipo B */}
        <div className="admin-team-section">
          <div className="admin-team-header">
            <div className="admin-team-icon">🏆</div>
            <h2 className="admin-team-name">{equipoB}</h2>
          </div>
          <div className="admin-score-display">
            <span className="admin-score">{match.marcadorB || 0}</span>
          </div>
          <button
            onClick={() => setMostrarInputGoleador('B')}
            className="admin-goal-btn"
            disabled={match.estado !== "en curso"}
          >
            ⚽ Marcar Gol
          </button>
        </div>
      </div>

      {/* Input para goleador */}
      {mostrarInputGoleador && (
        <div className="admin-goal-input-modal">
          <div className="admin-modal-content">
            <h3>
              Gol para {mostrarInputGoleador === 'A' ? equipoA : equipoB}
            </h3>
            
            {/* Lista de jugadores del equipo */}
            <div className="admin-player-selector">
              <h4>Seleccionar Jugador:</h4>
              <div className="admin-players-grid">
                {(mostrarInputGoleador === 'A' ? jugadoresEquipoA : jugadoresEquipoB).length > 0 ? (
                  (mostrarInputGoleador === 'A' ? jugadoresEquipoA : jugadoresEquipoB).map((jugador) => (
                    <button
                      key={jugador.id}
                      onClick={() => setGoleadorInput(`#${jugador.numero || '?'} ${jugador.nombre}`)}
                      className={`admin-player-selector-btn ${
                        goleadorInput === `#${jugador.numero || '?'} ${jugador.nombre}` ? 'selected' : ''
                      }`}
                    >
                      <span className="player-number-btn">#{jugador.numero || '?'}</span>
                      <span className="player-name-btn">{jugador.nombre}</span>
                    </button>
                  ))
                ) : (
                  <div className="no-players-available">
                    <span className="no-players-icon">⚠️</span>
                    <span>No hay jugadores registrados para este equipo</span>
                  </div>
                )}
              </div>
            </div>
            
            {/* Input manual como alternativa */}
            <div className="admin-manual-input">
              <h4>O escribir manualmente:</h4>
              <input
                type="text"
                placeholder="Nombre del goleador..."
                value={goleadorInput}
                onChange={(e) => setGoleadorInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    marcarGol(mostrarInputGoleador);
                  }
                }}
                className="admin-goal-input"
              />
            </div>
            
            <div className="admin-modal-actions">
              <button
                onClick={() => marcarGol(mostrarInputGoleador)}
                className="admin-btn admin-btn-confirm"
                disabled={!goleadorInput.trim()}
              >
                ✅ Confirmar Gol
              </button>
              <button
                onClick={() => {
                  setMostrarInputGoleador(null);
                  setGoleadorInput("");
                }}
                className="admin-btn admin-btn-cancel"
              >
                ❌ Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lista de goleadores */}
      <div className="admin-goalscorers-section">
        <div className="admin-goalscorers-header">
          <h3 className="admin-section-title">⚽ Goleadores del Partido</h3>
          <div className="admin-goalscorer-controls">
            {editandoGoleadores ? (
              <div className="admin-edit-actions">
                <button
                  onClick={guardarGoleadores}
                  className="admin-btn admin-btn-save"
                >
                  💾 Guardar Cambios
                </button>
                <button
                  onClick={cancelarEdicionGoleadores}
                  className="admin-btn admin-btn-cancel"
                >
                  ❌ Cancelar
                </button>
              </div>
            ) : (
              <button
                onClick={() => setEditandoGoleadores(true)}
                className="admin-btn admin-btn-edit"
              >
                ✏️ Editar Goleadores
              </button>
            )}
          </div>
        </div>

        <div className="admin-goalscorers-grid">
          {/* Goleadores Equipo A */}
          <div className="admin-team-goalscorers">
            <h4 className="admin-team-subtitle">{equipoA}</h4>
            <div className="admin-goalscorers-list">
              {editandoGoleadores ? (
                <>
                  {goleadoresTemporal.A.map((nombre, index) => (
                    <div key={index} className="admin-goalscorer-edit-item">
                      <input
                        type="text"
                        value={nombre}
                        onChange={(e) => editarNombreGoleador('A', index, e.target.value)}
                        className="admin-goalscorer-input"
                      />
                      <button
                        onClick={() => eliminarGoleador('A', index)}
                        className="admin-btn-remove"
                      >
                        🗑️
                      </button>
                    </div>
                  ))}
                  <div className="admin-add-goalscorer">
                    <input
                      type="text"
                      placeholder="Agregar goleador..."
                      value={nuevoGoleador.A}
                      onChange={(e) => setNuevoGoleador(prev => ({
                        ...prev,
                        A: e.target.value
                      }))}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          agregarGoleador('A');
                        }
                      }}
                      className="admin-goalscorer-input"
                    />
                    <button
                      onClick={() => agregarGoleador('A')}
                      className="admin-btn-add"
                    >
                      ➕
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {Object.keys(goleadoresA).length > 0 ? (
                    Object.entries(goleadoresA).map(([nombre, goles]) => (
                      <div key={nombre} className="admin-goalscorer-item">
                        <span className="admin-player-name">{nombre}</span>
                        <span className="admin-goal-count">({goles})</span>
                      </div>
                    ))
                  ) : (
                    <p className="admin-no-goals">Sin goles aún</p>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Goleadores Equipo B */}
          <div className="admin-team-goalscorers">
            <h4 className="admin-team-subtitle">{equipoB}</h4>
            <div className="admin-goalscorers-list">
              {editandoGoleadores ? (
                <>
                  {goleadoresTemporal.B.map((nombre, index) => (
                    <div key={index} className="admin-goalscorer-edit-item">
                      <input
                        type="text"
                        value={nombre}
                        onChange={(e) => editarNombreGoleador('B', index, e.target.value)}
                        className="admin-goalscorer-input"
                      />
                      <button
                        onClick={() => eliminarGoleador('B', index)}
                        className="admin-btn-remove"
                      >
                        🗑️
                      </button>
                    </div>
                  ))}
                  <div className="admin-add-goalscorer">
                    <input
                      type="text"
                      placeholder="Agregar goleador..."
                      value={nuevoGoleador.B}
                      onChange={(e) => setNuevoGoleador(prev => ({
                        ...prev,
                        B: e.target.value
                      }))}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          agregarGoleador('B');
                        }
                      }}
                      className="admin-goalscorer-input"
                    />
                    <button
                      onClick={() => agregarGoleador('B')}
                      className="admin-btn-add"
                    >
                      ➕
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {Object.keys(goleadoresB).length > 0 ? (
                    Object.entries(goleadoresB).map(([nombre, goles]) => (
                      <div key={nombre} className="admin-goalscorer-item">
                        <span className="admin-player-name">{nombre}</span>
                        <span className="admin-goal-count">({goles})</span>
                      </div>
                    ))
                  ) : (
                    <p className="admin-no-goals">Sin goles aún</p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Información adicional */}
      <div className="admin-match-additional-info">
        <div className="admin-info-grid">
          <div className="admin-info-item">
            <span className="admin-info-label">📅 Fecha:</span>
            <span className="admin-info-value">{match.fecha || "No definida"}</span>
          </div>
          <div className="admin-info-item">
            <span className="admin-info-label">🕐 Hora:</span>
            <span className="admin-info-value">{match.hora || "No definida"}</span>
          </div>
          <div className="admin-info-item">
            <span className="admin-info-label">🏟️ Grupo:</span>
            <span className="admin-info-value">{match.grupo}</span>
          </div>
          <div className="admin-info-item">
            <span className="admin-info-label">🏆 Fase:</span>
            <span className="admin-info-value">{match.fase || "Grupos"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}