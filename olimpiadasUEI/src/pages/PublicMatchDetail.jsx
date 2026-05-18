import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, onSnapshot } from "../api/firestoreCompat";
import { db } from "../firebase/config";
import "../styles/PublicMatchDetail.css";

export default function PublicMatchDetail() {
  const { matchId, discipline } = useParams();
  const navigate = useNavigate();
  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!matchId) return;

    const unsubscribe = onSnapshot(doc(db, "matches", matchId), (docSnap) => {
      if (docSnap.exists()) {
        setMatch({ id: docSnap.id, ...docSnap.data() });
      } else {
        console.error("Partido no encontrado");
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [matchId]);

  const getEstadoColor = (estado) => {
    switch (estado) {
      case "finalizado":
        return "#4CAF50";
      case "en curso":
        return "#2196F3";
      case "pendiente":
        return "#FF9800";
      default:
        return "#757575";
    }
  };

  const getEstadoIcon = (estado) => {
    switch (estado) {
      case "finalizado":
        return "✅";
      case "en curso":
        return "🟢";
      case "pendiente":
        return "⏳";
      default:
        return "❓";
    }
  };

  const getFaseInfo = (fase) => {
    switch (fase) {
      case "grupos":
        return { nombre: "Fase de Grupos", icon: "👥", color: "#4CAF50" };
      case "grupos1":
        return { nombre: "Fase de Grupos 1", icon: "👥", color: "#4CAF50" };
      case "grupos3":
        return { nombre: "Fase de Grupos 3", icon: "🎯", color: "#FF9800" };
      case "semifinales":
        return { nombre: "Semifinales", icon: "🥈", color: "#2196F3" };
      case "finales":
        return { nombre: "Finales", icon: "🏆", color: "#F44336" };
      case "final":
        return { nombre: "Final", icon: "🏆", color: "#F44336" };
      case "tercerPuesto":
        return { nombre: "Tercer Puesto", icon: "🥉", color: "#CD7F32" };
      default:
        return { nombre: "Fase de Grupos", icon: "👥", color: "#4CAF50" };
    }
  };

  // Función para agrupar goleadores por nombre y contar apariciones
  const agruparGoleadores = (goleadores) => {
    if (!goleadores || goleadores.length === 0) return [];

    const conteo = {};
    goleadores.forEach(goleador => {
      conteo[goleador] = (conteo[goleador] || 0) + 1;
    });

    return Object.entries(conteo).map(([nombre, cantidad]) => ({
      nombre,
      cantidad
    }));
  };

  // Funciones específicas para vóley
  const ganadorSet = (setData, limitePuntos) => {
    if (!setData) return null;
    if (setData.A >= limitePuntos && setData.A - setData.B >= 2) return 'A';
    if (setData.B >= limitePuntos && setData.B - setData.A >= 2) return 'B';
    return null;
  };

  const esFaseGrupos = match?.fase === 'grupos1' || match?.fase === 'grupos3' || !match?.fase;
  const esSemifinal = match?.fase === "semifinales";
  const esFinal = match?.fase === "finales";

  const reglasJuego = esFaseGrupos
    ? { sets: 1, puntosPorSet: 20, descripcion: "1 set de 20 puntos" }
    : esSemifinal
    ? { sets: 3, puntosPorSet: [20, 20, 15], descripcion: "Al mejor de 3 sets: 20-20-15" }
    : esFinal
    ? { sets: 3, puntosPorSet: [5, 5, 15], descripcion: "Al mejor de 3 sets: 5-5-15" }
    : { sets: 3, puntosPorSet: [20, 20, 15], descripcion: "Al mejor de 3 sets: 20-20-15" };

  const deberMostrarSet = (setKey, setData, allSets) => {
    // Si el set tiene datos (puntuación > 0), mostrarlo
    if (setData && (setData.A > 0 || setData.B > 0)) {
      return true;
    }

    // Si es fase de grupos, solo mostrar el primer set si tiene datos
    if (esFaseGrupos) {
      return setKey === 'set1' && setData && (setData.A > 0 || setData.B > 0);
    }

    // Para semifinales y finales, mostrar sets progresivamente según se van jugando
    const setNumber = parseInt(setKey.replace('set', ''));

    // Verificar si los sets anteriores se jugaron
    for (let i = 1; i < setNumber; i++) {
      const prevSetKey = `set${i}`;
      const prevSetData = allSets[prevSetKey];
      if (!prevSetData || (prevSetData.A === 0 && prevSetData.B === 0)) {
        return false; // No mostrar este set si el anterior no se jugó
      }
    }

    return setData && (setData.A > 0 || setData.B > 0);
  };

  const calcularSetsGanados = (sets) => {
    let setsA = 0, setsB = 0;

    sets.forEach((set, index) => {
      if (set && (set.A > 0 || set.B > 0)) {
        const puntosLimite = esFaseGrupos
          ? reglasJuego.puntosPorSet
          : reglasJuego.puntosPorSet[index];

        if (set.A >= puntosLimite && set.A - set.B >= 2) {
          setsA++;
        } else if (set.B >= puntosLimite && set.B - set.A >= 2) {
          setsB++;
        }
      }
    });

    return { setsA, setsB };
  };

  const obtenerPuntosSet = (setIndex, sets) => {
    if (esFaseGrupos) {
      return reglasJuego.puntosPorSet;
    }

    const { setsA, setsB } = calcularSetsGanados(sets.slice(0, setIndex));

    if (setsA === 1 || setsB === 1) {
      return 15;
    }

    return reglasJuego.puntosPorSet[setIndex] || (esFinal ? 5 : 20);
  };

  if (loading) {
    return (
      <div className="public-match-detail-container">
        <div className="loading-section">
          <div className="loading-spinner"></div>
          <p>Cargando información del partido...</p>
        </div>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="public-match-detail-container">
        <div className="error-section">
          <div className="error-icon">❌</div>
          <h3>Partido no encontrado</h3>
          <p>El partido que buscas no existe o ha sido eliminado.</p>
          <button 
            onClick={() => discipline ? navigate(`/matches/${discipline}`) : navigate(-1)} 
            className="back-btn"
          >
            Volver
          </button>
        </div>
      </div>
    );
  }

  const faseInfo = getFaseInfo(match.fase);
  const goleadoresAAgrupados = agruparGoleadores(match.goleadoresA);
  const goleadoresBAgrupados = agruparGoleadores(match.goleadoresB);

  return (
    <div className="public-match-detail-container">
      {/* Header */}
      <div className="public-detail-header">
        <button 
          onClick={() => discipline ? navigate(`/matches/${discipline}`) : navigate(-1)} 
          className="back-button"
        >
          <span className="back-icon">←</span>
          Volver
        </button>
        <h1 className="page-title">Detalle del Partido</h1>
      </div>

      {/* Información principal del partido */}
      <div className="match-main-info">
        <div className="match-header-card">
          <div className="tournament-info">
            <div className="fase-badge" style={{ backgroundColor: faseInfo.color }}>
              <span className="fase-icon">{faseInfo.icon}</span>
              <span className="fase-text">{faseInfo.nombre}</span>
            </div>
            <div className="categoria-info">
              <span className="categoria-icon">🏆</span>
              <span className="categoria-text">
                {match.categoria && match.genero ? 
                  `${match.categoria} - ${match.genero}` : 
                  (match.categoria || "Categoría no definida")}
              </span>
            </div>
          </div>
          <div className="grupo-info">
            <span className="grupo-icon">👥</span>
            <span className="grupo-text">{match.grupo || "Grupo no definido"}</span>
          </div>
        </div>

        {/* Equipos y marcador */}
        <div className="teams-score-card">
          <div className="team-section">
            <div className="team-info">
              <div className="team-icon">🏫</div>
              <div className="team-details">
                <h3 className="team-name">
                  {match.equipoA?.curso} {match.equipoA?.paralelo}
                </h3>
                <span className="team-label">Equipo A</span>
              </div>
            </div>
            <div className="team-score">{match.marcadorA ?? 0}</div>
          </div>

          <div className="vs-divider">
            <span className="vs-text">VS</span>
          </div>

          <div className="team-section">
            <div className="team-score">{match.marcadorB ?? 0}</div>
            <div className="team-info">
              <div className="team-icon">🏫</div>
              <div className="team-details">
                <h3 className="team-name">
                  {match.equipoB?.curso} {match.equipoB?.paralelo}
                </h3>
                <span className="team-label">Equipo B</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Información adicional */}
      <div className="match-additional-info">
        <div className="info-grid">
          <div className="info-card">
            <div className="info-icon">📅</div>
            <div className="info-content">
              <span className="info-label">Fecha</span>
              <span className="info-value">
                {match.fecha || "Por definir"}
              </span>
            </div>
          </div>

          <div className="info-card">
            <div className="info-icon">🕐</div>
            <div className="info-content">
              <span className="info-label">Hora</span>
              <span className="info-value">
                {match.hora || "Por definir"}
              </span>
            </div>
          </div>

          <div className="info-card">
            <div className="info-icon">🏟️</div>
            <div className="info-content">
              <span className="info-label">Disciplina</span>
              <span className="info-value">
                {match.disciplina === "futbol" ? "Fútbol" :
                 match.disciplina === "voley" ? "Vóley" :
                 match.disciplina === "basquet" ? "Básquet" :
                 "No especificada"}
              </span>
            </div>
          </div>

          {match.nivelEducacional && (
            <div className="info-card">
              <div className="info-icon">🎓</div>
              <div className="info-content">
                <span className="info-label">Nivel</span>
                <span className="info-value">
                  {match.nivelEducacional}
                </span>
              </div>
            </div>
          )}

          <div className="info-card">
            <div className="info-icon">📊</div>
            <div className="info-content">
              <span className="info-label">Estado</span>
              <span className="info-value" style={{ color: getEstadoColor(match.estado) }}>
                {getEstadoIcon(match.estado)} {
                  match.estado === "finalizado" ? "Finalizado" :
                  match.estado === "en curso" ? "En Curso" :
                  match.estado === "pendiente" ? "Pendiente" : 
                  match.estado === "programado" ? "Programado" :
                  "Sin estado"
                }
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Marcador por Sets para Vóley */}
      {match.disciplina === "voley" && match.sets && Object.keys(match.sets).length > 0 && (
        <div className="sets-section">
          <h3 className="section-title">
            <span className="section-icon">🏐</span>
            Marcador por Sets
          </h3>
          <div className="sets-table-container">
            <table className="sets-table">
              <thead>
                <tr>
                  <th className="team-header-cell">Equipo</th>
                  {Object.entries(match.sets)
                    .sort(([a], [b]) => parseInt(a.replace('set', '')) - parseInt(b.replace('set', '')))
                    .filter(([setKey, setData]) => deberMostrarSet(setKey, setData, match.sets))
                    .map(([setKey, setData], index) => {
                      const setNumber = parseInt(setKey.replace('set', ''));

                      return (
                        <th key={setKey} className="set-header">
                          Set {setNumber}
                          {!esFaseGrupos && setNumber >= 3 && " (Decisivo)"}
                        </th>
                      );
                    })}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="team-name-cell">
                    {match.equipoA?.curso} {match.equipoA?.paralelo}
                  </td>
                  {Object.entries(match.sets)
                    .sort(([a], [b]) => parseInt(a.replace('set', '')) - parseInt(b.replace('set', '')))
                    .filter(([setKey, setData]) => deberMostrarSet(setKey, setData, match.sets))
                    .map(([setKey, setData], index) => {
                      const setNumber = parseInt(setKey.replace('set', ''));
                      const limitePuntos = obtenerPuntosSet(setNumber - 1, Object.values(match.sets));
                      const ganador = ganadorSet(setData, limitePuntos);

                      return (
                        <td key={setKey} className={`set-score ${ganador === 'A' ? 'winner' : ''}`}>
                          <div className="score-display">
                            <span className="score-value">{setData?.A || 0}</span>
                            <span className="score-limit">/{limitePuntos}</span>
                          </div>
                        </td>
                      );
                    })}
                </tr>
                <tr>
                  <td className="team-name-cell">
                    {match.equipoB?.curso} {match.equipoB?.paralelo}
                  </td>
                  {Object.entries(match.sets)
                    .sort(([a], [b]) => parseInt(a.replace('set', '')) - parseInt(b.replace('set', '')))
                    .filter(([setKey, setData]) => deberMostrarSet(setKey, setData, match.sets))
                    .map(([setKey, setData], index) => {
                      const setNumber = parseInt(setKey.replace('set', ''));
                      const limitePuntos = obtenerPuntosSet(setNumber - 1, Object.values(match.sets));
                      const ganador = ganadorSet(setData, limitePuntos);

                      return (
                        <td key={setKey} className={`set-score ${ganador === 'B' ? 'winner' : ''}`}>
                          <div className="score-display">
                            <span className="score-value">{setData?.B || 0}</span>
                            <span className="score-limit">/{limitePuntos}</span>
                          </div>
                        </td>
                      );
                    })}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Goleadores/Anotadores */}
      {(match.disciplina === "futbol" || match.disciplina === "voley" || match.disciplina === "basquet") && 
       (goleadoresAAgrupados.length > 0 || goleadoresBAgrupados.length > 0) && (
        <div className="scorers-section">
          <h3 className="section-title">
            <span className="section-icon">
              {match.disciplina === "futbol" ? "⚽" : 
               match.disciplina === "voley" ? "🏐" : 
               match.disciplina === "basquet" ? "🏀" : "⚽"}
            </span>
            {match.disciplina === "futbol" ? "Goleadores" : 
             match.disciplina === "voley" ? "Mejores Puntos" : 
             match.disciplina === "basquet" ? "Anotadores" : "Goleadores"}
          </h3>
          <div className="scorers-grid">
            <div className="team-scorers">
              <h4 className="team-scorers-title">
                {match.equipoA?.curso} {match.equipoA?.paralelo}
              </h4>
              <div className="scorers-list">
                {goleadoresAAgrupados.length > 0 ? (
                  goleadoresAAgrupados.map((goleador, index) => (
                    <div key={index} className="scorer-item">
                      <span className="scorer-icon">
                        {match.disciplina === "futbol" ? "⚽" : 
                         match.disciplina === "voley" ? "🏐" : 
                         match.disciplina === "basquet" ? "🏀" : "⚽"}
                      </span>
                      <span className="scorer-name">
                        {goleador.nombre} {goleador.cantidad > 1 && `(${goleador.cantidad})`}
                      </span>
                    </div>
                  ))
                ) : (
                  <span className="no-scorers">
                    {match.disciplina === "futbol" ? "Sin goles" : 
                     match.disciplina === "voley" ? "Sin puntos destacados" : 
                     match.disciplina === "basquet" ? "Sin anotaciones" : "Sin goles"}
                  </span>
                )}
              </div>
            </div>

            <div className="team-scorers">
              <h4 className="team-scorers-title">
                {match.equipoB?.curso} {match.equipoB?.paralelo}
              </h4>
              <div className="scorers-list">
                {goleadoresBAgrupados.length > 0 ? (
                  goleadoresBAgrupados.map((goleador, index) => (
                    <div key={index} className="scorer-item">
                      <span className="scorer-icon">
                        {match.disciplina === "futbol" ? "⚽" : 
                         match.disciplina === "voley" ? "🏐" : 
                         match.disciplina === "basquet" ? "🏀" : "⚽"}
                      </span>
                      <span className="scorer-name">
                        {goleador.nombre} {goleador.cantidad > 1 && `(${goleador.cantidad})`}
                      </span>
                    </div>
                  ))
                ) : (
                  <span className="no-scorers">
                    {match.disciplina === "futbol" ? "Sin goles" : 
                     match.disciplina === "voley" ? "Sin puntos destacados" : 
                     match.disciplina === "basquet" ? "Sin anotaciones" : "Sin goles"}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Resultado del partido */}
      {match.estado === "finalizado" && (
        <div className="match-result-section">
          <h3 className="section-title">
            <span className="section-icon">🏆</span>
            Resultado Final
          </h3>
          <div className="result-card">
            {match.marcadorA > match.marcadorB ? (
              <div className="winner-announcement">
                <span className="winner-icon">🎉</span>
                <span className="winner-text">
                  Ganador: {match.equipoA?.curso} {match.equipoA?.paralelo}
                </span>
                <span className="final-score">
                  {match.marcadorA} - {match.marcadorB}
                </span>
              </div>
            ) : match.marcadorB > match.marcadorA ? (
              <div className="winner-announcement">
                <span className="winner-icon">🎉</span>
                <span className="winner-text">
                  Ganador: {match.equipoB?.curso} {match.equipoB?.paralelo}
                </span>
                <span className="final-score">
                  {match.marcadorA} - {match.marcadorB}
                </span>
              </div>
            ) : (
              <div className="tie-announcement">
                <span className="tie-icon">🤝</span>
                <span className="tie-text">Empate</span>
                <span className="final-score">
                  {match.marcadorA} - {match.marcadorB}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
