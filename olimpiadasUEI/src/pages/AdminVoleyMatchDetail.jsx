import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase/config";
import { useToast } from "../components/Toast";
import "../styles/AdminVoleyMatchDetail.css";

export default function AdminVoleyMatchDetail() {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const { showToast, ToastContainer } = useToast();
  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Estados para edición de fecha y hora
  const [editandoHorario, setEditandoHorario] = useState(false);
  const [fechaTemporal, setFechaTemporal] = useState("");
  const [horaTemporal, setHoraTemporal] = useState("");
  
  // Estados para jugadores de los equipos
  const [jugadoresEquipoA, setJugadoresEquipoA] = useState([]);
  const [jugadoresEquipoB, setJugadoresEquipoB] = useState([]);

  // Estados para gestión de puntos
  const [mostrarInputPunto, setMostrarInputPunto] = useState(null);
  const [puntoInput, setPuntoInput] = useState("");
  const [numeroJugadorBusqueda, setNumeroJugadorBusqueda] = useState(""); // Nuevo estado para búsqueda por número

  // Estados para edición de anotadores
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
          
          // Inicializar fechas temporales
          setFechaTemporal(matchData.fecha || "");
          setHoraTemporal(matchData.hora || "");
          
          // Inicializar anotadores temporales
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
        console.log("Vóley - Jugadores Equipo A:", jugadoresA);
        console.log("Vóley - Jugadores Equipo B:", jugadoresB);
        console.log("Vóley - Match data:", match);
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

  // Mapeo de fases para mostrar nombres legibles
  const fasesNombres = {
    "grupos1": "Fase de Grupos 1",
    "grupos3": "Fase de Grupos 3",
    "semifinales": "Semifinales",
    "finales": "Finales"
  };

  // Determinar reglas según fase
  const esFaseGrupos = ["grupos", "grupos1", "grupos3"].includes(match?.fase || "grupos1");
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
      const limitePuntos = esFaseGrupos 
        ? reglasJuego.puntosPorSet
        : reglasJuego.puntosPorSet[index];
      const ganador = ganadorSet(set, limitePuntos);
      if (ganador === 'A') setsA++;
      if (ganador === 'B') setsB++;
    });
    return { setsA, setsB };
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
    console.log("🔧 AdminVoleyMatchDetail - Iniciando cambio de estado a:", nuevoEstado);
    console.log("🔧 Role del usuario:", localStorage.getItem('userRole'));
    
    try {
      const updateData = { estado: nuevoEstado };
      
      if (nuevoEstado === "en curso") {
        console.log("🔧 Inicializando sets para el partido");
        // Inicializar sets al comenzar el partido
        const setsIniciales = inicializarSets();
        updateData.sets = setsIniciales;
      }

      console.log("🔧 Actualizando documento en Firestore...");
      await updateDoc(doc(db, "matches", matchId), updateData);
      setMatch(prev => ({ ...prev, ...updateData }));
      
      const mensajes = {
        "en curso": "Partido iniciado",
        "finalizado": "Partido finalizado",
        "pendiente": "Partido pausado"
      };
      console.log("🔧 Estado cambiado exitosamente a:", nuevoEstado);
      showToast(mensajes[nuevoEstado] || "Estado actualizado", "success");
    } catch (error) {
      console.error("Error al cambiar estado:", error);
      showToast("Error al cambiar estado del partido", "error");
    }
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

    const jugadorEncontrado = buscarJugadorPorNumero(numeroJugadorBusqueda, mostrarInputPunto);
    
    if (jugadorEncontrado) {
      setPuntoInput(`#${jugadorEncontrado.numero} ${jugadorEncontrado.nombre}`);
      setNumeroJugadorBusqueda("");
      // Eliminado alert redundante - el usuario ve que se seleccionó el jugador
    } else {
      showToast(`No se encontró jugador con número ${numeroJugadorBusqueda}`, "warning");
    }
  };

  // Marcar punto
  const marcarPunto = async (equipo, setActual) => {
    if (!puntoInput.trim()) {
      showToast("Por favor, ingresa el nombre del anotador", "warning");
      return;
    }

    try {
      const sets = inicializarSets();
      const nuevoSets = [...sets];
      
      // Obtener límite de puntos para el set actual
      const limitePuntos = esFaseGrupos 
        ? reglasJuego.puntosPorSet  // Para todas las fases de grupos: 20 puntos
        : reglasJuego.puntosPorSet[setActual]; // Para semifinales/finales: según array

      // Verificar si el set ya está completo
      const setCompleto = ganadorSet(sets[setActual], limitePuntos) !== null;
      if (setCompleto) {
        showToast("Este set ya está completo", "warning");
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
      setNumeroJugadorBusqueda("");
      setMostrarInputPunto(null);

    } catch (error) {
      console.error("Error al marcar punto:", error);
      showToast("Error al marcar punto", "error");
    }
  };

  // Funciones para editar anotadores
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

  const guardarAnotadores = async () => {
    try {
      const updateData = {
        anotadoresA: anotadoresTemporal.A.filter(nombre => nombre.trim()),
        anotadoresB: anotadoresTemporal.B.filter(nombre => nombre.trim())
      };

      await updateDoc(doc(db, "matches", matchId), updateData);
      setMatch(prev => ({ ...prev, ...updateData }));
      setEditandoAnotadores(false);
      showToast("Anotadores actualizados correctamente", "success");
    } catch (error) {
      console.error("Error al actualizar anotadores:", error);
      showToast("Error al actualizar anotadores", "error");
    }
  };

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
        <button onClick={() => navigate(-1)} className="admin-back-button">
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
        <h1 className="admin-voley-title">🏐 Gestión de Partido - Vóley</h1>
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
        <div className="admin-status-actions">
          {(match.estado === "pendiente" || match.estado === "programado") && (
            <>
              {equiposDefinidos() ? (
                <>
                  <button
                    onClick={() => {
                      console.log("🚀 Botón Iniciar Partido clickeado");
                      console.log("🚀 Estado actual del partido:", match.estado);
                      console.log("🚀 Role del usuario:", localStorage.getItem('userRole'));
                      cambiarEstadoPartido("en curso");
                    }}
                    className="admin-btn admin-btn-start"
                  >
                    🚀 Iniciar Partido
                  </button>
                  <div className="admin-privilege-info">
                    <span className="privilege-icon">🛡️</span>
                    <span className="privilege-text">Como administrador, puedes iniciar partidos sin restricciones de horario</span>
                  </div>
                </>
              ) : (
                <div className="admin-privilege-info">
                  <span className="privilege-icon">⏳</span>
                  <span className="privilege-text">Este partido no se puede iniciar hasta que se conozcan los equipos participantes</span>
                </div>
              )}
            </>
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
          {match.estado === "finalizado" && (
            <button
              onClick={() => cambiarEstadoPartido("en curso")}
              className="admin-btn admin-btn-resume"
            >
              ▶️ Reanudar Partido
            </button>
          )}
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
                  
                  const limitePuntos = esFaseGrupos 
                    ? reglasJuego.puntosPorSet  // Para todas las fases de grupos: 25
                    : reglasJuego.puntosPorSet[index]; // Para semifinales/finales: según el índice
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
                  
                  const limitePuntos = esFaseGrupos 
                    ? reglasJuego.puntosPorSet  // Para todas las fases de grupos: 25
                    : reglasJuego.puntosPorSet[index]; // Para semifinales/finales: según el índice
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
            
            {/* Lista de jugadores del equipo */}
            <div className="admin-player-selector">
              <h4>Seleccionar Jugador:</h4>
              <div className="admin-players-grid">
                {(mostrarInputPunto.equipo === 'A' ? jugadoresEquipoA : jugadoresEquipoB).length > 0 ? (
                  (mostrarInputPunto.equipo === 'A' ? jugadoresEquipoA : jugadoresEquipoB).map((jugador) => (
                    <button
                      key={jugador.id}
                      onClick={() => setPuntoInput(`#${jugador.numero || '?'} ${jugador.nombre}`)}
                      className={`admin-player-selector-btn ${
                        puntoInput === `#${jugador.numero || '?'} ${jugador.nombre}` ? 'selected' : ''
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
              <h4>O buscar por número de jugador:</h4>
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
              
              {puntoInput && (
                <div className="jugador-seleccionado">
                  <span>Jugador seleccionado: <strong>{puntoInput}</strong></span>
                  <button
                    onClick={() => {
                      setPuntoInput("");
                      setNumeroJugadorBusqueda("");
                    }}
                    className="admin-btn admin-btn-clear"
                  >
                    ✖ Limpiar
                  </button>
                </div>
              )}
            </div>
            
            <div className="admin-modal-actions">
              <button
                onClick={() => marcarPunto(mostrarInputPunto.equipo, mostrarInputPunto.set)}
                className="admin-btn admin-btn-confirm"
                disabled={!puntoInput.trim()}
              >
                ✅ Confirmar
              </button>
              <button
                onClick={() => {
                  setMostrarInputPunto(null);
                  setPuntoInput("");
                  setNumeroJugadorBusqueda("");
                }}
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

      {/* Sección de edición de horarios */}
      <div className="admin-voley-schedule-section">
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
      <ToastContainer />
    </div>
  );
}
