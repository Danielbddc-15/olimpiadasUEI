import { useEffect, useState, useRef } from "react";
import { db } from "../firebase/config";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";
import { useParams } from "react-router-dom";
import "../styles/AdminMatches.css";
import { useNavigate } from "react-router-dom";

export default function AdminMatches() {
  const { discipline } = useParams();
  const [matches, setMatches] = useState([]);
  const [newMatch, setNewMatch] = useState({
    equipoA: "",
    equipoB: "",
    fecha: "",
    hora: "",
  });
  const [editingMatchId, setEditingMatchId] = useState(null);
  const [editedMatch, setEditedMatch] = useState({ fecha: "", hora: "" });
  const [scoreEdit, setScoreEdit] = useState({});
  const [grupos, setGrupos] = useState([]);
  const [equipos, setEquipos] = useState([]);
  const [faseActual, setFaseActual] = useState(0);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [grupoAEliminar, setGrupoAEliminar] = useState(null);

  const navigate = useNavigate();

  // Función para navegar al detalle del partido
  const irADetallePartido = (matchId) => {
    // Redireccionar según la disciplina
    if (discipline === "voley") {
      navigate(`/admin-voley-match-detail/${matchId}`);
    } else if (discipline === "basquet") {
      navigate(`/admin-basquet-match-detail/${matchId}`);
    } else {
      // Para fútbol y otras disciplinas, mantener la ruta original
      navigate(`/admin/partido/${matchId}`);
    }
  };

  // Funciones de navegación
  const goToTeams = () => {
    navigate(`/admin/${discipline}/equipos`);
  };

  const goToStandings = () => {
    navigate(`/admin/${discipline}/tabla`);
  };

  const goToSchedule = () => {
    navigate(`/admin/${discipline}/horarios`);
  };

  const goToPanel = () => {
    navigate('/admin');
  };

  // Detectar si es fútbol
  const esFutbol = discipline === "futbol";

  // Fases según disciplina - ACTUALIZADO PARA VÓLEY
  const fasesDb = {
    grupos1: "Fase de Grupos 1",
    grupos3: "Fase de Grupos 3",
    semifinales: "Semifinales",
    finales: "Finales",
  };

  // Arrays para la navegación
  const fases = Object.values(fasesDb);
  const fasesArray = Object.keys(fasesDb);

  // Función para obtener el icono de la fase
  const obtenerIconoFase = (faseKey) => {
    if (faseKey.includes("grupos")) return "👥";
    if (faseKey === "semifinales") return "🥈";
    if (faseKey === "finales") return "🏆";
    return "🏅";
  };

  // Función para calcular clasificación por grupo
  const calcularClasificacion = (partidosGrupo) => {
    const equipos = {};
    
    partidosGrupo.forEach((match) => {
      if (match.estado !== "finalizado") return;
      
      const equipoAKey = `${match.equipoA.curso} ${match.equipoA.paralelo}`;
      const equipoBKey = `${match.equipoB.curso} ${match.equipoB.paralelo}`;
      
      if (!equipos[equipoAKey]) {
        equipos[equipoAKey] = {
          nombre: equipoAKey,
          curso: match.equipoA.curso,
          paralelo: match.equipoA.paralelo,
          grupo: match.grupo,
          partidos: 0,
          ganados: 0,
          empatados: 0,
          perdidos: 0,
          puntosAFavor: 0,
          puntosEnContra: 0,
          puntos: 0
        };
      }
      
      if (!equipos[equipoBKey]) {
        equipos[equipoBKey] = {
          nombre: equipoBKey,
          curso: match.equipoB.curso,
          paralelo: match.equipoB.paralelo,
          grupo: match.grupo,
          partidos: 0,
          ganados: 0,
          empatados: 0,
          perdidos: 0,
          puntosAFavor: 0,
          puntosEnContra: 0,
          puntos: 0
        };
      }
      
      const marcadorA = match.marcadorA || 0;
      const marcadorB = match.marcadorB || 0;
      
      equipos[equipoAKey].partidos++;
      equipos[equipoBKey].partidos++;
      equipos[equipoAKey].puntosAFavor += marcadorA;
      equipos[equipoAKey].puntosEnContra += marcadorB;
      equipos[equipoBKey].puntosAFavor += marcadorB;
      equipos[equipoBKey].puntosEnContra += marcadorA;
      
      if (marcadorA > marcadorB) {
        // Equipo A gana
        equipos[equipoAKey].ganados++;
        equipos[equipoAKey].puntos += 3;
        equipos[equipoBKey].perdidos++;
      } else if (marcadorA < marcadorB) {
        // Equipo B gana
        equipos[equipoBKey].ganados++;
        equipos[equipoBKey].puntos += 3;
        equipos[equipoAKey].perdidos++;
      } else {
        // Empate
        equipos[equipoAKey].empatados++;
        equipos[equipoAKey].puntos += 1;
        equipos[equipoBKey].empatados++;
        equipos[equipoBKey].puntos += 1;
      }
    });
    
    // Ordenar según la disciplina
    if (discipline === "voley") {
      // Para vóley: 1) Partidos ganados, 2) Menos puntos en contra
      return Object.values(equipos).sort((a, b) => {
        if (b.ganados !== a.ganados) return b.ganados - a.ganados;
        return a.puntosEnContra - b.puntosEnContra;
      });
    } else {
      // Para fútbol: 1) Puntos, 2) Partidos ganados, 3) Menos puntos en contra
      return Object.values(equipos).sort((a, b) => {
        if (b.puntos !== a.puntos) return b.puntos - a.puntos;
        if (b.ganados !== a.ganados) return b.ganados - a.ganados;
        return a.puntosEnContra - b.puntosEnContra;
      });
    }
  };

  // Función para verificar si una fase está completa
  const verificarFaseCompleta = (fase) => {
    const partidosFase = matches.filter(m => (m.fase || "grupos1") === fase && m.estado === "finalizado");
    
    if (partidosFase.length === 0) return false;
    
    // Si es fase de grupos 1, verificar que todos los partidos estén finalizados
    if (fase === "grupos1") {
      const partidosPendientes = matches.filter(m => (m.fase || "grupos1") === fase && m.estado !== "finalizado");
      return partidosPendientes.length === 0;
    }
    
    // Para fases 2 y 3, verificar que todos los partidos de esa fase estén finalizados
    if (fase === "grupos2" || fase === "grupos3") {
      const partidosPendientes = matches.filter(m => m.fase === fase && m.estado !== "finalizado");
      return partidosPendientes.length === 0;
    }
    
    // Para semifinales y finales, verificar que todos los partidos estén finalizados
    if (fase === "semifinales" || fase === "finales") {
      const partidosPendientes = matches.filter(m => m.fase === fase && m.estado !== "finalizado");
      return partidosPendientes.length === 0;
    }
    
    return false;
  };

  // Función para generar partidos de la siguiente fase automáticamente
  const generarSiguienteFase = async (faseActual) => {
    if (faseActual === "finales") return; // No hay fase después de finales
    
    const fasesSiguientes = {
      "grupos1": "grupos2",
      "grupos2": "grupos3", 
      "grupos3": "semifinales",
      "semifinales": "finales"
    };
    
    const siguienteFase = fasesSiguientes[faseActual];
    if (!siguienteFase) return;
    
    // Verificar si ya existen partidos en la siguiente fase
    const partidosSiguienteFase = matches.filter(m => m.fase === siguienteFase);
    if (partidosSiguienteFase.length > 0) return;
    
    try {
      // Obtener clasificados de la fase actual
      const clasificados = [];
      
      if (faseActual.includes("grupos")) {
        // Para fases de grupos, obtener equipos según la lógica específica
        for (const grupo of grupos) {
          // Obtener todos los partidos finalizados hasta la fase actual
          const partidosCompletos = matches.filter(m => 
            m.grupo === grupo && 
            m.estado === "finalizado" &&
            (m.fase === "grupos1" || m.fase === "grupos2" || m.fase === "grupos3")
          );
          
          if (partidosCompletos.length > 0) {
            const clasificacionGrupo = calcularClasificacion(partidosCompletos);
            
            if (siguienteFase === "grupos2") {
              // Fase 2: Solo equipos que NO tienen 2 partidos jugados
              const equiposParaFase2 = clasificacionGrupo.filter(equipo => equipo.partidos < 2);
              clasificados.push(...equiposParaFase2);
            } else if (siguienteFase === "grupos3") {
              // Fase 3: Solo equipos que NO tienen 3 partidos jugados
              const equiposParaFase3 = clasificacionGrupo.filter(equipo => equipo.partidos < 3);
              clasificados.push(...equiposParaFase3);
            } else if (siguienteFase === "semifinales") {
              // Semifinales: Top 4 de cada grupo, pero solo los que hayan jugado 3 partidos
              const equiposConTresPartidos = clasificacionGrupo.filter(equipo => equipo.partidos === 3);
              clasificados.push(...equiposConTresPartidos.slice(0, 4));
            }
          }
        }
      } else if (faseActual === "semifinales") {
        // Para finales, obtener ganadores de semifinales
        const semifinales = matches.filter(m => m.fase === "semifinales" && m.estado === "finalizado");
        semifinales.forEach(match => {
          const ganador = (match.marcadorA || 0) > (match.marcadorB || 0) 
            ? { curso: match.equipoA.curso, paralelo: match.equipoA.paralelo, grupo: match.grupo }
            : { curso: match.equipoB.curso, paralelo: match.equipoB.paralelo, grupo: match.grupo };
          clasificados.push(ganador);
        });
      }
      
      if (clasificados.length < 2) return;
      
      // Generar partidos para la siguiente fase
      const nuevosPartidos = [];
      
      if (siguienteFase === "finales") {
        // Final: los 2 ganadores de semifinales
        if (clasificados.length >= 2) {
          nuevosPartidos.push({
            equipoA: { curso: clasificados[0].curso, paralelo: clasificados[0].paralelo },
            equipoB: { curso: clasificados[1].curso, paralelo: clasificados[1].paralelo },
            disciplina: discipline,
            marcadorA: 0,
            marcadorB: 0,
            estado: "pendiente",
            fecha: null,
            hora: null,
            grupo: clasificados[0].grupo,
            fase: siguienteFase,
            goleadoresA: [],
            goleadoresB: [],
            ...(discipline === "voley" && {
              sets: Array(5).fill({ A: 0, B: 0 }),
              anotadoresA: [],
              anotadoresB: []
            })
          });
        }
      } else if (siguienteFase === "semifinales") {
        // Semifinales: 1° vs 4°, 2° vs 3° por grupo
        const gruposClasificados = {};
        clasificados.forEach(equipo => {
          if (!gruposClasificados[equipo.grupo]) gruposClasificados[equipo.grupo] = [];
          gruposClasificados[equipo.grupo].push(equipo);
        });
        
        Object.entries(gruposClasificados).forEach(([grupo, equiposGrupo]) => {
          if (equiposGrupo.length >= 4) {
            // 1° vs 4°
            nuevosPartidos.push({
              equipoA: { curso: equiposGrupo[0].curso, paralelo: equiposGrupo[0].paralelo },
              equipoB: { curso: equiposGrupo[3].curso, paralelo: equiposGrupo[3].paralelo },
              disciplina: discipline,
              marcadorA: 0,
              marcadorB: 0,
              estado: "pendiente",
              fecha: null,
              hora: null,
              grupo: grupo,
              fase: siguienteFase,
              goleadoresA: [],
              goleadoresB: [],
              ...(discipline === "voley" && {
                sets: Array(5).fill({ A: 0, B: 0 }),
                anotadoresA: [],
                anotadoresB: []
              })
            });
            
            // 2° vs 3°
            nuevosPartidos.push({
              equipoA: { curso: equiposGrupo[1].curso, paralelo: equiposGrupo[1].paralelo },
              equipoB: { curso: equiposGrupo[2].curso, paralelo: equiposGrupo[2].paralelo },
              disciplina: discipline,
              marcadorA: 0,
              marcadorB: 0,
              estado: "pendiente",
              fecha: null,
              hora: null,
              grupo: grupo,
              fase: siguienteFase,
              goleadoresA: [],
              goleadoresB: [],
              ...(discipline === "voley" && {
                sets: Array(5).fill({ A: 0, B: 0 }),
                anotadoresA: [],
                anotadoresB: []
              })
            });
          }
        });
      } else {
        // Para grupos2 y grupos3: enfrentar equipos según posición en tabla
        const gruposClasificados = {};
        clasificados.forEach(equipo => {
          if (!gruposClasificados[equipo.grupo]) gruposClasificados[equipo.grupo] = [];
          gruposClasificados[equipo.grupo].push(equipo);
        });
        
        Object.entries(gruposClasificados).forEach(([grupo, equiposGrupo]) => {
          // Ordenar equipos por posición (ya vienen ordenados por calcularClasificacion)
          let equiposOrdenados = [...equiposGrupo];
          
          // Si hay número impar de equipos, eliminar el último clasificado
          if (equiposOrdenados.length % 2 !== 0) {
            console.log(`Eliminando último clasificado del ${grupo}: ${equiposOrdenados[equiposOrdenados.length - 1].nombre}`);
            equiposOrdenados.pop(); // Eliminar el último equipo
          }
          
          // Crear partidos basados en posiciones: 1°vs último, 2°vs penúltimo, etc.
          if (equiposOrdenados.length >= 2) {
            for (let i = 0; i < Math.floor(equiposOrdenados.length / 2); i++) {
              const equipoA = equiposOrdenados[i];
              const equipoB = equiposOrdenados[equiposOrdenados.length - 1 - i];
              
              nuevosPartidos.push({
                equipoA: { curso: equipoA.curso, paralelo: equipoA.paralelo },
                equipoB: { curso: equipoB.curso, paralelo: equipoB.paralelo },
                disciplina: discipline,
                marcadorA: 0,
                marcadorB: 0,
                estado: "pendiente",
                fecha: null,
                hora: null,
                grupo: grupo,
                fase: siguienteFase,
                goleadoresA: [],
                goleadoresB: [],
                ...(discipline === "voley" && {
                  sets: siguienteFase.includes("grupos") ? [{ A: 0, B: 0 }] : Array(5).fill({ A: 0, B: 0 }),
                  anotadoresA: [],
                  anotadoresB: []
                })
              });
            }
          }
        });
      }
      
      // Guardar nuevos partidos en Firestore
      if (nuevosPartidos.length > 0) {
        for (const partido of nuevosPartidos) {
          await addDoc(collection(db, "matches"), partido);
        }
        
        console.log(`Generados ${nuevosPartidos.length} partidos para ${fasesDb[siguienteFase]}`);
      }
      
    } catch (error) {
      console.error("Error al generar siguiente fase:", error);
    }
  };

  // Función para obtener equipos clasificados por puntos
  const obtenerClasificacion = async (discipline) => {
    try {
      const matchesQuery = query(
        collection(db, "matches"),
        where("disciplina", "==", discipline),
        where("estado", "==", "finalizado"),
      );
      const matchesSnapshot = await getDocs(matchesQuery);
      const matches = matchesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Calcular puntos por equipo
      const equipos = {};

      matches.forEach((match) => {
        const equipoAKey = `${match.equipoA.curso}${match.equipoA.paralelo}`;
        const equipoBKey = `${match.equipoB.curso}${match.equipoB.paralelo}`;

        if (!equipos[equipoAKey]) {
          equipos[equipoAKey] = {
            curso: match.equipoA.curso,
            paralelo: match.equipoA.paralelo,
            puntos: 0,
            puntosAnotados: 0,
            puntosRecibidos: 0,
            partidos: 0,
          };
        }

        if (!equipos[equipoBKey]) {
          equipos[equipoBKey] = {
            curso: match.equipoB.curso,
            paralelo: match.equipoB.paralelo,
            puntos: 0,
            puntosAnotados: 0,
            puntosRecibidos: 0,
            partidos: 0,
          };
        }

        // Sumar estadísticas
        equipos[equipoAKey].puntosAnotados += match.marcadorA || 0;
        equipos[equipoAKey].puntosRecibidos += match.marcadorB || 0;
        equipos[equipoAKey].partidos++;

        equipos[equipoBKey].puntosAnotados += match.marcadorB || 0;
        equipos[equipoBKey].puntosRecibidos += match.marcadorA || 0;
        equipos[equipoBKey].partidos++;

        // Asignar puntos por victoria/empate/derrota
        if (discipline === "voley") {
          // En vóley no hay empates
          if (match.marcadorA > match.marcadorB) {
            equipos[equipoAKey].puntos += 3;
          } else {
            equipos[equipoBKey].puntos += 3;
          }
        } else {
          // Fútbol
          if (match.marcadorA > match.marcadorB) {
            equipos[equipoAKey].puntos += 3;
          } else if (match.marcadorA < match.marcadorB) {
            equipos[equipoBKey].puntos += 3;
          } else {
            equipos[equipoAKey].puntos += 1;
            equipos[equipoBKey].puntos += 1;
          }
        }
      });

      // Convertir a array y ordenar
      return Object.values(equipos).sort((a, b) => {
        if (b.puntos !== a.puntos) return b.puntos - a.puntos;
        const difA = a.puntosAnotados - a.puntosRecibidos;
        const difB = b.puntosAnotados - b.puntosRecibidos;
        return difB - difA;
      });
    } catch (error) {
      console.error("Error al obtener clasificación:", error);
      return [];
    }
  };

  // Función para recargar partidos
  const fetchMatches = () => {
    // Esta función se ejecuta automáticamente por el onSnapshot en el useEffect
  };

  // Modal para goleador
  const [showGoleadorModal, setShowGoleadorModal] = useState(false);
  const [goleadorNombre, setGoleadorNombre] = useState("");
  const [golMatchId, setGolMatchId] = useState(null);
  const [golEquipo, setGolEquipo] = useState(null);

  // Modal para ver y editar goleadores
  const [showListaGoleadores, setShowListaGoleadores] = useState(false);
  const [editGoleadoresA, setEditGoleadoresA] = useState([]);
  const [editGoleadoresB, setEditGoleadoresB] = useState([]);
  const [editMatchId, setEditMatchId] = useState(null);

  // Para standings y auto-creación de partidos
  const [standingsPorGrupo, setStandingsPorGrupo] = useState({});

  // Obtener grupos desde Firestore
  useEffect(() => {
    const obtenerGrupos = async () => {
      const snapshot = await getDocs(collection(db, "grupos"));
      const data = snapshot.docs.map((doc) => doc.data().nombre);
      setGrupos(data);
    };
    obtenerGrupos();
  }, []);

  // Obtener equipos desde Firestore
  useEffect(() => {
    const obtenerEquipos = async () => {
      const q = query(
        collection(db, "equipos"),
        where("disciplina", "==", discipline),
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => ({
        curso: doc.data().curso,
        paralelo: doc.data().paralelo,
        grupo: doc.data().grupo,
      }));
      setEquipos(data);
    };
    obtenerEquipos();
  }, [discipline]);

  // Obtener partidos en tiempo real
  useEffect(() => {
    const q = query(
      collection(db, "matches"),
      where("disciplina", "==", discipline),
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setMatches(data);
    });
    return () => unsubscribe();
  }, [discipline]);

  // Auto-generación de siguientes fases cuando se completa una fase
  useEffect(() => {
    if (!matches.length || !grupos.length) return;
    
    const verificarYGenerar = async () => {
      // Verificar cada fase para auto-generar la siguiente
      const fasesParaVerificar = ["grupos1", "grupos2", "grupos3", "semifinales"];
      
      for (const fase of fasesParaVerificar) {
        if (verificarFaseCompleta(fase)) {
          await generarSiguienteFase(fase);
        }
      }
    };
    
    verificarYGenerar();
  }, [matches, grupos, discipline]);

  // Calcular standings por grupo
  useEffect(() => {
    const equiposPorGrupo = {};
    equipos.forEach((equipo) => {
      const grupo = equipo.grupo || "Sin grupo";
      if (!equiposPorGrupo[grupo]) equiposPorGrupo[grupo] = [];
      equiposPorGrupo[grupo].push(equipo);
    });

    const standingsPorGrupoTemp = {};
    Object.entries(equiposPorGrupo).forEach(([grupo, equiposGrupo]) => {
      const table = {};
      matches
        .filter(
          (match) =>
            match.estado === "finalizado" &&
            equiposGrupo.some(
              (eq) =>
                `${eq.curso} ${eq.paralelo}` ===
                  `${match.equipoA.curso} ${match.equipoA.paralelo}` ||
                `${eq.curso} ${eq.paralelo}` ===
                  `${match.equipoB.curso} ${match.equipoB.paralelo}`,
            ),
        )
        .forEach((match) => {
          const { equipoA, equipoB, marcadorA, marcadorB } = match;
          if (marcadorA === null || marcadorB === null) return;
          const keyA = `${equipoA.curso} ${equipoA.paralelo}`;
          const keyB = `${equipoB.curso} ${equipoB.paralelo}`;
          if (!table[keyA]) table[keyA] = createTeamEntry(keyA, grupo);
          if (!table[keyB]) table[keyB] = createTeamEntry(keyB, grupo);
          table[keyA].pj++;
          table[keyB].pj++;
          table[keyA].gf += marcadorA;
          table[keyA].gc += marcadorB;
          table[keyB].gf += marcadorB;
          table[keyB].gc += marcadorA;
          if (marcadorA > marcadorB) {
            table[keyA].pts += 3;
            table[keyA].pg++;
            table[keyB].pp++;
          } else if (marcadorA < marcadorB) {
            table[keyB].pts += 3;
            table[keyB].pg++;
            table[keyA].pp++;
          } else {
            table[keyA].pts += 1;
            table[keyB].pts += 1;
            table[keyA].pe++;
            table[keyB].pe++;
          }
        });
      equiposGrupo.forEach((equipo) => {
        const nombre = `${equipo.curso} ${equipo.paralelo}`;
        if (!table[nombre]) {
          table[nombre] = createTeamEntry(nombre, grupo);
        }
      });
      const result = Object.values(table)
        .map((team) => ({
          ...team,
          dg: team.gf - team.gc,
        }))
        .sort((a, b) => b.pts - a.pts || b.dg - a.dg || b.gf - a.gf);
      standingsPorGrupoTemp[grupo] = result;
    });
    setStandingsPorGrupo(standingsPorGrupoTemp);
  }, [matches, equipos]);

  function createTeamEntry(nombre, grupo) {
    return {
      nombre,
      grupo,
      pj: 0,
      pg: 0,
      pe: 0,
      pp: 0,
      gf: 0,
      gc: 0,
      pts: 0,
      dg: 0,
    };
  }

  // --- HANDLERS Y RENDER ---

  // Agregar partido manualmente (solo para fase de grupos)
  const handleAddMatch = async () => {
    if (!newMatch.equipoA || !newMatch.equipoB) {
      alert("Completa los campos de equipos.");
      return;
    }
    // Buscar el grupo del equipoA en la colección de equipos
    const equipoAData = equipos.find(
      (eq) => `${eq.curso} ${eq.paralelo}` === newMatch.equipoA,
    );
    const grupoAsignado = equipoAData?.grupo || "Sin grupo";

    try {
      const partidoData = {
        equipoA: {
          curso: newMatch.equipoA.split(" ")[0],
          paralelo: newMatch.equipoA.split(" ")[1],
        },
        equipoB: {
          curso: newMatch.equipoB.split(" ")[0],
          paralelo: newMatch.equipoB.split(" ")[1],
        },
        disciplina: discipline,
        marcadorA: 0,
        marcadorB: 0,
        estado: "pendiente",
        fecha: newMatch.fecha || null,
        hora: newMatch.hora || null,
        grupo: grupoAsignado,
        fase: "grupos1", // Siempre empezar en grupos1
        goleadoresA: [],
        goleadoresB: [],
      };

      // Solo agregar sets si es vóley
      if (discipline === "voley") {
        partidoData.sets = [{ A: 0, B: 0 }]; // 1 set para grupos1
        partidoData.anotadoresA = [];
        partidoData.anotadoresB = [];
      }

      await addDoc(collection(db, "matches"), partidoData);

      setNewMatch({ equipoA: "", equipoB: "", fecha: "", hora: "" });
    } catch (error) {
      console.error("Error al crear partido:", error);
    }
  };

  // Cambiar marcador
  const handleScoreChange = (id, team, delta) => {
    setScoreEdit((prev) => {
      const prevScore = prev[id] || {
        marcadorA: matches.find((m) => m.id === id)?.marcadorA || 0,
        marcadorB: matches.find((m) => m.id === id)?.marcadorB || 0,
      };
      const newScore = {
        ...prevScore,
        [team]: Math.max(0, prevScore[team] + delta),
      };
      return { ...prev, [id]: newScore };
    });
  };

  // Guardar marcador
  const handleSaveScore = async (id) => {
    const { marcadorA, marcadorB } = scoreEdit[id];
    await updateDoc(doc(db, "matches", id), { marcadorA, marcadorB });
    setScoreEdit((prev) => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
    setMatches((prev) =>
      prev.map((m) => (m.id === id ? { ...m, marcadorA, marcadorB } : m)),
    );
  };

  // Finalizar partido
  const handleFinishMatch = async (id) => {
    await updateDoc(doc(db, "matches", id), { estado: "finalizado" });
    setMatches((prev) =>
      prev.map((m) => (m.id === id ? { ...m, estado: "finalizado" } : m)),
    );
  };

  // Poner partido en curso
  const handleStartMatch = async (id) => {
    await updateDoc(doc(db, "matches", id), { estado: "en curso" });
    setMatches((prev) =>
      prev.map((m) => (m.id === id ? { ...m, estado: "en curso" } : m)),
    );
  };

  // Botón Gol con nombre desde modal
  const handleGol = async (id, equipo, nombre) => {
    if (!nombre) return;
    const matchRef = doc(db, "matches", id);
    const matchDoc = matches.find((m) => m.id === id);
    let goleadoresA = matchDoc.goleadoresA || [];
    let goleadoresB = matchDoc.goleadoresB || [];
    let marcadorA = matchDoc.marcadorA || 0;
    let marcadorB = matchDoc.marcadorB || 0;

    if (equipo === "A") {
      goleadoresA = [...goleadoresA, nombre];
      marcadorA += 1;
    } else {
      goleadoresB = [...goleadoresB, nombre];
      marcadorB += 1;
    }

    await updateDoc(matchRef, {
      marcadorA,
      marcadorB,
      goleadoresA,
      goleadoresB,
    });
    setMatches((prev) =>
      prev.map((m) =>
        m.id === id
          ? { ...m, marcadorA, marcadorB, goleadoresA, goleadoresB }
          : m,
      ),
    );
  };

  const handleDelete = async (id) => {
    await deleteDoc(doc(db, "matches", id));
    setMatches((prev) => prev.filter((m) => m.id !== id));
  };

  const handleEdit = (match) => {
    setEditingMatchId(match.id);
    setEditedMatch({ fecha: match.fecha || "", hora: match.hora || "" });
  };

  const handleSaveEdit = async (id) => {
    await updateDoc(doc(db, "matches", id), {
      fecha: editedMatch.fecha || null,
      hora: editedMatch.hora || null,
    });
    setEditingMatchId(null);
    setMatches((prev) =>
      prev.map((m) =>
        m.id === id
          ? { ...m, fecha: editedMatch.fecha, hora: editedMatch.hora }
          : m,
      ),
    );
  };

  // Agrupar partidos por grupo (usando el campo grupo)
  const agruparPorGrupo = (matches) => {
    const agrupados = {};
    matches.forEach((match) => {
      const grupoAsignado = match.grupo || "Sin grupo";
      if (!agrupados[grupoAsignado]) agrupados[grupoAsignado] = [];
      agrupados[grupoAsignado].push(match);
    });
    return agrupados;
  };

  //boton para eliminar los partidos por grupo
  const handleDeleteGroupMatches = async () => {
    if (!grupoAEliminar) return;
    const partidosGrupo = matches.filter((m) => m.grupo === grupoAEliminar);
    for (const partido of partidosGrupo) {
      await deleteDoc(doc(db, "matches", partido.id));
    }
    setShowConfirmDelete(false);
    setGrupoAEliminar(null);
    setMatches((prev) => prev.filter((m) => m.grupo !== grupoAEliminar));
  };

  // Filtrar partidos por fase
  const partidosPorFase = (fase) =>
    matches.filter((m) => (m.fase || "grupos1") === fase);

  // Abrir modal de goleadores para editar
  const handleOpenGoleadores = (match) => {
    setEditGoleadoresA([...match.goleadoresA]);
    setEditGoleadoresB([...match.goleadoresB]);
    setEditMatchId(match.id);
    setShowListaGoleadores(true);
  };

  // Guardar edición de goleadores
  const handleSaveGoleadoresEdit = async () => {
    const matchRef = doc(db, "matches", editMatchId);
    await updateDoc(matchRef, {
      goleadoresA: editGoleadoresA,
      goleadoresB: editGoleadoresB,
    });
    setShowListaGoleadores(false);
    setMatches((prev) =>
      prev.map((m) =>
        m.id === editMatchId
          ? { ...m, goleadoresA: editGoleadoresA, goleadoresB: editGoleadoresB }
          : m,
      ),
    );
  };

  // Componente para mostrar la tabla de partidos de una fase
  function TablaPartidos({ partidos }) {
    // Agrupa partidos por grupo para cualquier fase
    const partidosPorGrupo = agruparPorGrupo(partidos);
    return (
      <>
        {grupos.map((grupo) =>
          partidosPorGrupo[grupo] && partidosPorGrupo[grupo].length > 0 ? (
            <div key={grupo} className="match-group">
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "1.5rem 0 0.5rem",
                }}
              >
                <h3 style={{ margin: 0 }}>{grupo}</h3>
                {/* Botón eliminar solo para fase de grupos */}
                {fasesArray[faseActual] === "grupos1" && (
                  <button
                    style={{
                      marginLeft: 16,
                      background: "#ef4444",
                      color: "#fff",
                      border: "none",
                      borderRadius: 4,
                      padding: "0.2rem 0.7rem",
                      cursor: "pointer",
                      fontSize: "0.9em",
                    }}
                    onClick={() => {
                      setGrupoAEliminar(grupo);
                      setShowConfirmDelete(true);
                    }}
                  >
                    Eliminar todos los partidos
                  </button>
                )}
              </div>

              <table className="admin-matches-table">
                <thead>
                  <tr>
                    <th>Equipo A</th>
                    <th>Equipo B</th>
                    <th>Marcador</th>
                    <th>Estado</th>
                    <th>Fecha</th>
                    <th>Hora</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {partidosPorGrupo[grupo].map((match) => (
                    <tr
                      key={match.id}
                      onClick={() => irADetallePartido(match.id)}
                      style={{ cursor: "pointer" }}
                      className="admin-clickable-row"
                    >
                      <td>
                        {match.equipoA?.curso} {match.equipoA?.paralelo}
                      </td>
                      <td>
                        {match.equipoB?.curso} {match.equipoB?.paralelo}
                      </td>
                      <td>
                        {match.marcadorA ?? 0} - {match.marcadorB ?? 0}
                      </td>
                      <td>
                        {match.estado === "finalizado" ? (
                          <span style={{ color: "green", fontWeight: "bold" }}>
                            ✅ Finalizado
                          </span>
                        ) : match.estado === "en curso" ? (
                          <span
                            style={{ color: "#2563eb", fontWeight: "bold" }}
                          >
                            🟢 En curso
                          </span>
                        ) : (
                          <span style={{ color: "orange", fontWeight: "bold" }}>
                            ⏳ Pendiente
                          </span>
                        )}
                      </td>
                      <td>
                        {editingMatchId === match.id ? (
                          <input
                            type="date"
                            value={editedMatch.fecha}
                            onChange={(e) =>
                              setEditedMatch({
                                ...editedMatch,
                                fecha: e.target.value,
                              })
                            }
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          match.fecha || "Por definir"
                        )}
                      </td>
                      <td>
                        {editingMatchId === match.id ? (
                          <input
                            type="time"
                            value={editedMatch.hora}
                            onChange={(e) =>
                              setEditedMatch({
                                ...editedMatch,
                                hora: e.target.value,
                              })
                            }
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          match.hora || "Por definir"
                        )}
                      </td>
                      <td>
                        {editingMatchId === match.id ? (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSaveEdit(match.id);
                              }}
                              style={{
                                background: "#22c55e",
                                color: "#fff",
                                border: "none",
                                borderRadius: 4,
                                padding: "0.2rem 0.7rem",
                                cursor: "pointer",
                                marginRight: 4,
                              }}
                            >
                              Guardar
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingMatchId(null);
                              }}
                              style={{
                                background: "#64748b",
                                color: "#fff",
                                border: "none",
                                borderRadius: 4,
                                padding: "0.2rem 0.7rem",
                                cursor: "pointer",
                              }}
                            >
                              Cancelar
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEdit(match);
                              }}
                              style={{
                                background: "#3b82f6",
                                color: "#fff",
                                border: "none",
                                borderRadius: 4,
                                padding: "0.2rem 0.7rem",
                                cursor: "pointer",
                                marginRight: 4,
                              }}
                            >
                              Editar Fecha/Hora
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(match.id);
                              }}
                              style={{
                                background: "#ef4444",
                                color: "#fff",
                                border: "none",
                                borderRadius: 4,
                                padding: "0.2rem 0.7rem",
                                cursor: "pointer",
                              }}
                            >
                              Eliminar
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null,
        )}
      </>
    );
  }

  return (
    <div className="admin-matches-container">
      {/* Header moderno */}
      <div className="admin-header">
        <div className="header-icon">
          {discipline === "futbol"
            ? "⚽"
            : discipline === "voley"
              ? "🏐"
              : "🏀"}
        </div>
        <h1 className="admin-title">Gestión de Partidos</h1>
        <p className="admin-subtitle">
          Administra los encuentros de{" "}
          {discipline === "futbol"
            ? "Fútbol"
            : discipline === "voley"
              ? "Vóley"
              : "Básquet"}
        </p>
      </div>

      {/* Navegación */}
      <div className="navigation-section">
        <button onClick={goToPanel} className="nav-card panel-card">
          <div className="nav-card-icon">🏠</div>
          <div className="nav-card-content">
            <h3 className="nav-card-title">Volver al Panel</h3>
            <p className="nav-card-description">Ir al panel principal</p>
          </div>
          <div className="nav-card-arrow">→</div>
        </button>
        <button onClick={goToTeams} className="nav-card teams-card">
          <div className="nav-card-icon">👥</div>
          <div className="nav-card-content">
            <h3 className="nav-card-title">Gestionar Equipos</h3>
            <p className="nav-card-description">Administrar equipos participantes</p>
          </div>
          <div className="nav-card-arrow">→</div>
        </button>
        <button onClick={goToStandings} className="nav-card standings-card">
          <div className="nav-card-icon">🏆</div>
          <div className="nav-card-content">
            <h3 className="nav-card-title">Ver Posiciones</h3>
            <p className="nav-card-description">Consultar tabla de posiciones</p>
          </div>
          <div className="nav-card-arrow">→</div>
        </button>
        <button onClick={goToSchedule} className="nav-card schedule-card">
          <div className="nav-card-icon">📅</div>
          <div className="nav-card-content">
            <h3 className="nav-card-title">Gestionar Horarios</h3>
            <p className="nav-card-description">Programar partidos por días</p>
          </div>
          <div className="nav-card-arrow">→</div>
        </button>
      </div>

      {/* Formulario de creación de partidos */}
      <div className="create-match-section">
        <h2 className="section-title">
          <span className="section-icon">➕</span>
          Programar Nuevo Partido
        </h2>

        <div className="create-match-form">
          <div className="form-grid">
            <div className="input-group">
              <label className="input-label">
                <span className="label-icon">🏠</span>
                Equipo Local
              </label>
              <select
                value={newMatch.equipoA}
                onChange={(e) =>
                  setNewMatch({ ...newMatch, equipoA: e.target.value })
                }
                className="modern-select"
              >
                <option value="">Selecciona equipo local</option>
                {equipos.map((eq, idx) => (
                  <option key={idx} value={`${eq.curso} ${eq.paralelo}`}>
                    {eq.curso} {eq.paralelo} ({eq.grupo})
                  </option>
                ))}
              </select>
            </div>

            <div className="input-group">
              <label className="input-label">
                <span className="label-icon">✈️</span>
                Equipo Visitante
              </label>
              <select
                value={newMatch.equipoB}
                onChange={(e) =>
                  setNewMatch({ ...newMatch, equipoB: e.target.value })
                }
                className="modern-select"
              >
                <option value="">Selecciona equipo visitante</option>
                {equipos.map((eq, idx) => (
                  <option key={idx} value={`${eq.curso} ${eq.paralelo}`}>
                    {eq.curso} {eq.paralelo} ({eq.grupo})
                  </option>
                ))}
              </select>
            </div>

            <div className="input-group">
              <label className="input-label">
                <span className="label-icon">📅</span>
                Fecha
              </label>
              <input
                type="date"
                value={newMatch.fecha}
                onChange={(e) =>
                  setNewMatch({ ...newMatch, fecha: e.target.value })
                }
                className="modern-input"
              />
            </div>

            <div className="input-group">
              <label className="input-label">
                <span className="label-icon">⏰</span>
                Hora
              </label>
              <input
                type="time"
                value={newMatch.hora}
                onChange={(e) =>
                  setNewMatch({ ...newMatch, hora: e.target.value })
                }
                className="modern-input"
              />
            </div>

            <button onClick={handleAddMatch} className="create-match-btn">
              <span className="btn-icon">🎯</span>
              <span>Programar Partido</span>
            </button>
          </div>
        </div>
      </div>

      {/* Navegador de fases */}
      <div className="phase-navigation">
        <div className="phase-controls">
          <button
            onClick={() => setFaseActual((f) => Math.max(0, f - 1))}
            disabled={faseActual === 0}
            className={`phase-btn prev-btn ${faseActual === 0 ? "disabled" : ""}`}
          >
            <span className="btn-icon">←</span>
          </button>

          <div className="current-phase">
            <span className="phase-icon">
              {obtenerIconoFase(fasesArray[faseActual])}
            </span>
            <h2 className="phase-title">{fases[faseActual]}</h2>
            
            {/* Indicador de fase completa */}
            {verificarFaseCompleta(fasesArray[faseActual]) && fasesArray[faseActual] !== "finales" && (
              <div style={{ 
                background: "#10b981", 
                color: "white", 
                padding: "0.25rem 0.75rem", 
                borderRadius: "12px", 
                fontSize: "0.8rem",
                marginTop: "0.5rem",
                display: "inline-block"
              }}>
                ✅ Fase completada - Siguiente fase generada automáticamente
              </div>
            )}
          </div>

          <button
            onClick={() =>
              setFaseActual((f) => Math.min(fases.length - 1, f + 1))
            }
            disabled={faseActual === fases.length - 1}
            className={`phase-btn next-btn ${faseActual === fases.length - 1 ? "disabled" : ""}`}
          >
            <span className="btn-icon">→</span>
          </button>
        </div>
      </div>

      {/* Mostrar solo la tabla de la fase actual */}
      <div className="matches-table-section">
        <TablaPartidos partidos={partidosPorFase(fasesArray[faseActual])} />
      </div>

      {/* Modal para ingresar nombre del goleador */}
      {showGoleadorModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(0,0,0,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: "#fff",
              padding: "2rem",
              borderRadius: "10px",
              boxShadow: "0 2px 16px #0002",
              minWidth: 300,
            }}
          >
            <h3>¿Quién anotó el gol?</h3>
            <input
              type="text"
              value={goleadorNombre}
              onChange={(e) => setGoleadorNombre(e.target.value)}
              placeholder="Nombre del goleador"
              style={{
                width: "100%",
                padding: "0.5rem",
                margin: "1rem 0",
                fontSize: "1rem",
              }}
              autoFocus
            />
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "1rem",
              }}
            >
              <button
                onClick={() => setShowGoleadorModal(false)}
                style={{
                  background: "#eee",
                  border: "none",
                  borderRadius: 4,
                  padding: "0.5rem 1rem",
                  cursor: "pointer",
                }}
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  if (!goleadorNombre.trim()) return;
                  await handleGol(golMatchId, golEquipo, goleadorNombre.trim());
                  setShowGoleadorModal(false);
                }}
                style={{
                  background: "#22c55e",
                  color: "#fff",
                  border: "none",
                  borderRadius: 4,
                  padding: "0.5rem 1rem",
                  cursor: "pointer",
                }}
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para ver y editar goleadores */}
      {showListaGoleadores && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(0,0,0,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: "#fff",
              padding: "2rem",
              borderRadius: "10px",
              boxShadow: "0 2px 16px #0002",
              minWidth: 350,
            }}
          >
            <h3>Goleadores del partido</h3>
            <div style={{ marginBottom: 16 }}>
              <b>
                Goleadores{" "}
                {
                  equipos.find(
                    (eq) =>
                      `${eq.curso} ${eq.paralelo}` ===
                      `${matches.find((m) => m.id === editMatchId)?.equipoA?.curso} ${matches.find((m) => m.id === editMatchId)?.equipoA?.paralelo}`,
                  )?.curso
                }{" "}
                {
                  equipos.find(
                    (eq) =>
                      `${eq.curso} ${eq.paralelo}` ===
                      `${matches.find((m) => m.id === editMatchId)?.equipoA?.curso} ${matches.find((m) => m.id === editMatchId)?.equipoA?.paralelo}`,
                  )?.paralelo
                }
                :
              </b>
              {editGoleadoresA.length > 0 ? (
                editGoleadoresA.map((g, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      margin: "4px 0",
                    }}
                  >
                    <input
                      type="text"
                      value={g}
                      onChange={(e) => {
                        const nuevos = [...editGoleadoresA];
                        nuevos[idx] = e.target.value;
                        setEditGoleadoresA(nuevos);
                      }}
                      style={{ flex: 1, padding: "0.2rem" }}
                    />
                  </div>
                ))
              ) : (
                <div style={{ color: "#888" }}>Sin goles</div>
              )}
            </div>
            <div style={{ marginBottom: 16 }}>
              <b>
                Goleadores{" "}
                {
                  equipos.find(
                    (eq) =>
                      `${eq.curso} ${eq.paralelo}` ===
                      `${matches.find((m) => m.id === editMatchId)?.equipoB?.curso} ${matches.find((m) => m.id === editMatchId)?.equipoB?.paralelo}`,
                  )?.curso
                }{" "}
                {
                  equipos.find(
                    (eq) =>
                      `${eq.curso} ${eq.paralelo}` ===
                      `${matches.find((m) => m.id === editMatchId)?.equipoB?.curso} ${matches.find((m) => m.id === editMatchId)?.equipoB?.paralelo}`,
                  )?.paralelo
                }
                :
              </b>
              {editGoleadoresB.length > 0 ? (
                editGoleadoresB.map((g, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      margin: "4px 0",
                    }}
                  >
                    <input
                      type="text"
                      value={g}
                      onChange={(e) => {
                        const nuevos = [...editGoleadoresB];
                        nuevos[idx] = e.target.value;
                        setEditGoleadoresB(nuevos);
                      }}
                      style={{ flex: 1, padding: "0.2rem" }}
                    />
                  </div>
                ))
              ) : (
                <div style={{ color: "#888" }}>Sin goles</div>
              )}
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "1rem",
              }}
            >
              <button
                onClick={() => setShowListaGoleadores(false)}
                style={{
                  background: "#eee",
                  border: "none",
                  borderRadius: 4,
                  padding: "0.5rem 1rem",
                  cursor: "pointer",
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveGoleadoresEdit}
                style={{
                  background: "#22c55e",
                  color: "#fff",
                  border: "none",
                  borderRadius: 4,
                  padding: "0.5rem 1rem",
                  cursor: "pointer",
                }}
              >
                Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmación para eliminar grupo */}
      {showConfirmDelete && (
        <div className="modal-overlay">
          <div className="confirmation-modal">
            <div className="modal-icon">⚠️</div>
            <h3 className="modal-title">¿Estás seguro?</h3>
            <p className="modal-text">
              ¿Seguro que quieres eliminar <strong>todos los partidos</strong>{" "}
              del grupo <strong>{grupoAEliminar}</strong>?
              <br />
              Esta acción no se puede deshacer.
            </p>
            <div className="modal-actions">
              <button
                onClick={() => setShowConfirmDelete(false)}
                className="cancel-btn"
              >
                <span className="btn-icon">❌</span>
                Cancelar
              </button>
              <button
                onClick={handleDeleteGroupMatches}
                className="confirm-delete-btn"
              >
                <span className="btn-icon">🗑️</span>
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
