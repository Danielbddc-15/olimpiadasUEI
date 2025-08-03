import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase/config";
import "../styles/ProfesorFutbolMatchDetail.css";

export default function ProfesorMatchDetail() {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);

  // Estados para edición de goleadores (solo nombres)
  const [editandoGoleadores, setEditandoGoleadores] = useState(false);
  const [goleadoresTemporal, setGoleadoresTemporal] = useState({ A: [], B: [] });

  // Cargar datos del partido
  useEffect(() => {
    const fetchMatch = async () => {
      try {
        const docRef = doc(db, "matches", matchId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const matchData = { id: docSnap.id, ...docSnap.data() };
          setMatch(matchData);
          
          // Inicializar valores temporales
          setGoleadoresTemporal({
            A: [...(matchData.goleadoresA || [])],
            B: [...(matchData.goleadoresB || [])]
          });
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

  // Editar nombre de goleador
  const editarNombreGoleador = (equipo, indice, nuevoNombre) => {
    setGoleadoresTemporal(prev => ({
      ...prev,
      [equipo]: prev[equipo].map((nombre, i) => 
        i === indice ? nuevoNombre : nombre
      )
    }));
  };

  // Guardar cambios de nombres de goleadores
  const guardarGoleadores = async () => {
    try {
      const updateData = {
        goleadoresA: goleadoresTemporal.A,
        goleadoresB: goleadoresTemporal.B
      };

      await updateDoc(doc(db, "matches", matchId), updateData);

      setMatch(prev => ({
        ...prev,
        ...updateData
      }));

      setEditandoGoleadores(false);
      alert("Nombres de goleadores actualizados correctamente");
    } catch (error) {
      console.error("Error al actualizar goleadores:", error);
      alert("Error al actualizar nombres de goleadores");
    }
  };

  // Cancelar edición de goleadores
  const cancelarEdicionGoleadores = () => {
    setGoleadoresTemporal({
      A: [...(match.goleadoresA || [])],
      B: [...(match.goleadoresB || [])]
    });
    setEditandoGoleadores(false);
  };

  // Función para contar goleadores
  const contarGoleadores = (goleadores) => {
    const conteo = {};
    (goleadores || []).forEach(nombre => {
      conteo[nombre] = (conteo[nombre] || 0) + 1;
    });
    return conteo;
  };

  // Validar si se puede iniciar el partido (solo para profesores)
  const puedeIniciarPartido = () => {
    const userRole = localStorage.getItem('userRole');
    
    // Si es admin, puede iniciar siempre
    if (userRole === 'admin') {
      return { puede: true, mensaje: '' };
    }
    
    // Para profesores, validar hora
    if (!match.fecha || !match.hora) {
      return { 
        puede: false, 
        mensaje: 'Este partido no tiene fecha y hora programada. Solo un administrador puede iniciarlo.' 
      };
    }
    
    // Crear fecha del partido
    const fechaPartido = new Date(`${match.fecha}T${match.hora}`);
    const ahora = new Date();
    
    // Calcular diferencia en minutos
    const diferenciaMinutos = (fechaPartido.getTime() - ahora.getTime()) / (1000 * 60);
    
    // Permitir iniciar 30 minutos antes del partido
    if (diferenciaMinutos > 30) {
      const horasRestantes = Math.floor(diferenciaMinutos / 60);
      const minutosRestantes = Math.floor(diferenciaMinutos % 60);
      return { 
        puede: false, 
        mensaje: `Solo puedes iniciar el partido 30 minutos antes de la hora programada. Tiempo restante: ${horasRestantes}h ${minutosRestantes}m` 
      };
    }
    
    // Si ya pasó mucho tiempo (más de 2 horas después), también restringir
    if (diferenciaMinutos < -120) {
      return { 
        puede: false, 
        mensaje: 'Este partido debió haberse jugado hace más de 2 horas. Contacta a un administrador.' 
      };
    }
    
    return { puede: true, mensaje: '' };
  };

  // Cambiar estado del partido (con restricciones para profesor)
  const cambiarEstadoPartido = async (nuevoEstado) => {
    try {
      // Validar si se puede iniciar el partido (solo para estado "en curso")
      if (nuevoEstado === "en curso") {
        const validacion = puedeIniciarPartido();
        if (!validacion.puede) {
          alert(validacion.mensaje);
          return;
        }
      }
      
      const updateData = { estado: nuevoEstado };

      await updateDoc(doc(db, "matches", matchId), updateData);
      setMatch(prev => ({ ...prev, ...updateData }));
      
      const mensajes = {
        "en curso": "Partido iniciado",
        "finalizado": "Partido finalizado",
        "pendiente": "Partido pausado"
      };
      alert(mensajes[nuevoEstado] || "Estado actualizado");
    } catch (error) {
      console.error("Error al cambiar estado:", error);
      alert("Error al cambiar estado del partido");
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Cargando partido...</p>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="error-container">
        <p>Partido no encontrado</p>
        <button onClick={() => navigate(-1)} className="back-btn">
          Volver
        </button>
      </div>
    );
  }

  const equipoA = `${match.equipoA?.curso} ${match.equipoA?.paralelo}`;
  const equipoB = `${match.equipoB?.curso} ${match.equipoB?.paralelo}`;
  const goleadoresA = contarGoleadores(match.goleadoresA);
  const goleadoresB = contarGoleadores(match.goleadoresB);
  const partidoFinalizado = match.estado === "finalizado";

  return (
    <div className="profesor-match-detail-container">
      {/* Header */}
      <div className="profesor-match-header">
        <button onClick={() => navigate(-1)} className="profesor-back-button">
          ← Volver
        </button>
        <h1 className="profesor-match-title">Detalle del Partido</h1>
        <div className="profesor-match-info">
          <span className="profesor-match-group">{match.grupo}</span>
          <span className="profesor-match-phase">{match.fase || "Grupos"}</span>
        </div>
      </div>

      {/* Estado del partido */}
      <div className="profesor-match-status">
        <div className="profesor-status-info">
          <span className={`profesor-status-badge ${match.estado?.replace(' ', '-')}`}>
            {match.estado === "pendiente" && "⏳ Pendiente"}
            {match.estado === "en curso" && "🟢 En Curso"}
            {match.estado === "finalizado" && "✅ Finalizado"}
          </span>
        </div>
        <div className="profesor-status-actions">
          {match.estado === "pendiente" && (
            <>
              <button
                onClick={() => cambiarEstadoPartido("en curso")}
                className={`profesor-btn profesor-btn-start ${!puedeIniciarPartido().puede ? 'disabled' : ''}`}
                disabled={!puedeIniciarPartido().puede}
                title={!puedeIniciarPartido().puede ? puedeIniciarPartido().mensaje : 'Iniciar partido'}
              >
                🚀 Iniciar Partido
              </button>
              {!puedeIniciarPartido().puede && (
                <div className="profesor-restriction-info">
                  <span className="restriction-icon">⏰</span>
                  <span className="restriction-text">{puedeIniciarPartido().mensaje}</span>
                </div>
              )}
            </>
          )}
          {match.estado === "en curso" && (
            <>
              <button
                onClick={() => cambiarEstadoPartido("finalizado")}
                className="profesor-btn profesor-btn-finish"
              >
                🏁 Finalizar Partido
              </button>
              <button
                onClick={() => cambiarEstadoPartido("pendiente")}
                className="profesor-btn profesor-btn-resume"
              >
                ⏸️ Pausar Partido
              </button>
            </>
          )}
          {/* Profesor NO puede reanudar partidos finalizados - solo admin */}
        </div>
      </div>

      {/* Marcador principal */}
      <div className="profesor-scoreboard">
        {/* Equipo A */}
        <div className="profesor-team-section">
          <div className="profesor-team-header">
            <div className="profesor-team-icon">🏆</div>
            <h2 className="profesor-team-name">{equipoA}</h2>
          </div>
          <div className="profesor-score-display">
            <span className="profesor-score">{match.marcadorA || 0}</span>
          </div>
        </div>

        {/* Separador */}
        <div className="profesor-vs-separator">
          <span className="profesor-vs-text">VS</span>
        </div>

        {/* Equipo B */}
        <div className="profesor-team-section">
          <div className="profesor-team-header">
            <div className="profesor-team-icon">🏆</div>
            <h2 className="profesor-team-name">{equipoB}</h2>
          </div>
          <div className="profesor-score-display">
            <span className="profesor-score">{match.marcadorB || 0}</span>
          </div>
        </div>
      </div>

      {/* Lista de goleadores */}
      <div className="profesor-goalscorers-section">
        <div className="profesor-goalscorers-header">
          <h3 className="profesor-section-title">⚽ Goleadores del Partido</h3>
          <div className="profesor-goalscorer-controls">
            {!partidoFinalizado && (
              editandoGoleadores ? (
                <div className="profesor-edit-actions">
                  <button
                    onClick={guardarGoleadores}
                    className="profesor-btn profesor-btn-save"
                  >
                    💾 Guardar Cambios
                  </button>
                  <button
                    onClick={cancelarEdicionGoleadores}
                    className="profesor-btn profesor-btn-cancel"
                  >
                    ❌ Cancelar
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setEditandoGoleadores(true)}
                  className="profesor-btn profesor-btn-edit"
                >
                  ✏️ Editar Nombres
                </button>
              )
            )}
            {partidoFinalizado && (
              <span className="profesor-readonly-notice">
                🔒 Partido finalizado - Solo lectura
              </span>
            )}
          </div>
        </div>

        <div className="profesor-goalscorers-grid">
          {/* Goleadores Equipo A */}
          <div className="profesor-team-goalscorers">
            <h4 className="profesor-team-subtitle">{equipoA}</h4>
            <div className="profesor-goalscorers-list">
              {editandoGoleadores && !partidoFinalizado ? (
                <>
                  {goleadoresTemporal.A.map((nombre, index) => (
                    <div key={index} className="profesor-goalscorer-edit-item">
                      <input
                        type="text"
                        value={nombre}
                        onChange={(e) => editarNombreGoleador('A', index, e.target.value)}
                        className="profesor-goalscorer-input"
                        placeholder="Nombre del goleador..."
                      />
                    </div>
                  ))}
                </>
              ) : (
                <>
                  {Object.keys(goleadoresA).length > 0 ? (
                    Object.entries(goleadoresA).map(([nombre, goles]) => (
                      <div key={nombre} className="profesor-goalscorer-item">
                        <span className="profesor-player-name">{nombre}</span>
                        <span className="profesor-goal-count">({goles})</span>
                      </div>
                    ))
                  ) : (
                    <p className="profesor-no-goals">Sin goles aún</p>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Goleadores Equipo B */}
          <div className="profesor-team-goalscorers">
            <h4 className="profesor-team-subtitle">{equipoB}</h4>
            <div className="profesor-goalscorers-list">
              {editandoGoleadores && !partidoFinalizado ? (
                <>
                  {goleadoresTemporal.B.map((nombre, index) => (
                    <div key={index} className="profesor-goalscorer-edit-item">
                      <input
                        type="text"
                        value={nombre}
                        onChange={(e) => editarNombreGoleador('B', index, e.target.value)}
                        className="profesor-goalscorer-input"
                        placeholder="Nombre del goleador..."
                      />
                    </div>
                  ))}
                </>
              ) : (
                <>
                  {Object.keys(goleadoresB).length > 0 ? (
                    Object.entries(goleadoresB).map(([nombre, goles]) => (
                      <div key={nombre} className="profesor-goalscorer-item">
                        <span className="profesor-player-name">{nombre}</span>
                        <span className="profesor-goal-count">({goles})</span>
                      </div>
                    ))
                  ) : (
                    <p className="profesor-no-goals">Sin goles aún</p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Información adicional */}
      <div className="profesor-match-additional-info">
        <div className="profesor-info-grid">
          <div className="profesor-info-item">
            <span className="profesor-info-label">📅 Fecha:</span>
            <span className="profesor-info-value">{match.fecha || "No definida"}</span>
          </div>
          <div className="profesor-info-item">
            <span className="profesor-info-label">🕐 Hora:</span>
            <span className="profesor-info-value">{match.hora || "No definida"}</span>
          </div>
          <div className="profesor-info-item">
            <span className="profesor-info-label">🏟️ Grupo:</span>
            <span className="profesor-info-value">{match.grupo}</span>
          </div>
          <div className="profesor-info-item">
            <span className="profesor-info-label">🏆 Fase:</span>
            <span className="profesor-info-value">{match.fase || "Grupos"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
