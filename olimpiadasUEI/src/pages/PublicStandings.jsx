import { useEffect, useState } from "react";
import { collection, getDocs, onSnapshot, query } from "firebase/firestore";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../firebase/config";
import "../styles/PublicTournament.css";

export default function PublicStandings() {
  const [equipos, setEquipos] = useState([]);
  const [matches, setMatches] = useState([]);
  const [standingsPorGrupo, setStandingsPorGrupo] = useState({});
  const [grupos, setGrupos] = useState([]);
  const [grupoActual, setGrupoActual] = useState("");
  const { discipline } = useParams();
  const navigate = useNavigate();

  // Funciones de navegación
  const goToDisciplineSelector = () => {
    navigate('/selector');
  };

  const goToLogin = () => {
    navigate('/');
  };

  // Estados de filtros avanzados
  const [filtroGenero, setFiltroGenero] = useState(() => {
    return localStorage.getItem(`olimpiadas_public_standings_filtro_genero_${discipline}`) || "";
  });
  const [filtroNivelEducacional, setFiltroNivelEducacional] = useState(() => {
    return localStorage.getItem(`olimpiadas_public_standings_filtro_nivel_educacional_${discipline}`) || "";
  });
  const [filtroCategoria, setFiltroCategoria] = useState(() => {
    return localStorage.getItem(`olimpiadas_public_standings_filtro_categoria_${discipline}`) || "";
  });

  // Cargar grupos
  useEffect(() => {
    const fetchGrupos = async () => {
      const snapshot = await getDocs(collection(db, "grupos"));
      const data = snapshot.docs.map((doc) => doc.data().nombre);
      setGrupos(data);
      setGrupoActual(data[0] || "");
    };
    fetchGrupos();
  }, []);

  // Cargar equipos
  useEffect(() => {
    const fetchEquipos = async () => {
      const snapshot = await getDocs(collection(db, "equipos"));
      const data = snapshot.docs.map((doc) => doc.data());
      setEquipos(data.filter((eq) => eq.disciplina === discipline));
    };
    fetchEquipos();
  }, [discipline]);

  // Escuchar partidos en tiempo real
  useEffect(() => {
    const q = query(collection(db, "matches"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setMatches(data.filter((m) => m.disciplina === discipline));
    });
    return () => unsubscribe();
  }, [discipline]);

  // Calcular standings por grupo
  useEffect(() => {
    if (equipos.length === 0) return;

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

    // Verificar si hay equipos con grupos múltiples válidos
    const equiposConGrupoMultiple = equiposFiltrados.filter(
      (equipo) =>
        equipo.grupo &&
        (equipo.grupo.includes("Grupo") || equipo.grupo.includes("grupo"))
    );

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

    const standingsPorGrupoTemp = {};

    Object.entries(equiposPorGrupo).forEach(([grupo, equiposGrupo]) => {
      const table = {};

      equiposGrupo.forEach((equipo) => {
        const nombre = `${equipo.curso} ${equipo.paralelo}`;
        table[nombre] = createTeamEntry(nombre, grupo);
      });

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

      partidosDelGrupo.forEach((match) => {
        const { equipoA, equipoB, marcadorA, marcadorB } = match;
        if (marcadorA === null || marcadorB === null) return;

        const keyA = `${equipoA.curso} ${equipoA.paralelo}`;
        const keyB = `${equipoB.curso} ${equipoB.paralelo}`;

        if (!table[keyA] || !table[keyB]) return;

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

      // Para vóley: marcar equipos eliminados
      if (discipline === "voley") {
        // Verificar qué equipos están activos según los partidos más recientes
        const todosLosPartidos = matches.filter(m => 
          m.grupo === grupo && 
          m.estado === "finalizado"
        );
        
        // Obtener la fase más avanzada con partidos en este grupo
        const fasesConPartidos = ['grupos3', 'grupos2', 'grupos1'];
        let faseActual = 'grupos1';
        
        for (const fase of fasesConPartidos) {
          const partidosFase = todosLosPartidos.filter(m => m.fase === fase);
          if (partidosFase.length > 0) {
            faseActual = fase;
            break;
          }
        }
        
        // Marcar equipos como eliminados o activos
        const equiposEnFaseReciente = new Set();
        
        if (faseActual === 'grupos2' || faseActual === 'grupos3') {
          todosLosPartidos
            .filter(m => m.fase === faseActual)
            .forEach(match => {
              equiposEnFaseReciente.add(`${match.equipoA.curso} ${match.equipoA.paralelo}`);
              equiposEnFaseReciente.add(`${match.equipoB.curso} ${match.equipoB.paralelo}`);
            });
        }
        
        // Marcar estado de cada equipo
        result = result.map(team => ({
          ...team,
          eliminado: team.pj > 0 && (
            (faseActual === 'grupos2' || faseActual === 'grupos3') 
              ? !equiposEnFaseReciente.has(team.nombre)
              : false
          )
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
          }
          return 0;
        });
        
        // Filtrar equipos con 0 partidos jugados solo si hay equipos activos
        const equiposConPartidos = result.filter(team => team.pj > 0);
        if (equiposConPartidos.length > 0) {
          result = equiposConPartidos;
        }
      }

      standingsPorGrupoTemp[grupo] = result;
    });

    setStandingsPorGrupo(standingsPorGrupoTemp);
  }, [matches, equipos, discipline, filtroGenero, filtroNivelEducacional, filtroCategoria]);

  // Funciones de filtros
  const limpiarFiltros = () => {
    setFiltroGenero("");
    setFiltroNivelEducacional("");
    setFiltroCategoria("");

    localStorage.removeItem(`olimpiadas_public_standings_filtro_genero_${discipline}`);
    localStorage.removeItem(`olimpiadas_public_standings_filtro_nivel_educacional_${discipline}`);
    localStorage.removeItem(`olimpiadas_public_standings_filtro_categoria_${discipline}`);
  };

  // Guardar filtros en localStorage
  useEffect(() => {
    if (filtroGenero) {
      localStorage.setItem(`olimpiadas_public_standings_filtro_genero_${discipline}`, filtroGenero);
    }
    if (filtroNivelEducacional) {
      localStorage.setItem(`olimpiadas_public_standings_filtro_nivel_educacional_${discipline}`, filtroNivelEducacional);
    }
    if (filtroCategoria) {
      localStorage.setItem(`olimpiadas_public_standings_filtro_categoria_${discipline}`, filtroCategoria);
    }
  }, [filtroGenero, filtroNivelEducacional, filtroCategoria, discipline]);

  // Limpiar filtros dependientes
  useEffect(() => {
    if (!filtroGenero) {
      setFiltroNivelEducacional("");
      setFiltroCategoria("");
    }
  }, [filtroGenero]);

  useEffect(() => {
    if (!filtroNivelEducacional) {
      setFiltroCategoria("");
    }
  }, [filtroNivelEducacional]);

  // Extraer opciones únicas para filtros
  const generosDisponibles = [...new Set(equipos.map(eq => eq.genero).filter(Boolean))];
  const nivelesDisponibles = filtroGenero
    ? [...new Set(equipos.filter(eq => eq.genero === filtroGenero).map(eq => eq.nivelEducacional).filter(Boolean))]
    : [...new Set(equipos.map(eq => eq.nivelEducacional).filter(Boolean))];
  const categoriasDisponibles = filtroNivelEducacional
    ? [...new Set(equipos.filter(eq => eq.genero === filtroGenero && eq.nivelEducacional === filtroNivelEducacional).map(eq => eq.categoria).filter(Boolean))]
    : filtroGenero
    ? [...new Set(equipos.filter(eq => eq.genero === filtroGenero).map(eq => eq.categoria).filter(Boolean))]
    : [...new Set(equipos.map(eq => eq.categoria).filter(Boolean))];

  // Filtrar grupos según los filtros aplicados
  const gruposFiltrados = Object.keys(standingsPorGrupo).filter(grupo => {
    const equiposDelGrupo = equipos.filter(eq => eq.grupo === grupo);
    if (equiposDelGrupo.length === 0) return true;

    return equiposDelGrupo.some(eq => {
      const matchesGenero = !filtroGenero || eq.genero === filtroGenero;
      const matchesNivel = !filtroNivelEducacional || eq.nivelEducacional === filtroNivelEducacional;
      const matchesCategoria = !filtroCategoria || eq.categoria === filtroCategoria;
      return matchesGenero && matchesNivel && matchesCategoria;
    });
  });

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
    <div className="section-container">
      {/* Selector de grupo */}
      <div className="group-selector">
        <h3 className="group-selector-title">Seleccionar Grupo</h3>
        <div className="group-buttons">
          {gruposFiltrados.map((grupo) => (
            <button
              key={grupo}
              onClick={() => setGrupoActual(grupo)}
              className={`group-button ${grupoActual === grupo ? "active" : ""}`}
            >
              <span className="group-icon">🏆</span>
              <span>{grupo}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="filter-controls">
        <div className="filters-row">
          <div className="filter-group">
            <label className="filter-label">🚻 Género:</label>
            <select
              value={filtroGenero}
              onChange={(e) => setFiltroGenero(e.target.value)}
              className="modern-select"
            >
              <option value="">Todos los géneros</option>
              {generosDisponibles.map((genero) => (
                <option key={genero} value={genero}>
                  {genero}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label className="filter-label">🎓 Nivel:</label>
            <select
              value={filtroNivelEducacional}
              onChange={(e) => setFiltroNivelEducacional(e.target.value)}
              className="modern-select"
              disabled={!filtroGenero}
            >
              <option value="">Todos los niveles</option>
              {nivelesDisponibles.map((nivel) => (
                <option key={nivel} value={nivel}>
                  {nivel}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label className="filter-label">🏷️ Categoría:</label>
            <select
              value={filtroCategoria}
              onChange={(e) => setFiltroCategoria(e.target.value)}
              className="modern-select"
              disabled={!filtroNivelEducacional}
            >
              <option value="">Todas las categorías</option>
              {categoriasDisponibles.map((categoria) => (
                <option key={categoria} value={categoria}>
                  {categoria}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={limpiarFiltros}
            className="clear-filters-btn"
            title="Limpiar todos los filtros"
            style={{
              padding: "8px 16px",
              backgroundColor: "#dc3545",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "500",
              transition: "background-color 0.2s"
            }}
          >
            🗑️ Limpiar
          </button>
        </div>
      </div>

      <div className="section-header">
        <div className="header-content">
          <h2 className="section-title">
            <span className="title-icon">🏆</span>
            Tabla de Posiciones
          </h2>
          <p className="section-subtitle">
            Clasificación actual del {grupoActual}
          </p>
        </div>
        <div className="header-actions">
          <button 
            onClick={goToDisciplineSelector}
            className="nav-btn secondary"
          >
            📋 Disciplinas
          </button>
          <button 
            onClick={goToLogin}
            className="nav-btn primary"
          >
            🚪 Salir
          </button>
        </div>
      </div>

      <div className="standings-container">
        {!filtroGenero || !filtroNivelEducacional || !filtroCategoria ? (
          <div className="filter-requirement-message" style={{
            textAlign: 'center',
            padding: '40px 20px',
            backgroundColor: '#f8f9fa',
            border: '2px dashed #dee2e6',
            borderRadius: '8px',
            margin: '20px 0'
          }}>
            <h3 style={{ color: '#6c757d', marginBottom: '10px' }}>
              📋 Selecciona todos los filtros para ver las posiciones
            </h3>
            <p style={{ color: '#6c757d', margin: 0 }}>
              Debes seleccionar género, nivel educacional y categoría para mostrar la tabla de posiciones
            </p>
          </div>
        ) : Object.keys(standingsPorGrupo).length === 0 ? (
          <div className="no-data">
            <div className="no-data-icon">📊</div>
            <p>No hay datos de posiciones disponibles para este grupo</p>
          </div>
        ) : (
        <div className="modern-table-wrapper">
          <table className="modern-table standings-table">
            <thead>
              <tr>
                <th className="position-header">
                  <span className="th-content" title="Posición en la tabla">
                    <span className="th-icon">#</span>
                    Pos
                  </span>
                </th>
                <th className="team-header">
                  <span className="th-content" title="Nombre del equipo">
                    <span className="th-icon">👥</span>
                    Equipo
                  </span>
                </th>
                <th>
                  <span className="th-content" title="Partidos Jugados">
                    <span className="th-icon">⚽</span>
                    PJ
                  </span>
                </th>
                <th>
                  <span className="th-content" title="Partidos Ganados">
                    <span className="th-icon">✅</span>
                    PG
                  </span>
                </th>
                {discipline === "futbol" && (
                  <th>
                    <span className="th-content" title="Partidos Empatados">
                      <span className="th-icon">🤝</span>
                      PE
                    </span>
                  </th>
                )}
                <th>
                  <span className="th-content" title="Partidos Perdidos">
                    <span className="th-icon">❌</span>
                    PP
                  </span>
                </th>
                {discipline === "futbol" && (
                  <th>
                    <span className="th-content" title="Goles a Favor">
                      <span className="th-icon">🥅</span>
                      GF
                    </span>
                  </th>
                )}
                <th>
                  <span className="th-content" title={discipline === "voley" ? "Puntos en Contra" : "Goles en Contra"}>
                    <span className="th-icon">🚫</span>
                    {discipline === "voley" ? "PC" : "GC"}
                  </span>
                </th>
                {discipline === "futbol" && (
                  <>
                    <th>
                      <span className="th-content" title="Diferencia de Goles (Goles a Favor - Goles en Contra)">
                        <span className="th-icon">📊</span>
                        DG
                      </span>
                    </th>
                    <th className="points-header">
                      <span className="th-content" title="Puntos Totales (Victoria = 3pts, Empate = 1pt, Derrota = 0pts)">
                        <span className="th-icon">🏆</span>
                        PTS
                      </span>
                    </th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {(standingsPorGrupo[grupoActual] || []).map((team, idx) => (
                <tr 
                  key={`${grupoActual}-${team.nombre}-${idx}`} 
                  className={`table-row position-${idx + 1} ${team.eliminado ? 'eliminated-team' : ''}`}
                  style={{
                    opacity: team.eliminado ? 0.6 : 1,
                    backgroundColor: team.eliminado ? '#ffebee' : 'transparent'
                  }}
                >
                  <td className="position-cell">
                    <span 
                      className={`position-badge position-${idx + 1} ${team.eliminado ? 'eliminated' : ''}`}
                      style={{
                        backgroundColor: team.eliminado ? '#f44336' : '',
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
                          color: team.eliminado ? '#757575' : '',
                          textDecoration: team.eliminado ? 'line-through' : 'none'
                        }}
                      >
                        {team.nombre}
                        {team.eliminado && (
                          <span style={{ 
                            marginLeft: '8px', 
                            fontSize: '0.8em', 
                            color: '#f44336',
                            fontWeight: 'bold'
                          }}>
                            ELIMINADO
                          </span>
                        )}
                      </span>
                    </div>
                  </td>
                  <td className="table-cell" style={{ color: team.eliminado ? '#757575' : '' }}>{team.pj}</td>
                  <td className="table-cell wins" style={{ color: team.eliminado ? '#757575' : '' }}>{team.pg}</td>
                  {discipline === "futbol" && (
                    <td className="table-cell draws" style={{ color: team.eliminado ? '#757575' : '' }}>{team.pe}</td>
                  )}
                  <td className="table-cell losses" style={{ color: team.eliminado ? '#757575' : '' }}>{team.pp}</td>
                  {discipline === "futbol" && (
                    <td className="table-cell goals-for" style={{ color: team.eliminado ? '#757575' : '' }}>{team.gf}</td>
                  )}
                  <td className="table-cell goals-against" style={{ color: team.eliminado ? '#757575' : '' }}>{team.gc}</td>
                  {discipline === "futbol" && (
                    <>
                      <td className={`table-cell goal-diff ${team.dg >= 0 ? "positive" : "negative"}`} style={{ color: team.eliminado ? '#757575' : '' }}>
                        {team.dg > 0 ? "+" : ""}{team.dg}
                      </td>
                      <td className="points-cell">
                        <span className="points-badge" style={{ color: team.eliminado ? '#757575' : '' }}>{team.pts}</span>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
      </div>
    </div>
  );
}
