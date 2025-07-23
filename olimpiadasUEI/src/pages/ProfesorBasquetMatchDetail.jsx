import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase/config";
import "../styles/AdminBasquetMatchDetail.css"; // Reutilizamos los mismos estilos

export default function ProfesorBasquetMatchDetail() {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Estados para anotar puntos
  const [jugadorInput, setJugadorInput] = useState("");
  const [mostrarInputJugador, setMostrarInputJugador] = useState(null); // 'A' o 'B'
  const [tipoCanasta, setTipoCanasta] = useState(1); // 1, 2 o 3 puntos

  // Estados para control del partido
  const [partidoIniciado, setPartidoIniciado] = useState(false);
  const [partidoFinalizado, setPartidoFinalizado] = useState(false);

  // Cargar datos del partido
  useEffect(() => {
    const fetchMatch = async () => {
      try {
        const docRef = doc(db, "matches", matchId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const matchData = { id: docSnap.id, ...docSnap.data() };
          setMatch(matchData);
          
          // Inicializar estados según el estado del partido
          setPartidoIniciado(matchData.estado === "en curso" || matchData.estado === "finalizado");
          setPartidoFinalizado(matchData.estado === "finalizado");
        } else {
          console.error("Partido no encontrado");
          navigate(-1);
        }
      } catch (error) {
        console.error("Error al cargar partido:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMatch();
  }, [matchId, navigate]);

  // Función para anotar puntos
  const anotarPuntos = async (equipo) => {
    if (!partidoIniciado) {
      alert("Debes iniciar el partido antes de anotar puntos");
      return;
    }

    if (partidoFinalizado) {
      alert("El partido ya ha finalizado, no se pueden anotar más puntos");
      return;
    }

    if (!jugadorInput.trim()) {
      alert("Por favor, ingresa el nombre del jugador");
      return;
    }

    try {
      const puntosAAgregar = parseInt(tipoCanasta);
      const nuevoMarcador = equipo === 'A' 
        ? { marcadorA: (match.marcadorA || 0) + puntosAAgregar }
        : { marcadorB: (match.marcadorB || 0) + puntosAAgregar };

      // Obtener anotadores actuales
      const anotadoresActuales = equipo === 'A' 
        ? match.anotadoresA || []
        : match.anotadoresB || [];

      // Agregar nueva anotación
      const nuevaAnotacion = {
        jugador: jugadorInput.trim(),
        puntos: puntosAAgregar,
        timestamp: new Date().toISOString()
      };
      const nuevosAnotadores = [...anotadoresActuales, nuevaAnotacion];

      const updateData = {
        ...nuevoMarcador,
        ...(equipo === 'A' 
          ? { anotadoresA: nuevosAnotadores }
          : { anotadoresB: nuevosAnotadores }
        ),
        estado: "en curso"
      };

      await updateDoc(doc(db, "matches", matchId), updateData);

      // Actualizar estado local
      setMatch(prev => ({
        ...prev,
        ...updateData
      }));

      // Limpiar inputs
      setJugadorInput("");
      setMostrarInputJugador(null);
      setTipoCanasta(1);

    } catch (error) {
      console.error("Error al anotar puntos:", error);
      alert("Error al anotar puntos");
    }
  };

  // Iniciar partido
  const iniciarPartido = async () => {
    if (window.confirm("¿Estás seguro de que quieres iniciar este partido?")) {
      try {
        await updateDoc(doc(db, "matches", matchId), {
          estado: "en curso",
          fechaInicio: new Date().toISOString()
        });

        setMatch(prev => ({
          ...prev,
          estado: "en curso",
          fechaInicio: new Date().toISOString()
        }));

        setPartidoIniciado(true);
        alert("Partido iniciado correctamente");
      } catch (error) {
        console.error("Error al iniciar partido:", error);
        alert("Error al iniciar partido");
      }
    }
  };

  // Finalizar partido
  const finalizarPartido = async () => {
    if (window.confirm("¿Estás seguro de que quieres finalizar este partido?")) {
      try {
        await updateDoc(doc(db, "matches", matchId), {
          estado: "finalizado",
          fechaFinalizacion: new Date().toISOString()
        });

        setMatch(prev => ({
          ...prev,
          estado: "finalizado",
          fechaFinalizacion: new Date().toISOString()
        }));

        setPartidoFinalizado(true);
        alert("Partido finalizado correctamente");
      } catch (error) {
        console.error("Error al finalizar partido:", error);
        alert("Error al finalizar partido");
      }
    }
  };

  // Obtener estadísticas del jugador
  const getEstadisticasJugador = (anotaciones) => {
    const stats = {};
    anotaciones.forEach(anotacion => {
      if (!stats[anotacion.jugador]) {
        stats[anotacion.jugador] = { puntos1: 0, puntos2: 0, puntos3: 0, total: 0 };
      }
      stats[anotacion.jugador][`puntos${anotacion.puntos}`]++;
      stats[anotacion.jugador].total += anotacion.puntos;
    });
    return stats;
  };

  if (loading) {
    return (
      <div className="admin-basquet-detail-container">
        <div className="loading-section">
          <div className="loading-spinner"></div>
          <p>Cargando partido...</p>
        </div>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="admin-basquet-detail-container">
        <div className="error-section">
          <h3>Partido no encontrado</h3>
          <button onClick={() => navigate(-1)} className="admin-back-button">
            Volver
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-basquet-detail-container">
      {/* Header */}
      <div className="admin-basquet-header">
        <button onClick={() => navigate(-1)} className="admin-back-button">
          ← Volver
        </button>
        <h1 className="admin-basquet-title">
          🏀 Gestión de Partido - Básquet
        </h1>
        <div className="admin-basquet-info">
          <span className={`status-badge ${match.estado}`}>
            {match.estado === "pendiente" && "⏳ Pendiente"}
            {match.estado === "en curso" && "▶️ En Curso"}
            {match.estado === "finalizado" && "✅ Finalizado"}
          </span>
        </div>
      </div>

      {/* Controles del partido */}
      <div className="partido-controles">
        {match.estado === "pendiente" && (
          <button 
            onClick={iniciarPartido}
            className="control-btn iniciar-btn"
          >
            <span className="btn-icon">▶️</span>
            Iniciar Partido
          </button>
        )}
        
        {match.estado === "en curso" && (
          <button 
            onClick={finalizarPartido}
            className="control-btn finalizar-btn"
          >
            <span className="btn-icon">🏁</span>
            Finalizar Partido
          </button>
        )}
        
        {match.estado === "finalizado" && (
          <div className="partido-finalizado-msg">
            <span className="msg-icon">✅</span>
            <span>Partido finalizado</span>
          </div>
        )}
      </div>

      {/* Información del partido */}
      <div className="partido-info-card">
        <div className="equipos-vs">
          <div className="equipo-info">
            <div className="equipo-nombre">
              <span className="equipo-icon">🏫</span>
              <h3>{match.equipoA.curso} {match.equipoA.paralelo}</h3>
            </div>
            <div className="marcador">{match.marcadorA || 0}</div>
          </div>
          
          <div className="vs-divider">
            <span className="vs-text">VS</span>
            <div className="partido-detalles">
              <p><strong>📅 Fecha:</strong> {match.fecha || "No definida"}</p>
              <p><strong>🕒 Hora:</strong> {match.hora || "No definida"}</p>
              <p><strong>🏆 Grupo:</strong> {match.grupo}</p>
              <p><strong>⚡ Fase:</strong> {match.fase || "Fase de Grupos 1"}</p>
            </div>
          </div>
          
          <div className="equipo-info">
            <div className="equipo-nombre">
              <span className="equipo-icon">🏫</span>
              <h3>{match.equipoB.curso} {match.equipoB.paralelo}</h3>
            </div>
            <div className="marcador">{match.marcadorB || 0}</div>
          </div>
        </div>
      </div>

      {/* Sección de anotación rápida */}
      {partidoIniciado && !partidoFinalizado && (
        <div className="anotacion-rapida">
          <h3>📊 Anotar Puntos</h3>
          
          <div className="equipos-anotacion">
            {/* Equipo A */}
            <div className="equipo-anotacion">
              <h4>{match.equipoA.curso} {match.equipoA.paralelo}</h4>
              
              {mostrarInputJugador === 'A' ? (
                <div className="input-anotacion">
                  <input
                    type="text"
                    value={jugadorInput}
                    onChange={(e) => setJugadorInput(e.target.value)}
                    placeholder="Nombre del jugador"
                    className="jugador-input"
                  />
                  
                  <div className="puntos-selector">
                    <span>Puntos:</span>
                    <div className="puntos-botones">
                      <button
                        className={`punto-btn ${tipoCanasta === 1 ? 'active' : ''}`}
                        onClick={() => setTipoCanasta(1)}
                      >
                        1 pt
                      </button>
                      <button
                        className={`punto-btn ${tipoCanasta === 2 ? 'active' : ''}`}
                        onClick={() => setTipoCanasta(2)}
                      >
                        2 pts
                      </button>
                      <button
                        className={`punto-btn ${tipoCanasta === 3 ? 'active' : ''}`}
                        onClick={() => setTipoCanasta(3)}
                      >
                        3 pts
                      </button>
                    </div>
                  </div>
                  
                  <div className="accion-botones">
                    <button
                      onClick={() => anotarPuntos('A')}
                      className="anotar-btn"
                    >
                      ✅ Anotar
                    </button>
                    <button
                      onClick={() => {
                        setMostrarInputJugador(null);
                        setJugadorInput("");
                        setTipoCanasta(1);
                      }}
                      className="cancelar-btn"
                    >
                      ❌ Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setMostrarInputJugador('A')}
                  className="agregar-punto-btn"
                >
                  🏀 + Anotar Puntos
                </button>
              )}
            </div>

            {/* Equipo B */}
            <div className="equipo-anotacion">
              <h4>{match.equipoB.curso} {match.equipoB.paralelo}</h4>
              
              {mostrarInputJugador === 'B' ? (
                <div className="input-anotacion">
                  <input
                    type="text"
                    value={jugadorInput}
                    onChange={(e) => setJugadorInput(e.target.value)}
                    placeholder="Nombre del jugador"
                    className="jugador-input"
                  />
                  
                  <div className="puntos-selector">
                    <span>Puntos:</span>
                    <div className="puntos-botones">
                      <button
                        className={`punto-btn ${tipoCanasta === 1 ? 'active' : ''}`}
                        onClick={() => setTipoCanasta(1)}
                      >
                        1 pt
                      </button>
                      <button
                        className={`punto-btn ${tipoCanasta === 2 ? 'active' : ''}`}
                        onClick={() => setTipoCanasta(2)}
                      >
                        2 pts
                      </button>
                      <button
                        className={`punto-btn ${tipoCanasta === 3 ? 'active' : ''}`}
                        onClick={() => setTipoCanasta(3)}
                      >
                        3 pts
                      </button>
                    </div>
                  </div>
                  
                  <div className="accion-botones">
                    <button
                      onClick={() => anotarPuntos('B')}
                      className="anotar-btn"
                    >
                      ✅ Anotar
                    </button>
                    <button
                      onClick={() => {
                        setMostrarInputJugador(null);
                        setJugadorInput("");
                        setTipoCanasta(1);
                      }}
                      className="cancelar-btn"
                    >
                      ❌ Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setMostrarInputJugador('B')}
                  className="agregar-punto-btn"
                >
                  🏀 + Anotar Puntos
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Resumen de anotaciones (solo visualización para profesor) */}
      <div className="anotaciones-resumen">
        <div className="resumen-header">
          <h3>📈 Resumen de Anotaciones</h3>
        </div>

        <div className="equipos-resumen">
          {/* Resumen Equipo A */}
          <div className="equipo-resumen">
            <h4>{match.equipoA.curso} {match.equipoA.paralelo}</h4>
            
            <div className="anotaciones-display">
              {(match.anotadoresA || []).map((anotacion, index) => (
                <div key={index} className="anotacion-item">
                  <span className="jugador-nombre">{anotacion.jugador}</span>
                  <span className={`puntos-badge puntos-${anotacion.puntos}`}>
                    {anotacion.puntos} pt{anotacion.puntos > 1 ? 's' : ''}
                  </span>
                </div>
              ))}
              
              {/* Estadísticas del equipo */}
              {match.anotadoresA && match.anotadoresA.length > 0 && (
                <div className="estadisticas-equipo">
                  <h5>📊 Estadísticas:</h5>
                  {Object.entries(getEstadisticasJugador(match.anotadoresA)).map(([jugador, stats]) => (
                    <div key={jugador} className="jugador-stats">
                      <span className="stats-jugador">{jugador}:</span>
                      <span className="stats-detalle">
                        {stats.total} pts ({stats.puntos1 > 0 && `${stats.puntos1}×1pt `}
                        {stats.puntos2 > 0 && `${stats.puntos2}×2pts `}
                        {stats.puntos3 > 0 && `${stats.puntos3}×3pts`})
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Resumen Equipo B */}
          <div className="equipo-resumen">
            <h4>{match.equipoB.curso} {match.equipoB.paralelo}</h4>
            
            <div className="anotaciones-display">
              {(match.anotadoresB || []).map((anotacion, index) => (
                <div key={index} className="anotacion-item">
                  <span className="jugador-nombre">{anotacion.jugador}</span>
                  <span className={`puntos-badge puntos-${anotacion.puntos}`}>
                    {anotacion.puntos} pt{anotacion.puntos > 1 ? 's' : ''}
                  </span>
                </div>
              ))}
              
              {/* Estadísticas del equipo */}
              {match.anotadoresB && match.anotadoresB.length > 0 && (
                <div className="estadisticas-equipo">
                  <h5>📊 Estadísticas:</h5>
                  {Object.entries(getEstadisticasJugador(match.anotadoresB)).map(([jugador, stats]) => (
                    <div key={jugador} className="jugador-stats">
                      <span className="stats-jugador">{jugador}:</span>
                      <span className="stats-detalle">
                        {stats.total} pts ({stats.puntos1 > 0 && `${stats.puntos1}×1pt `}
                        {stats.puntos2 > 0 && `${stats.puntos2}×2pts `}
                        {stats.puntos3 > 0 && `${stats.puntos3}×3pts`})
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Acciones del partido */}
      {match.estado !== "finalizado" && (
        <div className="partido-acciones">
          <button onClick={finalizarPartido} className="finalizar-btn">
            🏁 Finalizar Partido
          </button>
        </div>
      )}
    </div>
  );
}
