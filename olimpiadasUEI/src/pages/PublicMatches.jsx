import { useEffect, useState } from "react";
import { db } from "../firebase/config";
import { collection, getDocs, query, where, onSnapshot } from "firebase/firestore";
import { useParams, useNavigate } from "react-router-dom";
import "../styles/PublicMatches.css";

export default function PublicMatches() {
  const { discipline } = useParams();
  const navigate = useNavigate();
  const [matches, setMatches] = useState([]);
  const [grupos, setGrupos] = useState([]);
  const [faseActual, setFaseActual] = useState(0);

  // Fases según disciplina
  const fasesDb = {
    "grupos1": "Fase de Grupos 1",
    "grupos2": "Fase de Grupos 2", 
    "grupos3": "Fase de Grupos 3",
    "semifinales": "Semifinales",
    "finales": "Finales"
  };

  const fases = Object.values(fasesDb);
  const fasesArray = Object.keys(fasesDb);

  // Función para obtener el icono de la fase
  const obtenerIconoFase = (faseKey) => {
    if (faseKey?.includes("grupos")) return "👥";
    if (faseKey === "semifinales") return "🥈";
    if (faseKey === "finales") return "🏆";
    return "🏅";
  };

  // Función para navegar al detalle del partido
  const irADetallePartido = (matchId) => {
    if (discipline === "voley") {
      navigate(`/public-voley-match-detail/${matchId}`);
    } else {
      navigate(`/public/partido/${matchId}`);
    }
  };

  // Obtener grupos desde Firestore
  useEffect(() => {
    const obtenerGrupos = async () => {
      try {
        const snapshot = await getDocs(collection(db, "grupos"));
        const data = snapshot.docs.map((doc) => doc.data().nombre);
        setGrupos(data);
      } catch (error) {
        console.error("Error al obtener grupos:", error);
      }
    };
    obtenerGrupos();
  }, []);

  // Obtener partidos en tiempo real
  useEffect(() => {
    const q = query(
      collection(db, "matches"),
      where("disciplina", "==", discipline)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setMatches(data);
    });
    return () => unsubscribe();
  }, [discipline]);

  // Filtrar partidos por fase
  const partidosPorFase = (fase) =>
    matches.filter((m) => (m.fase || "grupos1") === fase);

  // Agrupar partidos por grupo
  const agruparPorGrupo = (matchesArray) => {
    const agrupados = {};
    matchesArray.forEach((match) => {
      const grupoAsignado = match.grupo || "Sin grupo";
      if (!agrupados[grupoAsignado]) agrupados[grupoAsignado] = [];
      agrupados[grupoAsignado].push(match);
    });
    return agrupados;
  };

  // Componente para mostrar la tabla de partidos de una fase
  function TablaPartidos({ partidos }) {
    const partidosPorGrupo = agruparPorGrupo(partidos);
    
    return (
      <>
        {grupos.map((grupo) =>
          partidosPorGrupo[grupo] && partidosPorGrupo[grupo].length > 0 ? (
            <div key={grupo} className="public-match-group">
              <h3 className="public-group-title">{grupo}</h3>
              
              <div className="public-matches-grid">
                {partidosPorGrupo[grupo].map((match) => (
                  <div
                    key={match.id}
                    onClick={() => irADetallePartido(match.id)}
                    className="public-match-card"
                  >
                    <div className="public-match-header">
                      <div className="public-match-teams">
                        <div className="public-team">
                          <span className="public-team-name">
                            {match.equipoA?.curso} {match.equipoA?.paralelo}
                          </span>
                        </div>
                        <div className="public-vs">VS</div>
                        <div className="public-team">
                          <span className="public-team-name">
                            {match.equipoB?.curso} {match.equipoB?.paralelo}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="public-match-score">
                      <div className="public-score-display">
                        <span className="public-score-number">
                          {match.marcadorA ?? 0}
                        </span>
                        <span className="public-score-separator">-</span>
                        <span className="public-score-number">
                          {match.marcadorB ?? 0}
                        </span>
                      </div>
                    </div>

                    <div className="public-match-status">
                      <span className={`public-status-badge ${match.estado?.replace(' ', '-')}`}>
                        {match.estado === "finalizado" && "✅ Finalizado"}
                        {match.estado === "en curso" && "🟢 En curso"}
                        {match.estado === "pendiente" && "⏳ Pendiente"}
                      </span>
                    </div>

                    <div className="public-match-info">
                      <div className="public-match-date">
                        📅 {match.fecha || "Por definir"}
                      </div>
                      <div className="public-match-time">
                        🕐 {match.hora || "Por definir"}
                      </div>
                    </div>

                    {discipline === "futbol" &&
                      (match.goleadoresA?.length > 0 || match.goleadoresB?.length > 0) && (
                        <div className="public-scorers-preview">
                          <div className="public-scorer-line">
                            <strong>{match.equipoA?.curso} {match.equipoA?.paralelo}:</strong>{" "}
                            {match.goleadoresA?.join(", ") || "-"}
                          </div>
                          <div className="public-scorer-line">
                            <strong>{match.equipoB?.curso} {match.equipoB?.paralelo}:</strong>{" "}
                            {match.goleadoresB?.join(", ") || "-"}
                          </div>
                        </div>
                      )}

                    {discipline === "voley" &&
                      (match.anotadoresA?.length > 0 || match.anotadoresB?.length > 0) && (
                        <div className="public-scorers-preview">
                          <div className="public-scorer-line">
                            <strong>{match.equipoA?.curso} {match.equipoA?.paralelo}:</strong>{" "}
                            {match.anotadoresA?.join(", ") || "-"}
                          </div>
                          <div className="public-scorer-line">
                            <strong>{match.equipoB?.curso} {match.equipoB?.paralelo}:</strong>{" "}
                            {match.anotadoresB?.join(", ") || "-"}
                          </div>
                        </div>
                      )}
                  </div>
                ))}
              </div>
            </div>
          ) : null
        )}
      </>
    );
  }

  return (
    <div className="public-matches-container">
      {/* Header */}
      <div className="public-header">
        <div className="public-header-icon">
          {discipline === "futbol" ? "⚽" : discipline === "voley" ? "🏐" : "🏀"}
        </div>
        <h1 className="public-title">
          Partidos de {discipline === "futbol" ? "Fútbol" : discipline === "voley" ? "Vóley" : "Básquet"}
        </h1>
        <p className="public-subtitle">Seguimiento en tiempo real</p>
      </div>

      {/* Navegador de fases */}
      <div className="public-phase-navigation">
        <div className="public-phase-controls">
          <button
            onClick={() => setFaseActual((f) => Math.max(0, f - 1))}
            disabled={faseActual === 0}
            className={`public-phase-btn public-prev-btn ${faseActual === 0 ? "disabled" : ""}`}
          >
            <span className="public-btn-icon">←</span>
          </button>

          <div className="public-current-phase">
            <span className="public-phase-icon">
              {obtenerIconoFase(fasesArray[faseActual])}
            </span>
            <h2 className="public-phase-title">{fases[faseActual]}</h2>
          </div>

          <button
            onClick={() => setFaseActual((f) => Math.min(fases.length - 1, f + 1))}
            disabled={faseActual === fases.length - 1}
            className={`public-phase-btn public-next-btn ${faseActual === fases.length - 1 ? "disabled" : ""}`}
          >
            <span className="public-btn-icon">→</span>
          </button>
        </div>
      </div>

      {/* Partidos de la fase actual */}
      <div className="public-matches-section">
        <TablaPartidos partidos={partidosPorFase(fasesArray[faseActual])} />
      </div>

      {/* Mensaje si no hay partidos */}
      {partidosPorFase(fasesArray[faseActual]).length === 0 && (
        <div className="public-empty-state">
          <div className="public-empty-icon">📋</div>
          <h3>No hay partidos programados</h3>
          <p>Aún no se han programado partidos para esta fase.</p>
        </div>
      )}
    </div>
  );
}