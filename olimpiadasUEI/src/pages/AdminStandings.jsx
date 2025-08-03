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
import { useParams, useNavigate } from "react-router-dom";
import "../styles/AdminStandings.css";

export default function AdminStandings() {
  const { discipline } = useParams();
  const navigate = useNavigate();
  const [matches, setMatches] = useState([]);
  const [equipos, setEquipos] = useState([]);
  const [standingsPorGrupo, setStandingsPorGrupo] = useState({});
  const [loading, setLoading] = useState(true);
  const [filtroGenero, setFiltroGenero] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [categorias, setCategorias] = useState([]);

  // Funciones de navegación
  const goToTeams = () => {
    navigate(`/admin/${discipline}/equipos`);
  };

  const goToMatches = () => {
    navigate(`/admin/${discipline}/partidos`);
  };

  const goToSchedule = () => {
    navigate(`/admin/${discipline}/horarios`);
  };

  const goToPanel = () => {
    navigate('/admin');
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

  // Calcular tabla de posiciones por grupo y generar octavos automáticamente
  useEffect(() => {
    if (equipos.length === 0) return;

    console.log("Todos los equipos:", equipos);
    console.log("Todos los partidos:", matches);

    // Aplicar filtros de género y categoría
    const equiposFiltrados = equipos.filter(equipo => {
      const pasaGenero = filtroGenero === "" || equipo.genero === filtroGenero;
      const pasaCategoria = filtroCategoria === "" || equipo.categoria === filtroCategoria;
      return pasaGenero && pasaCategoria;
    });

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
        
        // Verificar si hay partidos sin fase (partidos iniciales de grupos)
        const partidosSinFase = todosLosPartidos.filter(m => !m.fase || m.fase === null || m.fase === '');
        const hayPartidosIniciales = partidosSinFase.length > 0;
        
        for (const fase of todasLasFases) {
          const partidosFase = todosLosPartidos.filter(m => m.fase === fase);
          if (partidosFase.length > 0) {
            faseActual = fase;
            break;
          }
        }
        
        // Si solo hay partidos sin fase, considerarlos como fase inicial
        if (hayPartidosIniciales && faseActual === 'grupos1' && !todosLosPartidos.some(m => m.fase === 'grupos1')) {
          faseActual = 'inicial'; // Fase inicial sin clasificar
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
          // En grupos1, inicial o sin fase específica, todos los equipos que han jugado están activos
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
          
          // Validar que los equipos clasificados existen en la base de datos
          const equiposClasificadosValidados = [];
          for (const team of equiposClasificados) {
            const equipoExiste = equipos.find(eq => 
              `${eq.curso} ${eq.paralelo}` === team.nombre && eq.grupo === grupo
            );
            if (equipoExiste) {
              equiposClasificadosValidados.push(team);
            } else {
              console.warn(`Equipo clasificado no encontrado en BD: ${team.nombre} del ${grupo}`);
            }
          }
          
          console.log(`Generando semifinales para ${grupo} con los 4 primeros validados:`, 
            equiposClasificadosValidados.map(t => t.nombre)
          );
          
          if (equiposClasificadosValidados.length >= 4) {
            // Semifinales: 1vs4 y 2vs3
            const emparejamientosSemi = [[0, 3], [1, 2]];
            
            for (const [idxA, idxB] of emparejamientosSemi) {
              const equipoA = equiposClasificadosValidados[idxA];
              const equipoB = equiposClasificadosValidados[idxB];
              if (!equipoA || !equipoB) continue;
              
              // Verificar que el partido de semifinal no exista ya
              const semiExiste = matches.some(m => 
                m.grupo === grupo && 
                m.fase === 'semifinal' &&
                ((m.equipoA.curso === equipoA.nombre.split(" ")[0] && 
                  m.equipoA.paralelo === equipoA.nombre.split(" ")[1] &&
                  m.equipoB.curso === equipoB.nombre.split(" ")[0] && 
                  m.equipoB.paralelo === equipoB.nombre.split(" ")[1]) ||
                 (m.equipoA.curso === equipoB.nombre.split(" ")[0] && 
                  m.equipoA.paralelo === equipoB.nombre.split(" ")[1] &&
                  m.equipoB.curso === equipoA.nombre.split(" ")[0] && 
                  m.equipoB.paralelo === equipoA.nombre.split(" ")[1]))
              );
              
              if (!semiExiste) {
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
            // Validar que ambos finalistas existen en la base de datos
            const equipoA = standings.find(t => t.nombre === ganadoresSemi[0]);
            const equipoB = standings.find(t => t.nombre === ganadoresSemi[1]);
            
            const equipoAExiste = equipoA && equipos.find(eq => 
              `${eq.curso} ${eq.paralelo}` === equipoA.nombre && eq.grupo === grupo
            );
            const equipoBExiste = equipoB && equipos.find(eq => 
              `${eq.curso} ${eq.paralelo}` === equipoB.nombre && eq.grupo === grupo
            );
            
            if (equipoAExiste && equipoBExiste) {
              // Verificar que el partido de final no exista ya
              const finalExiste = matches.some(m => 
                m.grupo === grupo && 
                m.fase === 'final' &&
                ((m.equipoA.curso === equipoA.nombre.split(" ")[0] && 
                  m.equipoA.paralelo === equipoA.nombre.split(" ")[1] &&
                  m.equipoB.curso === equipoB.nombre.split(" ")[0] && 
                  m.equipoB.paralelo === equipoB.nombre.split(" ")[1]) ||
                 (m.equipoA.curso === equipoB.nombre.split(" ")[0] && 
                  m.equipoA.paralelo === equipoB.nombre.split(" ")[1] &&
                  m.equipoB.curso === equipoA.nombre.split(" ")[0] && 
                  m.equipoB.paralelo === equipoA.nombre.split(" ")[1]))
              );
              
              if (!finalExiste) {
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
            } else {
              console.warn(`Finalistas no válidos para ${grupo}:`, ganadoresSemi);
            }
          }
        }
      }
    });
  }, [matches, equipos, discipline, filtroGenero, filtroCategoria]);

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
    <div className="admin-standings-container">
      {/* Header */}
      <div className="admin-header">
        <div className="header-icon">🏆</div>
        <h1 className="admin-title">Tabla de Posiciones</h1>
        <p className="admin-subtitle">
          Posiciones actuales de{" "}
          {discipline === "futbol" ? "Fútbol" : discipline === "voley" ? "Vóley" : "Básquet"}
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
        <button onClick={goToMatches} className="nav-card matches-card">
          <div className="nav-card-icon">⚽</div>
          <div className="nav-card-content">
            <h3 className="nav-card-title">Gestionar Partidos</h3>
            <p className="nav-card-description">Administrar encuentros</p>
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

      {/* Filtros por género y categoría */}
      <div style={{
        background: 'white',
        borderRadius: '12px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        padding: '1.5rem',
        marginBottom: '2rem',
        border: '1px solid #e9ecef'
      }}>
        <h3 style={{
          margin: '0 0 1rem 0',
          color: '#495057',
          fontSize: '1.1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <span>🔍</span>
          Filtros de Visualización
        </h3>
        
        <div style={{
          display: 'flex',
          gap: '1rem',
          alignItems: 'center',
          flexWrap: 'wrap'
        }}>
          <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
            <label style={{fontWeight: '500', color: '#666', fontSize: '0.9rem'}}>
              <span style={{marginRight: '0.5rem'}}>🚻</span>
              Género:
            </label>
            <select
              value={filtroGenero}
              onChange={e => {
                setFiltroGenero(e.target.value);
                setFiltroCategoria(""); // Limpiar categoría al cambiar género
              }}
              style={{
                padding: '0.5rem',
                border: '1px solid #ced4da',
                borderRadius: '6px',
                minWidth: '140px',
                fontSize: '0.9rem'
              }}
            >
              <option value="">Todos los géneros</option>
              <option value="Hombre">Hombre</option>
              <option value="Mujer">Mujer</option>
            </select>
          </div>

          <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
            <label style={{fontWeight: '500', color: '#666', fontSize: '0.9rem'}}>
              <span style={{marginRight: '0.5rem'}}>🏷️</span>
              Categoría:
            </label>
            <select
              value={filtroCategoria}
              onChange={e => setFiltroCategoria(e.target.value)}
              disabled={!filtroGenero}
              style={{
                padding: '0.5rem',
                border: '1px solid #ced4da',
                borderRadius: '6px',
                minWidth: '200px',
                fontSize: '0.9rem',
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

          {(filtroGenero || filtroCategoria) && (
            <button
              onClick={() => {
                setFiltroGenero("");
                setFiltroCategoria("");
              }}
              style={{
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                fontSize: '0.9rem',
                cursor: 'pointer'
              }}
            >
              🗑️ Limpiar Filtros
            </button>
          )}
        </div>

        {(filtroGenero || filtroCategoria) && (
          <div style={{
            marginTop: '1rem',
            padding: '0.75rem',
            backgroundColor: '#e3f2fd',
            borderRadius: '6px',
            fontSize: '0.9rem',
            color: '#1565c0'
          }}>
            📊 Mostrando posiciones para: {filtroGenero ? `${filtroGenero}` : 'Todos los géneros'}{filtroCategoria ? ` - ${filtroCategoria}` : ''}
          </div>
        )}
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
                        <th>
                          <div className="th-content">
                            <span className="th-icon">🥅</span>
                            GF
                          </div>
                        </th>
                      )}
                      <th>
                        <div className="th-content">
                          <span className="th-icon">🚫</span>
                          {discipline === "voley" ? "PC" : "GC"}
                        </div>
                      </th>
                      {discipline === "futbol" && (
                        <>
                          <th>
                            <div className="th-content">
                              <span className="th-icon">📊</span>
                              DG
                            </div>
                          </th>
                          <th>
                            <div className="th-content">
                              <span className="th-icon">🏆</span>
                              PTS
                            </div>
                          </th>
                        </>
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
                        {discipline === "futbol" ? (
                          <td className="table-cell draws" style={{ color: team.eliminado ? 'rgba(244, 67, 54, 0.8)' : '' }}>{team.pe}</td>
                        ) : null}
                        <td className="table-cell losses" style={{ color: team.eliminado ? 'rgba(244, 67, 54, 0.8)' : '' }}>{team.pp}</td>
                        {discipline === "futbol" ? (
                          <td className="table-cell goals-for" style={{ color: team.eliminado ? 'rgba(244, 67, 54, 0.8)' : '' }}>{team.gf}</td>
                        ) : null}
                        <td className="table-cell goals-against" style={{ color: team.eliminado ? 'rgba(244, 67, 54, 0.8)' : '' }}>{team.gc}</td>
                        {discipline === "futbol" ? (
                          <>
                            <td
                              className={`table-cell goal-diff ${team.dg >= 0 ? "positive" : "negative"}`}
                              style={{ color: team.eliminado ? 'rgba(244, 67, 54, 0.8)' : '' }}
                            >
                              {team.dg > 0 ? "+" : ""}
                              {team.dg}
                            </td>
                            <td className="points-cell">
                              <span className="points-badge" style={{ color: team.eliminado ? 'rgba(244, 67, 54, 0.8)' : '' }}>{team.pts}</span>
                            </td>
                          </>
                        ) : null}
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
