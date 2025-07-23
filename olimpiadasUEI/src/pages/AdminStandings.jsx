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
import "../styles/AdminStandings.css";
import Bracket from "../components/Bracket";

export default function AdminStandings() {
  const { discipline } = useParams();
  const [matches, setMatches] = useState([]);
  const [equipos, setEquipos] = useState([]);
  const [standingsPorGrupo, setStandingsPorGrupo] = useState({});
  const [loading, setLoading] = useState(true);
  const [showBracket, setShowBracket] = useState(false);
  const [grupoBracket, setGrupoBracket] = useState(null);

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

    // Filtrar solo equipos que realmente pertenecen a grupos válidos (Grupo 1, Grupo 2, etc.)
    const equiposConGrupoValido = equipos.filter(
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

    console.log("Resultado final standings:", standingsPorGrupoTemp);
    setStandingsPorGrupo(standingsPorGrupoTemp);

    // Generar partidos de octavos automáticamente (puedes eliminar esta parte si ya no usas octavos)
    /*
    Object.entries(standingsPorGrupoTemp).forEach(async ([grupo, standings]) => {
      if (
        standings.length >= 6 &&
        standings.every(team => team.pj >= 2)
      ) {
        // Verifica si ya existen partidos de octavos para este grupo
        const octavosQuery = query(
          collection(db, "matches"),
          where("grupo", "==", grupo),
          where("fase", "==", "octavos")
        );
        const octavosSnapshot = await getDocs(octavosQuery);
        if (octavosSnapshot.empty) {
          // Emparejamientos: 1 vs 6, 2 vs 5, 3 vs 4
          const emparejamientos = [
            [0, 5],
            [1, 4],
            [2, 3],
          ];
          for (let i = 0; i < emparejamientos.length; i++) {
            const [idxA, idxB] = emparejamientos[i];
            const equipoA = standings[idxA];
            const equipoB = standings[idxB];
            if (!equipoA || !equipoB) continue;
            await addDoc(collection(db, "matches"), {
              equipoA: { curso: equipoA.nombre.split(" ")[0], paralelo: equipoA.nombre.split(" ")[1] },
              equipoB: { curso: equipoB.nombre.split(" ")[0], paralelo: equipoB.nombre.split(" ")[1] },
              disciplina: discipline,
              marcadorA: 0,
              marcadorB: 0,
              estado: "pendiente",
              fecha: null,
              hora: null,
              grupo: grupo,
              fase: "octavos",
              goleadoresA: [],
              goleadoresB: [],
            });
          }
        }
      }
    });
    */
  }, [matches, equipos, discipline]);

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

  // Obtener partidos de semifinal y final del grupo seleccionado para el bracket
  let semifinales = ["Por definir", "Por definir"];
  let final = "Por definir";
  if (showBracket && grupoBracket) {
    const semisGrupo = matches.filter(
      (m) => m.grupo === grupoBracket && m.fase === "semifinal",
    );
    const finalGrupo = matches.find(
      (m) => m.grupo === grupoBracket && m.fase === "final",
    );
    
    // Limitar a máximo 2 semifinales
    const semisLimitadas = semisGrupo.slice(0, 2);
    
    if (semisLimitadas.length >= 1) {
      semifinales[0] = `${semisLimitadas[0].equipoA.curso} ${semisLimitadas[0].equipoA.paralelo} vs ${semisLimitadas[0].equipoB.curso} ${semisLimitadas[0].equipoB.paralelo}`;
    }
    if (semisLimitadas.length >= 2) {
      semifinales[1] = `${semisLimitadas[1].equipoA.curso} ${semisLimitadas[1].equipoA.paralelo} vs ${semisLimitadas[1].equipoB.curso} ${semisLimitadas[1].equipoB.paralelo}`;
    }
    
    if (finalGrupo) {
      final = `${finalGrupo.equipoA.curso} ${finalGrupo.equipoA.paralelo} vs ${finalGrupo.equipoB.curso} ${finalGrupo.equipoB.paralelo}`;
    }
  }

  return (
    <div className="admin-standings-container">
      {/* Header moderno */}
      <div className="admin-header">
        <div className="header-icon">🏆</div>
        <h1 className="admin-title">Tabla de Posiciones</h1>
        <p className="admin-subtitle">
          Clasificación actual de{" "}
          {discipline === "futbol"
            ? "Fútbol"
            : discipline === "voley"
              ? "Vóley"
              : "Básquet"}
        </p>
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
                <button
                  className="bracket-btn"
                  onClick={() => {
                    setGrupoBracket(grupo);
                    setShowBracket(true);
                  }}
                >
                  <span className="btn-icon">🎯</span>
                  <span>Ver Bracket</span>
                </button>
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
                        {discipline === "futbol" ? (
                          <td className="table-cell draws" style={{ color: team.eliminado ? '#757575' : '' }}>{team.pe}</td>
                        ) : null}
                        <td className="table-cell losses" style={{ color: team.eliminado ? '#757575' : '' }}>{team.pp}</td>
                        {discipline === "futbol" ? (
                          <td className="table-cell goals-for" style={{ color: team.eliminado ? '#757575' : '' }}>{team.gf}</td>
                        ) : null}
                        <td className="table-cell goals-against" style={{ color: team.eliminado ? '#757575' : '' }}>{team.gc}</td>
                        {discipline === "futbol" ? (
                          <>
                            <td
                              className={`table-cell goal-diff ${team.dg >= 0 ? "positive" : "negative"}`}
                              style={{ color: team.eliminado ? '#757575' : '' }}
                            >
                              {team.dg > 0 ? "+" : ""}
                              {team.dg}
                            </td>
                            <td className="points-cell">
                              <span className="points-badge" style={{ color: team.eliminado ? '#757575' : '' }}>{team.pts}</span>
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

      {/* Modal Bracket por grupo */}
      {showBracket && grupoBracket && (
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
            <h3>Llave del grupo {grupoBracket}</h3>
            <Bracket
              octavos={["Por definir", "Por definir", "Por definir"]}
              cuartos={["Por definir", "Por definir"]}
              semifinales={semifinales}
              final={final}
              tercerLugar="Por definir"
            />
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginTop: 16,
              }}
            >
              <button
                onClick={() => setShowBracket(false)}
                style={{
                  background: "#eee",
                  border: "none",
                  borderRadius: 4,
                  padding: "0.5rem 1rem",
                  cursor: "pointer",
                }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
