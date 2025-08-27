import { useEffect, useState } from "react";
import { collection, getDocs, onSnapshot, query, where } from "firebase/firestore";
import { useParams } from "react-router-dom";
import { db } from "../firebase/config";
import "../styles/PublicTournament.css";

export default function PublicReport() {
  const [equipos, setEquipos] = useState([]);
  const [matches, setMatches] = useState([]);
  const [standingsPorGrupo, setStandingsPorGrupo] = useState({});
  const [busqueda, setBusqueda] = useState("");
  const [equipoSeleccionado, setEquipoSeleccionado] = useState(null);
  const [filtroGrupo, setFiltroGrupo] = useState("todos");
  const { discipline } = useParams();

  // Estados de filtros avanzados
  const [filtroGenero, setFiltroGenero] = useState(() => {
    return localStorage.getItem(`olimpiadas_public_report_filtro_genero_${discipline}`) || "";
  });
  const [filtroNivelEducacional, setFiltroNivelEducacional] = useState(() => {
    return localStorage.getItem(`olimpiadas_public_report_filtro_nivel_educacional_${discipline}`) || "";
  });
  const [filtroCategoria, setFiltroCategoria] = useState(() => {
    return localStorage.getItem(`olimpiadas_public_report_filtro_categoria_${discipline}`) || "";
  });

  // Cargar equipos en tiempo real
  useEffect(() => {
    const q = query(
      collection(db, "equipos"),
      where("disciplina", "==", discipline)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setEquipos(data);
    });
    return () => unsubscribe();
  }, [discipline]);

  // Escuchar partidos en tiempo real
  useEffect(() => {
    const q = query(
      collection(db, "matches"),
      where("disciplina", "==", discipline)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      console.log("Partidos cargados para disciplina:", discipline, data);
      setMatches(data);
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

  // Funciones de filtros
  const limpiarFiltros = () => {
    setFiltroGenero("");
    setFiltroNivelEducacional("");
    setFiltroCategoria("");

    localStorage.removeItem(`olimpiadas_public_report_filtro_genero_${discipline}`);
    localStorage.removeItem(`olimpiadas_public_report_filtro_nivel_educacional_${discipline}`);
    localStorage.removeItem(`olimpiadas_public_report_filtro_categoria_${discipline}`);
  };

  // Guardar filtros en localStorage
  useEffect(() => {
    if (filtroGenero) {
      localStorage.setItem(`olimpiadas_public_report_filtro_genero_${discipline}`, filtroGenero);
    }
    if (filtroNivelEducacional) {
      localStorage.setItem(`olimpiadas_public_report_filtro_nivel_educacional_${discipline}`, filtroNivelEducacional);
    }
    if (filtroCategoria) {
      localStorage.setItem(`olimpiadas_public_report_filtro_categoria_${discipline}`, filtroCategoria);
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

  // Aplicar filtros a los equipos
  const equiposFiltrados = equipos.filter(equipo => {
    if (filtroGenero && equipo.genero !== filtroGenero) return false;
    if (filtroNivelEducacional && equipo.nivelEducacional !== filtroNivelEducacional) return false;
    if (filtroCategoria && equipo.categoria !== filtroCategoria) return false;
    return true;
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

  // Componente de reporte por equipo
  function ReporteEquipo({ equipo }) {
    const nombreEquipo = `${equipo.curso} ${equipo.paralelo}`.trim();
    
    // Filtrar partidos de forma más precisa
    const partidos = matches.filter((m) => {
      // Verificar que el partido sea de la misma disciplina
      if (m.disciplina !== discipline) return false;
      
      // Verificar filtros de género, nivel y categoría si están aplicados
      if (filtroGenero && m.genero !== filtroGenero) return false;
      if (filtroNivelEducacional && m.nivelEducacional !== filtroNivelEducacional) return false;
      if (filtroCategoria && m.categoria !== filtroCategoria) return false;
      
      // Verificar que el equipo participe en el partido
      const equipoANombre = `${m.equipoA?.curso || ''} ${m.equipoA?.paralelo || ''}`.trim();
      const equipoBNombre = `${m.equipoB?.curso || ''} ${m.equipoB?.paralelo || ''}`.trim();
      
      const participaEnPartido = equipoANombre === nombreEquipo || equipoBNombre === nombreEquipo;
      
      return participaEnPartido;
    });

    console.log(`${nombreEquipo} - Total partidos encontrados: ${partidos.length}`);

    const partidosJugados = partidos.filter((m) => m.estado === "finalizado");
    const partidosPendientes = partidos.filter((m) => m.estado !== "finalizado");

    console.log(`${nombreEquipo} - Partidos jugados: ${partidosJugados.length}, Partidos pendientes: ${partidosPendientes.length}`);

    let ganados = 0, perdidos = 0, empatados = 0, puntos = 0, anotadores = [];
    partidos.forEach((m) => {
      let esA = `${m.equipoA?.curso} ${m.equipoA?.paralelo}` === nombreEquipo;
      let marcadorPropio = esA ? m.marcadorA : m.marcadorB;
      let marcadorRival = esA ? m.marcadorB : m.marcadorA;
      if (m.estado === "finalizado") {
        if (marcadorPropio > marcadorRival) ganados++;
        else if (marcadorPropio < marcadorRival) perdidos++;
        else empatados++;
      }
      puntos += marcadorPropio || 0;
      
      // Para vóley usar anotadores, para fútbol usar goleadores
      if (discipline === "voley") {
        if (esA && m.anotadoresA) anotadores = anotadores.concat(m.anotadoresA);
        if (!esA && m.anotadoresB) anotadores = anotadores.concat(m.anotadoresB);
      } else {
        if (esA && m.goleadoresA) anotadores = anotadores.concat(m.goleadoresA);
        if (!esA && m.goleadoresB) anotadores = anotadores.concat(m.goleadoresB);
      }
    });

    const tabla = standingsPorGrupo[equipo.grupo] || [];
    const posicion = tabla.findIndex((t) => t.nombre === nombreEquipo) + 1;

    const anotadoresCount = {};
    anotadores.forEach((g) => {
      anotadoresCount[g] = (anotadoresCount[g] || 0) + 1;
    });
    const listaAnotadores = Object.entries(anotadoresCount).sort((a, b) => b[1] - a[1]);

    const renderPartidoRow = (m, idx) => {
      const esA = `${m.equipoA?.curso} ${m.equipoA?.paralelo}` === nombreEquipo;
      const rival = esA
        ? `${m.equipoB?.curso} ${m.equipoB?.paralelo}`
        : `${m.equipoA?.curso} ${m.equipoA?.paralelo}`;
      const marcador = esA
        ? `${m.marcadorA ?? 0} - ${m.marcadorB ?? 0}`
        : `${m.marcadorB ?? 0} - ${m.marcadorA ?? 0}`;

      let resultadoColor = "#6c757d";
      let resultadoText = "";

      if (m.estado === "finalizado") {
        const marcadorPropio = esA ? m.marcadorA : m.marcadorB;
        const marcadorRival = esA ? m.marcadorB : m.marcadorA;

        if (marcadorPropio > marcadorRival) {
          resultadoColor = "#28a745";
          resultadoText = "Victoria";
        } else if (marcadorPropio < marcadorRival) {
          resultadoColor = "#dc3545";
          resultadoText = "Derrota";
        } else {
          resultadoColor = "#ffc107";
          resultadoText = "Empate";
        }
      }

      return (
        <tr key={idx} style={{ borderBottom: "1px solid #e9ecef" }}>
          <td style={{ padding: "12px 8px", fontWeight: "500" }}>{rival}</td>
          <td style={{ padding: "12px 8px", textAlign: "center", fontWeight: "bold", fontSize: "16px" }}>
            {marcador}
          </td>
          <td style={{ padding: "12px 8px", textAlign: "center" }}>
            {m.estado === "finalizado" ? (
              <span
                style={{
                  color: resultadoColor,
                  fontWeight: "bold",
                  padding: "4px 8px",
                  borderRadius: "4px",
                  backgroundColor: `${resultadoColor}20`,
                }}
              >
                {resultadoText}
              </span>
            ) : m.estado === "en curso" ? (
              <span style={{ color: "#2563eb", fontWeight: "bold", padding: "4px 8px", borderRadius: "4px", backgroundColor: "#2563eb20" }}>
                En curso
              </span>
            ) : (
              <span style={{ color: "#f39c12", fontWeight: "bold", padding: "4px 8px", borderRadius: "4px", backgroundColor: "#f39c1220" }}>
                Pendiente
              </span>
            )}
          </td>
          <td style={{ padding: "12px 8px", textAlign: "center", textTransform: "capitalize" }}>
            {m.fase || "grupos"}
          </td>
          <td style={{ padding: "12px 8px", textAlign: "center", color: "#6c757d" }}>
            {m.fecha || "Por definir"}
          </td>
        </tr>
      );
    };

    return (
      <div
        style={{
          background: "#fff",
          borderRadius: "12px",
          padding: "24px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
          border: "1px solid #e1e8ed",
        }}
      >
        {/* Header del equipo */}
        <div
          style={{
            textAlign: "center",
            marginBottom: "24px",
            padding: "20px",
            background: "linear-gradient(135deg, #2563eb, #3b82f6)",
            borderRadius: "8px",
            color: "#fff",
          }}
        >
          <h2 style={{ margin: "0 0 8px 0", fontSize: "28px", fontWeight: "bold" }}>
            {nombreEquipo}
          </h2>
          <p style={{ margin: "0", fontSize: "16px", opacity: "0.9" }}>
            {equipo.grupo}
          </p>
        </div>

        {/* Estadísticas generales */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "16px",
            marginBottom: "32px",
          }}
        >
          <div style={{ background: "#f8f9fa", padding: "16px", borderRadius: "8px", textAlign: "center", border: "1px solid #e9ecef" }}>
            <div style={{ fontSize: "24px", fontWeight: "bold", color: "#2563eb" }}>
              {posicion > 0 ? `#${posicion}` : "N/A"}
            </div>
            <div style={{ fontSize: "14px", color: "#6c757d", marginTop: "4px" }}>
              Posición en tabla
            </div>
          </div>

          <div style={{ background: "#f8f9fa", padding: "16px", borderRadius: "8px", textAlign: "center", border: "1px solid #e9ecef" }}>
            <div style={{ fontSize: "24px", fontWeight: "bold", color: "#28a745" }}>
              {ganados}
            </div>
            <div style={{ fontSize: "14px", color: "#6c757d", marginTop: "4px" }}>
              Victorias
            </div>
          </div>

          <div style={{ background: "#f8f9fa", padding: "16px", borderRadius: "8px", textAlign: "center", border: "1px solid #e9ecef" }}>
            <div style={{ fontSize: "24px", fontWeight: "bold", color: "#ffc107" }}>
              {empatados}
            </div>
            <div style={{ fontSize: "14px", color: "#6c757d", marginTop: "4px" }}>
              Empates
            </div>
          </div>

          <div style={{ background: "#f8f9fa", padding: "16px", borderRadius: "8px", textAlign: "center", border: "1px solid #e9ecef" }}>
            <div style={{ fontSize: "24px", fontWeight: "bold", color: "#dc3545" }}>
              {perdidos}
            </div>
            <div style={{ fontSize: "14px", color: "#6c757d", marginTop: "4px" }}>
              Derrotas
            </div>
          </div>

          <div style={{ background: "#f8f9fa", padding: "16px", borderRadius: "8px", textAlign: "center", border: "1px solid #e9ecef" }}>
            <div style={{ fontSize: "24px", fontWeight: "bold", color: "#17a2b8" }}>
              {puntos}
            </div>
            <div style={{ fontSize: "14px", color: "#6c757d", marginTop: "4px" }}>
              {discipline === "voley" ? "Puntos anotados" : "Goles anotados"}
            </div>
          </div>
        </div>

        {/* Anotadores/Goleadores */}
        <div style={{ background: "#f8f9fa", padding: "20px", borderRadius: "8px", marginBottom: "32px", border: "1px solid #e9ecef" }}>
          <h3 style={{ margin: "0 0 16px 0", color: "#2c3e50", fontSize: "18px", fontWeight: "bold" }}>
            🏆 {discipline === "voley" ? "Anotadores" : "Goleadores"}
          </h3>
          {listaAnotadores.length === 0 ? (
            <div style={{ color: "#6c757d", fontStyle: "italic", textAlign: "center", padding: "20px" }}>
              {discipline === "voley" ? "Sin puntos registrados" : "Sin goles registrados"}
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
              {listaAnotadores.map(([nombre, cantidad], idx) => (
                <div
                  key={idx}
                  style={{
                    background: "#fff",
                    padding: "12px 16px",
                    borderRadius: "6px",
                    border: "1px solid #e9ecef",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span style={{ fontWeight: "500" }}>{nombre}</span>
                  <span
                    style={{
                      background: "#2563eb",
                      color: "#fff",
                      padding: "4px 8px",
                      borderRadius: "12px",
                      fontSize: "12px",
                      fontWeight: "bold",
                    }}
                  >
                    {cantidad}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Partidos Jugados */}
        {partidosJugados.length > 0 && (
          <div style={{ marginBottom: "32px" }}>
            <h3 style={{ margin: "0 0 16px 0", color: "#2c3e50", fontSize: "20px", fontWeight: "bold", display: "flex", alignItems: "center", gap: "8px" }}>
              ✅ Partidos Jugados
              <span style={{ background: "#28a745", color: "#fff", padding: "4px 12px", borderRadius: "20px", fontSize: "14px" }}>
                {partidosJugados.length}
              </span>
            </h3>
            <div style={{ background: "#fff", borderRadius: "8px", overflow: "hidden", border: "1px solid #e9ecef", boxShadow: "0 2px 4px rgba(0,0,0,0.05)" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f8f9fa" }}>
                    <th style={{ padding: "16px 8px", textAlign: "left", fontWeight: "600", color: "#495057", borderBottom: "2px solid #e9ecef" }}>
                      Rival
                    </th>
                    <th style={{ padding: "16px 8px", textAlign: "center", fontWeight: "600", color: "#495057", borderBottom: "2px solid #e9ecef" }}>
                      Marcador
                    </th>
                    <th style={{ padding: "16px 8px", textAlign: "center", fontWeight: "600", color: "#495057", borderBottom: "2px solid #e9ecef" }}>
                      Resultado
                    </th>
                    <th style={{ padding: "16px 8px", textAlign: "center", fontWeight: "600", color: "#495057", borderBottom: "2px solid #e9ecef" }}>
                      Fase
                    </th>
                    <th style={{ padding: "16px 8px", textAlign: "center", fontWeight: "600", color: "#495057", borderBottom: "2px solid #e9ecef" }}>
                      Fecha
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {partidosJugados.map((m, idx) => renderPartidoRow(m, idx))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Partidos Pendientes */}
        {partidosPendientes.length > 0 && (
          <div>
            <h3 style={{ margin: "0 0 16px 0", color: "#2c3e50", fontSize: "20px", fontWeight: "bold", display: "flex", alignItems: "center", gap: "8px" }}>
              ⏳ Partidos Pendientes
              <span style={{ background: "#f39c12", color: "#fff", padding: "4px 12px", borderRadius: "20px", fontSize: "14px" }}>
                {partidosPendientes.length}
              </span>
            </h3>
            <div style={{ background: "#fff", borderRadius: "8px", overflow: "hidden", border: "1px solid #e9ecef", boxShadow: "0 2px 4px rgba(0,0,0,0.05)" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f8f9fa" }}>
                    <th style={{ padding: "16px 8px", textAlign: "left", fontWeight: "600", color: "#495057", borderBottom: "2px solid #e9ecef" }}>
                      Rival
                    </th>
                    <th style={{ padding: "16px 8px", textAlign: "center", fontWeight: "600", color: "#495057", borderBottom: "2px solid #e9ecef" }}>
                      Marcador
                    </th>
                    <th style={{ padding: "16px 8px", textAlign: "center", fontWeight: "600", color: "#495057", borderBottom: "2px solid #e9ecef" }}>
                      Estado
                    </th>
                    <th style={{ padding: "16px 8px", textAlign: "center", fontWeight: "600", color: "#495057", borderBottom: "2px solid #e9ecef" }}>
                      Fase
                    </th>
                    <th style={{ padding: "16px 8px", textAlign: "center", fontWeight: "600", color: "#495057", borderBottom: "2px solid #e9ecef" }}>
                      Fecha
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {partidosPendientes.map((m, idx) => renderPartidoRow(m, idx))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Mensaje si no hay partidos */}
        {partidos.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px", background: "#f8f9fa", borderRadius: "8px", border: "1px solid #e9ecef" }}>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>⚽</div>
            <p style={{ fontSize: "18px", color: "#6c757d", margin: "0 0 8px 0" }}>
              No hay partidos registrados para este equipo
            </p>
            <p style={{ fontSize: "14px", color: "#6c757d", margin: "0" }}>
              Los partidos aparecerán aquí cuando sean programados
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="section-container">
      {equipoSeleccionado ? (
        <>
          <button
            onClick={() => setEquipoSeleccionado(null)}
            className="back-button"
          >
            <span className="back-icon">←</span>
            <span>Atrás</span>
          </button>
          <ReporteEquipo equipo={equipoSeleccionado} />
        </>
      ) : (
        <div className="team-search-container">
          <div className="search-header">
            <h2 className="section-title">
              <span className="title-icon">📊</span>
              Reportes por Equipo
            </h2>
            <p className="section-subtitle">
              Selecciona un equipo para ver sus estadísticas detalladas
            </p>
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

            <div className="search-input-wrapper">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                placeholder="Buscar equipo por curso o paralelo..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="modern-search-input"
              />
            </div>

            <div className="filter-group">
              <label className="filter-label">Filtrar por grupo:</label>
              <select
                value={filtroGrupo}
                onChange={(e) => setFiltroGrupo(e.target.value)}
                className="modern-select"
              >
                <option value="todos">Todos los grupos</option>
                {[...new Set(equiposFiltrados.map(eq => eq.grupo).filter(Boolean))].map(grupo => (
                  <option key={grupo} value={grupo}>{grupo}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="teams-grid">
            {(!filtroGenero || !filtroNivelEducacional || !filtroCategoria) ? (
              <div className="filter-requirement-message" style={{
                textAlign: 'center',
                padding: '40px 20px',
                backgroundColor: '#f8f9fa',
                border: '2px dashed #dee2e6',
                borderRadius: '8px',
                margin: '20px 0',
                gridColumn: '1 / -1'
              }}>
                <h3 style={{ color: '#6c757d', marginBottom: '10px' }}>
                  📋 Selecciona todos los filtros para ver los equipos
                </h3>
                <p style={{ color: '#6c757d', margin: 0 }}>
                  Debes seleccionar género, nivel educacional y categoría para mostrar los reportes de equipos
                </p>
              </div>
            ) : equiposFiltrados.length === 0 ? (
              <div className="no-results" style={{ gridColumn: '1 / -1' }}>
                <div className="no-results-icon">📊</div>
                <p>No hay equipos disponibles con los filtros seleccionados</p>
              </div>
            ) : equiposFiltrados
              .filter((eq) => {
                const matchesBusqueda = `${eq.curso} ${eq.paralelo}`
                  .toLowerCase()
                  .includes(busqueda.toLowerCase());
                const matchesGrupo = filtroGrupo === "todos" || eq.grupo === filtroGrupo;
                return matchesBusqueda && matchesGrupo;
              })
              .map((eq, idx) => (
                <div
                  key={idx}
                  className="team-card"
                  onClick={() => setEquipoSeleccionado(eq)}
                >
                  <div className="team-card-content">
                    <div className="team-info">
                      <h3 className="team-name">
                        {eq.curso} {eq.paralelo}
                      </h3>
                      <p className="team-group">{eq.grupo}</p>
                      <div className="team-details">
                        <span className="team-genre">{eq.genero}</span>
                        <span className="team-level">{eq.nivelEducacional}</span>
                        <span className="team-category">{eq.categoria}</span>
                      </div>
                    </div>
                    <div className="card-arrow">→</div>
                  </div>
                </div>
              ))}
          </div>

          {filtroGenero && filtroNivelEducacional && filtroCategoria && 
           equiposFiltrados.filter((eq) =>
            `${eq.curso} ${eq.paralelo}`
              .toLowerCase()
              .includes(busqueda.toLowerCase())
          ).length === 0 && (
            <div className="no-results">
              <div className="no-results-icon">🔍</div>
              <p>No se encontraron equipos con ese criterio de búsqueda</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
