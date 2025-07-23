import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase/config";
import "../styles/ProfesorVoleyMatchDetail.css";

export default function ProfesorVoleyMatchDetail() {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);

  // Estados para gestión de puntos
  const [mostrarInputPunto, setMostrarInputPunto] = useState(null);
  const [puntoInput, setPuntoInput] = useState("");

  // Estados para edición de anotadores (solo nombres)
  const [editandoAnotadores, setEditandoAnotadores] = useState(false);
  const [anotadoresTemporal, setAnotadoresTemporal] = useState({ A: [], B: [] });

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
          setAnotadoresTemporal({
            A: [...(matchData.anotadoresA || [])],
            B: [...(matchData.anotadoresB || [])]
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

  // Mapeo de fases para mostrar nombres legibles
  const fasesNombres = {
    "grupos1": "Fase de Grupos 1",
    "grupos3": "Fase de Grupos 3",
    "semifinales": "Semifinales",
    "finales": "Finales"
  };

  // Determinar reglas según fase
  const esFaseGrupos = ["grupos1", "grupos3"].includes(match?.fase || "grupos1");
  const esSemifinal = match?.fase === "semifinales";
  const esFinal = match?.fase === "finales";

  const reglasJuego = esFaseGrupos 
    ? { sets: 1, puntosPorSet: 20, descripcion: "1 set de 20 puntos" }
    : esSemifinal
    ? { sets: 3, puntosPorSet: [20, 20, 15], descripcion: "Al mejor de 3 sets: 20-20-15" }
    : esFinal
    ? { sets: 3, puntosPorSet: [5, 5, 15], descripcion: "Al mejor de 3 sets: 5-5-15" }
    : { sets: 3, puntosPorSet: [20, 20, 15], descripcion: "Al mejor de 3 sets: 20-20-15" };

  // Inicializar sets si no existen
  const inicializarSets = () => {
    if (!match?.sets) {
      const setsIniciales = esFaseGrupos 
        ? Array(1).fill({ A: 0, B: 0 })  // Solo 1 set para fases de grupos
        : Array(3).fill({ A: 0, B: 0 }); // 3 sets para semifinales/finales (al mejor de 3)
      return setsIniciales;
    }
    return match.sets;
  };

  // Calcular sets ganados por cada equipo
  const calcularSetsGanados = (sets) => {
    let setsA = 0, setsB = 0;
    
    sets.forEach((set, index) => {
      if (set.A > 0 || set.B > 0) {
        const puntosLimite = obtenerPuntosSet(index, sets);
        
        if (set.A >= puntosLimite && set.A - set.B >= 2) {
          setsA++;
        } else if (set.B >= puntosLimite && set.B - set.A >= 2) {
          setsB++;
        }
      }
    });
    
    return { setsA, setsB };
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

  // Determinar si un set debe mostrarse (para evitar mostrar sets innecesarios)
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

  // Función para obtener los puntos límite de un set específico
  const obtenerPuntosSet = (setIndex, sets) => {
    if (esFaseGrupos) return reglasJuego.puntosPorSet; // Siempre 20 en fases de grupos
    
    // Para semifinales y finales, verificar si algún equipo ya tiene 1 set ganado
    const { setsA, setsB } = calcularSetsGanados(sets.slice(0, setIndex));
    
    // Si algún equipo tiene 1 set ganado, el siguiente set es decisivo de 15 puntos
    if (setsA === 1 || setsB === 1) {
      return 15; // Set decisivo
    }
    
    // Si no, usar los puntos normales del array
    return reglasJuego.puntosPorSet[setIndex] || (esFinal ? 5 : 20);
  };

  // Cambiar estado del partido
  const cambiarEstadoPartido = async (nuevoEstado) => {
    try {
      const updateData = { estado: nuevoEstado };
      
      if (nuevoEstado === "en curso") {
        // Inicializar sets al comenzar el partido
        const setsIniciales = inicializarSets();
        updateData.sets = setsIniciales;
      }

      await updateDoc(doc(db, "matches", matchId), updateData);
      setMatch(prev => ({ ...prev, ...updateData }));
      
      const mensajes = {
        "en curso": "Partido iniciado",
        "finalizado": "Partido finalizado",
        "pendiente": "Partido pausado"
      };
      alert(mensajes[nuevoEstado] || "Estado actualizado");
    } catch (error) {
      console.error("Error al cambiar estado:", error);
      alert("Error al cambiar estado del partido");
    }
  };

  // Marcar punto
  const marcarPunto = async (equipo, setActual) => {
    if (!puntoInput.trim()) {
      alert("Por favor, ingresa el nombre del anotador");
      return;
    }

    try {
      const sets = inicializarSets();
      const nuevoSets = [...sets];
      
      // Obtener límite de puntos para el set actual
      const limitePuntos = obtenerPuntosSet(setActual, sets);

      // Verificar si el set ya está completo
      const setCompleto = ganadorSet(sets[setActual], limitePuntos) !== null;
      if (setCompleto) {
        alert("Este set ya está completo");
        return;
      }

      // Incrementar punto
      nuevoSets[setActual] = {
        ...nuevoSets[setActual],
        [equipo]: (nuevoSets[setActual][equipo] || 0) + 1
      };

      // Actualizar anotadores
      const anotadoresKey = `anotadores${equipo}`;
      const nuevosAnotadores = [...(match[anotadoresKey] || []), puntoInput.trim()];

      // Calcular marcador total
      const marcadorTotal = nuevoSets.reduce((total, set) => total + (set[equipo] || 0), 0);

      // Actualizar en Firebase
      const updateData = {
        sets: nuevoSets,
        [anotadoresKey]: nuevosAnotadores,
        [`marcador${equipo}`]: marcadorTotal
      };

      await updateDoc(doc(db, "matches", matchId), updateData);

      // Actualizar estado local
      setMatch(prev => ({
        ...prev,
        ...updateData
      }));

      // Limpiar input
      setPuntoInput("");
      setMostrarInputPunto(null);

    } catch (error) {
      console.error("Error al marcar punto:", error);
      alert("Error al marcar punto");
    }
  };

  // Editar nombre de anotador
  const editarNombreAnotador = (equipo, indice, nuevoNombre) => {
    setAnotadoresTemporal(prev => ({
      ...prev,
      [equipo]: prev[equipo].map((nombre, i) => 
        i === indice ? nuevoNombre : nombre
      )
    }));
  };

  const agregarAnotador = (equipo) => {
    setAnotadoresTemporal(prev => ({
      ...prev,
      [equipo]: [...prev[equipo], ""]
    }));
  };

  const eliminarAnotador = (equipo, indice) => {
    setAnotadoresTemporal(prev => ({
      ...prev,
      [equipo]: prev[equipo].filter((_, i) => i !== indice)
    }));
  };

  // Guardar cambios de nombres de anotadores
  const guardarAnotadores = async () => {
    try {
      const updateData = {
        anotadoresA: anotadoresTemporal.A.filter(nombre => nombre.trim()),
        anotadoresB: anotadoresTemporal.B.filter(nombre => nombre.trim())
      };

      await updateDoc(doc(db, "matches", matchId), updateData);

      setMatch(prev => ({
        ...prev,
        ...updateData
      }));

      setEditandoAnotadores(false);
      alert("Nombres de anotadores actualizados correctamente");
    } catch (error) {
      console.error("Error al actualizar anotadores:", error);
      alert("Error al actualizar nombres de anotadores");
    }
  };

  // Cancelar edición de anotadores
  const cancelarEdicionAnotadores = () => {
    setAnotadoresTemporal({
      A: [...(match.anotadoresA || [])],
      B: [...(match.anotadoresB || [])]
    });
    setEditandoAnotadores(false);
  };

  // Función para contar anotadores
  const contarAnotadores = (anotadores) => {
    const conteo = {};
    (anotadores || []).forEach(nombre => {
      conteo[nombre] = (conteo[nombre] || 0) + 1;
    });
    return conteo;
  };

  // Calcular ganador de set
  const ganadorSet = (setData, limitePuntos) => {
    if (!setData) return null;
    if (setData.A >= limitePuntos && setData.A - setData.B >= 2) return 'A';
    if (setData.B >= limitePuntos && setData.B - setData.A >= 2) return 'B';
    return null;
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
  const anotadoresA = contarAnotadores(match.anotadoresA);
  const anotadoresB = contarAnotadores(match.anotadoresB);
  const sets = inicializarSets();
  const partidoFinalizado = match.estado === "finalizado";

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
            {match.estado === "pendiente" && "⏳ Pendiente"}
            {match.estado === "en curso" && "🟢 En Curso"}
            {match.estado === "finalizado" && "✅ Finalizado"}
          </span>
        </div>
        <div className="admin-status-actions">
          {match.estado === "pendiente" && (
            <button
              onClick={() => cambiarEstadoPartido("en curso")}
              className="admin-btn admin-btn-start"
            >
              🚀 Iniciar Partido
            </button>
          )}
          {match.estado === "en curso" && (
            <>
              <button
                onClick={() => cambiarEstadoPartido("finalizado")}
                className="admin-btn admin-btn-finish"
              >
                🏁 Finalizar Partido
              </button>
              <button
                onClick={() => cambiarEstadoPartido("pendiente")}
                className="admin-btn admin-btn-resume"
              >
                ⏸️ Pausar Partido
              </button>
            </>
          )}
          {/* Profesor NO puede reanudar partidos finalizados - solo admin */}
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
                  
                  const limitePuntos = obtenerPuntosSet(index, match.sets);
                  const ganador = ganadorSet(set, limitePuntos);
                  return (
                    <td key={index} className={`set-score ${ganador === 'A' ? 'winner' : ''}`}>
                      <div className="set-points">
                        {set?.A || 0}
                        {match.estado === "en curso" && (
                          <button
                            onClick={() => setMostrarInputPunto({ equipo: 'A', set: index })}
                            className="punto-btn"
                            disabled={ganador !== null}
                          >
                            +
                          </button>
                        )}
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
                  
                  const limitePuntos = obtenerPuntosSet(index, match.sets);
                  const ganador = ganadorSet(set, limitePuntos);
                  return (
                    <td key={index} className={`set-score ${ganador === 'B' ? 'winner' : ''}`}>
                      <div className="set-points">
                        {set?.B || 0}
                        {match.estado === "en curso" && (
                          <button
                            onClick={() => setMostrarInputPunto({ equipo: 'B', set: index })}
                            className="punto-btn"
                            disabled={ganador !== null}
                          >
                            +
                          </button>
                        )}
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

      {/* Modal para agregar punto */}
      {mostrarInputPunto && (
        <div className="admin-punto-input-modal">
          <div className="admin-modal-content">
            <h3>Agregar Punto</h3>
            <p>Equipo: {mostrarInputPunto.equipo === 'A' ? equipoA : equipoB}</p>
            <p>Set: {mostrarInputPunto.set + 1}</p>
            <input
              type="text"
              value={puntoInput}
              onChange={(e) => setPuntoInput(e.target.value)}
              placeholder="Nombre del anotador"
              className="admin-punto-input"
              autoFocus
            />
            <div className="admin-modal-actions">
              <button
                onClick={() => marcarPunto(mostrarInputPunto.equipo, mostrarInputPunto.set)}
                className="admin-btn admin-btn-confirm"
              >
                ✅ Confirmar
              </button>
              <button
                onClick={() => setMostrarInputPunto(null)}
                className="admin-btn admin-btn-cancel"
              >
                ❌ Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lista de anotadores */}
      <div className="admin-scorers-section">
        <div className="admin-scorers-header">
          <h3 className="admin-section-title">🏐 Anotadores del Partido</h3>
          <div className="admin-scorer-controls">
            {/* Profesor NO puede editar anotadores una vez finalizado el partido */}
            {!partidoFinalizado && (
              editandoAnotadores ? (
                <div className="admin-edit-actions">
                  <button
                    onClick={guardarAnotadores}
                    className="admin-btn admin-btn-save"
                  >
                    💾 Guardar Cambios
                  </button>
                  <button
                    onClick={cancelarEdicionAnotadores}
                    className="admin-btn admin-btn-cancel"
                  >
                    ❌ Cancelar
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setEditandoAnotadores(true)}
                  className="admin-btn admin-btn-edit"
                >
                  ✏️ Editar Anotadores
                </button>
              )
            )}
            {partidoFinalizado && (
              <span className="admin-readonly-notice">
                🔒 Partido finalizado - Solo lectura
              </span>
            )}
          </div>
        </div>

        <div className="admin-scorers-grid">
          {/* Anotadores Equipo A */}
          <div className="admin-team-scorers">
            <h4 className="admin-team-subtitle">{equipoA}</h4>
            <div className="admin-scorers-list">
              {editandoAnotadores && !partidoFinalizado ? (
                <>
                  {anotadoresTemporal.A.map((nombre, index) => (
                    <div key={index} className="admin-scorer-edit-item">
                      <input
                        type="text"
                        value={nombre}
                        onChange={(e) => editarNombreAnotador('A', index, e.target.value)}
                        className="admin-scorer-input"
                        placeholder="Nombre del anotador..."
                      />
                      <button
                        onClick={() => eliminarAnotador('A', index)}
                        className="admin-btn-remove"
                      >
                        🗑️
                      </button>
                    </div>
                  ))}
                  <div className="admin-add-scorer">
                    <input
                      type="text"
                      placeholder="Nuevo anotador..."
                      className="admin-scorer-input"
                    />
                    <button
                      onClick={() => agregarAnotador('A')}
                      className="admin-btn-add"
                    >
                      ➕
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {Object.keys(anotadoresA).length > 0 ? (
                    Object.entries(anotadoresA).map(([nombre, puntos]) => (
                      <div key={nombre} className="admin-scorer-item">
                        <span className="admin-player-name">{nombre} ({puntos})</span>
                        <span className="admin-point-count">{puntos} pts</span>
                      </div>
                    ))
                  ) : (
                    <p className="admin-no-points">Sin puntos aún</p>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Anotadores Equipo B */}
          <div className="admin-team-scorers">
            <h4 className="admin-team-subtitle">{equipoB}</h4>
            <div className="admin-scorers-list">
              {editandoAnotadores && !partidoFinalizado ? (
                <>
                  {anotadoresTemporal.B.map((nombre, index) => (
                    <div key={index} className="admin-scorer-edit-item">
                      <input
                        type="text"
                        value={nombre}
                        onChange={(e) => editarNombreAnotador('B', index, e.target.value)}
                        className="admin-scorer-input"
                        placeholder="Nombre del anotador..."
                      />
                      <button
                        onClick={() => eliminarAnotador('B', index)}
                        className="admin-btn-remove"
                      >
                        🗑️
                      </button>
                    </div>
                  ))}
                  <div className="admin-add-scorer">
                    <input
                      type="text"
                      placeholder="Nuevo anotador..."
                      className="admin-scorer-input"
                    />
                    <button
                      onClick={() => agregarAnotador('B')}
                      className="admin-btn-add"
                    >
                      ➕
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {Object.keys(anotadoresB).length > 0 ? (
                    Object.entries(anotadoresB).map(([nombre, puntos]) => (
                      <div key={nombre} className="admin-scorer-item">
                        <span className="admin-player-name">{nombre} ({puntos})</span>
                        <span className="admin-point-count">{puntos} pts</span>
                      </div>
                    ))
                  ) : (
                    <p className="admin-no-points">Sin puntos aún</p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Información adicional */}
      <div className="admin-voley-additional-info">
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
            <span className="admin-info-value">{fasesNombres[match.fase] || "Fase de Grupos 1"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
