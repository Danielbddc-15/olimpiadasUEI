import { useEffect, useState } from "react";
import { collection, getDocs, onSnapshot, query } from "firebase/firestore";
import { useParams } from "react-router-dom";
import { db } from "../firebase/config";
import "../styles/PublicTournament.css";

export default function PublicStandings() {
  const [equipos, setEquipos] = useState([]);
  const [matches, setMatches] = useState([]);
  const [standingsPorGrupo, setStandingsPorGrupo] = useState({});
  const [grupos, setGrupos] = useState([]);
  const [grupoActual, setGrupoActual] = useState("");
  const { discipline } = useParams();

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

    const equiposConGrupoValido = equipos.filter(
      (equipo) =>
        equipo.grupo &&
        (equipo.grupo.includes("Grupo") || equipo.grupo.includes("grupo"))
    );

    const equiposPorGrupo = {};
    equiposConGrupoValido.forEach((equipo) => {
      const grupo = equipo.grupo;
      if (!equiposPorGrupo[grupo]) equiposPorGrupo[grupo] = [];
      equiposPorGrupo[grupo].push(equipo);
    });

    const standingsPorGrupoTemp = {};

    Object.entries(equiposPorGrupo).forEach(([grupo, equiposGrupo]) => {
      const table = {};

      equiposGrupo.forEach((equipo) => {
        const nombre = `${equipo.curso} ${equipo.paralelo}`;
        table[nombre] = createTeamEntry(nombre, grupo);
      });

      const partidosDelGrupo = matches.filter(
        (match) =>
          match.estado === "finalizado" &&
          match.grupo === grupo &&
          equiposGrupo.some(
            (eq) =>
              `${eq.curso} ${eq.paralelo}` ===
              `${match.equipoA.curso} ${match.equipoA.paralelo}`
          ) &&
          equiposGrupo.some(
            (eq) =>
              `${eq.curso} ${eq.paralelo}` ===
              `${match.equipoB.curso} ${match.equipoB.paralelo}`
          )
      );

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
  }, [matches, equipos]);

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
          {grupos.map((grupo) => (
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

      <div className="section-header">
        <h2 className="section-title">
          <span className="title-icon">🏆</span>
          Tabla de Posiciones
        </h2>
        <p className="section-subtitle">
          Clasificación actual del {grupoActual}
        </p>
      </div>

      <div className="standings-container">
        <div className="modern-table-wrapper">
          <table className="modern-table standings-table">
            <thead>
              <tr>
                <th className="position-header">
                  <span className="th-content">
                    <span className="th-icon">#</span>
                    Pos
                  </span>
                </th>
                <th className="team-header">
                  <span className="th-content">
                    <span className="th-icon">👥</span>
                    Equipo
                  </span>
                </th>
                <th>
                  <span className="th-content">
                    <span className="th-icon">⚽</span>
                    PJ
                  </span>
                </th>
                <th>
                  <span className="th-content">
                    <span className="th-icon">✅</span>
                    PG
                  </span>
                </th>
                {discipline === "futbol" && (
                  <th>
                    <span className="th-content">
                      <span className="th-icon">🤝</span>
                      PE
                    </span>
                  </th>
                )}
                <th>
                  <span className="th-content">
                    <span className="th-icon">❌</span>
                    PP
                  </span>
                </th>
                {discipline === "futbol" && (
                  <th>
                    <span className="th-content">
                      <span className="th-icon">🥅</span>
                      GF
                    </span>
                  </th>
                )}
                <th>
                  <span className="th-content">
                    <span className="th-icon">🚫</span>
                    {discipline === "voley" ? "PC" : "GC"}
                  </span>
                </th>
                {discipline === "futbol" && (
                  <>
                    <th>
                      <span className="th-content">
                        <span className="th-icon">📊</span>
                        DG
                      </span>
                    </th>
                    <th className="points-header">
                      <span className="th-content">
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
                  key={team.nombre} 
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

        {(standingsPorGrupo[grupoActual] || []).length === 0 && (
          <div className="no-data">
            <div className="no-data-icon">📊</div>
            <p>No hay datos de posiciones disponibles para este grupo</p>
          </div>
        )}
      </div>
    </div>
  );
}