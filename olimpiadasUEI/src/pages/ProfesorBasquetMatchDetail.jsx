import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, updateDoc, collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase/config";
import { verificarYGenerarFasesFinalesExterna } from "./AdminMatches";
import { useToast } from "../components/Toast";
import "../styles/AdminBasquetMatchDetail.css"; // Reutilizamos los mismos estilos

export default function ProfesorBasquetMatchDetail() {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const { showToast, Toast, ToastContainer } = useToast();
  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Estados para edición de fecha y hora
  const [editandoHorario, setEditandoHorario] = useState(false);
  const [fechaTemporal, setFechaTemporal] = useState("");
  const [horaTemporal, setHoraTemporal] = useState("");
  
  // Estados para anotar puntos
  const [jugadorInput, setJugadorInput] = useState("");
  const [mostrarInputJugador, setMostrarInputJugador] = useState(null); // 'A' o 'B'
  const [tipoCanasta, setTipoCanasta] = useState(1); // 1, 2 o 3 puntos

  // Estados para jugadores
  const [jugadoresEquipoA, setJugadoresEquipoA] = useState([]);
  const [jugadoresEquipoB, setJugadoresEquipoB] = useState([]);

  // Estados para control del partido
  const [partidoIniciado, setPartidoIniciado] = useState(false);
  const [partidoFinalizado, setPartidoFinalizado] = useState(false);

  // Cargar datos del partido
  useEffect(() => {
    const fetchMatch = async () => {
      try {
        const docRef = doc(db, "matches", matchId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const matchData = { id: docSnap.id, ...docSnap.data() };
          setMatch(matchData);
          
          // Inicializar fechas temporales
          setFechaTemporal(matchData.fecha || "");
          setHoraTemporal(matchData.hora || "");
          
          // Inicializar estados según el estado del partido
          setPartidoIniciado(matchData.estado === "en curso" || matchData.estado === "finalizado");
          setPartidoFinalizado(matchData.estado === "finalizado");
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
          where("disciplina", "==", "basquet")
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
          where("disciplina", "==", "basquet")
        );
        const snapshotB = await getDocs(queryB);
        const jugadoresB = snapshotB.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data() 
        })).sort((a, b) => (a.numero || 0) - (b.numero || 0));

        setJugadoresEquipoA(jugadoresA);
        setJugadoresEquipoB(jugadoresB);
        
        console.log("Jugadores Equipo A (Básquet):", jugadoresA);
        console.log("Jugadores Equipo B (Básquet):", jugadoresB);
      } catch (error) {
        console.error("Error al cargar jugadores:", error);
      }
    };

    fetchJugadores();
  }, [match]);

  // Función para anotar puntos
  const anotarPuntos = async (equipo) => {
    if (!partidoIniciado) {
      showToast("Debes iniciar el partido antes de anotar puntos", "warning");
      return;
    }

    // Los profesores pueden anotar puntos en cualquier momento
    if (!jugadorInput.trim()) {
      showToast("Por favor, ingresa el nombre del jugador", "warning");
      return;
    }

    try {
      const puntosAAgregar = parseInt(tipoCanasta);
      const nuevoMarcador = equipo === 'A' 
        ? { marcadorA: (match.marcadorA || 0) + puntosAAgregar }
        : { marcadorB: (match.marcadorB || 0) + puntosAAgregar };

      // Obtener anotadores actuales
      const anotadoresActuales = equipo === 'A' 
        ? match.anotadoresA || []
        : match.anotadoresB || [];

      // Agregar nueva anotación
      const nuevaAnotacion = {
        jugador: jugadorInput.trim(),
        puntos: puntosAAgregar,
        timestamp: new Date().toISOString()
      };
      const nuevosAnotadores = [...anotadoresActuales, nuevaAnotacion];

      const updateData = {
        ...nuevoMarcador,
        ...(equipo === 'A' 
          ? { anotadoresA: nuevosAnotadores }
          : { anotadoresB: nuevosAnotadores }
        ),
        estado: "en curso"
      };

      await updateDoc(doc(db, "matches", matchId), updateData);

      // Actualizar estado local
      setMatch(prev => ({
        ...prev,
        ...updateData
      }));

      // Limpiar inputs
      setJugadorInput("");
      setMostrarInputJugador(null);
      setTipoCanasta(1);

    } catch (error) {
      console.error("Error al anotar puntos:", error);
      showToast("Error al anotar puntos", "error");
    }
  };

  // Validar si se puede iniciar el partido (solo para profesores)
  const puedeIniciarPartido = () => {
    const userRole = localStorage.getItem('userRole');
    
    // Los profesores y administradores tienen acceso total sin restricciones
    if (userRole === 'admin' || userRole === 'profesor') {
      return { puede: true, mensaje: '' };
    }
    
    // Solo para otros roles aplicar validaciones mínimas
    return { puede: true, mensaje: '' };
  };

  // Iniciar partido
  const iniciarPartido = async () => {
    // Validar si se puede iniciar el partido
    const validacion = puedeIniciarPartido();
    if (!validacion.puede) {
      showToast(validacion.mensaje, "warning");
      return;
    }
    
    if (window.confirm("¿Estás seguro de que quieres iniciar este partido?")) {
      try {
        await updateDoc(doc(db, "matches", matchId), {
          estado: "en curso",
          fechaInicio: new Date().toISOString()
        });

        setMatch(prev => ({
          ...prev,
          estado: "en curso",
          fechaInicio: new Date().toISOString()
        }));

        setPartidoIniciado(true);
        showToast("Partido iniciado correctamente", "success");
      } catch (error) {
        console.error("Error al iniciar partido:", error);
        showToast("Error al iniciar partido", "error");
      }
    }
  };

  // Finalizar partido
  const finalizarPartido = async () => {
    if (window.confirm("¿Estás seguro de que quieres finalizar este partido?")) {
      try {
        await updateDoc(doc(db, "matches", matchId), {
          estado: "finalizado",
          fechaFinalizacion: new Date().toISOString()
        });

        setMatch(prev => ({
          ...prev,
          estado: "finalizado",
          fechaFinalizacion: new Date().toISOString()
        }));

        setPartidoFinalizado(true);
        showToast("Partido finalizado correctamente", "success");

        // Ejecutar verificación automática de generación de finales
        console.log(`🎯 PARTIDO BÁSQUET FINALIZADO (PROFESOR) - Ejecutando verificación automática para partido ID: ${matchId}`);

        // Ejecutar verificación automática después de un breve delay para asegurar que la BD esté actualizada
        setTimeout(async () => {
          try {
            console.log(`🔄 Iniciando verificación automática de finales desde profesor básquet...`);

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

            console.log(`📊 Partidos relevantes encontrados (profesor básquet): ${matchesRelevantes.length}`);

            // Usar la función de verificación externa desde AdminMatches
            await verificarYGenerarFasesFinalesExterna(match, (mensaje, tipo) => {
              console.log(`Toast (${tipo}): ${mensaje}`);
              // Eliminado alert redundante - verificación automática en background
            });

          } catch (error) {
            console.error("Error en verificación automática (profesor básquet):", error);
            // Solo mostrar error si es crítico
          }
        }, 2000);
      } catch (error) {
        console.error("Error al finalizar partido:", error);
        showToast("Error al finalizar partido", "error");
      }
    }
  };

  // Función para actualizar fecha y hora
  const actualizarFechaHora = async () => {
    try {
      const updateData = {
        fecha: fechaTemporal || null,
        hora: horaTemporal || null,
        semana: fechaTemporal && horaTemporal ? match.semana || 1 : null,
        estado: fechaTemporal && horaTemporal ? "programado" : "pendiente"
      };

      await updateDoc(doc(db, "matches", matchId), updateData);
      setMatch(prev => ({ 
        ...prev, 
        fecha: fechaTemporal || null,
        hora: horaTemporal || null,
        estado: fechaTemporal && horaTemporal ? "programado" : "pendiente"
      }));
      setEditandoHorario(false);
      showToast("Fecha y hora actualizadas correctamente", "success");
    } catch (error) {
      console.error("Error al actualizar fecha y hora:", error);
      showToast("Error al actualizar fecha y hora", "error");
    }
  };

  const cancelarEdicionHorario = () => {
    setFechaTemporal(match.fecha || "");
    setHoraTemporal(match.hora || "");
    setEditandoHorario(false);
  };

  // Función para convertir fecha a nombre del día
  const obtenerNombreDia = (fecha) => {
    if (!fecha) return "Sin fecha";
    const diasSemana = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    const fechaObj = new Date(fecha);
    return diasSemana[fechaObj.getDay()];
  };

  // Obtener estadísticas del jugador
  const getEstadisticasJugador = (anotaciones) => {
    const stats = {};
    anotaciones.forEach(anotacion => {
      if (!stats[anotacion.jugador]) {
        stats[anotacion.jugador] = { puntos1: 0, puntos2: 0, puntos3: 0, total: 0 };
      }
      stats[anotacion.jugador][`puntos${anotacion.puntos}`]++;
      stats[anotacion.jugador].total += anotacion.puntos;
    });
    return stats;
  };

  if (loading) {
    return (
      <div className="admin-basquet-detail-container">
        <div className="loading-section">
          <div className="loading-spinner"></div>
          <p>Cargando partido...</p>
        </div>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="admin-basquet-detail-container">
        <div className="error-section">
          <h3>Partido no encontrado</h3>
          <button onClick={() => navigate(-1)} className="admin-back-button">
            Volver
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-basquet-detail-container">
      {/* Header */}
      <div className="admin-basquet-header">
        <button onClick={() => navigate(-1)} className="admin-back-button">
          ← Volver
        </button>
        <h1 className="admin-basquet-title">
          🏀 Gestión de Partido - Básquet
        </h1>
        <div className="admin-basquet-info">
          <span className={`status-badge ${match.estado}`}>
            {(match.estado === "pendiente" || match.estado === "programado") && "⏳ Programado"}
            {match.estado === "en curso" && "▶️ En Curso"}
            {match.estado === "finalizado" && "✅ Finalizado"}
          </span>
        </div>
      </div>

      {/* Controles del partido */}
      <div className="partido-controles">
        {(match.estado === "pendiente" || match.estado === "programado") && (
          <>
            <button 
              onClick={iniciarPartido}
              className="control-btn iniciar-btn"
              title="Como profesor, puedes iniciar el partido en cualquier momento"
            >
              <span className="btn-icon">▶️</span>
              Iniciar Partido
            </button>
            <div className="basquet-privilege-info">
              <span className="privilege-icon">💡</span>
              <span className="privilege-text">Como profesor, puedes iniciar partidos sin restricciones de horario</span>
            </div>
          </>
        )}
        
        {match.estado === "en curso" && (
          <button 
            onClick={finalizarPartido}
            className="control-btn finalizar-btn"
          >
            <span className="btn-icon">���</span>
            Finalizar Partido
          </button>
        )}
        
        {match.estado === "finalizado" && (
          <div className="partido-finalizado-msg">
            <span className="msg-icon">✅</span>
            <span>Partido finalizado</span>
            <button
              onClick={() => {
                setMatch({...match, estado: "en curso"});
                setPartidoFinalizado(false);
                // Actualizar en la base de datos
                const updateMatch = async () => {
                  try {
                    await updateDoc(doc(db, "matches", matchId), { estado: "en curso" });
                  } catch (error) {
                    console.error("Error al reanudar partido:", error);
                  }
                };
                updateMatch();
              }}
              className="control-btn reanudar-btn"
            >
              ⏯️ Reanudar Partido
            </button>
          </div>
        )}
      </div>

      {/* Información del partido */}
      <div className="partido-info-card">
        <div className="equipos-vs">
          <div className="equipo-info">
            <div className="equipo-nombre">
              <span className="equipo-icon">🏫</span>
              <h3>{match.equipoA.curso} {match.equipoA.paralelo}</h3>
            </div>
            <div className="marcador">{match.marcadorA || 0}</div>
          </div>
          
          <div className="vs-divider">
            <span className="vs-text">VS</span>
            <div className="partido-detalles">
              <p><strong>📅 Fecha:</strong> {match.fecha || "No definida"}</p>
              <p><strong>🕒 Hora:</strong> {match.hora || "No definida"}</p>
              <p><strong>🏆 Grupo:</strong> {match.grupo}</p>
              <p><strong>⚡ Fase:</strong> {match.fase || "Fase de Grupos 1"}</p>
            </div>
          </div>
          
          <div className="equipo-info">
            <div className="equipo-nombre">
              <span className="equipo-icon">🏫</span>
              <h3>{match.equipoB.curso} {match.equipoB.paralelo}</h3>
            </div>
            <div className="marcador">{match.marcadorB || 0}</div>
          </div>
        </div>
      </div>

      {/* Sección de anotación rápida */}
      {partidoIniciado && (
        <div className="anotacion-rapida">
          <h3>📊 Anotar Puntos</h3>
          
          <div className="equipos-anotacion">
            {/* Equipo A */}
            <div className="equipo-anotacion">
              <h4>{match.equipoA.curso} {match.equipoA.paralelo}</h4>
              
              {mostrarInputJugador === 'A' ? (
                <div className="input-anotacion">
                  {/* Selector de jugadores */}
                  <div className="basquet-player-selector" style={{ marginBottom: '15px' }}>
                    <h5 style={{ marginBottom: '10px', fontSize: '14px', color: '#333' }}>Seleccionar Jugador:</h5>
                    <div className="basquet-players-grid" style={{ 
                      display: 'grid', 
                      gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', 
                      gap: '6px', 
                      maxHeight: '150px', 
                      overflowY: 'auto',
                      padding: '8px',
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      backgroundColor: '#f8f9fa'
                    }}>
                      {jugadoresEquipoA.length > 0 ? (
                        jugadoresEquipoA.map((jugador) => (
                          <button
                            key={jugador.id}
                            onClick={() => setJugadorInput(`#${jugador.numero || '?'} ${jugador.nombre}`)}
                            className={`basquet-player-selector-btn ${
                              jugadorInput === `#${jugador.numero || '?'} ${jugador.nombre}` ? 'selected' : ''
                            }`}
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              padding: '6px',
                              border: jugadorInput === `#${jugador.numero || '?'} ${jugador.nombre}` ? '2px solid #FF9800' : '1px solid #ccc',
                              borderRadius: '4px',
                              backgroundColor: jugadorInput === `#${jugador.numero || '?'} ${jugador.nombre}` ? '#fff3e0' : 'white',
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              fontSize: '11px'
                            }}
                          >
                            <span className="player-number-btn" style={{ 
                              fontWeight: 'bold', 
                              color: '#FF5722',
                              marginBottom: '2px'
                            }}>#{jugador.numero || '?'}</span>
                            <span className="player-name-btn" style={{ 
                              fontSize: '10px',
                              textAlign: 'center',
                              lineHeight: '1.1'
                            }}>{jugador.nombre}</span>
                          </button>
                        ))
                      ) : (
                        <div className="no-players-available" style={{
                          gridColumn: '1 / -1',
                          textAlign: 'center',
                          padding: '15px',
                          color: '#666',
                          fontSize: '12px'
                        }}>
                          <span className="no-players-icon">⚠️</span>
                          <span>No hay jugadores registrados</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Input manual como alternativa */}
                  <div className="basquet-manual-input" style={{ marginBottom: '15px' }}>
                    <h5 style={{ marginBottom: '8px', fontSize: '13px', color: '#333' }}>O escribir manualmente:</h5>
                    <input
                      type="text"
                      value={jugadorInput}
                      onChange={(e) => setJugadorInput(e.target.value)}
                      placeholder="Nombre del jugador"
                      className="jugador-input"
                    />
                  </div>
                  
                  <div className="puntos-selector">
                    <span>Puntos:</span>
                    <div className="puntos-botones">
                      <button
                        className={`punto-btn ${tipoCanasta === 1 ? 'active' : ''}`}
                        onClick={() => setTipoCanasta(1)}
                      >
                        1 pt
                      </button>
                      <button
                        className={`punto-btn ${tipoCanasta === 2 ? 'active' : ''}`}
                        onClick={() => setTipoCanasta(2)}
                      >
                        2 pts
                      </button>
                      <button
                        className={`punto-btn ${tipoCanasta === 3 ? 'active' : ''}`}
                        onClick={() => setTipoCanasta(3)}
                      >
                        3 pts
                      </button>
                    </div>
                  </div>
                  
                  <div className="accion-botones">
                    <button
                      onClick={() => anotarPuntos('A')}
                      className="anotar-btn"
                    >
                      ✅ Anotar
                    </button>
                    <button
                      onClick={() => {
                        setMostrarInputJugador(null);
                        setJugadorInput("");
                        setTipoCanasta(1);
                      }}
                      className="cancelar-btn"
                    >
                      ❌ Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setMostrarInputJugador('A')}
                  className="agregar-punto-btn"
                  disabled={mostrarInputJugador === 'B'}
                >
                  🏀 + Anotar Puntos
                </button>
              )}
            </div>

            {/* Equipo B */}
            <div className="equipo-anotacion">
              <h4>{match.equipoB.curso} {match.equipoB.paralelo}</h4>
              
              {mostrarInputJugador === 'B' ? (
                <div className="input-anotacion">
                  {/* Selector de jugadores */}
                  <div className="basquet-player-selector" style={{ marginBottom: '15px' }}>
                    <h5 style={{ marginBottom: '10px', fontSize: '14px', color: '#333' }}>Seleccionar Jugador:</h5>
                    <div className="basquet-players-grid" style={{ 
                      display: 'grid', 
                      gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', 
                      gap: '6px', 
                      maxHeight: '150px', 
                      overflowY: 'auto',
                      padding: '8px',
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      backgroundColor: '#f8f9fa'
                    }}>
                      {jugadoresEquipoB.length > 0 ? (
                        jugadoresEquipoB.map((jugador) => (
                          <button
                            key={jugador.id}
                            onClick={() => setJugadorInput(`#${jugador.numero || '?'} ${jugador.nombre}`)}
                            className={`basquet-player-selector-btn ${
                              jugadorInput === `#${jugador.numero || '?'} ${jugador.nombre}` ? 'selected' : ''
                            }`}
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              padding: '6px',
                              border: jugadorInput === `#${jugador.numero || '?'} ${jugador.nombre}` ? '2px solid #FF9800' : '1px solid #ccc',
                              borderRadius: '4px',
                              backgroundColor: jugadorInput === `#${jugador.numero || '?'} ${jugador.nombre}` ? '#fff3e0' : 'white',
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              fontSize: '11px'
                            }}
                          >
                            <span className="player-number-btn" style={{ 
                              fontWeight: 'bold', 
                              color: '#FF5722',
                              marginBottom: '2px'
                            }}>#{jugador.numero || '?'}</span>
                            <span className="player-name-btn" style={{ 
                              fontSize: '10px',
                              textAlign: 'center',
                              lineHeight: '1.1'
                            }}>{jugador.nombre}</span>
                          </button>
                        ))
                      ) : (
                        <div className="no-players-available" style={{
                          gridColumn: '1 / -1',
                          textAlign: 'center',
                          padding: '15px',
                          color: '#666',
                          fontSize: '12px'
                        }}>
                          <span className="no-players-icon">⚠️</span>
                          <span>No hay jugadores registrados</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Input manual como alternativa */}
                  <div className="basquet-manual-input" style={{ marginBottom: '15px' }}>
                    <h5 style={{ marginBottom: '8px', fontSize: '13px', color: '#333' }}>O escribir manualmente:</h5>
                    <input
                      type="text"
                      value={jugadorInput}
                      onChange={(e) => setJugadorInput(e.target.value)}
                      placeholder="Nombre del jugador"
                      className="jugador-input"
                    />
                  </div>
                  
                  <div className="puntos-selector">
                    <span>Puntos:</span>
                    <div className="puntos-botones">
                      <button
                        className={`punto-btn ${tipoCanasta === 1 ? 'active' : ''}`}
                        onClick={() => setTipoCanasta(1)}
                      >
                        1 pt
                      </button>
                      <button
                        className={`punto-btn ${tipoCanasta === 2 ? 'active' : ''}`}
                        onClick={() => setTipoCanasta(2)}
                      >
                        2 pts
                      </button>
                      <button
                        className={`punto-btn ${tipoCanasta === 3 ? 'active' : ''}`}
                        onClick={() => setTipoCanasta(3)}
                      >
                        3 pts
                      </button>
                    </div>
                  </div>
                  
                  <div className="accion-botones">
                    <button
                      onClick={() => anotarPuntos('B')}
                      className="anotar-btn"
                    >
                      ✅ Anotar
                    </button>
                    <button
                      onClick={() => {
                        setMostrarInputJugador(null);
                        setJugadorInput("");
                        setTipoCanasta(1);
                      }}
                      className="cancelar-btn"
                    >
                      ❌ Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setMostrarInputJugador('B')}
                  className="agregar-punto-btn"
                  disabled={mostrarInputJugador === 'A'}
                >
                  🏀 + Anotar Puntos
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Resumen de anotaciones (solo visualización para profesor) */}
      <div className="anotaciones-resumen">
        <div className="resumen-header">
          <h3>📈 Resumen de Anotaciones</h3>
        </div>

        <div className="equipos-resumen">
          {/* Resumen Equipo A */}
          <div className="equipo-resumen">
            <h4>{match.equipoA.curso} {match.equipoA.paralelo}</h4>
            
            <div className="anotaciones-display">
              {(match.anotadoresA || []).map((anotacion, index) => (
                <div key={index} className="anotacion-item">
                  <span className="jugador-nombre">{anotacion.jugador}</span>
                  <span className={`puntos-badge puntos-${anotacion.puntos}`}>
                    {anotacion.puntos} pt{anotacion.puntos > 1 ? 's' : ''}
                  </span>
                </div>
              ))}
              
              {/* Estadísticas del equipo */}
              {match.anotadoresA && match.anotadoresA.length > 0 && (
                <div className="estadisticas-equipo">
                  <h5>📊 Estadísticas:</h5>
                  {Object.entries(getEstadisticasJugador(match.anotadoresA)).map(([jugador, stats]) => (
                    <div key={jugador} className="jugador-stats">
                      <span className="stats-jugador">{jugador}:</span>
                      <span className="stats-detalle">
                        {stats.total} pts ({stats.puntos1 > 0 && `${stats.puntos1}×1pt `}
                        {stats.puntos2 > 0 && `${stats.puntos2}×2pts `}
                        {stats.puntos3 > 0 && `${stats.puntos3}×3pts`})
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Resumen Equipo B */}
          <div className="equipo-resumen">
            <h4>{match.equipoB.curso} {match.equipoB.paralelo}</h4>
            
            <div className="anotaciones-display">
              {(match.anotadoresB || []).map((anotacion, index) => (
                <div key={index} className="anotacion-item">
                  <span className="jugador-nombre">{anotacion.jugador}</span>
                  <span className={`puntos-badge puntos-${anotacion.puntos}`}>
                    {anotacion.puntos} pt{anotacion.puntos > 1 ? 's' : ''}
                  </span>
                </div>
              ))}
              
              {/* Estadísticas del equipo */}
              {match.anotadoresB && match.anotadoresB.length > 0 && (
                <div className="estadisticas-equipo">
                  <h5>📊 Estadísticas:</h5>
                  {Object.entries(getEstadisticasJugador(match.anotadoresB)).map(([jugador, stats]) => (
                    <div key={jugador} className="jugador-stats">
                      <span className="stats-jugador">{jugador}:</span>
                      <span className="stats-detalle">
                        {stats.total} pts ({stats.puntos1 > 0 && `${stats.puntos1}×1pt `}
                        {stats.puntos2 > 0 && `${stats.puntos2}×2pts `}
                        {stats.puntos3 > 0 && `${stats.puntos3}×3pts`})
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Sección de edición de horarios */}
      <div className="profesor-basquet-schedule-section">
        <div className="profesor-schedule-header">
          <h3 className="profesor-section-title">⏰ Programación del Partido</h3>
          {!editandoHorario ? (
            <button
              onClick={() => setEditandoHorario(true)}
              className="profesor-btn profesor-btn-edit"
            >
              ✏️ Editar Horario
            </button>
          ) : (
            <div className="profesor-schedule-actions">
              <button
                onClick={actualizarFechaHora}
                className="profesor-btn profesor-btn-save"
                disabled={!fechaTemporal || !horaTemporal}
              >
                ✅ Guardar
              </button>
              <button
                onClick={cancelarEdicionHorario}
                className="profesor-btn profesor-btn-cancel"
              >
                ❌ Cancelar
              </button>
            </div>
          )}
        </div>

        {editandoHorario ? (
          <div className="profesor-schedule-edit">
            <div className="profesor-schedule-controls">
              <div className="profesor-control-group">
                <label className="profesor-control-label">
                  📅 Fecha:
                </label>
                <input
                  type="date"
                  value={fechaTemporal}
                  onChange={(e) => setFechaTemporal(e.target.value)}
                  className="profesor-date-input"
                />
              </div>

              <div className="profesor-control-group">
                <label className="profesor-control-label">
                  🕐 Hora:
                </label>
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
              </div>

              <div className="profesor-control-group">
                <label className="profesor-control-label">
                  📍 Horario:
                </label>
                <div className="profesor-schedule-preview">
                  {fechaTemporal && horaTemporal ? (
                    <span className="profesor-schedule-value">
                      {obtenerNombreDia(fechaTemporal).charAt(0).toUpperCase() + obtenerNombreDia(fechaTemporal).slice(1)} {fechaTemporal} a las {horaTemporal}
                    </span>
                  ) : (
                    <span className="profesor-schedule-empty">Sin programar</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="profesor-schedule-display">
            <div className="profesor-schedule-info">
              <div className="profesor-schedule-item">
                <span className="profesor-schedule-label">📅 Fecha:</span>
                <span className="profesor-schedule-value">
                  {match.fecha ? `${obtenerNombreDia(match.fecha).charAt(0).toUpperCase() + obtenerNombreDia(match.fecha).slice(1)} ${match.fecha}` : "No programada"}
                </span>
              </div>
              <div className="profesor-schedule-item">
                <span className="profesor-schedule-label">🕐 Hora:</span>
                <span className="profesor-schedule-value">{match.hora || "No programada"}</span>
              </div>
              <div className="profesor-schedule-item">
                <span className="profesor-schedule-label">📍 Estado:</span>
                <span className={`profesor-schedule-status ${match.estado}`}>
                  {match.fecha && match.hora ? "Programado" : "Pendiente"}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Acciones del partido - Los profesores pueden finalizar en cualquier momento */}
      {match.estado === "en curso" && (
        <div className="partido-acciones">
          <button onClick={finalizarPartido} className="finalizar-btn">
            🏁 Finalizar Partido
          </button>
        </div>
      )}
      <ToastContainer />
    </div>
  );
}
