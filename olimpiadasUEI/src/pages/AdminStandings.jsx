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
  const [filtroGenero, setFiltroGenero] = useState(() => {
    return localStorage.getItem('olimpiadas_filtro_genero') || "";
  });
  const [filtroNivelEducacional, setFiltroNivelEducacional] = useState(() => {
    return localStorage.getItem('olimpiadas_filtro_nivel_educacional') || "";
  });
  const [filtroCategoria, setFiltroCategoria] = useState(() => {
    return localStorage.getItem('olimpiadas_filtro_categoria') || "";
  });
  const [categorias, setCategorias] = useState([]);
  const [nivelesEducacionales, setNivelesEducacionales] = useState([]);

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

  // Funciones para manejar filtros persistentes
  const handleFiltroGeneroChange = (genero) => {
    setFiltroGenero(genero);
    setFiltroNivelEducacional(""); // Limpiar nivel al cambiar género
    setFiltroCategoria(""); // Limpiar categoría al cambiar género
    if (genero) {
      localStorage.setItem('olimpiadas_filtro_genero', genero);
    } else {
      localStorage.removeItem('olimpiadas_filtro_genero');
    }
    localStorage.removeItem('olimpiadas_filtro_nivel_educacional');
    localStorage.removeItem('olimpiadas_filtro_categoria');
  };

  const handleFiltroNivelEducacionalChange = (nivel) => {
    setFiltroNivelEducacional(nivel);
    setFiltroCategoria(""); // Limpiar categoría al cambiar nivel
    if (nivel) {
      localStorage.setItem('olimpiadas_filtro_nivel_educacional', nivel);
    } else {
      localStorage.removeItem('olimpiadas_filtro_nivel_educacional');
    }
    localStorage.removeItem('olimpiadas_filtro_categoria');
  };

  const handleFiltroCategoriaChange = (categoria) => {
    setFiltroCategoria(categoria);
    if (categoria) {
      localStorage.setItem('olimpiadas_filtro_categoria', categoria);
    } else {
      localStorage.removeItem('olimpiadas_filtro_categoria');
    }
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

  // Obtener niveles educacionales desde Firestore
  const obtenerNivelesEducacionales = async () => {
    try {
      const q = query(
        collection(db, "nivelesEducacionales"),
        where("disciplina", "==", discipline)
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setNivelesEducacionales(data);
    } catch (error) {
      console.error("Error obteniendo niveles educacionales:", error);
    }
  };

  // Cargar categorías y niveles al iniciar
  useEffect(() => {
    obtenerCategorias();
    obtenerNivelesEducacionales();
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

    // ✅ NO MOSTRAR NADA SI NO ESTÁN TODOS LOS FILTROS SELECCIONADOS
    if (!filtroGenero || !filtroNivelEducacional || !filtroCategoria) {
      console.log("Filtros incompletos - no mostrar tabla");
      setStandingsPorGrupo({});
      return;
    }

    // Aplicar filtros de género, nivel educacional y categoría
    const equiposFiltrados = equipos.filter(equipo => {
      const pasaGenero = equipo.genero === filtroGenero;
      const pasaNivel = equipo.nivelEducacional === filtroNivelEducacional;
      const pasaCategoria = equipo.categoria === filtroCategoria;
      return pasaGenero && pasaNivel && pasaCategoria;
    });

    console.log("Equipos filtrados:", equiposFiltrados);

    // Verificar si hay equipos con grupos múltiples válidos
    const equiposConGrupoMultiple = equiposFiltrados.filter(
      (equipo) =>
        equipo.grupo &&
        (equipo.grupo.includes("Grupo") || equipo.grupo.includes("grupo"))
    );

    console.log("Equipos con grupo múltiple:", equiposConGrupoMultiple);

    // Agrupar equipos por grupo o crear un grupo único
    const equiposPorGrupo = {};
    
    if (equiposConGrupoMultiple.length > 0) {
      // Si hay equipos con grupos múltiples, agrupar por grupo
      equiposConGrupoMultiple.forEach((equipo) => {
        const grupo = equipo.grupo;
        if (!equiposPorGrupo[grupo]) equiposPorGrupo[grupo] = [];
        equiposPorGrupo[grupo].push(equipo);
      });
    } else {
      // Si no hay grupos múltiples, crear una tabla única con todos los equipos filtrados
      const nombreGrupo = filtroCategoria; // Usar el nombre de la categoría como nombre del grupo
      equiposPorGrupo[nombreGrupo] = equiposFiltrados;
    }

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

      // Filtrar partidos que corresponden específicamente a este grupo y filtros
      const partidosDelGrupo = matches.filter((match) => {
        // Verificar que el partido esté finalizado
        if (match.estado !== "finalizado") return false;
        
        // Verificar filtros básicos
        if (match.genero !== filtroGenero) return false;
        if (match.nivelEducacional !== filtroNivelEducacional) return false;
        if (match.categoria !== filtroCategoria) return false;
        
        // Verificar que ambos equipos pertenezcan a este grupo
        const equipoAPertenece = equiposGrupo.some(
          (eq) => `${eq.curso} ${eq.paralelo}` === `${match.equipoA.curso} ${match.equipoA.paralelo}`
        );
        const equipoBPertenece = equiposGrupo.some(
          (eq) => `${eq.curso} ${eq.paralelo}` === `${match.equipoB.curso} ${match.equipoB.paralelo}`
        );
        
        if (!equipoAPertenece || !equipoBPertenece) return false;
        
        // Si hay múltiples grupos, verificar que el partido sea del grupo correcto
        if (equiposConGrupoMultiple.length > 0) {
          return match.grupo === grupo;
        }
        
        // Si no hay grupos múltiples, incluir todos los partidos que cumplan los filtros
        return true;
      });

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
        
        // Mostrar todos los equipos del grupo, incluso si no han jugado
        // Solo filtrar equipos con partidos si TODOS los equipos han jugado al menos 1 partido
        const equiposConPartidos = result.filter(team => team.pj > 0);
        const todosHanJugado = result.every(team => team.pj > 0);
        
        if (todosHanJugado && equiposConPartidos.length > 0) {
          result = equiposConPartidos;
        }
        // Si no todos han jugado, mostrar todos los equipos para mantener la integridad del grupo
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
        
        // ⚠️  SISTEMA LEGACY DESHABILITADO - Ahora se usa generación automática centralizada
        // La generación automática de fases finales se maneja desde:
        // - AdminMatches.jsx (verificarYGenerarFasesFinalesPostPartidoConEstado) 
        // - AdminMatchDetail.jsx (generarFasesFinalesAutomaticas)
        console.log(`✅ Sistema legacy deshabilitado para ${grupo} - generación automática centralizada activa`);
      }
    });
  }, [matches, equipos, discipline, filtroGenero, filtroNivelEducacional, filtroCategoria]);

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
                handleFiltroGeneroChange(e.target.value);
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
              <span style={{marginRight: '0.5rem'}}>�</span>
              Nivel Educacional:
            </label>
            <select
              value={filtroNivelEducacional}
              onChange={e => handleFiltroNivelEducacionalChange(e.target.value)}
              disabled={!filtroGenero}
              style={{
                padding: '0.5rem',
                border: '1px solid #ced4da',
                borderRadius: '6px',
                minWidth: '180px',
                fontSize: '0.9rem',
                backgroundColor: !filtroGenero ? '#f5f5f5' : '',
                color: !filtroGenero ? '#999' : '',
                cursor: !filtroGenero ? 'not-allowed' : 'pointer'
              }}
            >
              <option value="">Todos los niveles</option>
              {nivelesEducacionales
                .filter(nivel => !filtroGenero || nivel.genero === filtroGenero)
                .map(nivel => (
                  <option key={nivel.id} value={nivel.nombre}>{nivel.nombre}</option>
                ))}
            </select>
          </div>

          <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
            <label style={{fontWeight: '500', color: '#666', fontSize: '0.9rem'}}>
              <span style={{marginRight: '0.5rem'}}>�🏷️</span>
              Categoría:
            </label>
            <select
              value={filtroCategoria}
              onChange={e => handleFiltroCategoriaChange(e.target.value)}
              disabled={!filtroGenero || !filtroNivelEducacional}
              style={{
                padding: '0.5rem',
                border: '1px solid #ced4da',
                borderRadius: '6px',
                minWidth: '200px',
                fontSize: '0.9rem',
                backgroundColor: (!filtroGenero || !filtroNivelEducacional) ? '#f5f5f5' : '',
                color: (!filtroGenero || !filtroNivelEducacional) ? '#999' : '',
                cursor: (!filtroGenero || !filtroNivelEducacional) ? 'not-allowed' : 'pointer'
              }}
            >
              <option value="">Todas las categorías</option>
              {categorias
                .filter(cat => 
                  (!filtroGenero || cat.genero === filtroGenero) &&
                  (!filtroNivelEducacional || cat.nivelEducacional === filtroNivelEducacional)
                )
                .map(cat => (
                  <option key={cat.id} value={cat.nombre}>{cat.nombre}</option>
                ))}
            </select>
          </div>

          {(filtroGenero || filtroCategoria) && (
            <button
              onClick={() => {
                setFiltroGenero("");
                setFiltroNivelEducacional("");
                setFiltroCategoria("");
                localStorage.removeItem('olimpiadas_filtro_genero');
                localStorage.removeItem('olimpiadas_filtro_nivel_educacional');
                localStorage.removeItem('olimpiadas_filtro_categoria');
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

        {(filtroGenero && filtroNivelEducacional && filtroCategoria) && (
          <div style={{
            marginTop: '1rem',
            padding: '0.75rem',
            backgroundColor: '#e3f2fd',
            borderRadius: '6px',
            fontSize: '0.9rem',
            color: '#1565c0'
          }}>
            📊 Mostrando posiciones para: {filtroGenero} - {filtroNivelEducacional} - {filtroCategoria}
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
                        <div className="th-content" title="Posición en la tabla">
                          <span className="th-icon">#</span>
                          Pos
                        </div>
                      </th>
                      <th>
                        <div className="th-content" title="Nombre del equipo">
                          <span className="th-icon">👥</span>
                          Equipo
                        </div>
                      </th>
                      <th>
                        <div className="th-content" title="Partidos Jugados">
                          <span className="th-icon">⚽</span>
                          PJ
                        </div>
                      </th>
                      <th>
                        <div className="th-content" title="Partidos Ganados">
                          <span className="th-icon">✅</span>
                          PG
                        </div>
                      </th>
                      {discipline === "futbol" && (
                        <th>
                          <div className="th-content" title="Partidos Empatados">
                            <span className="th-icon">🤝</span>
                            PE
                          </div>
                        </th>
                      )}
                      <th>
                        <div className="th-content" title="Partidos Perdidos">
                          <span className="th-icon">❌</span>
                          PP
                        </div>
                      </th>
                      {discipline === "futbol" && (
                        <th>
                          <div className="th-content" title="Goles a Favor">
                            <span className="th-icon">🥅</span>
                            GF
                          </div>
                        </th>
                      )}
                      <th>
                        <div className="th-content" title={discipline === "voley" ? "Puntos en Contra" : "Goles en Contra"}>
                          <span className="th-icon">🚫</span>
                          {discipline === "voley" ? "PC" : "GC"}
                        </div>
                      </th>
                      {discipline === "futbol" && (
                        <>
                          <th>
                            <div className="th-content" title="Diferencia de Goles (Goles a Favor - Goles en Contra)">
                              <span className="th-icon">📊</span>
                              DG
                            </div>
                          </th>
                          <th>
                            <div className="th-content" title="Puntos Totales (Victoria = 3pts, Empate = 1pt, Derrota = 0pts)">
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
                        key={`${grupo}-${team.nombre}-${idx}`}
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
