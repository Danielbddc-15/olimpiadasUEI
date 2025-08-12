import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { useParams } from "react-router-dom";
import { db } from "../firebase/config";
import "../styles/PublicTournament.css";

export default function PublicTeams() {
  const [equipos, setEquipos] = useState([]);
  const [filtroGrupo, setFiltroGrupo] = useState("todos");
  const { discipline } = useParams();

  // Estados de filtros avanzados
  const [filtroGenero, setFiltroGenero] = useState(() => {
    return localStorage.getItem(`olimpiadas_public_teams_filtro_genero_${discipline}`) || "";
  });
  const [filtroNivelEducacional, setFiltroNivelEducacional] = useState(() => {
    return localStorage.getItem(`olimpiadas_public_teams_filtro_nivel_educacional_${discipline}`) || "";
  });
  const [filtroCategoria, setFiltroCategoria] = useState(() => {
    return localStorage.getItem(`olimpiadas_public_teams_filtro_categoria_${discipline}`) || "";
  });

  useEffect(() => {
    const fetchEquipos = async () => {
      const snapshot = await getDocs(collection(db, "equipos"));
      const data = snapshot.docs.map((doc) => doc.data());
      setEquipos(data.filter((eq) => eq.disciplina === discipline));
    };
    fetchEquipos();
  }, [discipline]);

  // Funciones de filtros
  const limpiarFiltros = () => {
    setFiltroGenero("");
    setFiltroNivelEducacional("");
    setFiltroCategoria("");
    setFiltroGrupo("todos");

    localStorage.removeItem(`olimpiadas_public_teams_filtro_genero_${discipline}`);
    localStorage.removeItem(`olimpiadas_public_teams_filtro_nivel_educacional_${discipline}`);
    localStorage.removeItem(`olimpiadas_public_teams_filtro_categoria_${discipline}`);
  };

  // Guardar filtros en localStorage
  useEffect(() => {
    if (filtroGenero) {
      localStorage.setItem(`olimpiadas_public_teams_filtro_genero_${discipline}`, filtroGenero);
    }
    if (filtroNivelEducacional) {
      localStorage.setItem(`olimpiadas_public_teams_filtro_nivel_educacional_${discipline}`, filtroNivelEducacional);
    }
    if (filtroCategoria) {
      localStorage.setItem(`olimpiadas_public_teams_filtro_categoria_${discipline}`, filtroCategoria);
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

  return (
    <div className="section-container">
      <div className="section-header">
        <h2 className="section-title">
          <span className="title-icon">👥</span>
          Equipos Participantes
        </h2>
        <p className="section-subtitle">
          Todos los equipos registrados en el torneo
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

          <div className="filter-group">
            <label className="filter-label">🏆 Grupo:</label>
            <select
              value={filtroGrupo}
              onChange={(e) => setFiltroGrupo(e.target.value)}
              className="modern-select"
            >
              <option value="todos">Todos los grupos</option>
              {[...new Set(equipos.map(eq => eq.grupo).filter(Boolean))].map(grupo => (
                <option key={grupo} value={grupo}>{grupo}</option>
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

      <div className="teams-table-container">
        <div className="modern-table-wrapper">
          <table className="modern-table">
            <thead>
              <tr>
                <th>
                  <span className="th-content">
                    <span className="th-icon">🎓</span>
                    Curso
                  </span>
                </th>
                <th>
                  <span className="th-content">
                    <span className="th-icon">📝</span>
                    Paralelo
                  </span>
                </th>
                <th>
                  <span className="th-content">
                    <span className="th-icon">🏆</span>
                    Grupo
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {equipos
              .filter(eq => {
                const matchesGrupo = filtroGrupo === "todos" || eq.grupo === filtroGrupo;
                const matchesGenero = !filtroGenero || eq.genero === filtroGenero;
                const matchesNivel = !filtroNivelEducacional || eq.nivelEducacional === filtroNivelEducacional;
                const matchesCategoria = !filtroCategoria || eq.categoria === filtroCategoria;
                return matchesGrupo && matchesGenero && matchesNivel && matchesCategoria;
              })
                .map((eq, idx) => (
                <tr key={idx} className="table-row">
                  <td className="table-cell">{eq.curso}</td>
                  <td className="table-cell">{eq.paralelo}</td>
                  <td className="table-cell">
                    <span className="group-badge">{eq.grupo}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
