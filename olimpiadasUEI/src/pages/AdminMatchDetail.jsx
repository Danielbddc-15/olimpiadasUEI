import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, updateDoc, collection, query, where, getDocs, addDoc } from "firebase/firestore";
import { db } from "../firebase/config";
import { useToast } from "../components/Toast";
import { verificarYGenerarFasesFinalesExterna } from "./AdminMatches";
import "../styles/AdminMatchDetail.css";
import "../styles/Toast.css";

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

  // Toast hook
  const { ToastContainer, showToast } = useToast();

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

      // Si se finaliza un partido, mostrar notificación inmediata
      if (nuevoEstado === "finalizado") {
        console.log(`🔔 MOSTRANDO NOTIFICACIÓN INMEDIATA - Partido finalizado`);
        showToast("🏁 Partido finalizado correctamente", "success");
      }

      // Si se finaliza un partido, ejecutar verificación automática de generación de finales
      if (nuevoEstado === "finalizado") {
        console.log(`🎯 PARTIDO FINALIZADO - Ejecutando verificación automática para partido ID: ${matchId}`);
        
        // Ejecutar verificación automática después de un breve delay para asegurar que la BD esté actualizada
        setTimeout(async () => {
          try {
            console.log(`🔄 Iniciando verificación automática de finales...`);
            
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
            
            console.log(`📊 Partidos relevantes encontrados: ${matchesRelevantes.length}`);
            
            // Verificar si hay grupos que necesiten automatización (tanto grupos normales como ida/vuelta)
            const gruposParaVerificar = {};
            
            matchesRelevantes.forEach(partido => {
              const fase = partido.fase || "grupos1";
              // Incluir grupos normales Y partidos de ida/vuelta
              if (fase.startsWith("grupos") || fase === "ida" || fase === "vuelta") {
                const grupo = partido.grupo;
                if (grupo) {
                  if (!gruposParaVerificar[grupo]) {
                    gruposParaVerificar[grupo] = [];
                  }
                  gruposParaVerificar[grupo].push(partido);
                }
              }
            });
            
            console.log(`🔍 Grupos encontrados para verificar:`, Object.keys(gruposParaVerificar));
            
            for (const [grupo, partidosDelGrupo] of Object.entries(gruposParaVerificar)) {
              // Verificar si es un grupo de 3 equipos
              const equiposUnicos = new Set();
              partidosDelGrupo.forEach(p => {
                if (p.equipoA) equiposUnicos.add(`${p.equipoA.curso}-${p.equipoA.paralelo}`);
                if (p.equipoB) equiposUnicos.add(`${p.equipoB.curso}-${p.equipoB.paralelo}`);
              });
              
              console.log(`📋 Grupo ${grupo}: ${equiposUnicos.size} equipos, ${partidosDelGrupo.length} partidos`);
              console.log(`📋 Detalle partidos grupo ${grupo}:`, partidosDelGrupo.map(p => ({
                fase: p.fase,
                equipoA: `${p.equipoA?.curso}-${p.equipoA?.paralelo}`,
                equipoB: `${p.equipoB?.curso}-${p.equipoB?.paralelo}`,
                marcador: `${p.marcadorA || 0}-${p.marcadorB || 0}`,
                estado: p.estado
              })));
              
              // MANEJO GRUPOS DE 2 EQUIPOS (ida y vuelta)
              if (equiposUnicos.size === 2 && partidosDelGrupo.length === 2) {
                const partidosFinalizados = partidosDelGrupo.filter(p => p.estado === "finalizado");
                
                console.log(`⚽ Grupo ${grupo} (2 equipos): ${partidosFinalizados.length}/${partidosDelGrupo.length} partidos finalizados`);
                
                if (partidosFinalizados.length === partidosDelGrupo.length) {
                  // Verificar si hay empate agregado y necesita desempate
                  const equipos = Array.from(equiposUnicos);
                  let puntosEquipo1 = 0, puntosEquipo2 = 0;
                  let golesEquipo1 = 0, golesEquipo2 = 0;
                  
                  partidosDelGrupo.forEach(partido => {
                    const esEquipo1Local = `${partido.equipoA.curso}-${partido.equipoA.paralelo}` === equipos[0];
                    const marcadorA = partido.marcadorA || 0;
                    const marcadorB = partido.marcadorB || 0;
                    
                    if (esEquipo1Local) {
                      golesEquipo1 += marcadorA;
                      golesEquipo2 += marcadorB;
                      if (marcadorA > marcadorB) puntosEquipo1 += 3;
                      else if (marcadorB > marcadorA) puntosEquipo2 += 3;
                      else { puntosEquipo1 += 1; puntosEquipo2 += 1; }
                    } else {
                      golesEquipo1 += marcadorB;
                      golesEquipo2 += marcadorA;
                      if (marcadorB > marcadorA) puntosEquipo1 += 3;
                      else if (marcadorA > marcadorB) puntosEquipo2 += 3;
                      else { puntosEquipo1 += 1; puntosEquipo2 += 1; }
                    }
                  });
                  
                  const diferenciaGoles1 = golesEquipo1 - golesEquipo2;
                  const diferenciaGoles2 = golesEquipo2 - golesEquipo1;
                  
                  console.log(`📊 Resultado agregado - Equipo 1: ${puntosEquipo1} pts (${golesEquipo1}-${golesEquipo2}), Equipo 2: ${puntosEquipo2} pts (${golesEquipo2}-${golesEquipo1})`);
                  
                  // Verificar si hay empate en puntos y diferencia de goles
                  const hayEmpate = puntosEquipo1 === puntosEquipo2 && diferenciaGoles1 === diferenciaGoles2;
                  
                  if (hayEmpate) {
                    // Verificar si ya existe un desempate
                    const desempateExistente = matchesRelevantes.find(m => 
                      m.fase === "desempate" && m.grupo === grupo
                    );
                    
                    if (!desempateExistente) {
                      console.log(`🥅 GENERANDO DESEMPATE AUTOMÁTICO para grupo ${grupo}`);
                      await generarDesempateAutomatico(grupo, partidosDelGrupo, match);
                    } else {
                      console.log(`ℹ️ Ya existe desempate para grupo ${grupo}`);
                    }
                  } else {
                    console.log(`✅ Grupo ${grupo} tiene ganador definido, no necesita desempate`);
                  }
                }
              }
              // MANEJO GRUPOS DE 3+ EQUIPOS (torneos tradicionales)
              else if (equiposUnicos.size >= 3) {
                // Calcular partidos esperados para grupo de N equipos (N*(N-1)/2)
                const partidosEsperados = (equiposUnicos.size * (equiposUnicos.size - 1)) / 2;
                const partidosFinalizados = partidosDelGrupo.filter(p => p.estado === "finalizado");
                
                console.log(`🏟️ Grupo ${grupo} (${equiposUnicos.size} equipos): ${partidosFinalizados.length}/${partidosEsperados} partidos finalizados`);
                
                if (partidosFinalizados.length === partidosEsperados) {
                  console.log(`🎯 Grupo ${grupo} completado - Verificando fases finales automáticas...`);
                  
                  // Verificar si ya existen fases finales para este grupo
                  const fasesFinalesExistentes = matchesRelevantes.filter(m => 
                    (m.fase === "semifinales" || m.fase === "final") && m.grupo === grupo
                  );
                  
                  if (fasesFinalesExistentes.length === 0) {
                    console.log(`🚀 GENERANDO FASES FINALES AUTOMÁTICAS para grupo ${grupo} (${equiposUnicos.size} equipos)`);
                    await generarFasesFinalesAutomaticas(grupo, partidosDelGrupo, match);
                  } else {
                    console.log(`ℹ️ Ya existen fases finales para grupo ${grupo}`);
                  }
                } else {
                  console.log(`⏳ Grupo ${grupo}: Faltan ${partidosEsperados - partidosFinalizados.length} partidos por finalizar`);
                }
              }
            }
            
          } catch (error) {
            console.error("❌ Error en verificación automática:", error);
          }
        }, 1000);
      }
      
    } catch (error) {
      console.error("Error al cambiar estado:", error);
      alert("Error al cambiar estado");
    }
  };

  // Función auxiliar para generar desempate automático (grupos de 2 equipos)
  const generarDesempateAutomatico = async (grupo, partidosDelGrupo, matchInfo) => {
    try {
      console.log(`🥅 Generando desempate para grupo ${grupo}...`);
      
      // Obtener los dos equipos del grupo
      const equiposUnicos = new Set();
      partidosDelGrupo.forEach(p => {
        if (p.equipoA) equiposUnicos.add(`${p.equipoA.curso}-${p.equipoA.paralelo}`);
        if (p.equipoB) equiposUnicos.add(`${p.equipoB.curso}-${p.equipoB.paralelo}`);
      });
      
      const equiposArray = Array.from(equiposUnicos);
      const equipo1Key = equiposArray[0];
      const equipo2Key = equiposArray[1];
      
      // Encontrar la info completa de cada equipo
      let equipoInfo1, equipoInfo2;
      
      partidosDelGrupo.forEach(partido => {
        const equipoAKey = `${partido.equipoA.curso}-${partido.equipoA.paralelo}`;
        const equipoBKey = `${partido.equipoB.curso}-${partido.equipoB.paralelo}`;
        
        if (equipoAKey === equipo1Key && !equipoInfo1) {
          equipoInfo1 = partido.equipoA;
        } else if (equipoBKey === equipo1Key && !equipoInfo1) {
          equipoInfo1 = partido.equipoB;
        }
        
        if (equipoAKey === equipo2Key && !equipoInfo2) {
          equipoInfo2 = partido.equipoA;
        } else if (equipoBKey === equipo2Key && !equipoInfo2) {
          equipoInfo2 = partido.equipoB;
        }
      });
      
      // Crear partido de desempate
      const desempateData = {
        disciplina: matchInfo.disciplina || "",
        categoria: matchInfo.categoria || equipoInfo1.categoria || "",
        genero: matchInfo.genero || equipoInfo1.genero || "",
        nivelEducacional: matchInfo.nivelEducacional || equipoInfo1.nivelEducacional || "",
        fase: "desempate",
        grupo: grupo,
        equipoA: equipoInfo1,
        equipoB: equipoInfo2,
        fecha: "",
        hora: "",
        estado: "programado",
        marcadorA: 0,
        marcadorB: 0,
        goleadoresA: [],
        goleadoresB: [],
        observaciones: `Desempate generado automáticamente - Grupo ${grupo} (ida y vuelta empatado)`
      };
      
      // Verificar que no hay campos undefined antes de guardar
      console.log(`🔍 Verificando datos del desempate antes de guardar:`, desempateData);
      
      // Filtrar campos undefined
      const desempateDataLimpio = {};
      Object.keys(desempateData).forEach(key => {
        if (desempateData[key] !== undefined && desempateData[key] !== null) {
          desempateDataLimpio[key] = desempateData[key];
        }
      });
      
      console.log(`✨ Datos limpios del desempate para guardar:`, desempateDataLimpio);
      
      console.log(`💾 Guardando desempate automático:`, desempateDataLimpio);
      
      await addDoc(collection(db, "matches"), desempateDataLimpio);
      
      console.log(`✅ Desempate automático generado para grupo ${grupo}`);
      
      // Mostrar notificación de éxito
      console.log(`🔔 EJECUTANDO showToast para desempate grupo ${grupo}`);
      showToast(
        `🥅 Desempate automático generado para Grupo ${grupo}`, 
        "success"
      );
      console.log(`🔔 showToast de desempate ejecutado correctamente`);
      
    } catch (error) {
      console.error(`❌ Error al generar desempate automático para grupo ${grupo}:`, error);
    }
  };

  // Función auxiliar para generar fases finales automáticas (grupos de 4+ equipos)
  const generarFasesFinalesAutomaticas = async (grupo, partidosDelGrupo, matchInfo) => {
    try {
      console.log(`🏆 Generando fases finales para grupo ${grupo}...`);
      
      // Primero verificar si hay otros grupos en la misma categoría
      const matchesSnapshot = await getDocs(collection(db, "matches"));
      const todosLosPartidos = matchesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Buscar otros grupos con la misma categoría, género, nivel educacional y disciplina
      const gruposEnCategoria = new Set();
      todosLosPartidos.forEach(partido => {
        if (partido.disciplina === matchInfo.disciplina &&
            partido.categoria === matchInfo.categoria &&
            partido.genero === matchInfo.genero &&
            partido.nivelEducacional === matchInfo.nivelEducacional &&
            partido.grupo &&
            partido.fase === "grupos") {
          gruposEnCategoria.add(partido.grupo);
        }
      });
      
      const numeroDeGrupos = gruposEnCategoria.size;
      console.log(`📊 Grupos encontrados en esta categoría: ${Array.from(gruposEnCategoria).join(', ')} (Total: ${numeroDeGrupos})`);
      
      // Calcular clasificación del grupo
      const equipos = {};
      
      partidosDelGrupo.forEach(partido => {
        const equipoA = `${partido.equipoA.curso}-${partido.equipoA.paralelo}`;
        const equipoB = `${partido.equipoB.curso}-${partido.equipoB.paralelo}`;
        
        if (!equipos[equipoA]) {
          equipos[equipoA] = {
            info: partido.equipoA,
            puntos: 0,
            golesFavor: 0,
            golesContra: 0,
            diferencia: 0,
            partidosJugados: 0,
            partidosGanados: 0,
            partidosEmpatados: 0,
            partidosPerdidos: 0
          };
        }
        if (!equipos[equipoB]) {
          equipos[equipoB] = {
            info: partido.equipoB,
            puntos: 0,
            golesFavor: 0,
            golesContra: 0,
            diferencia: 0,
            partidosJugados: 0,
            partidosGanados: 0,
            partidosEmpatados: 0,
            partidosPerdidos: 0
          };
        }
        
        const marcadorA = partido.marcadorA || 0;
        const marcadorB = partido.marcadorB || 0;
        
        equipos[equipoA].golesFavor += marcadorA;
        equipos[equipoA].golesContra += marcadorB;
        equipos[equipoA].partidosJugados += 1;
        
        equipos[equipoB].golesFavor += marcadorB;
        equipos[equipoB].golesContra += marcadorA;
        equipos[equipoB].partidosJugados += 1;
        
        if (marcadorA > marcadorB) {
          equipos[equipoA].puntos += 3;
          equipos[equipoA].partidosGanados += 1;
          equipos[equipoB].partidosPerdidos += 1;
        } else if (marcadorB > marcadorA) {
          equipos[equipoB].puntos += 3;
          equipos[equipoB].partidosGanados += 1;
          equipos[equipoA].partidosPerdidos += 1;
        } else {
          equipos[equipoA].puntos += 1;
          equipos[equipoB].puntos += 1;
          equipos[equipoA].partidosEmpatados += 1;
          equipos[equipoB].partidosEmpatados += 1;
        }
      });
      
      // Calcular diferencia de goles
      Object.values(equipos).forEach(equipo => {
        equipo.diferencia = equipo.golesFavor - equipo.golesContra;
      });
      
      // Ordenar equipos por clasificación (puntos, diferencia de goles, goles a favor)
      const equiposOrdenados = Object.values(equipos).sort((a, b) => {
        if (b.puntos !== a.puntos) return b.puntos - a.puntos;
        if (b.diferencia !== a.diferencia) return b.diferencia - a.diferencia;
        return b.golesFavor - a.golesFavor;
      });
      
      console.log(`📊 Clasificación final del grupo ${grupo}:`, equiposOrdenados.map((e, i) => ({
        posicion: i + 1,
        equipo: `${e.info.curso}-${e.info.paralelo}`,
        puntos: e.puntos,
        diferencia: e.diferencia,
        goles: `${e.golesFavor}-${e.golesContra}`
      })));
      
      console.log(`🔢 Total de equipos en ${grupo}: ${equiposOrdenados.length}`);
      console.log(`🏆 ¿Se generará tercer puesto? ${equiposOrdenados.length >= 4 ? 'SÍ' : 'NO'}`);
      
      if (numeroDeGrupos === 1) {
        // UN SOLO GRUPO: Generar final (1º vs 2º) y tercer puesto (3º vs 4º)
        console.log(`🏆 Un solo grupo detectado - Generando final y tercer puesto`);
        console.log(`📊 Equipos disponibles: ${equiposOrdenados.length}`, equiposOrdenados.map((e, i) => ({
          posicion: i + 1,
          equipo: `${e.info.curso}-${e.info.paralelo}`,
          puntos: e.puntos
        })));
        
        if (equiposOrdenados.length < 2) {
          console.log(`⚠️ No hay suficientes equipos para final (solo ${equiposOrdenados.length})`);
          return;
        }
        
        // Final siempre se genera si hay al menos 2 equipos (1º vs 2º)
        const finalData = {
          disciplina: matchInfo.disciplina || "",
          categoria: matchInfo.categoria || equiposOrdenados[0].info.categoria || "",
          genero: matchInfo.genero || equiposOrdenados[0].info.genero || "",
          nivelEducacional: matchInfo.nivelEducacional || equiposOrdenados[0].info.nivelEducacional || "",
          fase: "final",
          grupo: grupo,
          equipoA: equiposOrdenados[0].info, // 1º
          equipoB: equiposOrdenados[1].info, // 2º
          fecha: "",
          hora: "",
          estado: "programado",
          marcadorA: 0,
          marcadorB: 0,
          goleadoresA: [],
          goleadoresB: [],
          observaciones: `Final generada automáticamente - ${grupo}`
        };
        
        // Filtrar campos undefined para la final
        const finalLimpia = {};
        Object.keys(finalData).forEach(key => {
          if (finalData[key] !== undefined && finalData[key] !== null) {
            finalLimpia[key] = finalData[key];
          }
        });
        
        console.log(`💾 Guardando final:`, finalLimpia);
        
        // Guardar la final
        await addDoc(collection(db, "matches"), finalLimpia);
        console.log(`✅ Final generada automáticamente`);
        
        // Tercer puesto: solo si hay al menos 4 equipos
        if (equiposOrdenados.length >= 4) {
          console.log(`🥉 Generando tercer puesto (4+ equipos disponibles)`);
          console.log(`📋 Equipos para tercer puesto:`);
          console.log(`   3º lugar: ${equiposOrdenados[2].info.curso}-${equiposOrdenados[2].info.paralelo} (${equiposOrdenados[2].puntos} pts)`);
          console.log(`   4º lugar: ${equiposOrdenados[3].info.curso}-${equiposOrdenados[3].info.paralelo} (${equiposOrdenados[3].puntos} pts)`);
          console.log(`📋 Info completa 3º:`, equiposOrdenados[2].info);
          console.log(`📋 Info completa 4º:`, equiposOrdenados[3].info);
          
          const tercerPuestoData = {
            disciplina: matchInfo.disciplina || "",
            categoria: matchInfo.categoria || equiposOrdenados[2].info.categoria || "",
            genero: matchInfo.genero || equiposOrdenados[2].info.genero || "",
            nivelEducacional: matchInfo.nivelEducacional || equiposOrdenados[2].info.nivelEducacional || "",
            fase: "tercerPuesto",
            grupo: grupo,
            equipoA: equiposOrdenados[2].info, // 3º
            equipoB: equiposOrdenados[3].info, // 4º
            fecha: "",
            hora: "",
            estado: "programado",
            marcadorA: 0,
            marcadorB: 0,
            goleadoresA: [],
            goleadoresB: [],
            observaciones: `Tercer puesto generado automáticamente - ${grupo}`
          };
          
          // Filtrar campos undefined para tercer puesto
          const tercerPuestoLimpia = {};
          Object.keys(tercerPuestoData).forEach(key => {
            if (tercerPuestoData[key] !== undefined && tercerPuestoData[key] !== null) {
              tercerPuestoLimpia[key] = tercerPuestoData[key];
            }
          });
          
          console.log(`💾 Guardando tercer puesto:`, tercerPuestoLimpia);
          
          try {
            await addDoc(collection(db, "matches"), tercerPuestoLimpia);
            console.log(`✅ Tercer puesto generado automáticamente`);
            
            // Mostrar notificación completa
            showToast(
              `🏆 Final y tercer puesto generados automáticamente para ${grupo} (${equiposOrdenados.length} equipos)`, 
              "success"
            );
          } catch (error) {
            console.error(`❌ Error al guardar tercer puesto:`, error);
            console.error(`❌ Datos del tercer puesto que falló:`, tercerPuestoLimpia);
            showToast(
              `🏆 Final generada correctamente. ❌ Error al crear tercer puesto para ${grupo}`, 
              "warning"
            );
          }
        } else if (equiposOrdenados.length === 3) {
          console.log(`⚽ Solo 3 equipos - Generando solo final (1º vs 2º)`);
          showToast(
            `🏆 Final generada automáticamente para Grupo ${grupo} (3 equipos)`, 
            "success"
          );
        } else {
          console.log(`⚠️ Solo ${equiposOrdenados.length} equipos - No se genera tercer puesto`);
          showToast(
            `🏆 Final generada automáticamente para ${grupo} (${equiposOrdenados.length} equipos)`, 
            "success"
          );
        }
        
      } else {
        // MÚLTIPLES GRUPOS: NO generar aquí - AdminMatches.jsx se encarga
        console.log(`� Múltiples grupos detectados (${numeroDeGrupos}) - AdminMatches.jsx manejará las semifinales`);
        console.log(`ℹ️ Esta función solo maneja grupos únicos. Las semifinales para múltiples grupos se generan desde AdminMatches.jsx`);
        
        // 🚀 NUEVA FUNCIONALIDAD: Llamar verificación externa
        console.log(`🔥 Ejecutando verificación externa para múltiples grupos...`);
        try {
          await verificarYGenerarFasesFinalesExterna(matchInfo, showToast);
          console.log(`✅ Verificación externa completada`);
        } catch (error) {
          console.error(`❌ Error en verificación externa:`, error);
        }
      }
      
    } catch (error) {
      console.error(`❌ Error al generar fases finales automáticas para grupo ${grupo}:`, error);
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
              {equiposDefinidos() ? (
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
              ) : (
                <div className="admin-privilege-info">
                  <span className="privilege-icon">⏳</span>
                  <span className="privilege-text">Este partido no se puede iniciar hasta que se conozcan los equipos participantes</span>
                </div>
              )}
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
      
      {/* Toast Container */}
      <ToastContainer />
    </div>
  );
}