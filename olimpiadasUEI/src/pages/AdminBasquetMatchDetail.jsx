import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from "../api/firestoreCompat";
import { db } from "../firebase/config";
import { useToast } from "../components/Toast";
import { verificarYGenerarFasesFinalesExterna } from "./AdminMatches";
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

  // Obtener anotadores agrupados para la interfaz
  const obtenerAnotadoresAgrupados = (anotaciones) => {
    const agrupados = {};
    (anotaciones || []).forEach(anotacion => {
      const nombre = anotacion.jugador;
      if (nombre && nombre.trim()) {
        agrupados[nombre] = (agrupados[nombre] || 0) + anotacion.puntos;
      }
    });
    return Object.entries(agrupados).map(([nombre, puntos]) => ({ nombre, puntos }));
  };

  // Helper para dividir los puntos acumulados en canastas estándar de 3, 2, 1
  const splitPoints = (total) => {
    const points = [];
    let remaining = total;
    while (remaining > 0) {
      if (remaining >= 3) {
        points.push(3);
        remaining -= 3;
      } else if (remaining >= 2) {
        points.push(2);
        remaining -= 2;
      } else {
        points.push(1);
        remaining -= 1;
      }
    }
    return points;
  };

  // Manejar edición de nombre de un anotador único
  const manejarEditarNombreAnotador = (equipo, nombreOriginal, nuevoNombre) => {
    if (!nuevoNombre.trim()) return;
    setAnotadoresTemporal(prev => ({
      ...prev,
      [equipo]: prev[equipo].map(anot => 
        anot.jugador === nombreOriginal ? { ...anot, jugador: nuevoNombre.trim() } : anot
      )
    }));
  };

  // Cambiar puntos de un anotador único (incrementar o decrementar)
  const manejarCambiarPuntosAnotador = (equipo, nombre, nuevoTotal) => {
    const total = Math.max(0, nuevoTotal);
    const puntosDivididos = splitPoints(total);
    const nuevosObjetos = puntosDivididos.map(p => ({
      jugador: nombre,
      puntos: p,
      timestamp: new Date().toISOString()
    }));

    setAnotadoresTemporal(prev => {
      const filtrados = prev[equipo].filter(anot => anot.jugador !== nombre);
      return {
        ...prev,
        [equipo]: [...filtrados, ...nuevosObjetos]
      };
    });
  };

  // Eliminar un anotador completo de la lista de edición
  const manejarEliminarAnotadorCompleto = (equipo, nombre) => {
    setAnotadoresTemporal(prev => ({
      ...prev,
      [equipo]: prev[equipo].filter(anot => anot.jugador !== nombre)
    }));
  };

  // Agregar anotador en edición
  const agregarAnotador = (equipo) => {
    const nombre = nuevoAnotador[equipo]?.trim();
    if (!nombre) return;
    
    const nuevaAnotacion = {
      jugador: nombre,
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

  // Guardar anotadores editados
  const guardarAnotadores = async () => {
    try {
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
  };

  // Finalizar partido
  const finalizarPartido = async () => {
    try {
      await updateDoc(doc(db, "matches", matchId), {
        estado: "finalizado",
        fechaFinalizacion: new Date().toISOString()
      });

      const updatedMatch = {
        ...match,
        estado: "finalizado",
        fechaFinalizacion: new Date().toISOString()
      };

      setMatch(updatedMatch);
      setPartidoFinalizado(true);
      showToast("Partido finalizado correctamente", "success");

      // 🚀 Ejecutar verificación de fases finales para básquet
      console.log("🏀 PARTIDO BASQUET FINALIZADO - Ejecutando verificación de fases finales para partido ID:", matchId);
      setTimeout(async () => {
        try {
          const freshSnap = await getDoc(doc(db, "matches", matchId));
          if (freshSnap.exists()) {
            const freshMatch = { id: freshSnap.id, ...freshSnap.data() };
            await verificarYGenerarFasesFinalesExterna(freshMatch, showToast);
          }
        } catch (err) {
          console.error("Error al verificar fases de básquet:", err);
        }
      }, 1000);

    } catch (error) {
      console.error("Error al finalizar partido:", error);
      showToast("Error al finalizar partido", "error");
    }
  };

  // Reanudar partido
  const reanudarPartido = async () => {
    try {
      await updateDoc(doc(db, "matches", matchId), {
        estado: "en curso"
      });

      const updatedMatch = {
        ...match,
        estado: "en curso"
      };

      setMatch(updatedMatch);
      setPartidoFinalizado(false);
      setPartidoIniciado(true);
      showToast("Partido reanudado correctamente", "success");
    } catch (error) {
      console.error("Error al reanudar partido:", error);
      showToast("Error al reanudar partido", "error");
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

  const getEstadisticasJugador = (anotaciones) => {
    const stats = {};
    (anotaciones || []).forEach(anotacion => {
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

  const equipoA = match.equipoA
    ? `${match.equipoA.curso || ''} ${match.equipoA.paralelo || ''}`.trim()
    : 'Equipo A';
  const equipoB = match.equipoB
    ? `${match.equipoB.curso || ''} ${match.equipoB.paralelo || ''}`.trim()
    : 'Equipo B';

  const estadoLabel = {
    pendiente: '⏳ Pendiente',
    programado: '📅 Programado',
    'en curso': '🟢 En Curso',
    finalizado: '✅ Finalizado',
  }[match.estado] || match.estado;

  const fechaFormateada = match.fecha ? `${obtenerNombreDia(match.fecha).charAt(0).toUpperCase() + obtenerNombreDia(match.fecha).slice(1)} ${match.fecha}` : null;
  const esProgramado = match.estado === 'programado' || match.estado === 'pendiente';

  return (
    <div className="admin-match-detail-container">
      {/* Header */}
      <div className="admin-match-header">
        <button onClick={() => navigate(-1)} className="admin-back-button">← Volver</button>
        <h1 className="admin-match-title">🏀 Gestión de Partido - Básquet</h1>
        <div className="admin-match-info">
          {match.grupo && <span className="admin-match-group">{match.grupo}</span>}
          <span className="admin-match-phase">{match.fase || 'Grupos'}</span>
        </div>
      </div>

      {/* Match Card principal */}
      <div className="admin-match-card">
        {/* Franja superior: fase + estado + fecha */}
        <div className="match-card-top">
          <span className="match-phase-badge">{match.fase || 'Fase de Grupos'}</span>

          <span className={`match-status-badge ${(match.estado || '').replace(' ', '-')}`}>
            {estadoLabel}
          </span>

          {esProgramado && (fechaFormateada || match.hora) && (
            <span className="match-datetime-info">
              📅 {fechaFormateada && <span>{fechaFormateada}</span>}
              {match.hora && <span> · 🕐 {match.hora}</span>}
            </span>
          )}
        </div>

        {/* Scoreboard */}
        <div className="match-scoreboard">
          {/* Equipo A */}
          <div className="match-team">
            <p className="match-team-sub">Equipo Local</p>
            <h2 className="match-team-name">{equipoA}</h2>
            <div className="match-score-block">
              <span className="match-score-number">{match.marcadorA ?? 0}</span>
            </div>
            <button
              className="match-goal-btn"
              onClick={() => setMostrarInputJugador('A')}
              disabled={match.estado !== 'en-curso' && match.estado !== 'en curso'}
            >
              🏀 Anotar Puntos
            </button>
          </div>

          {/* VS */}
          <div className="match-vs-center">
            <span className="match-vs-text">VS</span>
          </div>

          {/* Equipo B */}
          <div className="match-team">
            <p className="match-team-sub">Equipo Visitante</p>
            <h2 className="match-team-name">{equipoB}</h2>
            <div className="match-score-block">
              <span className="match-score-number">{match.marcadorB ?? 0}</span>
            </div>
            <button
              className="match-goal-btn"
              onClick={() => setMostrarInputJugador('B')}
              disabled={match.estado !== 'en-curso' && match.estado !== 'en curso'}
            >
              🏀 Anotar Puntos
            </button>
          </div>
        </div>
      </div>

      {/* Acciones de estado */}
      <div className="admin-match-status">
        <div className="admin-status-info">
          <span className={`admin-status-badge ${match.estado}`}>{estadoLabel}</span>
        </div>
        <div className="admin-status-actions">
          {(match.estado === 'pendiente' || match.estado === 'programado') && (
            equiposDefinidos() ? (
              <>
                <button onClick={iniciarPartido} className="admin-btn admin-btn-start">
                  ▶️ Iniciar Partido
                </button>
                <div className="admin-privilege-info">
                  <span>🛡️</span>
                  <span className="privilege-text">Puedes iniciar sin restricción de horario</span>
                </div>
              </>
            ) : (
              <div className="admin-privilege-info">
                <span>⏳</span>
                <span className="privilege-text">Esperando que se definan los equipos participantes</span>
              </div>
            )
          )}
          {match.estado === 'en curso' && (
            <button onClick={finalizarPartido} className="admin-btn admin-btn-finish">
              🏁 Finalizar Partido
            </button>
          )}
          {match.estado === 'finalizado' && (
            <>
              <div className="partido-finalizado-msg" style={{ background: '#cbd5e1', color: '#475569', border: '1px solid #cbd5e1', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', borderRadius: '25px', fontWeight: '700', fontSize: '0.9rem' }}>
                <span className="msg-icon">✅</span>
                <span>Partido finalizado</span>
              </div>
              <button onClick={reanudarPartido} className="admin-btn admin-btn-resume">
                ⏯️ Reanudar Partido
              </button>
            </>
          )}
        </div>
      </div>

      {/* Modal puntos básquet */}
      {mostrarInputJugador && (
        <div className="admin-goal-input-modal">
          <div className="admin-modal-content">
            <h3>🏀 Anotar Puntos para {mostrarInputJugador === 'A' ? equipoA : equipoB}</h3>

            <div className="admin-player-selector">
              <h4>Seleccionar Jugador:</h4>
              <div className="admin-players-grid">
                {(mostrarInputJugador === 'A' ? jugadoresEquipoA : jugadoresEquipoB).length > 0
                  ? (mostrarInputJugador === 'A' ? jugadoresEquipoA : jugadoresEquipoB).map(j => (
                      <button
                        key={j.id}
                        onClick={() => setJugadorInput(`#${j.numero || '?'} ${j.nombre}`)}
                        className={`admin-player-selector-btn ${jugadorInput === `#${j.numero || '?'} ${j.nombre}` ? 'selected' : ''}`}
                      >
                        <span className="player-number-btn">#{j.numero || '?'}</span>
                        <span className="player-name-btn">{j.nombre}</span>
                      </button>
                    ))
                  : <div className="no-players-available"><span>⚠️</span><span>Sin jugadores registrados</span></div>
                }
              </div>
            </div>

            <div className="admin-manual-input">
              <h4>O buscar por número:</h4>
              <div className="numero-jugador-busqueda">
                <input
                  type="number" min="1"
                  placeholder="Número del jugador..."
                  value={numeroJugadorBusqueda}
                  onChange={e => setNumeroJugadorBusqueda(e.target.value)}
                  onKeyPress={e => e.key === 'Enter' && asignarPuntoPorNumero()}
                  className="admin-goal-input"
                />
                <button onClick={asignarPuntoPorNumero} className="admin-btn admin-btn-search" disabled={!numeroJugadorBusqueda.trim()}>
                  🔍 Buscar
                </button>
              </div>
              {jugadorInput && (
                <div className="jugador-seleccionado">
                  <span>Seleccionado: <strong>{jugadorInput}</strong></span>
                  <button onClick={() => { setJugadorInput(''); setNumeroJugadorBusqueda(''); }} className="admin-btn admin-btn-clear">✖ Limpiar</button>
                </div>
              )}
            </div>

            <div className="puntos-selector-modal" style={{ marginTop: '1.25rem' }}>
              <h4 style={{ marginBottom: '0.5rem', color: '#374151', fontWeight: 600, fontSize: '0.9rem' }}>Puntos a anotar:</h4>
              <div className="puntos-botones-modal" style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                {[1, 2, 3].map(pts => (
                  <button
                    key={pts}
                    type="button"
                    className={`admin-btn ${tipoCanasta === pts ? 'admin-btn-confirm' : 'admin-btn-cancel'}`}
                    onClick={() => setTipoCanasta(pts)}
                    style={{ flex: 1, padding: '0.75rem', fontSize: '1rem', fontWeight: 700 }}
                  >
                    {pts} {pts === 1 ? 'pt' : 'pts'}
                  </button>
                ))}
              </div>
            </div>

            <div className="admin-modal-actions" style={{ marginTop: '1.5rem' }}>
              <button onClick={() => anotarPuntos(mostrarInputJugador)} className="admin-btn admin-btn-confirm" disabled={!jugadorInput.trim()}>
                ✅ Confirmar Puntos
              </button>
              <button onClick={() => { setMostrarInputJugador(null); setJugadorInput(''); setNumeroJugadorBusqueda(''); setTipoCanasta(1); }} className="admin-btn admin-btn-cancel">
                ❌ Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Resumen de anotaciones */}
      <div className="admin-goalscorers-section">
        <div className="admin-goalscorers-header">
          <h3 className="admin-section-title">🏀 Anotadores del Partido</h3>
          <div className="admin-goalscorer-controls">
            {editandoAnotadores ? (
              <div className="admin-edit-actions">
                <button onClick={guardarAnotadores} className="admin-btn admin-btn-save">💾 Guardar</button>
                <button onClick={cancelarEdicion} className="admin-btn admin-btn-cancel">❌ Cancelar</button>
              </div>
            ) : (
              <button onClick={() => setEditandoAnotadores(true)} className="admin-btn admin-btn-edit">✏️ Editar</button>
            )}
          </div>
        </div>

        <div className="admin-goalscorers-grid">
          {/* Equipo A */}
          <div className="admin-team-goalscorers">
            <h4 className="admin-team-subtitle">{equipoA}</h4>
            <div className="admin-goalscorers-list">
              {editandoAnotadores ? (
                <>
                  <div className="admin-add-goalscorer">
                    <input
                      type="text"
                      value={nuevoAnotador.A}
                      onChange={(e) => setNuevoAnotador(prev => ({ ...prev, A: e.target.value }))}
                      placeholder="Agregar anotador..."
                      className="admin-goalscorer-input"
                    />
                    <select
                      value={nuevoPuntaje.A}
                      onChange={(e) => setNuevoPuntaje(prev => ({ ...prev, A: parseInt(e.target.value) }))}
                      className="admin-time-select"
                      style={{ padding: '0.4rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                    >
                      <option value={1}>1 pt</option>
                      <option value={2}>2 pts</option>
                      <option value={3}>3 pts</option>
                    </select>
                    <button onClick={() => agregarAnotador('A')} className="admin-btn-add">➕</button>
                  </div>

                  <div className="anotaciones-lista" style={{ marginTop: '0.75rem' }}>
                    {obtenerAnotadoresAgrupados(anotadoresTemporal.A).map((anotacion) => (
                      <div key={anotacion.nombre} className="anotacion-editable grouped-anotacion">
                        <input
                          type="text"
                          value={anotacion.nombre}
                          onChange={(e) => manejarEditarNombreAnotador('A', anotacion.nombre, e.target.value)}
                          className="editar-jugador-input"
                          style={{ flex: 1, padding: '0.4rem 0.6rem', border: '1px solid #e2e8f0', borderRadius: '6px' }}
                        />
                        
                        <div className="puntos-control-group">
                          <span className="puntos-acumulados">{anotacion.puntos} pts</span>
                          <div className="btn-group-puntos">
                            <button onClick={() => manejarCambiarPuntosAnotador('A', anotacion.nombre, anotacion.puntos - 3)} className="puntos-btn-adjust minus-3" disabled={anotacion.puntos < 3}>-3</button>
                            <button onClick={() => manejarCambiarPuntosAnotador('A', anotacion.nombre, anotacion.puntos - 2)} className="puntos-btn-adjust minus-2" disabled={anotacion.puntos < 2}>-2</button>
                            <button onClick={() => manejarCambiarPuntosAnotador('A', anotacion.nombre, anotacion.puntos - 1)} className="puntos-btn-adjust minus-1" disabled={anotacion.puntos < 1}>-1</button>
                            <button onClick={() => manejarCambiarPuntosAnotador('A', anotacion.nombre, anotacion.puntos + 1)} className="puntos-btn-adjust plus-1">+1</button>
                            <button onClick={() => manejarCambiarPuntosAnotador('A', anotacion.nombre, anotacion.puntos + 2)} className="puntos-btn-adjust plus-2">+2</button>
                            <button onClick={() => manejarCambiarPuntosAnotador('A', anotacion.nombre, anotacion.puntos + 3)} className="puntos-btn-adjust plus-3">+3</button>
                          </div>
                        </div>

                        <button onClick={() => manejarEliminarAnotadorCompleto('A', anotacion.nombre)} className="admin-btn-remove">🗑️</button>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                match.anotadoresA && match.anotadoresA.length > 0 ? (
                  Object.entries(getEstadisticasJugador(match.anotadoresA)).map(([jugador, stats]) => (
                    <div key={jugador} className="admin-goalscorer-item">
                      <span className="admin-player-name">{jugador}</span>
                      <span className="admin-goal-count">{stats.total} pts</span>
                    </div>
                  ))
                ) : (
                  <p className="admin-no-goals">Sin anotaciones aún</p>
                )
              )}
            </div>
          </div>

          {/* Equipo B */}
          <div className="admin-team-goalscorers">
            <h4 className="admin-team-subtitle">{equipoB}</h4>
            <div className="admin-goalscorers-list">
              {editandoAnotadores ? (
                <>
                  <div className="admin-add-goalscorer">
                    <input
                      type="text"
                      value={nuevoAnotador.B}
                      onChange={(e) => setNuevoAnotador(prev => ({ ...prev, B: e.target.value }))}
                      placeholder="Agregar anotador..."
                      className="admin-goalscorer-input"
                    />
                    <select
                      value={nuevoPuntaje.B}
                      onChange={(e) => setNuevoPuntaje(prev => ({ ...prev, B: parseInt(e.target.value) }))}
                      className="admin-time-select"
                      style={{ padding: '0.4rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                    >
                      <option value={1}>1 pt</option>
                      <option value={2}>2 pts</option>
                      <option value={3}>3 pts</option>
                    </select>
                    <button onClick={() => agregarAnotador('B')} className="admin-btn-add">➕</button>
                  </div>

                  <div className="anotaciones-lista" style={{ marginTop: '0.75rem' }}>
                    {obtenerAnotadoresAgrupados(anotadoresTemporal.B).map((anotacion) => (
                      <div key={anotacion.nombre} className="anotacion-editable grouped-anotacion">
                        <input
                          type="text"
                          value={anotacion.nombre}
                          onChange={(e) => manejarEditarNombreAnotador('B', anotacion.nombre, e.target.value)}
                          className="editar-jugador-input"
                          style={{ flex: 1, padding: '0.4rem 0.6rem', border: '1px solid #e2e8f0', borderRadius: '6px' }}
                        />
                        
                        <div className="puntos-control-group">
                          <span className="puntos-acumulados">{anotacion.puntos} pts</span>
                          <div className="btn-group-puntos">
                            <button onClick={() => manejarCambiarPuntosAnotador('B', anotacion.nombre, anotacion.puntos - 3)} className="puntos-btn-adjust minus-3" disabled={anotacion.puntos < 3}>-3</button>
                            <button onClick={() => manejarCambiarPuntosAnotador('B', anotacion.nombre, anotacion.puntos - 2)} className="puntos-btn-adjust minus-2" disabled={anotacion.puntos < 2}>-2</button>
                            <button onClick={() => manejarCambiarPuntosAnotador('B', anotacion.nombre, anotacion.puntos - 1)} className="puntos-btn-adjust minus-1" disabled={anotacion.puntos < 1}>-1</button>
                            <button onClick={() => manejarCambiarPuntosAnotador('B', anotacion.nombre, anotacion.puntos + 1)} className="puntos-btn-adjust plus-1">+1</button>
                            <button onClick={() => manejarCambiarPuntosAnotador('B', anotacion.nombre, anotacion.puntos + 2)} className="puntos-btn-adjust plus-2">+2</button>
                            <button onClick={() => manejarCambiarPuntosAnotador('B', anotacion.nombre, anotacion.puntos + 3)} className="puntos-btn-adjust plus-3">+3</button>
                          </div>
                        </div>

                        <button onClick={() => manejarEliminarAnotadorCompleto('B', anotacion.nombre)} className="admin-btn-remove">🗑️</button>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                match.anotadoresB && match.anotadoresB.length > 0 ? (
                  Object.entries(getEstadisticasJugador(match.anotadoresB)).map(([jugador, stats]) => (
                    <div key={jugador} className="admin-goalscorer-item">
                      <span className="admin-player-name">{jugador}</span>
                      <span className="admin-goal-count">{stats.total} pts</span>
                    </div>
                  ))
                ) : (
                  <p className="admin-no-goals">Sin anotaciones aún</p>
                )
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Sección de programación e información del partido */}
      <div className="admin-match-additional-info">
        <div className="admin-goalscorers-header" style={{ marginBottom: '1rem' }}>
          <h3 className="admin-section-title">📋 Información y Programación</h3>
          {!editandoHorario ? (
            <button onClick={() => setEditandoHorario(true)} className="admin-btn admin-btn-edit">
              ✏️ Editar
            </button>
          ) : (
            <div className="admin-schedule-buttons">
              <button onClick={actualizarFechaHora} className="admin-save-btn">✅ Guardar</button>
              <button onClick={cancelarEdicionHorario} className="admin-cancel-btn">❌ Cancelar</button>
            </div>
          )}
        </div>

        <div className="admin-info-grid">
          <div className="admin-info-item">
            <span className="admin-info-label">📅 Fecha</span>
            {editandoHorario ? (
              <input
                type="date"
                value={fechaTemporal}
                onChange={(e) => setFechaTemporal(e.target.value)}
                className="admin-date-input"
              />
            ) : (
              <span className="admin-info-value">
                {match.fecha ? `${obtenerNombreDia(match.fecha).charAt(0).toUpperCase() + obtenerNombreDia(match.fecha).slice(1)} ${match.fecha}` : "No programada"}
              </span>
            )}
          </div>

          <div className="admin-info-item">
            <span className="admin-info-label">🕐 Hora</span>
            {editandoHorario ? (
              <select
                value={horaTemporal}
                onChange={(e) => setHoraTemporal(e.target.value)}
                className="admin-time-select"
              >
                <option value="">Sin hora</option>
                {['07:05','07:50','08:35','09:20','10:05','10:50','11:35','12:20','13:00'].map(h => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            ) : (
              <span className="admin-info-value">{match.hora || "No programada"}</span>
            )}
          </div>

          <div className="admin-info-item">
            <span className="admin-info-label">🏟️ Grupo</span>
            <span className="admin-info-value">{match.grupo || "—"}</span>
          </div>

          <div className="admin-info-item">
            <span className="admin-info-label">🏆 Fase</span>
            <span className="admin-info-value">{match.fase || "Fase de Grupos"}</span>
          </div>

          <div className="admin-info-item">
            <span className="admin-info-label">🏀 Disciplina</span>
            <span className="admin-info-value">{match.disciplina || "Básquet"}</span>
          </div>
        </div>
      </div>
      <ToastContainer />
    </div>
  );
}

