import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from "../api/firestoreCompat";
import { db } from "../firebase/config";
import { useToast } from "../components/Toast";
import { verificarYGenerarFasesFinalesExterna } from "./AdminMatches";
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
  const [nuevoAnotadorTexto, setNuevoAnotadorTexto] = useState({ A: "", B: "" });

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
  const esSemifinal = match?.fase === "semifinal" || match?.fase === "semifinales";
  const esFinal = match?.fase === "final" || match?.fase === "finales" || match?.fase === "tercerPuesto" || match?.fase === "tercer_puesto";

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

      // Generar fases finales si el partido es finalizado
      if (nuevoEstado === "finalizado") {
        console.log(`🎯 PARTIDO VOLEY FINALIZADO - Ejecutando verificación de fases finales para partido ID: ${matchId}`);
        setTimeout(async () => {
          try {
            const freshSnap = await getDoc(doc(db, "matches", matchId));
            if (freshSnap.exists()) {
              const freshMatch = { id: freshSnap.id, ...freshSnap.data() };
              await verificarYGenerarFasesFinalesExterna(freshMatch, showToast);
            }
          } catch (err) {
            console.error("Error al verificar fases de voley:", err);
          }
        }, 1000);
      }
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

  // Función para marcar punto por falta (sin necesidad de seleccionar jugador)
  const marcarPuntoPorFalta = async (equipo, setActual) => {
    try {
      const sets = inicializarSets();
      const nuevoSets = [...sets];
      
      const limitePuntos = esFaseGrupos 
        ? reglasJuego.puntosPorSet
        : reglasJuego.puntosPorSet[setActual];

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

      // Agregar anotador genérico
      const anotadoresKey = `anotadores${equipo}`;
      const nuevosAnotadores = [...(match[anotadoresKey] || []), "Punto por Falta"];

      const marcadorTotal = nuevoSets.reduce((total, set) => total + (set[equipo] || 0), 0);

      const updateData = {
        sets: nuevoSets,
        [anotadoresKey]: nuevosAnotadores,
        [`marcador${equipo}`]: marcadorTotal
      };

      await updateDoc(doc(db, "matches", matchId), updateData);

      setMatch(prev => ({
        ...prev,
        ...updateData
      }));

      setPuntoInput("");
      setNumeroJugadorBusqueda("");
      setMostrarInputPunto(null);
      showToast("Punto por falta registrado correctamente", "success");

    } catch (error) {
      console.error("Error al marcar punto por falta:", error);
      showToast("Error al marcar punto por falta", "error");
    }
  };

  // Obtener anotadores agrupados para la interfaz
  const obtenerAnotadoresAgrupados = (anotadores) => {
    const agrupados = {};
    (anotadores || []).forEach(nombre => {
      if (nombre && nombre.trim()) {
        agrupados[nombre] = (agrupados[nombre] || 0) + 1;
      }
    });
    return Object.entries(agrupados).map(([nombre, puntos]) => ({ nombre, puntos }));
  };

  // Manejar edición de nombre de un anotador único
  const manejarEditarNombreAnotador = (equipo, nombreOriginal, nuevoNombre) => {
    if (!nuevoNombre.trim()) return;
    setAnotadoresTemporal(prev => ({
      ...prev,
      [equipo]: prev[equipo].map(n => n === nombreOriginal ? nuevoNombre.trim() : n)
    }));
  };

  // Incrementar puntos de un anotador único
  const manejarIncrementarPuntos = (equipo, nombre) => {
    setAnotadoresTemporal(prev => ({
      ...prev,
      [equipo]: [...prev[equipo], nombre]
    }));
  };

  // Decrementar puntos de un anotador único
  const manejarDecrementarPuntos = (equipo, nombre) => {
    setAnotadoresTemporal(prev => {
      const arr = prev[equipo];
      const index = arr.indexOf(nombre);
      if (index > -1) {
        const nuevoArr = [...arr];
        nuevoArr.splice(index, 1);
        return { ...prev, [equipo]: nuevoArr };
      }
      return prev;
    });
  };

  // Eliminar un anotador completo de la lista de edición
  const manejarEliminarAnotadorCompleto = (equipo, nombre) => {
    setAnotadoresTemporal(prev => ({
      ...prev,
      [equipo]: prev[equipo].filter(n => n !== nombre)
    }));
  };

  // Agregar anotador en edición
  const agregarAnotador = (equipo) => {
    const nombre = nuevoAnotadorTexto[equipo]?.trim();
    if (!nombre) return;
    
    setAnotadoresTemporal(prev => ({
      ...prev,
      [equipo]: [...prev[equipo], nombre]
    }));
    
    setNuevoAnotadorTexto(prev => ({
      ...prev,
      [equipo]: ""
    }));
  };

  const guardarAnotadores = async () => {
    try {
      const nuevosAnotadoresA = anotadoresTemporal.A.filter(nombre => nombre.trim());
      const nuevosAnotadoresB = anotadoresTemporal.B.filter(nombre => nombre.trim());

      const originalA = match.anotadoresA || [];
      const originalB = match.anotadoresB || [];

      const difA = nuevosAnotadoresA.length - originalA.length;
      const difB = nuevosAnotadoresB.length - originalB.length;

      const setsData = inicializarSets();
      const nuevosSets = JSON.parse(JSON.stringify(setsData));

      // Función local para obtener puntos límite
      const localObtenerPuntosSet = (setIndex, currentSets) => {
        if (esFaseGrupos) return reglasJuego.puntosPorSet;
        
        // Calcular sets ganados de manera local y aislada
        let sA = 0, sB = 0;
        currentSets.slice(0, setIndex).forEach((s, idx) => {
          const lim = reglasJuego.puntosPorSet[idx] || 20;
          if (s.A >= lim && s.A - s.B >= 2) sA++;
          if (s.B >= lim && s.B - s.A >= 2) sB++;
        });
        
        if (sA === 1 || sB === 1) return 15;
        return reglasJuego.puntosPorSet[setIndex] || (esFinal ? 5 : 20);
      };

      // Función local para determinar ganador de set
      const localGanadorSet = (setData, limitePuntos) => {
        if (!setData) return null;
        if (setData.A >= limitePuntos && setData.A - setData.B >= 2) return 'A';
        if (setData.B >= limitePuntos && setData.B - setData.A >= 2) return 'B';
        return null;
      };

      // Ajustar Puntos Equipo A
      if (difA !== 0) {
        if (difA > 0) {
          let puntosPorSumar = difA;
          let activeSetIndex = 0;
          for (let i = 0; i < nuevosSets.length; i++) {
            const limite = localObtenerPuntosSet(i, nuevosSets);
            if (localGanadorSet(nuevosSets[i], limite) === null) {
              activeSetIndex = i;
              break;
            }
          }
          nuevosSets[activeSetIndex].A = (nuevosSets[activeSetIndex].A || 0) + puntosPorSumar;
        } else {
          let puntosPorRestar = Math.abs(difA);
          for (let i = nuevosSets.length - 1; i >= 0; i--) {
            if (puntosPorRestar <= 0) break;
            const puntosEnSet = nuevosSets[i].A || 0;
            if (puntosEnSet > 0) {
              const restados = Math.min(puntosEnSet, puntosPorRestar);
              nuevosSets[i].A -= restados;
              puntosPorRestar -= restados;
            }
          }
        }
      }

      // Ajustar Puntos Equipo B
      if (difB !== 0) {
        if (difB > 0) {
          let puntosPorSumar = difB;
          let activeSetIndex = 0;
          for (let i = 0; i < nuevosSets.length; i++) {
            const limite = localObtenerPuntosSet(i, nuevosSets);
            if (localGanadorSet(nuevosSets[i], limite) === null) {
              activeSetIndex = i;
              break;
            }
          }
          nuevosSets[activeSetIndex].B = (nuevosSets[activeSetIndex].B || 0) + puntosPorSumar;
        } else {
          let puntosPorRestar = Math.abs(difB);
          for (let i = nuevosSets.length - 1; i >= 0; i--) {
            if (puntosPorRestar <= 0) break;
            const puntosEnSet = nuevosSets[i].B || 0;
            if (puntosEnSet > 0) {
              const restados = Math.min(puntosEnSet, puntosPorRestar);
              nuevosSets[i].B -= restados;
              puntosPorRestar -= restados;
            }
          }
        }
      }

      // Recalcular marcador total
      const marcadorA = nuevosSets.reduce((total, s) => total + (s.A || 0), 0);
      const marcadorB = nuevosSets.reduce((total, s) => total + (s.B || 0), 0);

      const updateData = {
        anotadoresA: nuevosAnotadoresA,
        anotadoresB: nuevosAnotadoresB,
        sets: nuevosSets,
        marcadorA,
        marcadorB
      };

      await updateDoc(doc(db, "matches", matchId), updateData);
      setMatch(prev => ({ ...prev, ...updateData }));
      setEditandoAnotadores(false);
      showToast("Anotadores y marcador actualizados correctamente", "success");
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
    setNuevoAnotadorTexto({ A: "", B: "" });
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
  const anotadoresA = contarAnotadores(match.anotadoresA);
  const anotadoresB = contarAnotadores(match.anotadoresB);
  const sets = inicializarSets();
  const { setsA: setsGanadosA, setsB: setsGanadosB } = calcularSetsGanados(sets);
  const partidoFinalizado = match.estado === "finalizado";

  return (
    <div className="admin-match-detail-container">
      {/* Header */}
      <div className="admin-match-header">
        <button onClick={() => navigate(-1)} className="admin-back-button">← Volver</button>
        <h1 className="admin-match-title">🏐 Gestión de Partido - Vóley</h1>
        <div className="admin-match-info">
          {match.grupo && <span className="admin-match-group">{match.grupo}</span>}
          <span className="admin-match-phase">{fasesNombres[match.fase] || "Fase de Grupos"}</span>
        </div>
      </div>

      {/* Match Card principal */}
      <div className="admin-match-card">
        {/* Franja superior: fase + estado + fecha */}
        <div className="match-card-top">
          <span className="match-phase-badge">{fasesNombres[match.fase] || 'Fase de Grupos'}</span>

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
              <span className="match-score-number">{setsGanadosA}</span>
              <span className="match-team-sub" style={{ fontSize: '0.65rem' }}>Sets Ganados</span>
            </div>
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
              <span className="match-score-number">{setsGanadosB}</span>
              <span className="match-team-sub" style={{ fontSize: '0.65rem' }}>Sets Ganados</span>
            </div>
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
                <button onClick={() => cambiarEstadoPartido("en curso")} className="admin-btn admin-btn-start">
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
            <>
              <button onClick={() => cambiarEstadoPartido("finalizado")} className="admin-btn admin-btn-finish">
                🏁 Finalizar Partido
              </button>
              <button onClick={() => cambiarEstadoPartido("pendiente")} className="admin-btn admin-btn-resume" style={{ marginLeft: '10px' }}>
                ⏸️ Pausar Partido
              </button>
            </>
          )}
          {match.estado === 'finalizado' && (
            <>
              <div className="partido-finalizado-msg" style={{ background: '#cbd5e1', color: '#475569', border: '1px solid #cbd5e1', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', borderRadius: '25px', fontWeight: '700', fontSize: '0.9rem' }}>
                <span className="msg-icon">✅</span>
                <span>Partido finalizado</span>
              </div>
              <button onClick={() => cambiarEstadoPartido("en curso")} className="admin-btn admin-btn-resume" style={{ marginLeft: '10px' }}>
                ⏯️ Reanudar Partido
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tabla de sets */}
      <div className="admin-goalscorers-section">
        <div className="admin-goalscorers-header">
          <h3 className="admin-section-title">📊 Marcador por Sets</h3>
          <span className="match-phase-badge" style={{ background: '#0891b2', border: 'none' }}>{reglasJuego.descripcion}</span>
        </div>

        <div className="admin-sets-table" style={{ marginTop: '1rem', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '700', color: '#64748b' }}>Equipo</th>
                {sets.map((_, index) => 
                  deberMostrarSet(index, sets) ? (
                    <th key={index} style={{ padding: '0.75rem', fontWeight: '700', color: '#64748b' }}>
                      Set {index + 1}
                      {!esFaseGrupos && index === 4 && " (15 pts)"}
                    </th>
                  ) : null
                )}
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: '1rem', textAlign: 'left', fontWeight: '700', color: '#1e293b' }}>{equipoA}</td>
                {sets.map((set, index) => {
                  if (!deberMostrarSet(index, sets)) return null;
                  
                  const limitePuntos = obtenerPuntosSet(index, sets);
                  const ganador = ganadorSet(set, limitePuntos);
                  
                  // El set previo debe estar completado para poder jugar este set
                  const setPrevioCompletado = index === 0 || (() => {
                    const limitePrevio = obtenerPuntosSet(index - 1, sets);
                    return ganadorSet(sets[index - 1], limitePrevio) !== null;
                  })();

                  const limiteSetsParaGanar = esFaseGrupos ? 1 : 2;
                  const matchGanado = setsGanadosA >= limiteSetsParaGanar || setsGanadosB >= limiteSetsParaGanar;
                  const botonDeshabilitado = matchGanado || ganador !== null || !setPrevioCompletado;

                  return (
                    <td key={index} style={{ padding: '1rem' }} className={`set-score ${ganador === 'A' ? 'winner' : ''}`}>
                      <div className="set-points" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '1.25rem', fontWeight: '800', color: ganador === 'A' ? '#10b981' : '#1e293b' }}>{set?.A || 0}</span>
                        {match.estado === "en curso" && (
                          <button
                            onClick={() => setMostrarInputPunto({ equipo: 'A', set: index })}
                            className="admin-btn-add"
                            disabled={botonDeshabilitado}
                            style={{ padding: '0.2rem 0.4rem', fontSize: '0.75rem', borderRadius: '4px' }}
                          >
                            ➕
                          </button>
                        )}
                      </div>
                      <div className="set-limit" style={{ fontSize: '0.75rem', color: '#94a3b8' }}>/{limitePuntos}</div>
                    </td>
                  );
                })}
              </tr>
              <tr>
                <td style={{ padding: '1rem', textAlign: 'left', fontWeight: '700', color: '#1e293b' }}>{equipoB}</td>
                {sets.map((set, index) => {
                  if (!deberMostrarSet(index, sets)) return null;
                  
                  const limitePuntos = obtenerPuntosSet(index, sets);
                  const ganador = ganadorSet(set, limitePuntos);
                  
                  // El set previo debe estar completado para poder jugar este set
                  const setPrevioCompletado = index === 0 || (() => {
                    const limitePrevio = obtenerPuntosSet(index - 1, sets);
                    return ganadorSet(sets[index - 1], limitePrevio) !== null;
                  })();

                  const limiteSetsParaGanar = esFaseGrupos ? 1 : 2;
                  const matchGanado = setsGanadosA >= limiteSetsParaGanar || setsGanadosB >= limiteSetsParaGanar;
                  const botonDeshabilitado = matchGanado || ganador !== null || !setPrevioCompletado;

                  return (
                    <td key={index} style={{ padding: '1rem' }} className={`set-score ${ganador === 'B' ? 'winner' : ''}`}>
                      <div className="set-points" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '1.25rem', fontWeight: '800', color: ganador === 'B' ? '#10b981' : '#1e293b' }}>{set?.B || 0}</span>
                        {match.estado === "en curso" && (
                          <button
                            onClick={() => setMostrarInputPunto({ equipo: 'B', set: index })}
                            className="admin-btn-add"
                            disabled={botonDeshabilitado}
                            style={{ padding: '0.2rem 0.4rem', fontSize: '0.75rem', borderRadius: '4px' }}
                          >
                            ➕
                          </button>
                        )}
                      </div>
                      <div className="set-limit" style={{ fontSize: '0.75rem', color: '#94a3b8' }}>/{limitePuntos}</div>
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
        <div className="admin-goal-input-modal">
          <div className="admin-modal-content">
            <h3>🏐 Anotar Punto en Set {mostrarInputPunto.set + 1}</h3>
            <p style={{ margin: '0.25rem 0 1rem', fontSize: '0.9rem', color: '#64748b' }}>
              Para: <strong>{mostrarInputPunto.equipo === 'A' ? equipoA : equipoB}</strong>
            </p>
            
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
                    <span>⚠️</span>
                    <span>No hay jugadores registrados</span>
                  </div>
                )}
              </div>
            </div>
            
            <div className="admin-manual-input">
              <h4>O buscar por número:</h4>
              <div className="numero-jugador-busqueda">
                <input
                  type="number" min="1"
                  placeholder="Número del jugador..."
                  value={numeroJugadorBusqueda}
                  onChange={(e) => setNumeroJugadorBusqueda(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && asignarPuntoPorNumero()}
                  className="admin-goal-input"
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
                  <span>Seleccionado: <strong>{puntoInput}</strong></span>
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
            
            <div className="admin-modal-actions" style={{ marginTop: '1.5rem' }}>
              <button
                onClick={() => marcarPunto(mostrarInputPunto.equipo, mostrarInputPunto.set)}
                className="admin-btn admin-btn-confirm"
                disabled={!puntoInput.trim()}
              >
                ✅ Confirmar Punto
              </button>
              <button
                onClick={() => marcarPuntoPorFalta(mostrarInputPunto.equipo, mostrarInputPunto.set)}
                className="admin-btn admin-btn-resume"
                style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
              >
                ⚠️ Falta / Punto Directo
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
      <div className="admin-goalscorers-section">
        <div className="admin-goalscorers-header">
          <h3 className="admin-section-title">🏐 Anotadores del Partido</h3>
          <div className="admin-goalscorer-controls">
            {!partidoFinalizado && (
              editandoAnotadores ? (
                <div className="admin-edit-actions">
                  <button onClick={guardarAnotadores} className="admin-btn admin-btn-save">💾 Guardar</button>
                  <button onClick={cancelarEdicionAnotadores} className="admin-btn admin-btn-cancel">❌ Cancelar</button>
                </div>
              ) : (
                <button onClick={() => setEditandoAnotadores(true)} className="admin-btn admin-btn-edit">✏️ Editar</button>
              )
            )}
          </div>
        </div>

        <div className="admin-goalscorers-grid">
          {/* Anotadores Equipo A */}
          <div className="admin-team-goalscorers">
            <h4 className="admin-team-subtitle">{equipoA}</h4>
            <div className="admin-goalscorers-list">
              {editandoAnotadores && !partidoFinalizado ? (
                <>
                  <div className="admin-add-goalscorer">
                    <input
                      type="text"
                      placeholder="Agregar anotador..."
                      value={nuevoAnotadorTexto.A}
                      onChange={e => setNuevoAnotadorTexto(prev => ({ ...prev, A: e.target.value }))}
                      onKeyPress={e => e.key === 'Enter' && agregarAnotador('A')}
                      className="admin-goalscorer-input"
                    />
                    <button onClick={() => agregarAnotador('A')} className="admin-btn-add">➕</button>
                  </div>

                  <div className="anotaciones-lista" style={{ marginTop: '0.75rem' }}>
                    {obtenerAnotadoresAgrupados(anotadoresTemporal.A).map((anotador, i) => (
                      <div key={i} className="admin-goalscorer-edit-item" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', background: '#fef9c3', border: '1px solid #fcd34d', padding: '0.5rem', borderRadius: '8px' }}>
                        <input
                          type="text"
                          value={anotador.nombre}
                          onChange={e => manejarEditarNombreAnotador('A', anotador.nombre, e.target.value)}
                          className="admin-goalscorer-input"
                          style={{ flex: 1 }}
                        />
                        <div className="contador-goles" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <button onClick={() => manejarDecrementarPuntos('A', anotador.nombre)} className="admin-btn-qty" style={{ padding: '3px 8px', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer', background: 'white', fontWeight: 'bold' }}>-</button>
                          <span style={{ fontWeight: 'bold', minWidth: '15px', textAlign: 'center' }}>{anotador.puntos}</span>
                          <button onClick={() => manejarIncrementarPuntos('A', anotador.nombre)} className="admin-btn-qty" style={{ padding: '3px 8px', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer', background: 'white', fontWeight: 'bold' }}>+</button>
                        </div>
                        <button onClick={() => manejarEliminarAnotadorCompleto('A', anotador.nombre)} className="admin-btn-remove">🗑️</button>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                Object.keys(anotadoresA).length > 0 ? (
                  Object.entries(anotadoresA).map(([nombre, puntos]) => (
                    <div key={nombre} className="admin-goalscorer-item">
                      <span className="admin-player-name">{nombre}</span>
                      <span className="admin-goal-count">{puntos} pts</span>
                    </div>
                  ))
                ) : (
                  <p className="admin-no-goals">Sin puntos aún</p>
                )
              )}
            </div>
          </div>

          {/* Anotadores Equipo B */}
          <div className="admin-team-goalscorers">
            <h4 className="admin-team-subtitle">{equipoB}</h4>
            <div className="admin-goalscorers-list">
              {editandoAnotadores && !partidoFinalizado ? (
                <>
                  <div className="admin-add-goalscorer">
                    <input
                      type="text"
                      placeholder="Agregar anotador..."
                      value={nuevoAnotadorTexto.B}
                      onChange={e => setNuevoAnotadorTexto(prev => ({ ...prev, B: e.target.value }))}
                      onKeyPress={e => e.key === 'Enter' && agregarAnotador('B')}
                      className="admin-goalscorer-input"
                    />
                    <button onClick={() => agregarAnotador('B')} className="admin-btn-add">➕</button>
                  </div>

                  <div className="anotaciones-lista" style={{ marginTop: '0.75rem' }}>
                    {obtenerAnotadoresAgrupados(anotadoresTemporal.B).map((anotador, i) => (
                      <div key={i} className="admin-goalscorer-edit-item" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', background: '#fef9c3', border: '1px solid #fcd34d', padding: '0.5rem', borderRadius: '8px' }}>
                        <input
                          type="text"
                          value={anotador.nombre}
                          onChange={e => manejarEditarNombreAnotador('B', anotador.nombre, e.target.value)}
                          className="admin-goalscorer-input"
                          style={{ flex: 1 }}
                        />
                        <div className="contador-goles" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <button onClick={() => manejarDecrementarPuntos('B', anotador.nombre)} className="admin-btn-qty" style={{ padding: '3px 8px', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer', background: 'white', fontWeight: 'bold' }}>-</button>
                          <span style={{ fontWeight: 'bold', minWidth: '15px', textAlign: 'center' }}>{anotador.puntos}</span>
                          <button onClick={() => manejarIncrementarPuntos('B', anotador.nombre)} className="admin-btn-qty" style={{ padding: '3px 8px', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer', background: 'white', fontWeight: 'bold' }}>+</button>
                        </div>
                        <button onClick={() => manejarEliminarAnotadorCompleto('B', anotador.nombre)} className="admin-btn-remove">🗑️</button>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                Object.keys(anotadoresB).length > 0 ? (
                  Object.entries(anotadoresB).map(([nombre, puntos]) => (
                    <div key={nombre} className="admin-goalscorer-item">
                      <span className="admin-player-name">{nombre}</span>
                      <span className="admin-goal-count">{puntos} pts</span>
                    </div>
                  ))
                ) : (
                  <p className="admin-no-goals">Sin puntos aún</p>
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
            <span className="admin-info-value">{fasesNombres[match.fase] || "Fase de Grupos"}</span>
          </div>

          <div className="admin-info-item">
            <span className="admin-info-label">🏐 Disciplina</span>
            <span className="admin-info-value">{match.disciplina || "Vóley"}</span>
          </div>
        </div>
      </div>
      <ToastContainer />
    </div>
  );
}
