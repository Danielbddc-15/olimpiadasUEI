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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
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
  const [categorias, setCategorias] = useState([]);
  const [filtroGenero, setFiltroGenero] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [filtroGrupos, setFiltroGrupos] = useState([]);
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

  // Nuevo sistema de fases simplificado
  const fasesDb = {
    grupos: "Fase de Grupos",
    semifinales: "Semifinales",
    final: "Final",
    tercerPuesto: "Tercer Puesto",
  };

  // Arrays para la navegación
  const fases = Object.values(fasesDb);
  const fasesArray = Object.keys(fasesDb);

  // Función para obtener el icono de la fase
  const obtenerIconoFase = (faseKey) => {
    if (faseKey === "grupos") return "👥";
    if (faseKey === "semifinales") return "🥈";
    if (faseKey === "final") return "🏆";
    if (faseKey === "tercerPuesto") return "🥉";
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

  // Función para generar partidos "todos contra todos" para grupos
  const generarPartidosGrupos = async () => {
    if (!filtroGenero || !filtroCategoria) {
      alert("Primero selecciona género y categoría para generar partidos");
      return;
    }

    try {
      // Obtener equipos filtrados por género y categoría
      const equiposFiltrados = equipos.filter(eq => 
        eq.genero === filtroGenero && eq.categoria === filtroCategoria
      );

      if (equiposFiltrados.length < 2) {
        alert("Se necesitan al menos 2 equipos para generar partidos");
        return;
      }

      // Agrupar equipos por grupo
      const equiposPorGrupo = {};
      equiposFiltrados.forEach(equipo => {
        const grupo = equipo.grupo || "Sin grupo";
        if (!equiposPorGrupo[grupo]) {
          equiposPorGrupo[grupo] = [];
        }
        equiposPorGrupo[grupo].push(equipo);
      });

      let partidosCreados = 0;

      // Generar partidos "todos contra todos" para cada grupo
      for (const [nombreGrupo, equiposGrupo] of Object.entries(equiposPorGrupo)) {
        if (equiposGrupo.length < 2) continue;

        // Verificar si ya existen partidos para este grupo, género y categoría
        const partidosExistentes = matches.filter(m => 
          m.grupo === nombreGrupo && 
          m.equipoA?.genero === filtroGenero && 
          m.equipoA?.categoria === filtroCategoria &&
          m.fase === "grupos"
        );

        if (partidosExistentes.length > 0) {
          if (!window.confirm(`Ya existen partidos para el grupo "${nombreGrupo}" en la categoría "${filtroCategoria}" (${filtroGenero}). ¿Deseas continuar y crear más partidos?`)) {
            continue;
          }
        }

        // Generar todos los enfrentamientos posibles (todos contra todos)
        for (let i = 0; i < equiposGrupo.length; i++) {
          for (let j = i + 1; j < equiposGrupo.length; j++) {
            const equipoA = equiposGrupo[i];
            const equipoB = equiposGrupo[j];

            // Verificar si ya existe este enfrentamiento
            const enfrentamientoExiste = matches.some(m => 
              m.grupo === nombreGrupo &&
              ((m.equipoA?.curso === equipoA.curso && m.equipoA?.paralelo === equipoA.paralelo &&
                m.equipoB?.curso === equipoB.curso && m.equipoB?.paralelo === equipoB.paralelo) ||
               (m.equipoA?.curso === equipoB.curso && m.equipoA?.paralelo === equipoB.paralelo &&
                m.equipoB?.curso === equipoA.curso && m.equipoB?.paralelo === equipoA.paralelo))
            );

            if (!enfrentamientoExiste) {
              await addDoc(collection(db, "matches"), {
                equipoA: {
                  curso: equipoA.curso,
                  paralelo: equipoA.paralelo,
                  genero: equipoA.genero,
                  categoria: equipoA.categoria
                },
                equipoB: {
                  curso: equipoB.curso,
                  paralelo: equipoB.paralelo,
                  genero: equipoB.genero,
                  categoria: equipoB.categoria
                },
                grupo: nombreGrupo,
                fase: "grupos",
                estado: "programado",
                disciplina: discipline,
                marcadorA: 0,
                marcadorB: 0,
                fecha: "",
                hora: "",
                goleadoresA: [],
                goleadoresB: []
              });
              partidosCreados++;
            }
          }
        }
      }

      if (partidosCreados > 0) {
        alert(`Se crearon ${partidosCreados} partidos para la fase de grupos`);
      } else {
        alert("No se crearon partidos nuevos. Puede que ya existan todos los enfrentamientos.");
      }

    } catch (error) {
      console.error("Error al generar partidos:", error);
      alert("Error al generar partidos");
    }
  };

  // Función para generar semifinales, final y tercer puesto
  const generarFasesFinales = async () => {
    if (!filtroGenero || !filtroCategoria) {
      alert("Primero selecciona género y categoría");
      return;
    }

    try {
      // Obtener equipos de la categoría y género seleccionado
      const equiposFiltrados = equipos.filter(eq => 
        eq.genero === filtroGenero && eq.categoria === filtroCategoria
      );

      // Agrupar equipos por grupo
      const equiposPorGrupo = {};
      equiposFiltrados.forEach(equipo => {
        const grupo = equipo.grupo || "Sin grupo";
        if (!equiposPorGrupo[grupo]) {
          equiposPorGrupo[grupo] = [];
        }
        equiposPorGrupo[grupo].push(equipo);
      });

      const gruposConEquipos = Object.keys(equiposPorGrupo).filter(g => equiposPorGrupo[g].length >= 2);

      if (gruposConEquipos.length < 1) {
        alert("No hay suficientes grupos con equipos para generar fases finales");
        return;
      }

      // Calcular clasificaciones de cada grupo
      const clasificaciones = {};
      for (const grupo of gruposConEquipos) {
        const partidosGrupo = matches.filter(m => 
          m.grupo === grupo && 
          m.equipoA?.genero === filtroGenero && 
          m.equipoA?.categoria === filtroCategoria &&
          m.fase === "grupos" &&
          m.estado === "finalizado"
        );
        
        if (partidosGrupo.length === 0) {
          alert(`El grupo "${grupo}" no tiene partidos finalizados. Completa los partidos de grupos primero.`);
          return;
        }

        clasificaciones[grupo] = calcularClasificacion(partidosGrupo);
      }

      let partidosCreados = 0;
      const tipoFormato = gruposConEquipos.length === 2 ? "cruzado" : "directo";

      if (gruposConEquipos.length === 2) {
        // Hay 2 grupos: Semifinales cruzadas + Final + Tercer puesto
        const opcion = window.confirm(
          "Hay 2 grupos. ¿Quieres semifinales CRUZADAS?\n" +
          "Aceptar: 1°GrupoA vs 2°GrupoB y 1°GrupoB vs 2°GrupoA\n" +
          "Cancelar: 1°GrupoA vs 1°GrupoB y 2°GrupoA vs 2°GrupoB"
        );

        const [grupo1, grupo2] = gruposConEquipos;
        const primeroGrupo1 = clasificaciones[grupo1][0];
        const segundoGrupo1 = clasificaciones[grupo1][1];
        const primeroGrupo2 = clasificaciones[grupo2][0];
        const segundoGrupo2 = clasificaciones[grupo2][1];

        if (!primeroGrupo1 || !segundoGrupo1 || !primeroGrupo2 || !segundoGrupo2) {
          alert("No hay suficientes equipos clasificados en las posiciones necesarias");
          return;
        }

        // Generar semifinales
        if (opcion) {
          // Cruzado
          await addDoc(collection(db, "matches"), {
            equipoA: { curso: primeroGrupo1.curso, paralelo: primeroGrupo1.paralelo, genero: filtroGenero, categoria: filtroCategoria },
            equipoB: { curso: segundoGrupo2.curso, paralelo: segundoGrupo2.paralelo, genero: filtroGenero, categoria: filtroCategoria },
            grupo: `${filtroCategoria} - ${filtroGenero}`,
            fase: "semifinales",
            estado: "programado",
            disciplina: discipline,
            marcadorA: 0, marcadorB: 0, fecha: "", hora: "", goleadoresA: [], goleadoresB: []
          });

          await addDoc(collection(db, "matches"), {
            equipoA: { curso: primeroGrupo2.curso, paralelo: primeroGrupo2.paralelo, genero: filtroGenero, categoria: filtroCategoria },
            equipoB: { curso: segundoGrupo1.curso, paralelo: segundoGrupo1.paralelo, genero: filtroGenero, categoria: filtroCategoria },
            grupo: `${filtroCategoria} - ${filtroGenero}`,
            fase: "semifinales",
            estado: "programado",
            disciplina: discipline,
            marcadorA: 0, marcadorB: 0, fecha: "", hora: "", goleadoresA: [], goleadoresB: []
          });
        } else {
          // Directo
          await addDoc(collection(db, "matches"), {
            equipoA: { curso: primeroGrupo1.curso, paralelo: primeroGrupo1.paralelo, genero: filtroGenero, categoria: filtroCategoria },
            equipoB: { curso: primeroGrupo2.curso, paralelo: primeroGrupo2.paralelo, genero: filtroGenero, categoria: filtroCategoria },
            grupo: `${filtroCategoria} - ${filtroGenero}`,
            fase: "semifinales",
            estado: "programado",
            disciplina: discipline,
            marcadorA: 0, marcadorB: 0, fecha: "", hora: "", goleadoresA: [], goleadoresB: []
          });

          await addDoc(collection(db, "matches"), {
            equipoA: { curso: segundoGrupo1.curso, paralelo: segundoGrupo1.paralelo, genero: filtroGenero, categoria: filtroCategoria },
            equipoB: { curso: segundoGrupo2.curso, paralelo: segundoGrupo2.paralelo, genero: filtroGenero, categoria: filtroCategoria },
            grupo: `${filtroCategoria} - ${filtroGenero}`,
            fase: "semifinales",
            estado: "programado",
            disciplina: discipline,
            marcadorA: 0, marcadorB: 0, fecha: "", hora: "", goleadoresA: [], goleadoresB: []
          });
        }
        partidosCreados += 2;

        // Crear partidos de final y tercer puesto (se definirán después de semifinales)
        await addDoc(collection(db, "matches"), {
          equipoA: { curso: "TBD", paralelo: "Ganador SF1", genero: filtroGenero, categoria: filtroCategoria },
          equipoB: { curso: "TBD", paralelo: "Ganador SF2", genero: filtroGenero, categoria: filtroCategoria },
          grupo: `${filtroCategoria} - ${filtroGenero}`,
          fase: "final",
          estado: "programado",
          disciplina: discipline,
          marcadorA: 0, marcadorB: 0, fecha: "", hora: "", goleadoresA: [], goleadoresB: []
        });

        await addDoc(collection(db, "matches"), {
          equipoA: { curso: "TBD", paralelo: "Perdedor SF1", genero: filtroGenero, categoria: filtroCategoria },
          equipoB: { curso: "TBD", paralelo: "Perdedor SF2", genero: filtroGenero, categoria: filtroCategoria },
          grupo: `${filtroCategoria} - ${filtroGenero}`,
          fase: "tercerPuesto",
          estado: "programado",
          disciplina: discipline,
          marcadorA: 0, marcadorB: 0, fecha: "", hora: "", goleadoresA: [], goleadoresB: []
        });
        partidosCreados += 2;

      } else if (gruposConEquipos.length === 1) {
        // Solo hay 1 grupo: Los 2 primeros van directo a final, 3° y 4° al tercer puesto
        const grupo = gruposConEquipos[0];
        const clasificacion = clasificaciones[grupo];
        
        if (clasificacion.length < 2) {
          alert("No hay suficientes equipos en el grupo para generar una final");
          return;
        }

        const primero = clasificacion[0];
        const segundo = clasificacion[1];

        // Crear final
        await addDoc(collection(db, "matches"), {
          equipoA: { curso: primero.curso, paralelo: primero.paralelo, genero: filtroGenero, categoria: filtroCategoria },
          equipoB: { curso: segundo.curso, paralelo: segundo.paralelo, genero: filtroGenero, categoria: filtroCategoria },
          grupo: `${filtroCategoria} - ${filtroGenero}`,
          fase: "final",
          estado: "programado",
          disciplina: discipline,
          marcadorA: 0, marcadorB: 0, fecha: "", hora: "", goleadoresA: [], goleadoresB: []
        });
        partidosCreados++;

        // Si hay 3° y 4°, crear partido por tercer puesto
        if (clasificacion.length >= 4) {
          const tercero = clasificacion[2];
          const cuarto = clasificacion[3];
          
          await addDoc(collection(db, "matches"), {
            equipoA: { curso: tercero.curso, paralelo: tercero.paralelo, genero: filtroGenero, categoria: filtroCategoria },
            equipoB: { curso: cuarto.curso, paralelo: cuarto.paralelo, genero: filtroGenero, categoria: filtroCategoria },
            grupo: `${filtroCategoria} - ${filtroGenero}`,
            fase: "tercerPuesto",
            estado: "programado",
            disciplina: discipline,
            marcadorA: 0, marcadorB: 0, fecha: "", hora: "", goleadoresA: [], goleadoresB: []
          });
          partidosCreados++;
        }
      }

      if (partidosCreados > 0) {
        alert(`Se crearon ${partidosCreados} partidos para las fases finales`);
      } else {
        alert("No se pudieron crear partidos");
      }

    } catch (error) {
      console.error("Error al generar fases finales:", error);
      alert("Error al generar fases finales");
    }
  };

  // Función para generar fases finales automáticamente cuando se completa la fase de grupos
  const generarFasesFinalesAutomatico = async (nombreGrupo, equiposOrdenados, totalGrupos) => {
    try {
      let partidosCreados = 0;
      console.log(`🎯 Generando fases finales para grupo ${nombreGrupo} con ${equiposOrdenados.length} equipos`);

      if (totalGrupos >= 2) {
        // 2 o más grupos: Los 2 primeros de cada grupo van a semifinales inter-grupos
        if (equiposOrdenados.length < 2) return;

        const primero = equiposOrdenados[0];
        const segundo = equiposOrdenados[1];

        console.log(`📋 Grupo ${nombreGrupo} completado. Clasificados: 1° ${primero.nombre}, 2° ${segundo.nombre}`);
        // Para múltiples grupos, las semifinales se crean cuando todos los grupos terminan
        
      } else if (totalGrupos === 1) {
        // Solo 1 grupo: Los 2 primeros van directo a final, 3° y 4° al tercer puesto
        if (equiposOrdenados.length < 2) return;

        const primero = equiposOrdenados[0];
        const segundo = equiposOrdenados[1];

        console.log(`🏆 Creando final para grupo único: ${primero.nombre} vs ${segundo.nombre}`);

        // Buscar equipos en la base de datos
        const equipoPrimero = equipos.find(eq => 
          `${eq.curso} ${eq.paralelo}` === primero.nombre &&
          eq.genero === filtroGenero && 
          eq.categoria === filtroCategoria
        );
        const equipoSegundo = equipos.find(eq => 
          `${eq.curso} ${eq.paralelo}` === segundo.nombre &&
          eq.genero === filtroGenero && 
          eq.categoria === filtroCategoria
        );

        if (!equipoPrimero || !equipoSegundo) {
          console.error("❌ No se encontraron los equipos para la final:", { primero: primero.nombre, segundo: segundo.nombre });
          return;
        }

        // Crear final
        await addDoc(collection(db, "matches"), {
          equipoA: { 
            curso: equipoPrimero.curso, 
            paralelo: equipoPrimero.paralelo, 
            genero: filtroGenero, 
            categoria: filtroCategoria 
          },
          equipoB: { 
            curso: equipoSegundo.curso, 
            paralelo: equipoSegundo.paralelo, 
            genero: filtroGenero, 
            categoria: filtroCategoria 
          },
          grupo: nombreGrupo,
          fase: "final",
          estado: "programado",
          disciplina: discipline,
          marcadorA: 0, 
          marcadorB: 0, 
          fecha: "", 
          hora: "", 
          goleadoresA: [], 
          goleadoresB: []
        });
        partidosCreados++;
        console.log("✅ Final creada exitosamente");

        // Si hay 3° y 4°, crear partido por tercer puesto
        if (equiposOrdenados.length >= 4) {
          const tercero = equiposOrdenados[2];
          const cuarto = equiposOrdenados[3];
          
          console.log(`🥉 Creando partido por 3er puesto: ${tercero.nombre} vs ${cuarto.nombre}`);
          
          const equipoTercero = equipos.find(eq => 
            `${eq.curso} ${eq.paralelo}` === tercero.nombre &&
            eq.genero === filtroGenero && 
            eq.categoria === filtroCategoria
          );
          const equipoCuarto = equipos.find(eq => 
            `${eq.curso} ${eq.paralelo}` === cuarto.nombre &&
            eq.genero === filtroGenero && 
            eq.categoria === filtroCategoria
          );

          if (equipoTercero && equipoCuarto) {
            await addDoc(collection(db, "matches"), {
              equipoA: { 
                curso: equipoTercero.curso, 
                paralelo: equipoTercero.paralelo, 
                genero: filtroGenero, 
                categoria: filtroCategoria 
              },
              equipoB: { 
                curso: equipoCuarto.curso, 
                paralelo: equipoCuarto.paralelo, 
                genero: filtroGenero, 
                categoria: filtroCategoria 
              },
              grupo: nombreGrupo,
              fase: "tercerPuesto",
              estado: "programado",
              disciplina: discipline,
              marcadorA: 0, 
              marcadorB: 0, 
              fecha: "", 
              hora: "", 
              goleadoresA: [], 
              goleadoresB: []
            });
            partidosCreados++;
            console.log("✅ Partido por 3er puesto creado exitosamente");
          }
        }
      }

      if (partidosCreados > 0) {
        console.log(`🎉 Se crearon ${partidosCreados} partidos de fases finales automáticamente`);
        alert(`Se generaron automáticamente ${partidosCreados} partidos de fases finales para ${nombreGrupo}`);
      }

    } catch (error) {
      console.error("❌ Error al generar fases finales automáticamente:", error);
      alert("Error al generar fases finales automáticamente");
    }
  };

  // Función para generar semifinales cuando múltiples grupos han terminado
  const generarSemifinalesMultiplesGrupos = async (clasificadosPorGrupo) => {
    try {
      const gruposNombres = Object.keys(clasificadosPorGrupo);
      if (gruposNombres.length < 2) return;

      // Tomar los 2 primeros de cada grupo
      const grupo1 = gruposNombres[0];
      const grupo2 = gruposNombres[1];
      
      const primerosGrupo1 = clasificadosPorGrupo[grupo1].slice(0, 2);
      const primerosGrupo2 = clasificadosPorGrupo[grupo2].slice(0, 2);

      if (primerosGrupo1.length < 2 || primerosGrupo2.length < 2) return;

      // Buscar equipos en la base de datos
      const buscarEquipo = (nombreEquipo) => {
        return equipos.find(eq => 
          `${eq.curso} ${eq.paralelo}` === nombreEquipo &&
          eq.genero === filtroGenero && 
          eq.categoria === filtroCategoria
        );
      };

      const equipoPrimeroGrupo1 = buscarEquipo(primerosGrupo1[0].nombre);
      const equipoSegundoGrupo1 = buscarEquipo(primerosGrupo1[1].nombre);
      const equipoPrimeroGrupo2 = buscarEquipo(primerosGrupo2[0].nombre);
      const equipoSegundoGrupo2 = buscarEquipo(primerosGrupo2[1].nombre);

      if (!equipoPrimeroGrupo1 || !equipoSegundoGrupo1 || !equipoPrimeroGrupo2 || !equipoSegundoGrupo2) {
        console.error("No se encontraron todos los equipos para las semifinales");
        return;
      }

      // Crear semifinales cruzadas: 1°A vs 2°B, 1°B vs 2°A
      await addDoc(collection(db, "matches"), {
        equipoA: { curso: equipoPrimeroGrupo1.curso, paralelo: equipoPrimeroGrupo1.paralelo, genero: filtroGenero, categoria: filtroCategoria },
        equipoB: { curso: equipoSegundoGrupo2.curso, paralelo: equipoSegundoGrupo2.paralelo, genero: filtroGenero, categoria: filtroCategoria },
        grupo: `${filtroCategoria} - ${filtroGenero}`,
        fase: "semifinales",
        estado: "programado",
        disciplina: discipline,
        marcadorA: 0, marcadorB: 0, fecha: "", hora: "", goleadoresA: [], goleadoresB: []
      });

      await addDoc(collection(db, "matches"), {
        equipoA: { curso: equipoPrimeroGrupo2.curso, paralelo: equipoPrimeroGrupo2.paralelo, genero: filtroGenero, categoria: filtroCategoria },
        equipoB: { curso: equipoSegundoGrupo1.curso, paralelo: equipoSegundoGrupo1.paralelo, genero: filtroGenero, categoria: filtroCategoria },
        grupo: `${filtroCategoria} - ${filtroGenero}`,
        fase: "semifinales",
        estado: "programado",
        disciplina: discipline,
        marcadorA: 0, marcadorB: 0, fecha: "", hora: "", goleadoresA: [], goleadoresB: []
      });

      // Crear placeholders para final y tercer puesto
      await addDoc(collection(db, "matches"), {
        equipoA: { curso: "TBD", paralelo: "Ganador SF1", genero: filtroGenero, categoria: filtroCategoria },
        equipoB: { curso: "TBD", paralelo: "Ganador SF2", genero: filtroGenero, categoria: filtroCategoria },
        grupo: `${filtroCategoria} - ${filtroGenero}`,
        fase: "final",
        estado: "programado",
        disciplina: discipline,
        marcadorA: 0, marcadorB: 0, fecha: "", hora: "", goleadoresA: [], goleadoresB: []
      });

      await addDoc(collection(db, "matches"), {
        equipoA: { curso: "TBD", paralelo: "Perdedor SF1", genero: filtroGenero, categoria: filtroCategoria },
        equipoB: { curso: "TBD", paralelo: "Perdedor SF2", genero: filtroGenero, categoria: filtroCategoria },
        grupo: `${filtroCategoria} - ${filtroGenero}`,
        fase: "tercerPuesto",
        estado: "programado",
        disciplina: discipline,
        marcadorA: 0, marcadorB: 0, fecha: "", hora: "", goleadoresA: [], goleadoresB: []
      });

      console.log("Semifinales generadas automáticamente para múltiples grupos");

    } catch (error) {
      console.error("Error al generar semifinales para múltiples grupos:", error);
    }
  };

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
      try {
        const q = query(
          collection(db, "grupos"),
          where("disciplina", "==", discipline)
        );
        
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        
        // Filtrar grupos en el cliente según los filtros activos
        let gruposFiltrados = data;
        
        if (filtroGenero) {
          gruposFiltrados = gruposFiltrados.filter(grupo => grupo.genero === filtroGenero);
        }
        
        if (filtroCategoria) {
          gruposFiltrados = gruposFiltrados.filter(grupo => grupo.categoria === filtroCategoria);
        }
        
        setGrupos(gruposFiltrados);
      } catch (error) {
        console.error("Error al obtener grupos:", error);
        setError("Error al cargar grupos");
        setGrupos([]); // En caso de error, establecer array vacío
      }
    };
    obtenerGrupos();
  }, [discipline, filtroGenero, filtroCategoria]);

  // Obtener categorías desde Firestore
  useEffect(() => {
    const obtenerCategorias = async () => {
      try {
        setLoading(true);
        const q = query(
          collection(db, "categorias"),
          where("disciplina", "==", discipline)
        );
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setCategorias(data);
      } catch (error) {
        console.error("Error al obtener categorías:", error);
        setError("Error al cargar categorías");
        setCategorias([]);
      } finally {
        setLoading(false);
      }
    };
    obtenerCategorias();
  }, [discipline]);

  // Obtener equipos desde Firestore
  useEffect(() => {
    const obtenerEquipos = async () => {
      try {
        const q = query(
          collection(db, "equipos"),
          where("disciplina", "==", discipline),
        );
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          curso: doc.data().curso,
          paralelo: doc.data().paralelo,
          grupo: doc.data().grupo,
          categoria: doc.data().categoria,
          genero: doc.data().genero,
        }));
        setEquipos(data);
      } catch (error) {
        console.error("Error al obtener equipos:", error);
        setEquipos([]);
      }
    };
    obtenerEquipos();
  }, [discipline]);

  // Obtener partidos en tiempo real
  useEffect(() => {
    try {
      const q = query(
        collection(db, "matches"),
        where("disciplina", "==", discipline),
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setMatches(data);
      }, (error) => {
        console.error("Error al obtener partidos:", error);
        setMatches([]);
      });
      return () => unsubscribe();
    } catch (error) {
      console.error("Error al configurar listener de partidos:", error);
      setMatches([]);
    }
  }, [discipline]);

  // Auto-generación de siguientes fases cuando se completa una fase
  useEffect(() => {
    if (!filtroGenero || !filtroCategoria || matches.length === 0 || equipos.length === 0) return;

    const verificarYGenerarFasesFinales = async () => {
      console.log("🔍 Verificando si se pueden generar fases finales...");
      console.log("Filtros:", { genero: filtroGenero, categoria: filtroCategoria });
      
      // Filtrar partidos y equipos por género y categoría seleccionados
      const partidosFiltrados = matches.filter(match => {
        const matchGenero = match.equipoA?.genero || match.genero;
        const matchCategoria = match.equipoA?.categoria || match.categoria;
        return matchGenero === filtroGenero && matchCategoria === filtroCategoria;
      });

      const equiposFiltrados = equipos.filter(equipo => {
        return equipo.genero === filtroGenero && equipo.categoria === filtroCategoria;
      });

      console.log("Partidos filtrados:", partidosFiltrados.length);
      console.log("Equipos filtrados:", equiposFiltrados.length);

      // Agrupar equipos por grupo
      const equiposPorGrupo = {};
      equiposFiltrados.forEach(equipo => {
        const grupo = equipo.grupo || "Sin grupo";
        if (!equiposPorGrupo[grupo]) equiposPorGrupo[grupo] = [];
        equiposPorGrupo[grupo].push(equipo);
      });

      console.log("Grupos encontrados:", Object.keys(equiposPorGrupo));

      // Verificar si la fase de grupos está completa para generar semifinales automáticamente
      for (const [nombreGrupo, equiposGrupo] of Object.entries(equiposPorGrupo)) {
        if (equiposGrupo.length < 2) continue;

        // Calcular cuántos partidos de grupos deberían existir (todos contra todos)
        const partidosGruposEsperados = (equiposGrupo.length * (equiposGrupo.length - 1)) / 2;
        
        // Contar partidos de grupos finalizados
        const partidosGruposFinalizados = partidosFiltrados.filter(match => 
          match.grupo === nombreGrupo && 
          (!match.fase || match.fase === "grupos") && 
          match.estado === "finalizado"
        ).length;

        console.log(`📊 Grupo ${nombreGrupo}: ${partidosGruposFinalizados}/${partidosGruposEsperados} partidos finalizados`);

        // Si la fase de grupos está completa, generar semifinales automáticamente
        if (partidosGruposFinalizados >= partidosGruposEsperados) {
          // Verificar si ya existen semifinales para este grupo
          const semifinalesExistentes = partidosFiltrados.filter(match => 
            match.grupo === nombreGrupo && 
            (match.fase === "semifinales" || match.fase === "final" || match.fase === "tercerPuesto")
          );

          console.log(`🏆 Grupo ${nombreGrupo} - Semifinales existentes:`, semifinalesExistentes.length);

          if (semifinalesExistentes.length === 0) {
            console.log(`🚀 Generando fases finales automáticamente para ${nombreGrupo}...`);
            
            // Calcular clasificación del grupo
            const partidosGrupo = partidosFiltrados.filter(match => 
              match.grupo === nombreGrupo && (!match.fase || match.fase === "grupos")
            );
            const clasificacion = calcularClasificacion(partidosGrupo);

            // Obtener los equipos ordenados por posición
            const equiposOrdenados = Object.entries(clasificacion)
              .map(([nombre, stats]) => ({ nombre, ...stats }))
              .sort((a, b) => {
                if (b.puntos !== a.puntos) return b.puntos - a.puntos;
                if (b.diferencia !== a.diferencia) return b.diferencia - a.diferencia;
                return b.golesFavor - a.golesFavor;
              });

            console.log(`📈 Clasificación final del grupo ${nombreGrupo}:`, equiposOrdenados);

            // Generar fases finales basado en el número de grupos
            const totalGrupos = Object.keys(equiposPorGrupo).length;
            await generarFasesFinalesAutomatico(nombreGrupo, equiposOrdenados, totalGrupos);
          }
        }
      }

      // Si hay múltiples grupos, verificar si todos han terminado para generar semifinales inter-grupos
      const totalGrupos = Object.keys(equiposPorGrupo).length;
      if (totalGrupos >= 2) {
        console.log("🏟️ Verificando si todos los grupos han terminado para generar semifinales inter-grupos...");
        
        // Verificar si todos los grupos han completado su fase de grupos
        let todosGruposCompletos = true;
        const clasificadosPorGrupo = {};

        for (const [nombreGrupo, equiposGrupo] of Object.entries(equiposPorGrupo)) {
          if (equiposGrupo.length < 2) continue;

          const partidosGruposEsperados = (equiposGrupo.length * (equiposGrupo.length - 1)) / 2;
          const partidosGruposFinalizados = partidosFiltrados.filter(match => 
            match.grupo === nombreGrupo && 
            (!match.fase || match.fase === "grupos") && 
            match.estado === "finalizado"
          ).length;

          if (partidosGruposFinalizados < partidosGruposEsperados) {
            console.log(`⏳ Grupo ${nombreGrupo} aún no ha terminado: ${partidosGruposFinalizados}/${partidosGruposEsperados}`);
            todosGruposCompletos = false;
            break;
          } else {
            // Calcular clasificación del grupo
            const partidosGrupo = partidosFiltrados.filter(match => 
              match.grupo === nombreGrupo && (!match.fase || match.fase === "grupos")
            );
            const clasificacion = calcularClasificacion(partidosGrupo);

            const equiposOrdenados = Object.entries(clasificacion)
              .map(([nombre, stats]) => ({ nombre, ...stats }))
              .sort((a, b) => {
                if (b.puntos !== a.puntos) return b.puntos - a.puntos;
                if (b.diferencia !== a.diferencia) return b.diferencia - a.diferencia;
                return b.golesFavor - a.golesFavor;
              });

            clasificadosPorGrupo[nombreGrupo] = equiposOrdenados;
            console.log(`✅ Grupo ${nombreGrupo} completado. Clasificados:`, equiposOrdenados.slice(0, 2).map(e => e.nombre));
          }
        }

        // Si todos los grupos están completos, generar semifinales inter-grupos
        if (todosGruposCompletos && Object.keys(clasificadosPorGrupo).length >= 2) {
          const semifinalesExistentes = partidosFiltrados.filter(match => 
            match.fase === "semifinales" && 
            match.equipoA?.genero === filtroGenero && 
            match.equipoA?.categoria === filtroCategoria
          );

          console.log("🏆 Semifinales inter-grupos existentes:", semifinalesExistentes.length);

          if (semifinalesExistentes.length === 0) {
            console.log("🚀 Generando semifinales automáticamente para múltiples grupos...");
            await generarSemifinalesMultiplesGrupos(clasificadosPorGrupo);
          }
        }
      }
    };

    verificarYGenerarFasesFinales();
  }, [matches, equipos, filtroGenero, filtroCategoria]);

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

  // Filtrar partidos por fase y aplicar filtros de género/categoría/grupos
  const partidosPorFase = (fase) => {
    const partidosFiltrados = matches.filter((m) => {
      // Primero filtrar por fase
      const faseMatch = (m.fase || "grupos") === fase;
      if (!faseMatch) return false;
      
      // Si no hay filtros seleccionados, mostrar todos los partidos de la fase
      if (!filtroGenero && !filtroCategoria && filtroGrupos.length === 0) {
        return true;
      }
      
      // Aplicar filtros (pero permitir undefined para partidos antiguos)
      const generoMatch = !filtroGenero || (
        (m.equipoA?.genero === filtroGenero || !m.equipoA?.genero) && 
        (m.equipoB?.genero === filtroGenero || !m.equipoB?.genero)
      );
      const categoriaMatch = !filtroCategoria || (
        (m.equipoA?.categoria === filtroCategoria || !m.equipoA?.categoria) && 
        (m.equipoB?.categoria === filtroCategoria || !m.equipoB?.categoria)
      );
      const grupoMatch = filtroGrupos.length === 0 || filtroGrupos.includes(m.grupo) || !m.grupo;
      
      return generoMatch && categoriaMatch && grupoMatch;
    });
    
    return partidosFiltrados;
  };

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
        {grupos.map((grupoObj) => {
          const nombreGrupo = grupoObj.nombre;
          const partidosDelGrupo = partidosPorGrupo[nombreGrupo];
          
          return partidosDelGrupo && partidosDelGrupo.length > 0 ? (
            <div key={nombreGrupo} className="match-group">
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "1.5rem 0 0.5rem",
                }}
              >
                <h3 style={{ margin: 0 }}>{nombreGrupo}</h3>
                {/* Botón eliminar solo para fase de grupos */}
                {fasesArray[faseActual] === "grupos" && (
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
                      setGrupoAEliminar(nombreGrupo);
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
                  {partidosPorGrupo[nombreGrupo].map((match) => (
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
          ) : null;
        })}
      </>
    );
  }

  return (
    <div className="admin-matches-container">
      {/* Mostrar estado de carga */}
      {loading && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '200px',
          fontSize: '1.2rem',
          color: '#666'
        }}>
          <div>
            <div style={{textAlign: 'center', marginBottom: '1rem'}}>⏳</div>
            Cargando datos...
          </div>
        </div>
      )}

      {/* Mostrar error si existe */}
      {error && !loading && (
        <div style={{
          background: '#fee',
          border: '1px solid #fcc',
          borderRadius: '8px',
          padding: '1rem',
          margin: '1rem',
          color: '#c33'
        }}>
          <strong>Error:</strong> {error}
          <button 
            onClick={() => window.location.reload()} 
            style={{
              marginLeft: '1rem',
              padding: '0.5rem 1rem',
              background: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Recargar página
          </button>
        </div>
      )}

      {/* Contenido principal - solo mostrar si no hay carga ni error */}
      {!loading && !error && (
        <>
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

      {/* Filtros por Género y Categoría */}
      <div className="filters-section" style={{
        background: 'white', 
        borderRadius: '20px', 
        boxShadow: '0 2px 12px rgba(0,0,0,0.1)', 
        padding: '1.5rem', 
        marginBottom: '2rem'
      }}>
        <h3 style={{margin: '0 0 1rem 0', color: '#495057', fontSize: '1.1rem'}}>
          🔍 Filtrar Partidos
        </h3>
        <div style={{display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
            <label style={{fontWeight: '500', color: '#666'}}>
              <span style={{marginRight: '0.5rem'}}>🚻</span>
              Género:
            </label>
            <select
              value={filtroGenero}
              onChange={e => {
                setFiltroGenero(e.target.value);
                setFiltroCategoria(""); // Reset categoría
                setFiltroGrupos([]); // Reset grupos
              }}
              style={{
                padding: '0.5rem',
                borderRadius: '6px',
                border: '1px solid #ced4da',
                minWidth: '140px'
              }}
            >
              <option value="">Todos los géneros</option>
              <option value="Hombre">Hombre</option>
              <option value="Mujer">Mujer</option>
            </select>
          </div>
          
          <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
            <label style={{fontWeight: '500', color: '#666'}}>
              <span style={{marginRight: '0.5rem'}}>🏷️</span>
              Categoría:
            </label>
            <select
              value={filtroCategoria}
              onChange={e => {
                setFiltroCategoria(e.target.value);
                setFiltroGrupos([]); // Reset grupos cuando cambie categoría
              }}
              disabled={!filtroGenero}
              style={{
                padding: '0.5rem',
                borderRadius: '6px',
                border: '1px solid #ced4da',
                minWidth: '200px',
                backgroundColor: !filtroGenero ? '#f5f5f5' : '',
                color: !filtroGenero ? '#999' : '',
                cursor: !filtroGenero ? 'not-allowed' : 'pointer'
              }}
            >
              <option value="">Todas las categorías</option>
              {categorias
                .filter(cat => !filtroGenero || cat.genero === filtroGenero)
                .map(cat => (
                  <option key={cat.id} value={cat.nombre}>{cat.nombre}</option>
                ))}
            </select>
          </div>
          
          <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap'}}>
            <label style={{fontWeight: '500', color: '#666'}}>
              <span style={{marginRight: '0.5rem'}}>👥</span>
              Grupos:
            </label>
            <div style={{display: 'flex', flexWrap: 'wrap', gap: '0.25rem', maxWidth: '500px'}}>
              {grupos
                .filter(grupo => {
                  // Solo mostrar grupos que coincidan con los filtros actuales
                  if (filtroGenero && grupo.genero !== filtroGenero) return false;
                  if (filtroCategoria && grupo.categoria !== filtroCategoria) return false;
                  return true;
                })
                .map(grupo => (
                  <label key={grupo.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    backgroundColor: filtroGrupos.includes(grupo.nombre) ? '#007bff' : '#f8f9fa',
                    color: filtroGrupos.includes(grupo.nombre) ? 'white' : '#495057',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '4px',
                    border: '1px solid #dee2e6',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    transition: 'all 0.2s'
                  }}>
                    <input
                      type="checkbox"
                      checked={filtroGrupos.includes(grupo.nombre)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFiltroGrupos([...filtroGrupos, grupo.nombre]);
                        } else {
                          setFiltroGrupos(filtroGrupos.filter(g => g !== grupo.nombre));
                        }
                      }}
                      style={{marginRight: '0.25rem', transform: 'scale(0.9)'}}
                    />
                    {grupo.nombre}
                  </label>
                ))}
              {grupos.filter(grupo => {
                if (filtroGenero && grupo.genero !== filtroGenero) return false;
                if (filtroCategoria && grupo.categoria !== filtroCategoria) return false;
                return true;
              }).length === 0 && (
                <span style={{color: '#6c757d', fontStyle: 'italic', fontSize: '0.875rem'}}>
                  No hay grupos disponibles con los filtros actuales
                </span>
              )}
            </div>
            {filtroGrupos.length > 0 && (
              <button
                onClick={() => setFiltroGrupos([])}
                style={{
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  padding: '0.25rem 0.5rem',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  cursor: 'pointer'
                }}
                title="Limpiar selección de grupos"
              >
                ✕ Limpiar
              </button>
            )}
          </div>

          <button
            onClick={generarPartidosGrupos}
            disabled={!filtroGenero || !filtroCategoria}
            style={{
              backgroundColor: (!filtroGenero || !filtroCategoria) ? '#6c757d' : '#28a745',
              color: 'white',
              border: 'none',
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              cursor: (!filtroGenero || !filtroCategoria) ? 'not-allowed' : 'pointer',
              fontWeight: '500',
              opacity: (!filtroGenero || !filtroCategoria) ? 0.5 : 1
            }}
            title="Genera automáticamente todos los partidos de la fase de grupos para la categoría seleccionada"
          >
            ⚽ Generar Partidos de Grupos
          </button>

          <button
            onClick={generarFasesFinales}
            disabled={!filtroGenero || !filtroCategoria}
            style={{
              backgroundColor: (!filtroGenero || !filtroCategoria) ? '#6c757d' : '#ffc107',
              color: (!filtroGenero || !filtroCategoria) ? 'white' : '#212529',
              border: 'none',
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              cursor: (!filtroGenero || !filtroCategoria) ? 'not-allowed' : 'pointer',
              fontWeight: '500',
              opacity: (!filtroGenero || !filtroCategoria) ? 0.5 : 1
            }}
            title="Regenera semifinales y final (solo usar si es necesario corregir el bracket automático)"
          >
            🔄 Regenerar Fases Finales
          </button>
          
          {(filtroGenero || filtroCategoria || filtroGrupos.length > 0) && (
            <button
              onClick={() => {
                setFiltroGenero("");
                setFiltroCategoria("");
                setFiltroGrupos([]);
              }}
              style={{
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '500'
              }}
              title="Limpiar todos los filtros y mostrar todos los partidos"
            >
              🗑️ Limpiar Filtros
            </button>
          )}
        </div>
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
                {equipos
                  .filter(eq => {
                    const pasaGenero = !filtroGenero || eq.genero === filtroGenero;
                    const pasaCategoria = !filtroCategoria || eq.categoria === filtroCategoria;
                    return pasaGenero && pasaCategoria;
                  })
                  .map((eq, idx) => (
                    <option key={idx} value={`${eq.curso} ${eq.paralelo}`}>
                      {eq.genero} - {eq.categoria} - {eq.curso} {eq.paralelo} ({eq.grupo || 'Sin grupo'})
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
                {equipos
                  .filter(eq => {
                    const pasaGenero = !filtroGenero || eq.genero === filtroGenero;
                    const pasaCategoria = !filtroCategoria || eq.categoria === filtroCategoria;
                    return pasaGenero && pasaCategoria;
                  })
                  .map((eq, idx) => (
                    <option key={idx} value={`${eq.curso} ${eq.paralelo}`}>
                      {eq.genero} - {eq.categoria} - {eq.curso} {eq.paralelo} ({eq.grupo || 'Sin grupo'})
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
        </>
      )}
    </div>
  );
}
