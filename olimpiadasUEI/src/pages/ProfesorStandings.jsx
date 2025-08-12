import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  query,
  where,
  addDoc,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { useParams } from "react-router-dom";
import "../styles/ProfesorStandings.css";
import { Link, useLocation } from "react-router-dom";

export default function ProfesorStandings() {
  const { discipline } = useParams();
  const [matches, setMatches] = useState([]);
  const [equipos, setEquipos] = useState([]);
  const [standingsPorGrupo, setStandingsPorGrupo] = useState({});
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  
  // Estados para filtros
  const [filtroGenero, setFiltroGenero] = useState("");
  const [filtroNivel, setFiltroNivel] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [categorias, setCategorias] = useState([]);

  // Funciones para manejar filtros
  const handleFiltroGeneroChange = (genero) => {
    setFiltroGenero(genero);
    setFiltroNivel(""); // Limpiar nivel al cambiar género
    setFiltroCategoria(""); // Limpiar categoría al cambiar género
  };

  const handleFiltroNivelChange = (nivel) => {
    setFiltroNivel(nivel);
    setFiltroCategoria(""); // Limpiar categoría al cambiar nivel
  };

  const handleFiltroCategoriaChange = (categoria) => {
    setFiltroCategoria(categoria);
  };

  // Obtener categorías desde Firestore
  const obtenerCategorias = async () => {
    try {
      const q = query(
        collection(db, "categorias"),
        where("disciplina", "==", discipline)
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setCategorias(data);
    } catch (error) {
      console.error("Error obteniendo categorías:", error);
    }
  };

  // Cargar categorías al iniciar
  useEffect(() => {
    obtenerCategorias();
  }, [discipline]);

  // Obtener opciones de filtro dinámicas
  const generosDisponibles = [...new Set(categorias.map(cat => cat.genero))].filter(Boolean);
  
  const nivelesDisponibles = filtroGenero 
    ? [...new Set(categorias.filter(cat => cat.genero === filtroGenero).map(cat => cat.nivelEducacional))].filter(Boolean)
    : [];
  
  const categoriasDisponibles = (filtroGenero && filtroNivel)
    ? categorias.filter(cat => cat.genero === filtroGenero && cat.nivelEducacional === filtroNivel).map(cat => cat.categoria)
    : [];

  // Obtener partidos en tiempo real
  useEffect(() => {
    setLoading(true);
    const q = query(
      collection(db, "matches"),
      where("disciplina", "==", discipline),
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      try {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setMatches(data);
      } catch (error) {
        console.error("Error cargando partidos:", error);
      } finally {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [discipline]);

  // Obtener equipos
  useEffect(() => {
    const fetchEquipos = async () => {
      try {
        const q = query(
          collection(db, "equipos"),
          where("disciplina", "==", discipline),
        );
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setEquipos(data);
      } catch (error) {
        console.error("Error cargando equipos:", error);
      }
    };
    fetchEquipos();
  }, [discipline]);

  // Calcular tabla de posiciones por grupo
  useEffect(() => {
    if (equipos.length === 0) return;

    console.log("Todos los equipos:", equipos);
    console.log("Todos los partidos:", matches);

    // Aplicar filtros
    let equiposFiltrados = equipos;
    
    if (filtroGenero || filtroNivel || filtroCategoria) {
      // Filtrar partidos que cumplan con los criterios seleccionados
      const partidosFiltrados = matches.filter(partido => {
        const pasaGenero = !filtroGenero || partido.genero === filtroGenero;
        const pasaNivel = !filtroNivel || partido.nivelEducacional === filtroNivel;
        const pasaCategoria = !filtroCategoria || partido.categoria === filtroCategoria;
        return pasaGenero && pasaNivel && pasaCategoria;
      });

      // Obtener equipos únicos de los partidos filtrados
      const equiposEnPartidos = new Set();
      partidosFiltrados.forEach(partido => {
        equiposEnPartidos.add(`${partido.equipoA.curso}_${partido.equipoA.paralelo}`);
        equiposEnPartidos.add(`${partido.equipoB.curso}_${partido.equipoB.paralelo}`);
      });

      // Filtrar equipos que aparecen en los partidos filtrados
      equiposFiltrados = equipos.filter(equipo => 
        equiposEnPartidos.has(`${equipo.curso}_${equipo.paralelo}`)
      );
    }

    console.log("Equipos filtrados:", equiposFiltrados);

    // Filtrar solo equipos que realmente pertenecen a grupos válidos (Grupo 1, Grupo 2, etc.)
    const equiposConGrupoValido = equiposFiltrados.filter(
      (equipo) =>
        equipo.grupo &&
        (equipo.grupo.includes("Grupo") || equipo.grupo.includes("grupo")),
    );

    console.log("Equipos con grupo válido:", equiposConGrupoValido);

    // Agrupar equipos por grupo
    const equiposPorGrupo = {};
    equiposConGrupoValido.forEach((equipo) => {
      const grupo = equipo.grupo;
      if (!equiposPorGrupo[grupo]) equiposPorGrupo[grupo] = [];
      equiposPorGrupo[grupo].push(equipo);
    });

    console.log("Equipos agrupados:", equiposPorGrupo);

    // Calcular standings por grupo
    const standingsPorGrupoTemp = {};

    Object.entries(equiposPorGrupo).forEach(([grupo, equiposGrupo]) => {
      console.log(`Procesando ${grupo} con equipos:`, equiposGrupo);

      const table = {};

      // Primero inicializar todos los equipos del grupo
      equiposGrupo.forEach((equipo) => {
        const nombre = `${equipo.curso} ${equipo.paralelo}`;
        table[nombre] = createTeamEntry(nombre, grupo);
      });

      console.log(`Tabla inicial para ${grupo}:`, table);

      // Filtrar partidos que corresponden específicamente a este grupo
      const partidosDelGrupo = matches.filter(
        (match) =>
          match.estado === "finalizado" &&
          match.grupo === grupo && // Verificar que el partido sea del grupo correcto
          equiposGrupo.some(
            (eq) =>
              `${eq.curso} ${eq.paralelo}` ===
              `${match.equipoA.curso} ${match.equipoA.paralelo}`,
          ) &&
          equiposGrupo.some(
            (eq) =>
              `${eq.curso} ${eq.paralelo}` ===
              `${match.equipoB.curso} ${match.equipoB.paralelo}`,
          ),
      );

      console.log(`Partidos válidos para ${grupo}:`, partidosDelGrupo);

      // Procesar partidos del grupo
      partidosDelGrupo.forEach((match) => {
        const { equipoA, equipoB, marcadorA, marcadorB } = match;
        if (marcadorA === null || marcadorB === null) return;

        const keyA = `${equipoA.curso} ${equipoA.paralelo}`;
        const keyB = `${equipoB.curso} ${equipoB.paralelo}`;

        // Verificar que ambos equipos están en la tabla
        if (!table[keyA] || !table[keyB]) {
          console.log(
            `Equipos no encontrados en tabla del ${grupo}:`,
            keyA,
            keyB,
          );
          return;
        }

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

      let result = Object.values(table)
        .map((team) => ({
          ...team,
          dg: team.gf - team.gc,
        }))
        .sort((a, b) => {
          if (discipline === "voley") {
            // Para vóley: 1) Partidos ganados, 2) Menos puntos en contra
            if (b.pg !== a.pg) return b.pg - a.pg;
            return a.gc - b.gc;
          } else {
            // Para fútbol: 1) Puntos, 2) Diferencia de goles, 3) Goles a favor
            if (b.pts !== a.pts) return b.pts - a.pts;
            if (b.dg !== a.dg) return b.dg - a.dg;
            return b.gf - a.gf;
          }
        });

      // Para vóley y fútbol: marcar equipos eliminados
      if (discipline === "voley" || discipline === "futbol") {
        // Verificar qué equipos están activos según los partidos más recientes
        const todosLosPartidos = matches.filter(m => 
          m.grupo === grupo && 
          m.estado === "finalizado"
        );
        
        // Obtener la fase más avanzada con partidos en este grupo
        const todasLasFases = ['final', 'semifinal', 'cuartos', 'octavos', 'grupos3', 'grupos1'];
        let faseActual = 'grupos1';
        
        for (const fase of todasLasFases) {
          const partidosFase = todosLosPartidos.filter(m => m.fase === fase);
          if (partidosFase.length > 0) {
            faseActual = fase;
            break;
          }
        }
        
        // Obtener equipos que siguen activos según la fase actual
        const equiposActivos = new Set();
        
        if (faseActual === 'final') {
          // En finales, solo los equipos que están jugando la final están activos
          todosLosPartidos
            .filter(m => m.fase === 'final')
            .forEach(match => {
              equiposActivos.add(`${match.equipoA.curso} ${match.equipoA.paralelo}`);
              equiposActivos.add(`${match.equipoB.curso} ${match.equipoB.paralelo}`);
            });
        } else if (faseActual === 'semifinal') {
          // En semifinales, equipos activos son los que están en semifinales
          todosLosPartidos
            .filter(m => m.fase === 'semifinal')
            .forEach(match => {
              equiposActivos.add(`${match.equipoA.curso} ${match.equipoA.paralelo}`);
              equiposActivos.add(`${match.equipoB.curso} ${match.equipoB.paralelo}`);
            });
        } else if (faseActual === 'cuartos') {
          // En cuartos, equipos activos son los que están en cuartos
          todosLosPartidos
            .filter(m => m.fase === 'cuartos')
            .forEach(match => {
              equiposActivos.add(`${match.equipoA.curso} ${match.equipoA.paralelo}`);
              equiposActivos.add(`${match.equipoB.curso} ${match.equipoB.paralelo}`);
            });
        } else if (faseActual === 'octavos') {
          // En octavos, equipos activos son los que están en octavos
          todosLosPartidos
            .filter(m => m.fase === 'octavos')
            .forEach(match => {
              equiposActivos.add(`${match.equipoA.curso} ${match.equipoA.paralelo}`);
              equiposActivos.add(`${match.equipoB.curso} ${match.equipoB.paralelo}`);
            });
        } else if (faseActual === 'grupos3') {
          // Para fase de grupos3
          todosLosPartidos
            .filter(m => m.fase === faseActual)
            .forEach(match => {
              equiposActivos.add(`${match.equipoA.curso} ${match.equipoA.paralelo}`);
              equiposActivos.add(`${match.equipoB.curso} ${match.equipoB.paralelo}`);
            });
        } else {
          // En grupos1 o sin fase específica, todos los equipos que han jugado están activos
          result.forEach(team => {
            if (team.pj > 0) {
              equiposActivos.add(team.nombre);
            }
          });
        }
        
        // Marcar estado de cada equipo
        result = result.map(team => ({
          ...team,
          eliminado: team.pj > 0 && !equiposActivos.has(team.nombre)
        }));
        
        // Ordenar: equipos activos primero, eliminados al final
        result.sort((a, b) => {
          if (a.eliminado !== b.eliminado) {
            return a.eliminado ? 1 : -1; // Eliminados al final
          }
          // Mantener el ordenamiento original para cada grupo
          if (discipline === "voley") {
            if (b.pg !== a.pg) return b.pg - a.pg;
            return a.gc - b.gc;
          } else if (discipline === "futbol") {
            if (b.pts !== a.pts) return b.pts - a.pts;
            if (b.dg !== a.dg) return b.dg - a.dg;
            return b.gf - a.gf;
          }
          return 0;
        });
        
        // Siempre mostrar todos los equipos que han jugado
        const equiposConPartidos = result.filter(team => team.pj > 0);
        if (equiposConPartidos.length > 0) {
          result = equiposConPartidos;
        }
      }

      standingsPorGrupoTemp[grupo] = result;
    });

    console.log("Resultado final standings:", standingsPorGrupoTemp);
    setStandingsPorGrupo(standingsPorGrupoTemp);

    // Generar automáticamente partidos de fases eliminatorias para vóley y fútbol
    Object.entries(standingsPorGrupoTemp).forEach(async ([grupo, standings]) => {
      if (standings.length >= 4 && standings.every(team => team.pj >= 1)) {
        // Verificar qué fases ya existen para este grupo
        const partidosGrupo = matches.filter(m => m.grupo === grupo);
        const fasesExistentes = new Set(partidosGrupo.map(m => m.fase).filter(Boolean));
        
        console.log(`Fases existentes para ${grupo}:`, Array.from(fasesExistentes));
        
        // Verificar si todos los equipos tienen al menos 2 partidos jugados y finalizados
        const todosConDosPartidos = standings.every(team => team.pj >= 2);
        
        console.log(`${grupo}: Todos con 2+ partidos: ${todosConDosPartidos}`);
        
        // FASE 2 (grupos3): Se genera cuando todos tienen 2 partidos finalizados
        if (todosConDosPartidos && !fasesExistentes.has('grupos3')) {
          console.log(`Generando grupos3 para ${grupo} - enfrentamientos por posición en tabla`);
          
          // Verificar que todos los equipos existen en la base de datos
          const equiposValidados = [];
          for (const team of standings) {
            const equipoExiste = equipos.find(eq => 
              `${eq.curso} ${eq.paralelo}` === team.nombre && eq.grupo === grupo
            );
            if (equipoExiste) {
              equiposValidados.push(team);
            } else {
              console.warn(`Equipo no encontrado en BD: ${team.nombre} del ${grupo}`);
            }
          }
          
          console.log(`Equipos validados para ${grupo}:`, equiposValidados.map(t => t.nombre));
          
          // Generar enfrentamientos según posición: 1vs2, 3vs4, 5vs6, etc.
          const emparejamientos = [];
          for (let i = 0; i < equiposValidados.length - 1; i += 2) {
            if (equiposValidados[i + 1]) { // Verificar que existe el segundo equipo
              emparejamientos.push([i, i + 1]);
            }
          }
          
          console.log(`Emparejamientos para ${grupo}:`, emparejamientos.map(([a, b]) => 
            `${equiposValidados[a]?.nombre} vs ${equiposValidados[b]?.nombre}`
          ));
          
          for (const [idxA, idxB] of emparejamientos) {
            const equipoA = equiposValidados[idxA];
            const equipoB = equiposValidados[idxB];
            if (!equipoA || !equipoB) continue;
            
            // Doble verificación: que el partido no exista ya
            const partidoExiste = matches.some(m => 
              m.grupo === grupo && 
              m.fase === 'grupos3' &&
              ((m.equipoA.curso === equipoA.nombre.split(" ")[0] && 
                m.equipoA.paralelo === equipoA.nombre.split(" ")[1] &&
                m.equipoB.curso === equipoB.nombre.split(" ")[0] && 
                m.equipoB.paralelo === equipoB.nombre.split(" ")[1]) ||
               (m.equipoA.curso === equipoB.nombre.split(" ")[0] && 
                m.equipoA.paralelo === equipoB.nombre.split(" ")[1] &&
                m.equipoB.curso === equipoA.nombre.split(" ")[0] && 
                m.equipoB.paralelo === equipoA.nombre.split(" ")[1]))
            );
            
            if (!partidoExiste) {
              await addDoc(collection(db, "matches"), {
                equipoA: { 
                  curso: equipoA.nombre.split(" ")[0], 
                  paralelo: equipoA.nombre.split(" ")[1] 
                },
                equipoB: { 
                  curso: equipoB.nombre.split(" ")[0], 
                  paralelo: equipoB.nombre.split(" ")[1] 
                },
                disciplina: discipline,
                marcadorA: 0,
                marcadorB: 0,
                estado: "pendiente",
                fecha: null,
                hora: null,
                grupo: grupo,
                fase: "grupos3",
                goleadoresA: [],
                goleadoresB: [],
              });
            }
          }
        }
        
        // SEMIFINALES: Solo los 4 primeros de la tabla pasan
        const partidosGrupos3 = partidosGrupo.filter(m => m.fase === 'grupos3' && m.estado === 'finalizado');
        const totalPartidosGrupos3Esperados = Math.floor(standings.length / 2);
        
        if (partidosGrupos3.length >= totalPartidosGrupos3Esperados && !fasesExistentes.has('semifinal')) {
          // Solo los 4 primeros equipos pasan a semifinales
          const equiposClasificados = standings.slice(0, 4);
          
          console.log(`Generando semifinales para ${grupo} con los 4 primeros:`, 
            equiposClasificados.map(t => t.nombre)
          );
          
          if (equiposClasificados.length >= 4) {
            // Semifinales: 1vs4 y 2vs3
            const emparejamientosSemi = [[0, 3], [1, 2]];
            
            for (const [idxA, idxB] of emparejamientosSemi) {
              const equipoA = equiposClasificados[idxA];
              const equipoB = equiposClasificados[idxB];
              if (!equipoA || !equipoB) continue;
              
              await addDoc(collection(db, "matches"), {
                equipoA: { 
                  curso: equipoA.nombre.split(" ")[0], 
                  paralelo: equipoA.nombre.split(" ")[1] 
                },
                equipoB: { 
                  curso: equipoB.nombre.split(" ")[0], 
                  paralelo: equipoB.nombre.split(" ")[1] 
                },
                disciplina: discipline,
                marcadorA: 0,
                marcadorB: 0,
                estado: "pendiente",
                fecha: null,
                hora: null,
                grupo: grupo,
                fase: "semifinal",
                goleadoresA: [],
                goleadoresB: [],
              });
            }
          }
        }
        
        // FINAL: Ganadores de semifinales
        const partidosSemi = partidosGrupo.filter(m => m.fase === 'semifinal' && m.estado === 'finalizado');
        if (partidosSemi.length >= 2 && !fasesExistentes.has('final')) {
          // Obtener ganadores de semifinales
          const ganadoresSemi = partidosSemi.map(match => {
            if (match.marcadorA > match.marcadorB) {
              return `${match.equipoA.curso} ${match.equipoA.paralelo}`;
            } else {
              return `${match.equipoB.curso} ${match.equipoB.paralelo}`;
            }
          });
          
          console.log(`Generando final para ${grupo} con finalistas:`, ganadoresSemi);
          
          if (ganadoresSemi.length >= 2) {
            const equipoA = standings.find(t => t.nombre === ganadoresSemi[0]);
            const equipoB = standings.find(t => t.nombre === ganadoresSemi[1]);
            
            if (equipoA && equipoB) {
              await addDoc(collection(db, "matches"), {
                equipoA: { 
                  curso: equipoA.nombre.split(" ")[0], 
                  paralelo: equipoA.nombre.split(" ")[1] 
                },
                equipoB: { 
                  curso: equipoB.nombre.split(" ")[0], 
                  paralelo: equipoB.nombre.split(" ")[1] 
                },
                disciplina: discipline,
                marcadorA: 0,
                marcadorB: 0,
                estado: "pendiente",
                fecha: null,
                hora: null,
                grupo: grupo,
                fase: "final",
                goleadoresA: [],
                goleadoresB: [],
              });
            }
          }
        }
      }
    });
  }, [matches, equipos, discipline, filtroGenero, filtroNivel, filtroCategoria]);

  const createTeamEntry = (nombre, grupo) => ({
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
  });

  return (
    <div className="profesor-standings-container">
      {/* Header moderno para profesor */}
      <div className="profesor-header">
        <div className="header-icon">🏆</div>
        <h1 className="profesor-title">Tabla de Posiciones</h1>
        <p className="profesor-subtitle">
          Clasificación actual de{" "}
          {discipline === "futbol"
            ? "Fútbol"
            : discipline === "voley"
              ? "Vóley"
              : "Básquet"}
        </p>
      </div>

      {/* Filtros */}
      <div className="filter-section">
        <div className="filter-container">
          <div className="filter-group">
            <label className="filter-label">
              <span className="filter-icon">⚥</span>
              Género
            </label>
            <select 
              value={filtroGenero} 
              onChange={(e) => handleFiltroGeneroChange(e.target.value)}
              className="filter-select"
            >
              <option value="">Todos los géneros</option>
              {generosDisponibles.map((genero) => (
                <option key={genero} value={genero}>{genero}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label className="filter-label">
              <span className="filter-icon">🎓</span>
              Nivel Educacional
            </label>
            <select 
              value={filtroNivel} 
              onChange={(e) => handleFiltroNivelChange(e.target.value)}
              className="filter-select"
              disabled={!filtroGenero}
            >
              <option value="">Todos los niveles</option>
              {nivelesDisponibles.map((nivel) => (
                <option key={nivel} value={nivel}>{nivel}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label className="filter-label">
              <span className="filter-icon">🏆</span>
              Categoría
            </label>
            <select 
              value={filtroCategoria} 
              onChange={(e) => handleFiltroCategoriaChange(e.target.value)}
              className="filter-select"
              disabled={!filtroNivel}
            >
              <option value="">Todas las categorías</option>
              {categoriasDisponibles.map((categoria) => (
                <option key={categoria} value={categoria}>{categoria}</option>
              ))}
            </select>
          </div>

          {(filtroGenero || filtroNivel || filtroCategoria) && (
            <button 
              onClick={() => {
                setFiltroGenero("");
                setFiltroNivel("");
                setFiltroCategoria("");
              }}
              className="clear-filters-btn"
            >
              <span className="clear-icon">🗑️</span>
              Limpiar filtros
            </button>
          )}
        </div>
      </div>
      {/* Navegación moderna entre secciones */}
      <div className="profesor-navigation">
        <Link
          to="/profesor"
          className="nav-link panel-link"
        >
          <span className="nav-icon">🏠</span>
          <span className="nav-text">Panel</span>
        </Link>
        <Link
          to={`/profesor/${discipline}/partidos`}
          className={`nav-link ${location.pathname.includes("/partidos") ? "active" : ""}`}
        >
          <span className="nav-icon">⚽</span>
          <span className="nav-text">Partidos</span>
        </Link>
        <Link
          to={`/profesor/${discipline}/tabla`}
          className={`nav-link ${location.pathname.includes("/tabla") ? "active" : ""}`}
        >
          <span className="nav-icon">🏆</span>
          <span className="nav-text">Posiciones</span>
        </Link>
        <Link
          to={`/profesor/${discipline}/horarios`}
          className={`nav-link ${location.pathname.includes("/horarios") ? "active" : ""}`}
        >
          <span className="nav-icon">📅</span>
          <span className="nav-text">Horarios</span>
        </Link>
      </div>
      {loading ? (
        <div className="loading-section">
          <div className="loading-spinner"></div>
          <p className="loading-text">Cargando estadísticas...</p>
        </div>
      ) : Object.keys(standingsPorGrupo).length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📊</div>
          <h3>No hay datos disponibles</h3>
          <p>
            Los partidos deben estar finalizados para generar la tabla de
            posiciones
          </p>
        </div>
      ) : (
        <div className="standings-grid">
          {Object.entries(standingsPorGrupo).map(([grupo, standings]) => (
            <div key={grupo} className="group-standings-card">
              <div className="group-header">
                <div className="group-info">
                  <h3 className="group-title">
                    <span className="group-icon">🏆</span>
                    {grupo}
                  </h3>
                  <div className="teams-count">{standings.length} equipos</div>
                </div>
              </div>

              <div className="standings-table-container">
                <table className="modern-standings-table">
                  <thead>
                    <tr>
                      <th>
                        <div className="th-content">
                          <span className="th-icon">#</span>
                          Pos
                        </div>
                      </th>
                      <th>
                        <div className="th-content">
                          <span className="th-icon">👥</span>
                          Equipo
                        </div>
                      </th>
                      <th>
                        <div className="th-content">
                          <span className="th-icon">⚽</span>
                          PJ
                        </div>
                      </th>
                      <th>
                        <div className="th-content">
                          <span className="th-icon">✅</span>
                          PG
                        </div>
                      </th>
                      {discipline === "futbol" && (
                        <th>
                          <div className="th-content">
                            <span className="th-icon">🤝</span>
                            PE
                          </div>
                        </th>
                      )}
                      <th>
                        <div className="th-content">
                          <span className="th-icon">❌</span>
                          PP
                        </div>
                      </th>
                      {discipline === "futbol" && (
                        <>
                          <th>
                            <div className="th-content">
                              <span className="th-icon">🥅</span>
                              GF
                            </div>
                          </th>
                          <th>
                            <div className="th-content">
                              <span className="th-icon">�</span>
                              DG
                            </div>
                          </th>
                        </>
                      )}
                      <th>
                        <div className="th-content">
                          <span className="th-icon">�</span>
                          {discipline === "voley" ? "PC" : "GC"}
                        </div>
                      </th>
                      {discipline === "futbol" && (
                        <th>
                          <div className="th-content">
                            <span className="th-icon">🏆</span>
                            PTS
                          </div>
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {standings.map((team, idx) => (
                      <tr
                        key={team.nombre}
                        className={`table-row position-${idx + 1} ${team.eliminado ? 'eliminated-team' : ''}`}
                        style={{
                          opacity: team.eliminado ? 0.7 : 1,
                          backgroundColor: team.eliminado ? 'rgba(244, 67, 54, 0.15)' : 'transparent'
                        }}
                      >
                        <td className="position-cell">
                          <span
                            className={`position-badge position-${idx + 1} ${team.eliminado ? 'eliminated' : ''}`}
                            style={{
                              backgroundColor: team.eliminado ? 'rgba(244, 67, 54, 0.8)' : '',
                              color: team.eliminado ? 'white' : ''
                            }}
                          >
                            {team.eliminado ? '❌' : idx + 1}
                          </span>
                        </td>
                        <td className="team-cell">
                          <div className="team-info">
                            <span className="team-icon">🏫</span>
                            <span 
                              className="team-name"
                              style={{
                                color: team.eliminado ? 'rgba(244, 67, 54, 0.8)' : '',
                                textDecoration: team.eliminado ? 'line-through' : 'none'
                              }}
                            >
                              {team.nombre}
                            </span>
                          </div>
                        </td>
                        <td className="table-cell" style={{ color: team.eliminado ? 'rgba(244, 67, 54, 0.8)' : '' }}>{team.pj}</td>
                        <td className="table-cell wins" style={{ color: team.eliminado ? 'rgba(244, 67, 54, 0.8)' : '' }}>{team.pg}</td>
                        {discipline === "futbol" && (
                          <td className="table-cell draws" style={{ color: team.eliminado ? 'rgba(244, 67, 54, 0.8)' : '' }}>{team.pe}</td>
                        )}
                        <td className="table-cell losses" style={{ color: team.eliminado ? 'rgba(244, 67, 54, 0.8)' : '' }}>{team.pp}</td>
                        {discipline === "futbol" && (
                          <>
                            <td className="table-cell goals-for" style={{ color: team.eliminado ? 'rgba(244, 67, 54, 0.8)' : '' }}>{team.gf}</td>
                            <td
                              className={`table-cell goal-diff ${team.dg >= 0 ? "positive" : "negative"}`}
                              style={{ color: team.eliminado ? 'rgba(244, 67, 54, 0.8)' : '' }}
                            >
                              {team.dg > 0 ? "+" : ""}
                              {team.dg}
                            </td>
                          </>
                        )}
                        <td className="table-cell goals-against" style={{ color: team.eliminado ? 'rgba(244, 67, 54, 0.8)' : '' }}>{team.gc}</td>
                        {discipline === "futbol" && (
                          <td className="points-cell">
                            <span className="points-badge" style={{ color: team.eliminado ? 'rgba(244, 67, 54, 0.8)' : '' }}>{team.pts}</span>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
