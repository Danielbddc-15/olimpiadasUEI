import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { useParams } from "react-router-dom";
import { db } from "../firebase/config";
import "../styles/PublicTournament.css";

export default function PublicTeams() {
  const [equipos, setEquipos] = useState([]);
  const [filtroGrupo, setFiltroGrupo] = useState("todos");
  const { discipline } = useParams();

  useEffect(() => {
    const fetchEquipos = async () => {
      const snapshot = await getDocs(collection(db, "equipos"));
      const data = snapshot.docs.map((doc) => doc.data());
      setEquipos(data.filter((eq) => eq.disciplina === discipline));
    };
    fetchEquipos();
  }, [discipline]);

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
        <div className="filter-group">
          <label className="filter-label">Filtrar por grupo:</label>
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
                .filter(eq => filtroGrupo === "todos" || eq.grupo === filtroGrupo)
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