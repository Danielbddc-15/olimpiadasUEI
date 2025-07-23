import { useEffect, useState } from "react";
import { db } from "../firebase/config";
import {
  collection,
  getDocs,
  updateDoc,
  doc,
  query,
  where,
  onSnapshot,
  addDoc,
} from "firebase/firestore";
import { Link, useLocation } from "react-router-dom";
import { useParams } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import "../styles/ProfesorMatches.css";

export default function ProfesorMatches() {
  const { discipline } = useParams();
  const [matches, setMatches] = useState([]);
  const [editingMatchId, setEditingMatchId] = useState(null);
  const [editedMatch, setEditedMatch] = useState({ fecha: "", hora: "" });
  const [grupos, setGrupos] = useState([]);
  const [equipos, setEquipos] = useState([]);
  const [faseActual, setFaseActual] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();

  // Función para navegar al detalle del partido
  const irADetallePartido = (matchId) => {
    // Redireccionar según la disciplina
    if (discipline === "voley") {
      navigate(`/profesor-voley-match-detail/${matchId}`);
    } else if (discipline === "basquet") {
      navigate(`/profesor-basquet-match-detail/${matchId}`);
    } else {
      navigate(`/profesor-match-detail/${matchId}`);
    }
  };

  // Funciones de navegación
  const goToStandings = () => {
    navigate(`/profesor/${discipline}/tabla`);
  };

  const goToSchedule = () => {
    navigate(`/profesor/${discipline}/horarios`);
  };

  const goToPanel = () => {
    navigate('/profesor');
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

  // Filtrar partidos por fase
  const partidosPorFase = (fase) =>
    matches.filter((m) => (m.fase || "grupos1") === fase);

  // Handlers
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
    // Actualiza el partido en el estado local
    setMatches((prev) =>
      prev.map((m) =>
        m.id === id
          ? { ...m, marcadorA, marcadorB, goleadoresA, goleadoresB }
          : m,
      ),
    );
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
    // Actualiza el partido en el estado local
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
  const partidosPorGrupo = agruparPorGrupo(partidos);
  return (
    <>
      {grupos.map((grupo) =>
        partidosPorGrupo[grupo] && partidosPorGrupo[grupo].length > 0 ? (
          <div key={grupo} className="match-group">
            <h3 style={{ textAlign: "center", margin: "1.5rem 0 0.5rem" }}>
              {grupo}
            </h3>
            <table className="admin-matches-table">
              <thead>
                <tr>
                  <th>Equipo A</th>
                  <th>Equipo B</th>
                  <th>Marcador</th>
                  <th>Estado</th>
                  <th>Fecha</th>
                  <th>Hora</th>
                </tr>
              </thead>
              <tbody>
                {partidosPorGrupo[grupo].map((match) => (
                  <tr 
                    key={match.id}
                    onClick={() => irADetallePartido(match.id)}
                    style={{ cursor: "pointer" }}
                    className="clickable-row"
                  >
                    <td>{match.equipoA?.curso} {match.equipoA?.paralelo}</td>
                    <td>{match.equipoB?.curso} {match.equipoB?.paralelo}</td>
                    <td>
                      {match.marcadorA ?? 0} - {match.marcadorB ?? 0}
                    </td>
                    <td>
                      {match.estado === "finalizado" ? (
                        <span style={{ color: "green", fontWeight: "bold" }}>✅ Finalizado</span>
                      ) : match.estado === "en curso" ? (
                        <span style={{ color: "#2563eb", fontWeight: "bold" }}>🟢 En curso</span>
                      ) : (
                        <span style={{ color: "orange", fontWeight: "bold" }}>⏳ Pendiente</span>
                      )}
                    </td>
                    <td>{match.fecha || "Por definir"}</td>
                    <td>{match.hora || "Por definir"}</td>
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
    <div className="profesor-matches-container">
      {/* Header moderno para profesor */}
      <div className="profesor-header">
        <div className="header-icon">
          {discipline === "futbol"
            ? "⚽"
            : discipline === "voley"
              ? "🏐"
              : "🏀"}
        </div>
        <h1 className="profesor-title">Supervisión de Partidos</h1>
        <p className="profesor-subtitle">
          Monitorea y actualiza los encuentros de{" "}
          {discipline === "futbol"
            ? "Fútbol"
            : discipline === "voley"
              ? "Vóley"
              : "Básquet"}
        </p>
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

      {/* Tabla de partidos */}
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
    </div>
  );
}
