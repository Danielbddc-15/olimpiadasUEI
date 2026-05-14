import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, updateDoc, collection, query, where, getDocs, addDoc } from "../api/firestoreCompat";
import { db } from "../firebase/config";
import { verificarYGenerarFasesFinalesExterna } from "./AdminMatches";
import { useToast } from "../components/Toast";
import "../styles/ProfesorMatchDetail.css";

export default function ProfesorMatchDetail() {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const { showToast, ToastContainer } = useToast();
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

  // Estados para edición de fecha y hora
  const [editandoHorario, setEditandoHorario] = useState(false);
  const [fechaTemporal, setFechaTemporal] = useState("");
  const [horaTemporal, setHoraTemporal] = useState("");

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
          
          // Inicializar fecha y hora temporales
          let fechaInicial = matchData.fechaCompleta || "";
          if (!fechaInicial && matchData.fecha) {
            // Convertir día de la semana a fecha aproximada
            const hoy = new Date();
            const dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
            const diaIndex = dias.indexOf(matchData.fecha.toLowerCase());
            if (diaIndex !== -1) {
              const fechaApprox = new Date();
              fechaApprox.setDate(hoy.getDate() + (diaIndex - hoy.getDay()));
              fechaInicial = fechaApprox.toISOString().split('T')[0];
            }
          }
          
          setFechaTemporal(fechaInicial);
          setHoraTemporal(matchData.hora || "");
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
        
        console.log("Jugadores Equipo A:", jugadoresA);
        console.log("Jugadores Equipo B:", jugadoresB);
        console.log("Match data:", match);
      } catch (error) {
        console.error("Error al cargar jugadores:", error);
      }
    };

    fetchJugadores();
  }, [match]);

  // Función para verificar si los equipos están definidos (no son TBD)
  const equiposDefinidos = () => {
    if (!match) return false;
    
    const equipoAEsValido = match.equipoA && 
      match.equipoA.curso && 
      !match.equipoA.curso.includes("TBD") &&
      match.equipoA.paralelo &&
      !match.equipoA.paralelo.includes("TBD");
      
    const equipoBEsValido = match.equipoB && 
      match.equipoB.curso && 
      !match.equipoB.curso.includes("TBD") &&
      match.equipoB.paralelo &&
      !match.equipoB.paralelo.includes("TBD");
      
    return equipoAEsValido && equipoBEsValido;
  };

  // Actualizar marcador y goleadores
  const marcarGol = async (equipo) => {
    if (!goleadorInput.trim()) {
      showToast("Por favor, ingresa el nombre del goleador", "warning");
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

  // Funciones para edición de fecha y hora
  const actualizarFechaHora = async () => {
    try {
      // Convertir fecha a día de la semana si es necesario
      let diaFormateado = fechaTemporal;
      if (fechaTemporal && fechaTemporal.includes('-')) {
        const fecha = new Date(fechaTemporal + 'T00:00:00');
        const dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
        diaFormateado = dias[fecha.getDay()];
      }

      await updateDoc(doc(db, "matches", matchId), {
        fecha: diaFormateado || null,
        fechaCompleta: fechaTemporal || null, // Guardamos también la fecha completa
        hora: horaTemporal || null,
        semana: fechaTemporal && horaTemporal ? match.semana || 1 : null,
        estado: fechaTemporal && horaTemporal ? "programado" : "pendiente"
      });

      setMatch(prev => ({
        ...prev,
        fecha: diaFormateado || null,
        fechaCompleta: fechaTemporal || null,
        hora: horaTemporal || null,
        estado: fechaTemporal && horaTemporal ? "programado" : "pendiente"
      }));

      setEditandoHorario(false);
      showToast("Horario actualizado correctamente", "success");
    } catch (error) {
      console.error("Error actualizando horario:", error);
      showToast("Error al actualizar el horario", "error");
    }
  };

  const cancelarEdicionHorario = () => {
    // Si hay fecha completa, usarla; si no, convertir día a fecha
    let fechaInicial = match.fechaCompleta || "";
    if (!fechaInicial && match.fecha) {
      // Convertir día de la semana a fecha aproximada (solo para edición)
      const hoy = new Date();
      const dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
      const diaIndex = dias.indexOf(match.fecha.toLowerCase());
      if (diaIndex !== -1) {
        const fechaApprox = new Date();
        fechaApprox.setDate(hoy.getDate() + (diaIndex - hoy.getDay()));
        fechaInicial = fechaApprox.toISOString().split('T')[0];
      }
    }
    
    setFechaTemporal(fechaInicial);
    setHoraTemporal(match.hora || "");
    setEditandoHorario(false);
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

      const mensajes = {
        "en curso": "Partido iniciado",
        "finalizado": "Partido finalizado",
        "pendiente": "Partido pausado"
      };
      alert(mensajes[nuevoEstado] || "Estado actualizado");

      // Si se finaliza un partido, ejecutar verificación automática de generación de finales
      if (nuevoEstado === "finalizado") {
        console.log(`🎯 PARTIDO FINALIZADO (PROFESOR) - Ejecutando verificación automática para partido ID: ${matchId}`);

        // Ejecutar verificación automática después de un breve delay para asegurar que la BD esté actualizada
        setTimeout(async () => {
          try {
            console.log(`🔄 Iniciando verificación automática de finales desde profesor...`);

            // Obtener datos frescos de la base de datos
            const matchesSnapshot = await getDocs(collection(db, "matches"));
            const allMatches = matchesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // Filtrar partidos de la misma disciplina, categoría y género que el partido actual
            const matchesRelevantes = allMatches.filter(m =>
              m.disciplina === match.disciplina &&
              m.categoria === match.categoria &&
              m.genero === match.genero &&
              m.nivelEducacional === match.nivelEducacional
            );

            console.log(`📊 Partidos relevantes encontrados (profesor): ${matchesRelevantes.length}`);

            // Usar la función de verificación externa desde AdminMatches
            await verificarYGenerarFasesFinalesExterna(match, (mensaje, tipo) => {
              console.log(`Toast (${tipo}): ${mensaje}`);
              alert(mensaje);
            });

          } catch (error) {
            console.error("Error en verificación automática (profesor):", error);
            alert("❌ Error al verificar fases automáticas");
          }
        }, 2000);
      }
    } catch (error) {
      console.error("Error al cambiar estado:", error);
      alert("Error al cambiar estado del partido");
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
    <div className="profesor-match-detail-container">
      {/* Header */}
      <div className="profesor-match-header">
        <button onClick={() => navigate(-1)} className="profesor-back-button">
          ← Volver
        </button>
        <h1 className="profesor-match-title">Gestión de Partido - Profesor</h1>
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
        <div className="profesor-status-actions">
          {(match.estado === "pendiente" || match.estado === "programado") && (
            <>
              <button 
                onClick={() => cambiarEstado("en curso")}
                className="profesor-btn profesor-btn-start"
                title="Como profesor, puedes iniciar el partido en cualquier momento"
              >
                ▶️ Iniciar Partido
              </button>
              <div className="profesor-privilege-info">
                <span className="privilege-icon">💡</span>
                <span className="privilege-text">Como profesor, puedes iniciar partidos sin restricciones de horario</span>
              </div>
            </>
          )}
          {match.estado === "en curso" && (
            <button 
              onClick={() => cambiarEstado("finalizado")}
              className="profesor-btn profesor-btn-finish"
            >
              🏁 Finalizar Partido
            </button>
          )}
          {match.estado === "finalizado" && (
            <button 
              onClick={() => cambiarEstado("en curso")}
              className="profesor-btn profesor-btn-resume"
            >
              ⏯️ Reanudar Partido
            </button>
          )}
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
          <button
            onClick={() => setMostrarInputGoleador('A')}
            className="profesor-goal-btn"
            disabled={match.estado !== "en curso"}
          >
            ⚽ Marcar Gol
          </button>
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
          <button
            onClick={() => setMostrarInputGoleador('B')}
            className="profesor-goal-btn"
            disabled={match.estado !== "en curso"}
          >
            ⚽ Marcar Gol
          </button>
        </div>
      </div>

      {/* Input para goleador */}
      {mostrarInputGoleador && (
        <div className="profesor-goal-input-modal">
          <div className="profesor-modal-content">
            <h3>
              Gol para {mostrarInputGoleador === 'A' ? equipoA : equipoB}
            </h3>
            
            {/* Lista de jugadores del equipo */}
            <div className="profesor-player-selector">
              <h4>Seleccionar Jugador:</h4>
              <div className="profesor-players-grid">
                {(mostrarInputGoleador === 'A' ? jugadoresEquipoA : jugadoresEquipoB).length > 0 ? (
                  (mostrarInputGoleador === 'A' ? jugadoresEquipoA : jugadoresEquipoB).map((jugador) => (
                    <button
                      key={jugador.id}
                      onClick={() => setGoleadorInput(`#${jugador.numero || '?'} ${jugador.nombre}`)}
                      className={`profesor-player-selector-btn ${
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
            <div className="profesor-manual-input">
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
                className="profesor-goal-input"
              />
            </div>
            
            <div className="profesor-modal-actions">
              <button
                onClick={() => marcarGol(mostrarInputGoleador)}
                className="profesor-btn profesor-btn-confirm"
                disabled={!goleadorInput.trim()}
              >
                ✅ Confirmar Gol
              </button>
              <button
                onClick={() => {
                  setMostrarInputGoleador(null);
                  setGoleadorInput("");
                }}
                className="profesor-btn profesor-btn-cancel"
              >
                ❌ Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lista de goleadores */}
      <div className="profesor-goalscorers-section">
        <div className="profesor-goalscorers-header">
          <h3 className="profesor-section-title">⚽ Goleadores del Partido</h3>
          <div className="profesor-goalscorer-controls">
            {editandoGoleadores ? (
              <div className="profesor-edit-actions">
                <button
                  onClick={guardarGoleadores}
                  className="profesor-btn profesor-btn-save"
                >
                  💾 Guardar Cambios
                </button>
                <button
                  onClick={cancelarEdicionGoleadores}
                  className="profesor-btn profesor-btn-cancel"
                >
                  ❌ Cancelar
                </button>
              </div>
            ) : (
              <button
                onClick={() => setEditandoGoleadores(true)}
                className="profesor-btn profesor-btn-edit"
              >
                ✏️ Editar Goleadores
              </button>
            )}
          </div>
        </div>

        <div className="profesor-goalscorers-grid">
          {/* Goleadores Equipo A */}
          <div className="profesor-team-goalscorers">
            <h4 className="profesor-team-subtitle">{equipoA}</h4>
            <div className="profesor-goalscorers-list">
              {editandoGoleadores ? (
                <>
                  {goleadoresTemporal.A.map((nombre, index) => (
                    <div key={index} className="profesor-goalscorer-edit-item">
                      <input
                        type="text"
                        value={nombre}
                        onChange={(e) => editarNombreGoleador('A', index, e.target.value)}
                        className="profesor-goalscorer-input"
                      />
                      <button
                        onClick={() => eliminarGoleador('A', index)}
                        className="profesor-btn-remove"
                      >
                        🗑️
                      </button>
                    </div>
                  ))}
                  <div className="profesor-add-goalscorer">
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
                      className="profesor-goalscorer-input"
                    />
                    <button
                      onClick={() => agregarGoleador('A')}
                      className="profesor-btn-add"
                    >
                      ➕
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {Object.keys(goleadoresA).length > 0 ? (
                    Object.entries(goleadoresA).map(([nombre, goles]) => (
                      <div key={nombre} className="profesor-goalscorer-item">
                        <span className="profesor-player-name">{nombre}</span>
                        <span className="profesor-goal-count">({goles})</span>
                      </div>
                    ))
                  ) : (
                    <p className="profesor-no-goals">Sin goles aún</p>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Goleadores Equipo B */}
          <div className="profesor-team-goalscorers">
            <h4 className="profesor-team-subtitle">{equipoB}</h4>
            <div className="profesor-goalscorers-list">
              {editandoGoleadores ? (
                <>
                  {goleadoresTemporal.B.map((nombre, index) => (
                    <div key={index} className="profesor-goalscorer-edit-item">
                      <input
                        type="text"
                        value={nombre}
                        onChange={(e) => editarNombreGoleador('B', index, e.target.value)}
                        className="profesor-goalscorer-input"
                      />
                      <button
                        onClick={() => eliminarGoleador('B', index)}
                        className="profesor-btn-remove"
                      >
                        🗑️
                      </button>
                    </div>
                  ))}
                  <div className="profesor-add-goalscorer">
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
                      className="profesor-goalscorer-input"
                    />
                    <button
                      onClick={() => agregarGoleador('B')}
                      className="profesor-btn-add"
                    >
                      ➕
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {Object.keys(goleadoresB).length > 0 ? (
                    Object.entries(goleadoresB).map(([nombre, goles]) => (
                      <div key={nombre} className="profesor-goalscorer-item">
                        <span className="profesor-player-name">{nombre}</span>
                        <span className="profesor-goal-count">({goles})</span>
                      </div>
                    ))
                  ) : (
                    <p className="profesor-no-goals">Sin goles aún</p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Información adicional */}
      <div className="profesor-match-additional-info">
        <div className="profesor-info-grid">
          <div className="profesor-info-item">
            <span className="profesor-info-label">📅 Fecha:</span>
            {editandoHorario ? (
              <input
                type="date"
                value={fechaTemporal} 
                onChange={(e) => setFechaTemporal(e.target.value)}
                className="profesor-date-input"
              />
            ) : (
              <span className="profesor-info-value">
                {match.fechaCompleta ? 
                  new Date(match.fechaCompleta + 'T00:00:00').toLocaleDateString('es-ES', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  }) : 
                  (match.fecha || "No definida")
                }
              </span>
            )}
          </div>
          <div className="profesor-info-item">
            <span className="profesor-info-label">🕐 Hora:</span>
            {editandoHorario ? (
              <select 
                value={horaTemporal} 
                onChange={(e) => setHoraTemporal(e.target.value)}
                className="profesor-time-select"
              >
                <option value="">Sin hora</option>
                <option value="07:05">07:05</option>
                <option value="07:50">07:50</option>
                <option value="08:35">08:35</option>
                <option value="09:20">09:20</option>
                <option value="10:05">10:05</option>
                <option value="10:50">10:50</option>
                <option value="11:35">11:35</option>
                <option value="12:20">12:20</option>
                <option value="13:00">13:00</option>
              </select>
            ) : (
              <span className="profesor-info-value">{match.hora || "No definida"}</span>
            )}
          </div>
          <div className="profesor-info-item">
            <span className="profesor-info-label">📝 Horario:</span>
            {editandoHorario ? (
              <div className="profesor-schedule-buttons">
                <button className="profesor-save-btn" onClick={actualizarFechaHora}>
                  ✅ Guardar
                </button>
                <button className="profesor-cancel-btn" onClick={cancelarEdicionHorario}>
                  ❌ Cancelar
                </button>
              </div>
            ) : (
              <button className="profesor-edit-btn" onClick={() => setEditandoHorario(true)}>
                ✏️ Editar Horario
              </button>
            )}
          </div>
          <div className="profesor-info-item">
            <span className="profesor-info-label">🏟️ Grupo:</span>
            <span className="profesor-info-value">{match.grupo}</span>
          </div>
          <div className="profesor-info-item">
            <span className="profesor-info-label">🏆 Fase:</span>
            <span className="profesor-info-value">{match.fase || "Grupos"}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
