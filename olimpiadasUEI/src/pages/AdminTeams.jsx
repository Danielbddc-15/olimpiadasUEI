import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { useParams, useNavigate } from "react-router-dom";
import { query, where } from "firebase/firestore";
import "../styles/AdminTeams.css";

export default function AdminTeams() {
  const { discipline } = useParams();
  const navigate = useNavigate();
  const [equipos, setEquipos] = useState([]);
  const [nuevoEquipo, setNuevoEquipo] = useState({
    curso: "",
    paralelo: "",
    grupo: "",
  });
  const [grupos, setGrupos] = useState([]);
  const [nuevoGrupo, setNuevoGrupo] = useState("");
  const [grupoEditando, setGrupoEditando] = useState(null);
  const [nuevoNombreGrupo, setNuevoNombreGrupo] = useState("");

  // Obtener grupos desde Firestore
  const obtenerGrupos = async () => {
    const snapshot = await getDocs(collection(db, "grupos"));
    const data = snapshot.docs.map((doc) => doc.data().nombre);
    setGrupos(data);
  };

  const obtenerEquipos = async () => {
    const q = query(
      collection(db, "equipos"),
      where("disciplina", "==", discipline),
    );
    const snapshot = await getDocs(q);
    const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    setEquipos(data);
  };

  useEffect(() => {
    obtenerEquipos();
    obtenerGrupos();
  }, []);

  const crearEquipo = async () => {
    if (!nuevoEquipo.curso || !nuevoEquipo.paralelo) return;
    // Si el grupo no existe, agrégalo
    if (nuevoEquipo.grupo && !grupos.includes(nuevoEquipo.grupo)) {
      await addDoc(collection(db, "grupos"), {
        nombre: nuevoEquipo.grupo.trim(),
      });
      await obtenerGrupos();
    }
    await addDoc(collection(db, "equipos"), {
      ...nuevoEquipo,
      grupo: nuevoEquipo.grupo || "Sin grupo",
      disciplina: discipline,
    });
    setNuevoEquipo({ curso: "", paralelo: "", grupo: "" });
    obtenerEquipos();
  };

  const eliminarGrupo = async (nombreGrupo) => {
    const snapshot = await getDocs(collection(db, "grupos"));
    const grupoDoc = snapshot.docs.find(
      (doc) => doc.data().nombre === nombreGrupo,
    );
    if (grupoDoc) {
      await deleteDoc(doc(db, "grupos", grupoDoc.id));
      obtenerGrupos();
      obtenerEquipos();
    }
  };

  const actualizarEquipo = async (id, campo, valor) => {
    const ref = doc(db, "equipos", id);
    await updateDoc(ref, { [campo]: valor });
    obtenerEquipos();
  };

  const eliminarEquipo = async (id) => {
    await deleteDoc(doc(db, "equipos", id));
    obtenerEquipos();
  };

  // Navigation handlers
  const goToMatches = () => {
    navigate(`/admin/${discipline}/partidos`);
  };

  const goToStandings = () => {
    navigate(`/admin/${discipline}/tabla`);
  };

  const goToSchedule = () => {
    navigate(`/admin/${discipline}/horarios`);
  };

  const goToPanel = () => {
    navigate('/admin');
  };

  return (
    <div className="admin-teams-container">
      {/* Header moderno */}
      <div className="admin-header">
        <div className="header-icon">👥</div>
        <h1 className="admin-title">Gestión de Equipos</h1>
        <p className="admin-subtitle">
          Administra los equipos de{" "}
          {discipline === "futbol"
            ? "Fútbol"
            : discipline === "voley"
              ? "Vóley"
              : "Básquet"}
        </p>
      </div>

      {/* Navegación rápida */}
      <div className="quick-navigation">
        <button onClick={goToPanel} className="nav-card panel-card">
          <div className="nav-card-icon">🏠</div>
          <div className="nav-card-content">
            <h3>Volver al Panel</h3>
            <p>Ir al panel principal</p>
          </div>
          <div className="nav-card-arrow">→</div>
        </button>
        <button onClick={goToMatches} className="nav-card matches-card">
          <div className="nav-card-icon">⚽</div>
          <div className="nav-card-content">
            <h3>Partidos</h3>
            <p>Gestionar encuentros</p>
          </div>
          <div className="nav-card-arrow">→</div>
        </button>
        <button onClick={goToStandings} className="nav-card standings-card">
          <div className="nav-card-icon">🏆</div>
          <div className="nav-card-content">
            <h3>Posiciones</h3>
            <p>Ver clasificación</p>
          </div>
          <div className="nav-card-arrow">→</div>
        </button>
        <button onClick={goToSchedule} className="nav-card schedule-card">
          <div className="nav-card-icon">📅</div>
          <div className="nav-card-content">
            <h3>Gestionar Horarios</h3>
            <p>Organizar encuentros</p>
          </div>
          <div className="nav-card-arrow">→</div>
        </button>
      </div>

      {/* Formulario de creación de equipos */}
      <div className="create-team-section">
        <h2 className="section-title">
          <span className="section-icon">➕</span>
          Crear Nuevo Equipo
        </h2>

        <div className="create-team-form">
          <div className="form-row">
            <div className="input-group">
              <label className="input-label">
                <span className="label-icon">🎓</span>
                Curso
              </label>
              <input
                type="text"
                placeholder="Ej: 1ro BGU"
                value={nuevoEquipo.curso}
                onChange={(e) =>
                  setNuevoEquipo({ ...nuevoEquipo, curso: e.target.value })
                }
                className="modern-input"
              />
            </div>

            <div className="input-group">
              <label className="input-label">
                <span className="label-icon">📝</span>
                Paralelo
              </label>
              <input
                type="text"
                placeholder="Ej: A, B, C"
                value={nuevoEquipo.paralelo}
                onChange={(e) =>
                  setNuevoEquipo({ ...nuevoEquipo, paralelo: e.target.value })
                }
                className="modern-input"
              />
            </div>

            <div className="input-group">
              <label className="input-label">
                <span className="label-icon">🏆</span>
                Grupo
              </label>
              <div className="group-input-wrapper">
                <input
                  list="grupos-list"
                  type="text"
                  placeholder="Selecciona o crea grupo"
                  value={nuevoEquipo.grupo || ""}
                  onChange={(e) =>
                    setNuevoEquipo({ ...nuevoEquipo, grupo: e.target.value })
                  }
                  className="modern-input"
                />
                <datalist id="grupos-list">
                  {grupos.map((g) => (
                    <option key={g} value={g} />
                  ))}
                </datalist>
                {nuevoEquipo.grupo && (
                  <button
                    className="delete-group-btn"
                    title={`Eliminar grupo "${nuevoEquipo.grupo}"`}
                    onClick={() => {
                      if (
                        window.confirm(
                          `¿Eliminar el grupo "${nuevoEquipo.grupo}"?`,
                        )
                      ) {
                        eliminarGrupo(nuevoEquipo.grupo);
                        setNuevoEquipo({ ...nuevoEquipo, grupo: "" });
                      }
                    }}
                  >
                    🗑️
                  </button>
                )}
              </div>
            </div>

            <button onClick={crearEquipo} className="create-btn">
              <span className="btn-icon">✨</span>
              <span>Crear Equipo</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tabla de equipos */}
      <div className="teams-table-section">
        <div className="section-header">
          <h2 className="section-title">
            <span className="section-icon">📋</span>
            Equipos Registrados
          </h2>
          <div className="teams-count">
            <span className="count-badge">{equipos.length}</span>
            <span>equipos totales</span>
          </div>
        </div>

        <div className="table-container">
          <div className="modern-table-wrapper">
            <table className="modern-table">
              <thead>
                <tr>
                  <th>
                    <div className="th-content">
                      <span className="th-icon">🎓</span>
                      Curso
                    </div>
                  </th>
                  <th>
                    <div className="th-content">
                      <span className="th-icon">📝</span>
                      Paralelo
                    </div>
                  </th>
                  <th>
                    <div className="th-content">
                      <span className="th-icon">🏆</span>
                      Grupo
                    </div>
                  </th>
                  <th>
                    <div className="th-content">
                      <span className="th-icon">⚙️</span>
                      Acciones
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {[...equipos]
                  .sort((a, b) => {
                    if ((a.grupo || "") < (b.grupo || "")) return -1;
                    if ((a.grupo || "") > (b.grupo || "")) return 1;
                    if ((a.curso || "") < (b.curso || "")) return -1;
                    if ((a.curso || "") > (b.curso || "")) return 1;
                    if ((a.paralelo || "") < (b.paralelo || "")) return -1;
                    if ((a.paralelo || "") > (b.paralelo || "")) return 1;
                    return 0;
                  })
                  .map((equipo) => (
                    <tr key={equipo.id} className="table-row">
                      <td className="table-cell">
                        <input
                          value={equipo.curso}
                          onChange={(e) =>
                            actualizarEquipo(equipo.id, "curso", e.target.value)
                          }
                          className="table-input"
                        />
                      </td>
                      <td className="table-cell">
                        <input
                          value={equipo.paralelo}
                          onChange={(e) =>
                            actualizarEquipo(
                              equipo.id,
                              "paralelo",
                              e.target.value,
                            )
                          }
                          className="table-input"
                        />
                      </td>
                      <td className="table-cell">
                        <select
                          value={equipo.grupo || ""}
                          onChange={(e) =>
                            actualizarEquipo(equipo.id, "grupo", e.target.value)
                          }
                          className="table-select"
                        >
                          <option value="">Sin grupo</option>
                          {grupos.map((g) => (
                            <option key={g} value={g}>
                              {g}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="table-cell">
                        <button
                          onClick={() => eliminarEquipo(equipo.id)}
                          className="delete-team-btn"
                          title="Eliminar equipo"
                        >
                          <span className="btn-icon">🗑️</span>
                          <span>Eliminar</span>
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {equipos.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon">👥</div>
              <h3>No hay equipos registrados</h3>
              <p>Crea el primer equipo para comenzar el torneo</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
