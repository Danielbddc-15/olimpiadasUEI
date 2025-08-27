import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase/config";
import { useToast } from "../components/Toast";
import "../styles/AdminBasquetMatchDetail.css";

export default function AdminBasquetMatchDetail() {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const { showToast, ToastContainer } = useToast();
  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Estados para edición de fecha y hora
  const [editandoHorario, setEditandoHorario] = useState(false);
  const [fechaTemporal, setFechaTemporal] = useState("");
  const [horaTemporal, setHoraTemporal] = useState("");
  
  const [jugadoresEquipoA, setJugadoresEquipoA] = useState([]);
  const [jugadoresEquipoB, setJugadoresEquipoB] = useState([]);
  
  // Estados para anotar puntos
  const [jugadorInput, setJugadorInput] = useState("");
  const [numeroJugadorBusqueda, setNumeroJugadorBusqueda] = useState(""); // Nuevo estado para búsqueda por número
  const [mostrarInputJugador, setMostrarInputJugador] = useState(null); // 'A' o 'B'
  const [tipoCanasta, setTipoCanasta] = useState(1); // 1, 2 o 3 puntos

  // Estados para edición de anotadores
  const [editandoAnotadores, setEditandoAnotadores] = useState(false);
  const [anotadoresTemporal, setAnotadoresTemporal] = useState({ A: [], B: [] });
  const [nuevoAnotador, setNuevoAnotador] = useState({ A: "", B: "" });
  const [nuevoPuntaje, setNuevoPuntaje] = useState({ A: 1, B: 1 });

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
        console.log("Básquet - Jugadores Equipo A:", jugadoresA);
        console.log("Básquet - Jugadores Equipo B:", jugadoresB);
        console.log("Básquet - Match data:", match);
      } catch (error) {
        console.error("Error al cargar jugadores:", error);
      }
    };

    fetchJugadores();
  }, [match]);

  // Función para agrupar anotadores por nombre y sumar puntos
  const agruparAnotadores = (anotadores) => {
    if (!anotadores || anotadores.length === 0) return [];
    
    const agrupados = {};
    anotadores.forEach(anotador => {
      // Extraer el nombre del anotador (quitar puntos si los hay al final)
      const nombreLimpio = anotador.replace(/\s*\(\d+\s*pts?\)\s*$/i, '').replace(/\s*\d+\s*pts?\s*$/i, '').trim();
      
      if (agrupados[nombreLimpio]) {
        agrupados[nombreLimpio]++;
      } else {
        agrupados[nombreLimpio] = 1;
      }
    });
    
    return Object.entries(agrupados)
      .map(([nombre, puntos]) => ({ nombre, puntos }))
      .sort((a, b) => b.puntos - a.puntos); // Ordenar por puntos descendente
  };

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

  // Función para buscar jugador por número
  const buscarJugadorPorNumero = (numero, equipo) => {
    if (!numero) return null;
    const jugadores = equipo === 'A' ? jugadoresEquipoA : jugadoresEquipoB;
    return jugadores.find(jugador => jugador.numero === parseInt(numero));
  };

  // Función para asignar punto por número de jugador
  const asignarPuntoPorNumero = () => {
    if (!numeroJugadorBusqueda.trim()) {
      showToast("Por favor ingresa un número de jugador", "warning");
      return;
    }

    const jugadorEncontrado = buscarJugadorPorNumero(numeroJugadorBusqueda, mostrarInputJugador);
    
    if (jugadorEncontrado) {
      setJugadorInput(`#${jugadorEncontrado.numero} ${jugadorEncontrado.nombre}`);
      setNumeroJugadorBusqueda("");
      // Eliminado alert redundante - el usuario ve que se seleccionó el jugador
    } else {
      showToast(`No se encontró jugador con número ${numeroJugadorBusqueda}`, "warning");
    }
  };

  // Función para anotar puntos
  const anotarPuntos = async (equipo) => {
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

      // Actualizar valores temporales
      setAnotadoresTemporal(prev => ({
        ...prev,
        [equipo]: nuevosAnotadores
      }));

      // Limpiar inputs
      setJugadorInput("");
      setNumeroJugadorBusqueda("");
      setMostrarInputJugador(null);
      setTipoCanasta(1);

    } catch (error) {
      console.error("Error al anotar puntos:", error);
      showToast("Error al anotar puntos", "error");
    }
  };

  // Agregar anotador en edición
  const agregarAnotador = (equipo) => {
    if (!nuevoAnotador[equipo].trim()) return;
    
    const nuevaAnotacion = {
      jugador: nuevoAnotador[equipo].trim(),
      puntos: nuevoPuntaje[equipo],
      timestamp: new Date().toISOString()
    };
    
    setAnotadoresTemporal(prev => ({
      ...prev,
      [equipo]: [...prev[equipo], nuevaAnotacion]
    }));
    
    setNuevoAnotador(prev => ({
      ...prev,
      [equipo]: ""
    }));
    
    setNuevoPuntaje(prev => ({
      ...prev,
      [equipo]: 1
    }));
  };

  // Eliminar anotación en edición
  const eliminarAnotacion = (equipo, indice) => {
    setAnotadoresTemporal(prev => ({
      ...prev,
      [equipo]: prev[equipo].filter((_, i) => i !== indice)
    }));
  };

  // Editar anotación
  const editarAnotacion = (equipo, indice, campo, valor) => {
    setAnotadoresTemporal(prev => ({
      ...prev,
      [equipo]: prev[equipo].map((anotacion, i) => 
        i === indice ? { ...anotacion, [campo]: valor } : anotacion
      )
    }));
  };

  // Guardar anotadores editados
  const guardarAnotadores = async () => {
    try {
      // Calcular marcadores totales
      const marcadorA = anotadoresTemporal.A.reduce((total, anotacion) => total + anotacion.puntos, 0);
      const marcadorB = anotadoresTemporal.B.reduce((total, anotacion) => total + anotacion.puntos, 0);

      const updateData = {
        anotadoresA: anotadoresTemporal.A,
        anotadoresB: anotadoresTemporal.B,
        marcadorA,
        marcadorB
      };

      await updateDoc(doc(db, "matches", matchId), updateData);

      setMatch(prev => ({
        ...prev,
        ...updateData
      }));

      setEditandoAnotadores(false);
      showToast("Anotaciones actualizadas correctamente", "success");
    } catch (error) {
      console.error("Error al actualizar anotaciones:", error);
      showToast("Error al actualizar anotaciones", "error");
    }
  };

  // Cancelar edición de anotadores
  const cancelarEdicion = () => {
    setAnotadoresTemporal({
      A: [...(match.anotadoresA || [])],
      B: [...(match.anotadoresB || [])]
    });
    setEditandoAnotadores(false);
  };

  // Iniciar partido
  const iniciarPartido = async () => {
    console.log("🏀 AdminBasquetMatchDetail - Intentando iniciar partido");
    console.log("🏀 Role del usuario:", localStorage.getItem('userRole'));
    
    if (window.confirm("¿Estás seguro de que quieres iniciar este partido?")) {
      try {
        console.log("🏀 Actualizando estado en Firestore...");
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
        console.log("🏀 Partido iniciado correctamente");
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
            {equiposDefinidos() ? (
              <>
                <button 
                  onClick={() => {
                    console.log("🏀 Botón Iniciar Partido clickeado");
                    console.log("🏀 Estado actual del partido:", match.estado);
                    console.log("🏀 Role del usuario:", localStorage.getItem('userRole'));
                    iniciarPartido();
                  }}
                  className="control-btn iniciar-btn"
                >
                  <span className="btn-icon">▶️</span>
                  Iniciar Partido
                </button>
                <div className="basquet-privilege-info">
                  <span className="privilege-icon">🛡️</span>
                  <span className="privilege-text">Como administrador, puedes iniciar partidos sin restricciones de horario</span>
                </div>
              </>
            ) : (
              <div className="basquet-privilege-info">
                <span className="privilege-icon">⏳</span>
                <span className="privilege-text">Este partido no se puede iniciar hasta que se conozcan los equipos participantes</span>
              </div>
            )}
          </>
        )}
        
        {match.estado === "en curso" && (
          <button 
            onClick={finalizarPartido}
            className="control-btn finalizar-btn"
          >
            <span className="btn-icon">🏁</span>
            Finalizar Partido
          </button>
        )}
        
        {match.estado === "finalizado" && (
          <div className="partido-finalizado-msg">
            <span className="msg-icon">✅</span>
            <span>Partido finalizado</span>
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
      {match.estado !== "finalizado" && (
        <div className="anotacion-rapida">
          <h3>📊 Anotar Puntos</h3>
          
          <div className="equipos-anotacion">
            {/* Equipo A */}
            <div className="equipo-anotacion">
              <h4>{match.equipoA.curso} {match.equipoA.paralelo}</h4>
              
              {mostrarInputJugador === 'A' ? (
                <div className="input-anotacion">
                  {/* Selector de jugadores */}
                  <div className="admin-player-selector">
                    <h5>Seleccionar Jugador:</h5>
                    <div className="admin-players-grid-inline">
                      {jugadoresEquipoA.length > 0 ? (
                        jugadoresEquipoA.map((jugador) => (
                          <button
                            key={jugador.id}
                            onClick={() => setJugadorInput(`#${jugador.numero || '?'} ${jugador.nombre}`)}
                            className={`admin-player-selector-btn-inline ${
                              jugadorInput === `#${jugador.numero || '?'} ${jugador.nombre}` ? 'selected' : ''
                            }`}
                          >
                            <span className="player-number-btn">#{jugador.numero || '?'}</span>
                            <span className="player-name-btn">{jugador.nombre}</span>
                          </button>
                        ))
                      ) : (
                        <div className="no-players-available-inline">
                          <span>⚠️ No hay jugadores registrados</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Input manual */}
                  <div className="manual-input-section">
                    <h5>O buscar por número de jugador:</h5>
                    <div className="numero-jugador-busqueda">
                      <input
                        type="number"
                        placeholder="Número del jugador..."
                        value={numeroJugadorBusqueda}
                        onChange={(e) => setNumeroJugadorBusqueda(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            asignarPuntoPorNumero();
                          }
                        }}
                        className="admin-goal-input"
                        min="1"
                      />
                      <button
                        onClick={asignarPuntoPorNumero}
                        className="admin-btn admin-btn-search"
                        disabled={!numeroJugadorBusqueda.trim()}
                      >
                        🔍 Buscar
                      </button>
                    </div>
                    
                    {jugadorInput && (
                      <div className="jugador-seleccionado">
                        <span>Jugador seleccionado: <strong>{jugadorInput}</strong></span>
                        <button
                          onClick={() => {
                            setJugadorInput("");
                            setNumeroJugadorBusqueda("");
                          }}
                          className="admin-btn admin-btn-clear"
                        >
                          ✖ Limpiar
                        </button>
                      </div>
                    )}
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
                        setNumeroJugadorBusqueda("");
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
                  <div className="admin-player-selector">
                    <h5>Seleccionar Jugador:</h5>
                    <div className="admin-players-grid-inline">
                      {jugadoresEquipoB.length > 0 ? (
                        jugadoresEquipoB.map((jugador) => (
                          <button
                            key={jugador.id}
                            onClick={() => setJugadorInput(`#${jugador.numero || '?'} ${jugador.nombre}`)}
                            className={`admin-player-selector-btn-inline ${
                              jugadorInput === `#${jugador.numero || '?'} ${jugador.nombre}` ? 'selected' : ''
                            }`}
                          >
                            <span className="player-number-btn">#{jugador.numero || '?'}</span>
                            <span className="player-name-btn">{jugador.nombre}</span>
                          </button>
                        ))
                      ) : (
                        <div className="no-players-available-inline">
                          <span>⚠️ No hay jugadores registrados</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Input manual */}
                  <div className="manual-input-section">
                    <h5>O buscar por número de jugador:</h5>
                    <div className="numero-jugador-busqueda">
                      <input
                        type="number"
                        placeholder="Número del jugador..."
                        value={numeroJugadorBusqueda}
                        onChange={(e) => setNumeroJugadorBusqueda(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            asignarPuntoPorNumero();
                          }
                        }}
                        className="admin-goal-input"
                        min="1"
                      />
                      <button
                        onClick={asignarPuntoPorNumero}
                        className="admin-btn admin-btn-search"
                        disabled={!numeroJugadorBusqueda.trim()}
                      >
                        🔍 Buscar
                      </button>
                    </div>
                    
                    {jugadorInput && (
                      <div className="jugador-seleccionado">
                        <span>Jugador seleccionado: <strong>{jugadorInput}</strong></span>
                        <button
                          onClick={() => {
                            setJugadorInput("");
                            setNumeroJugadorBusqueda("");
                          }}
                          className="admin-btn admin-btn-clear"
                        >
                          ✖ Limpiar
                        </button>
                      </div>
                    )}
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
                        setNumeroJugadorBusqueda("");
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

      {/* Resumen de anotaciones */}
      <div className="anotaciones-resumen">
        <div className="resumen-header">
          <h3>📈 Resumen de Anotaciones</h3>
          <button
            onClick={() => setEditandoAnotadores(!editandoAnotadores)}
            className="editar-btn"
          >
            {editandoAnotadores ? "❌ Cancelar" : "✏️ Editar"}
          </button>
        </div>

        <div className="equipos-resumen">
          {/* Resumen Equipo A */}
          <div className="equipo-resumen">
            <h4>{match.equipoA.curso} {match.equipoA.paralelo}</h4>
            
            {editandoAnotadores ? (
              <div className="edicion-anotadores">
                {/* Agregar nueva anotación */}
                <div className="agregar-anotacion">
                  <input
                    type="text"
                    value={nuevoAnotador.A}
                    onChange={(e) => setNuevoAnotador(prev => ({ ...prev, A: e.target.value }))}
                    placeholder="Jugador"
                    className="nuevo-jugador-input"
                  />
                  <select
                    value={nuevoPuntaje.A}
                    onChange={(e) => setNuevoPuntaje(prev => ({ ...prev, A: parseInt(e.target.value) }))}
                    className="nuevo-puntaje-select"
                  >
                    <option value={1}>1 pt</option>
                    <option value={2}>2 pts</option>
                    <option value={3}>3 pts</option>
                  </select>
                  <button
                    onClick={() => agregarAnotador('A')}
                    className="agregar-anotacion-btn"
                  >
                    ➕
                  </button>
                </div>

                {/* Lista de anotaciones editables */}
                <div className="anotaciones-lista">
                  {anotadoresTemporal.A.map((anotacion, index) => (
                    <div key={index} className="anotacion-editable">
                      <input
                        type="text"
                        value={anotacion.jugador}
                        onChange={(e) => editarAnotacion('A', index, 'jugador', e.target.value)}
                        className="editar-jugador-input"
                      />
                      <select
                        value={anotacion.puntos}
                        onChange={(e) => editarAnotacion('A', index, 'puntos', parseInt(e.target.value))}
                        className="editar-puntaje-select"
                      >
                        <option value={1}>1 pt</option>
                        <option value={2}>2 pts</option>
                        <option value={3}>3 pts</option>
                      </select>
                      <button
                        onClick={() => eliminarAnotacion('A', index)}
                        className="eliminar-anotacion-btn"
                      >
                        🗑️
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="anotaciones-display">
                {/* Solo mostrar estadísticas agrupadas */}
                {match.anotadoresA && match.anotadoresA.length > 0 && (
                  <div className="estadisticas-equipo">
                    <h5>📊 Estadísticas:</h5>
                    {Object.entries(getEstadisticasJugador(match.anotadoresA)).map(([jugador, stats]) => (
                      <div key={jugador} className="jugador-stats">
                        <span className="stats-jugador">{jugador}:</span>
                        <span className="stats-total">
                          {stats.total} pts
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                
                {(!match.anotadoresA || match.anotadoresA.length === 0) && (
                  <div className="no-anotaciones">Sin anotaciones registradas</div>
                )}
              </div>
            )}
          </div>

          {/* Resumen Equipo B */}
          <div className="equipo-resumen">
            <h4>{match.equipoB.curso} {match.equipoB.paralelo}</h4>
            
            {editandoAnotadores ? (
              <div className="edicion-anotadores">
                {/* Agregar nueva anotación */}
                <div className="agregar-anotacion">
                  <input
                    type="text"
                    value={nuevoAnotador.B}
                    onChange={(e) => setNuevoAnotador(prev => ({ ...prev, B: e.target.value }))}
                    placeholder="Jugador"
                    className="nuevo-jugador-input"
                  />
                  <select
                    value={nuevoPuntaje.B}
                    onChange={(e) => setNuevoPuntaje(prev => ({ ...prev, B: parseInt(e.target.value) }))}
                    className="nuevo-puntaje-select"
                  >
                    <option value={1}>1 pt</option>
                    <option value={2}>2 pts</option>
                    <option value={3}>3 pts</option>
                  </select>
                  <button
                    onClick={() => agregarAnotador('B')}
                    className="agregar-anotacion-btn"
                  >
                    ➕
                  </button>
                </div>

                {/* Lista de anotaciones editables */}
                <div className="anotaciones-lista">
                  {anotadoresTemporal.B.map((anotacion, index) => (
                    <div key={index} className="anotacion-editable">
                      <input
                        type="text"
                        value={anotacion.jugador}
                        onChange={(e) => editarAnotacion('B', index, 'jugador', e.target.value)}
                        className="editar-jugador-input"
                      />
                      <select
                        value={anotacion.puntos}
                        onChange={(e) => editarAnotacion('B', index, 'puntos', parseInt(e.target.value))}
                        className="editar-puntaje-select"
                      >
                        <option value={1}>1 pt</option>
                        <option value={2}>2 pts</option>
                        <option value={3}>3 pts</option>
                      </select>
                      <button
                        onClick={() => eliminarAnotacion('B', index)}
                        className="eliminar-anotacion-btn"
                      >
                        🗑️
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="anotaciones-display">
                {/* Solo mostrar estadísticas agrupadas */}
                {match.anotadoresB && match.anotadoresB.length > 0 && (
                  <div className="estadisticas-equipo">
                    <h5>📊 Estadísticas:</h5>
                    {Object.entries(getEstadisticasJugador(match.anotadoresB)).map(([jugador, stats]) => (
                      <div key={jugador} className="jugador-stats">
                        <span className="stats-jugador">{jugador}:</span>
                        <span className="stats-total">
                          {stats.total} pts
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                
                {(!match.anotadoresB || match.anotadoresB.length === 0) && (
                  <div className="no-anotaciones">Sin anotaciones registradas</div>
                )}
              </div>
            )}
          </div>
        </div>

        {editandoAnotadores && (
          <div className="edicion-acciones">
            <button onClick={guardarAnotadores} className="guardar-btn">
              💾 Guardar Cambios
            </button>
            <button onClick={cancelarEdicion} className="cancelar-edicion-btn">
              ❌ Cancelar Edición
            </button>
          </div>
        )}
      </div>

      {/* Sección de edición de horarios */}
      <div className="admin-basquet-schedule-section">
        <div className="admin-schedule-header">
          <h3 className="admin-section-title">⏰ Programación del Partido</h3>
          {!editandoHorario ? (
            <button
              onClick={() => setEditandoHorario(true)}
              className="admin-btn admin-btn-edit"
            >
              ✏️ Editar Horario
            </button>
          ) : (
            <div className="admin-schedule-actions">
              <button
                onClick={actualizarFechaHora}
                className="admin-btn admin-btn-save"
                disabled={!fechaTemporal || !horaTemporal}
              >
                ✅ Guardar
              </button>
              <button
                onClick={cancelarEdicionHorario}
                className="admin-btn admin-btn-cancel"
              >
                ❌ Cancelar
              </button>
            </div>
          )}
        </div>

        {editandoHorario ? (
          <div className="admin-schedule-edit">
            <div className="admin-schedule-controls">
              <div className="admin-control-group">
                <label className="admin-control-label">
                  📅 Fecha:
                </label>
                <input
                  type="date"
                  value={fechaTemporal}
                  onChange={(e) => setFechaTemporal(e.target.value)}
                  className="admin-date-input"
                />
              </div>

              <div className="admin-control-group">
                <label className="admin-control-label">
                  🕐 Hora:
                </label>
                <select
                  value={horaTemporal}
                  onChange={(e) => setHoraTemporal(e.target.value)}
                  className="admin-time-select"
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

              <div className="admin-control-group">
                <label className="admin-control-label">
                  📍 Horario:
                </label>
                <div className="admin-schedule-preview">
                  {fechaTemporal && horaTemporal ? (
                    <span className="admin-schedule-value">
                      {obtenerNombreDia(fechaTemporal).charAt(0).toUpperCase() + obtenerNombreDia(fechaTemporal).slice(1)} {fechaTemporal} a las {horaTemporal}
                    </span>
                  ) : (
                    <span className="admin-schedule-empty">Sin programar</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="admin-schedule-display">
            <div className="admin-schedule-info">
              <div className="admin-schedule-item">
                <span className="admin-schedule-label">📅 Fecha:</span>
                <span className="admin-schedule-value">
                  {match.fecha ? `${obtenerNombreDia(match.fecha).charAt(0).toUpperCase() + obtenerNombreDia(match.fecha).slice(1)} ${match.fecha}` : "No programada"}
                </span>
              </div>
              <div className="admin-schedule-item">
                <span className="admin-schedule-label">🕐 Hora:</span>
                <span className="admin-schedule-value">{match.hora || "No programada"}</span>
              </div>
              <div className="admin-schedule-item">
                <span className="admin-schedule-label">📍 Estado:</span>
                <span className={`admin-schedule-status ${match.estado}`}>
                  {match.fecha && match.hora ? "Programado" : "Pendiente"}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Acciones del partido */}
      {match.estado !== "finalizado" && (
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
