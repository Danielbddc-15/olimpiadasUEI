import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  query,
  where,
  updateDoc,
  doc,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { useParams, useNavigate } from "react-router-dom";
import "../styles/AdminHorarios.css";

export default function AdminHorarios() {
  const { discipline } = useParams();
  const navigate = useNavigate();
  const [matches, setMatches] = useState([]);
  const [horariosPorDia, setHorariosPorDia] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedMatches, setSelectedMatches] = useState(new Set());
  const [draggedMatch, setDraggedMatch] = useState(null);
  const [showTimeSelector, setShowTimeSelector] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState(null);

  // Funciones de navegación
  const goToTeams = () => {
    navigate(`/admin/${discipline}/equipos`);
  };

  const goToMatches = () => {
    navigate(`/admin/${discipline}/partidos`);
  };

  const goToStandings = () => {
    navigate(`/admin/${discipline}/tabla`);
  };

  const goToPanel = () => {
    navigate('/admin');
  };

  // Días laborables de la semana
  const diasLaborables = [
    'lunes',
    'martes', 
    'miércoles',
    'jueves',
    'viernes'
  ];

  // Horarios disponibles (intervalos de 45 minutos)
  const horariosDisponibles = [
    '08:00',
    '08:45',
    '09:30',
    '10:15',
    '11:00',
    '11:45',
    '12:30',
    '13:15',
    '14:00',
    '14:45',
    '15:30',
    '16:15'
  ];

  // Obtener partidos en tiempo real
  useEffect(() => {
    setLoading(true);
    const q = query(
      collection(db, "matches"),
      where("disciplina", "==", discipline),
      where("estado", "in", ["pendiente", "programado"])
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

  // Organizar partidos por horarios
  useEffect(() => {
    if (matches.length === 0) return;

    const horarios = {};
    
    // Inicializar estructura de horarios
    diasLaborables.forEach(dia => {
      horarios[dia] = {};
      horariosDisponibles.forEach(hora => {
        horarios[dia][hora] = null;
      });
    });

    // Colocar partidos que ya tienen fecha y hora asignada
    matches.forEach(partido => {
      if (partido.fecha && partido.hora) {
        const dia = partido.fecha;
        const hora = partido.hora;
        if (horarios[dia] && horarios[dia][hora] !== undefined) {
          horarios[dia][hora] = {
            ...partido,
            diaAsignado: dia,
            horaAsignada: hora
          };
        }
      }
    });

    // Colocar partidos sin asignar automáticamente
    const partidosSinAsignar = matches.filter(m => !m.fecha || !m.hora);
    
    let diaIndex = 0;
    let horaIndex = 0;
    const equiposUsadosPorDia = {};

    // Función para verificar si un equipo ya juega en un día
    const equipoYaJuegaEnDia = (partido, dia) => {
      if (!equiposUsadosPorDia[dia]) {
        equiposUsadosPorDia[dia] = new Set();
        // Agregar equipos que ya están programados ese día
        Object.values(horarios[dia]).forEach(p => {
          if (p) {
            const equipoA = `${p.equipoA.curso} ${p.equipoA.paralelo}`;
            const equipoB = `${p.equipoB.curso} ${p.equipoB.paralelo}`;
            equiposUsadosPorDia[dia].add(equipoA);
            equiposUsadosPorDia[dia].add(equipoB);
          }
        });
      }
      
      const equipoA = `${partido.equipoA.curso} ${partido.equipoA.paralelo}`;
      const equipoB = `${partido.equipoB.curso} ${partido.equipoB.paralelo}`;
      
      return equiposUsadosPorDia[dia].has(equipoA) || equiposUsadosPorDia[dia].has(equipoB);
    };

    // Función para marcar equipos como usados en un día
    const marcarEquiposUsados = (partido, dia) => {
      if (!equiposUsadosPorDia[dia]) {
        equiposUsadosPorDia[dia] = new Set();
      }
      
      const equipoA = `${partido.equipoA.curso} ${partido.equipoA.paralelo}`;
      const equipoB = `${partido.equipoB.curso} ${partido.equipoB.paralelo}`;
      
      equiposUsadosPorDia[dia].add(equipoA);
      equiposUsadosPorDia[dia].add(equipoB);
    };

    // Asignar partidos sin programar
    partidosSinAsignar.forEach(partido => {
      let asignado = false;
      let intentos = 0;
      const maxIntentos = diasLaborables.length * horariosDisponibles.length;

      while (!asignado && intentos < maxIntentos) {
        const dia = diasLaborables[diaIndex];
        const hora = horariosDisponibles[horaIndex];

        if (!horarios[dia][hora] && !equipoYaJuegaEnDia(partido, dia)) {
          horarios[dia][hora] = {
            ...partido,
            diaAsignado: dia,
            horaAsignada: hora
          };
          marcarEquiposUsados(partido, dia);
          asignado = true;
        }

        horaIndex++;
        if (horaIndex >= horariosDisponibles.length) {
          horaIndex = 0;
          diaIndex++;
          if (diaIndex >= diasLaborables.length) {
            diaIndex = 0;
          }
        }
        intentos++;
      }
    });

    setHorariosPorDia(horarios);
  }, [matches]);

  // Función para obtener el tipo de fase de un partido
  const getTipoFase = (partido) => {
    if (!partido.fase || partido.fase === 'grupos1') {
      return { tipo: 'Fase de Grupos 1', color: '#4CAF50', icon: '🏃‍♂️' };
    } else if (partido.fase === 'grupos3') {
      return { tipo: 'Fase de Posicionamiento', color: '#FF9800', icon: '🎯' };
    } else if (partido.fase === 'semifinal') {
      return { tipo: 'Semifinal', color: '#2196F3', icon: '🥈' };
    } else if (partido.fase === 'final') {
      return { tipo: 'Final', color: '#F44336', icon: '🏆' };
    }
    return { tipo: 'Sin clasificar', color: '#757575', icon: '❓' };
  };

  // Funciones de Drag & Drop
  const handleDragStart = (e, partido) => {
    setDraggedMatch(partido);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e, targetDia, targetHora) => {
    e.preventDefault();
    
    if (!draggedMatch) return;

    // Verificar si ya hay un partido en ese horario
    const partidoEnTarget = horariosPorDia[targetDia]?.[targetHora];
    
    // Verificar restricción: un equipo por día
    const equiposEnDia = Object.values(horariosPorDia[targetDia] || {})
      .filter(p => p && p.id !== draggedMatch.id)
      .map(p => [`${p.equipoA.curso} ${p.equipoA.paralelo}`, `${p.equipoB.curso} ${p.equipoB.paralelo}`])
      .flat();
    
    const equiposDraggedMatch = [
      `${draggedMatch.equipoA.curso} ${draggedMatch.equipoA.paralelo}`,
      `${draggedMatch.equipoB.curso} ${draggedMatch.equipoB.paralelo}`
    ];
    
    const conflicto = equiposDraggedMatch.some(equipo => equiposEnDia.includes(equipo));
    
    if (conflicto && !partidoEnTarget) {
      alert('Uno de los equipos ya tiene un partido programado ese día');
      setDraggedMatch(null);
      return;
    }

    try {
      // Si hay un partido en el slot target, intercambiar posiciones
      if (partidoEnTarget) {
        // Intercambiar partidos
        await updateDoc(doc(db, "matches", draggedMatch.id), {
          fecha: targetDia,
          hora: targetHora,
          estado: "programado"
        });

        await updateDoc(doc(db, "matches", partidoEnTarget.id), {
          fecha: draggedMatch.diaAsignado || null,
          hora: draggedMatch.horaAsignada || null,
          estado: draggedMatch.diaAsignado ? "programado" : "pendiente"
        });
      } else {
        // Solo mover el partido arrastrado
        await updateDoc(doc(db, "matches", draggedMatch.id), {
          fecha: targetDia,
          hora: targetHora,
          estado: "programado"
        });
      }
      
      setDraggedMatch(null);
    } catch (error) {
      console.error("Error moviendo partido:", error);
      alert("Error al mover el partido");
      setDraggedMatch(null);
    }
  };

  // Función para abrir selector de horario
  const openTimeSelector = (partido) => {
    setSelectedMatch(partido);
    setShowTimeSelector(true);
  };

  // Función para asignar horario manualmente
  const assignTimeManually = async (dia, hora) => {
    if (!selectedMatch) return;

    // Verificar conflictos
    const partidoEnTarget = horariosPorDia[dia]?.[hora];
    
    const equiposEnDia = Object.values(horariosPorDia[dia] || {})
      .filter(p => p && p.id !== selectedMatch.id)
      .map(p => [`${p.equipoA.curso} ${p.equipoA.paralelo}`, `${p.equipoB.curso} ${p.equipoB.paralelo}`])
      .flat();
    
    const equiposSelectedMatch = [
      `${selectedMatch.equipoA.curso} ${selectedMatch.equipoA.paralelo}`,
      `${selectedMatch.equipoB.curso} ${selectedMatch.equipoB.paralelo}`
    ];
    
    const conflicto = equiposSelectedMatch.some(equipo => equiposEnDia.includes(equipo));
    
    if (conflicto && !partidoEnTarget) {
      alert('Uno de los equipos ya tiene un partido programado ese día');
      return;
    }

    try {
      if (partidoEnTarget) {
        // Intercambiar
        await updateDoc(doc(db, "matches", selectedMatch.id), {
          fecha: dia,
          hora: hora,
          estado: "programado"
        });

        await updateDoc(doc(db, "matches", partidoEnTarget.id), {
          fecha: selectedMatch.diaAsignado || null,
          hora: selectedMatch.horaAsignada || null,
          estado: selectedMatch.diaAsignado ? "programado" : "pendiente"
        });
      } else {
        await updateDoc(doc(db, "matches", selectedMatch.id), {
          fecha: dia,
          hora: hora,
          estado: "programado"
        });
      }
      
      setShowTimeSelector(false);
      setSelectedMatch(null);
    } catch (error) {
      console.error("Error asignando horario:", error);
      alert("Error al asignar el horario");
    }
  };

  // Función para mover partidos seleccionados al siguiente día
  const moverPartidosAlSiguienteDia = async () => {
    if (selectedMatches.size === 0) return;

    const partidosAMover = [];
    
    Object.values(horariosPorDia).forEach(dia => {
      Object.values(dia).forEach(partido => {
        if (partido && selectedMatches.has(partido.id)) {
          partidosAMover.push(partido);
        }
      });
    });

    try {
      for (const partido of partidosAMover) {
        await updateDoc(doc(db, "matches", partido.id), {
          fecha: null,
          hora: null,
          estado: "pendiente"
        });
      }
      
      setSelectedMatches(new Set());
      alert(`${partidosAMover.length} partidos movidos para reorganización automática`);
    } catch (error) {
      console.error("Error moviendo partidos:", error);
      alert("Error al mover los partidos");
    }
  };

  // Función para confirmar horarios del día
  const confirmarHorariosDia = async (dia) => {
    const partidosDelDia = Object.entries(horariosPorDia[dia])
      .filter(([hora, partido]) => partido)
      .map(([hora, partido]) => ({ ...partido, hora }));

    try {
      for (const partido of partidosDelDia) {
        await updateDoc(doc(db, "matches", partido.id), {
          fecha: dia,
          hora: partido.hora,
          estado: "programado"
        });
      }
      
      alert(`Horarios del ${dia} confirmados correctamente`);
    } catch (error) {
      console.error("Error confirmando horarios:", error);
      alert("Error al confirmar los horarios");
    }
  };

  // Función para seleccionar/deseleccionar partido
  const toggleSelectPartido = (partidoId) => {
    const newSelection = new Set(selectedMatches);
    if (newSelection.has(partidoId)) {
      newSelection.delete(partidoId);
    } else {
      newSelection.add(partidoId);
    }
    setSelectedMatches(newSelection);
  };

  return (
    <div className="admin-horarios-container">
      {/* Header */}
      <div className="admin-header">
        <div className="header-icon">📅</div>
        <h1 className="admin-title">Gestión de Horarios</h1>
        <p className="admin-subtitle">
          Organización semanal de partidos de{" "}
          {discipline === "futbol" ? "Fútbol" : discipline === "voley" ? "Vóley" : "Básquet"}
        </p>
      </div>

      {/* Navegación */}
      <div className="navigation-section">
        <button onClick={goToPanel} className="nav-card panel-card">
          <div className="nav-card-icon">🏠</div>
          <div className="nav-card-content">
            <h3 className="nav-card-title">Volver al Panel</h3>
            <p className="nav-card-description">Ir al panel principal</p>
          </div>
          <div className="nav-card-arrow">→</div>
        </button>
        <button onClick={goToTeams} className="nav-card teams-card">
          <div className="nav-card-icon">👥</div>
          <div className="nav-card-content">
            <h3 className="nav-card-title">Gestionar Equipos</h3>
            <p className="nav-card-description">Administrar equipos participantes</p>
          </div>
          <div className="nav-card-arrow">→</div>
        </button>
        <button onClick={goToMatches} className="nav-card matches-card">
          <div className="nav-card-icon">⚽</div>
          <div className="nav-card-content">
            <h3 className="nav-card-title">Gestionar Partidos</h3>
            <p className="nav-card-description">Administrar encuentros</p>
          </div>
          <div className="nav-card-arrow">→</div>
        </button>
        <button onClick={goToStandings} className="nav-card standings-card">
          <div className="nav-card-icon">🏆</div>
          <div className="nav-card-content">
            <h3 className="nav-card-title">Ver Posiciones</h3>
            <p className="nav-card-description">Consultar tabla de posiciones</p>
          </div>
          <div className="nav-card-arrow">→</div>
        </button>
      </div>

      {/* Controles */}
      <div className="horarios-controls">
        <div className="controls-info">
          <div className="info-item">
            <span className="info-icon">🏃‍♂️</span>
            <span>Fase de Grupos 1</span>
          </div>
          <div className="info-item">
            <span className="info-icon">🎯</span>
            <span>Posicionamiento</span>
          </div>
          <div className="info-item">
            <span className="info-icon">🥈</span>
            <span>Semifinales</span>
          </div>
          <div className="info-item">
            <span className="info-icon">🏆</span>
            <span>Finales</span>
          </div>
          <div className="info-item">
            <span className="info-icon">🖱️</span>
            <span>Arrastra para mover</span>
          </div>
        </div>
        
        {selectedMatches.size > 0 && (
          <div className="selection-controls">
            <span className="selected-count">
              {selectedMatches.size} partido(s) seleccionado(s)
            </span>
            <button 
              className="move-matches-btn"
              onClick={moverPartidosAlSiguienteDia}
            >
              <span className="btn-icon">🔄</span>
              Mover para reorganizar
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="loading-section">
          <div className="loading-spinner"></div>
          <p className="loading-text">Cargando horarios...</p>
        </div>
      ) : matches.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📅</div>
          <h3>No hay partidos pendientes</h3>
          <p>Todos los partidos han sido programados o finalizados</p>
        </div>
      ) : (
        <div className="horarios-grid">
          {diasLaborables.map(dia => (
            <div key={dia} className="dia-column">
              <div className="dia-header">
                <h3 className="dia-title">
                  <span className="dia-icon">📅</span>
                  {dia.charAt(0).toUpperCase() + dia.slice(1)}
                </h3>
                <button 
                  className="confirm-day-btn"
                  onClick={() => confirmarHorariosDia(dia)}
                  disabled={!Object.values(horariosPorDia[dia] || {}).some(p => p)}
                >
                  <span className="btn-icon">✅</span>
                  Confirmar día
                </button>
              </div>

              <div className="horarios-lista">
                {horariosDisponibles.map(hora => {
                  const partido = horariosPorDia[dia]?.[hora];
                  return (
                    <div 
                      key={hora} 
                      className="horario-slot"
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, dia, hora)}
                    >
                      <div className="hora-label">{hora}</div>
                      {partido ? (
                        <div 
                          className={`partido-card ${selectedMatches.has(partido.id) ? 'selected' : ''}`}
                          draggable={true}
                          onDragStart={(e) => handleDragStart(e, partido)}
                          onClick={() => toggleSelectPartido(partido.id)}
                        >
                          <div className="partido-header">
                            <div 
                              className="fase-badge"
                              style={{ backgroundColor: getTipoFase(partido).color }}
                            >
                              <span className="fase-icon">{getTipoFase(partido).icon}</span>
                              <span className="fase-text">{getTipoFase(partido).tipo}</span>
                            </div>
                            <button 
                              className="time-select-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                openTimeSelector(partido);
                              }}
                              title="Seleccionar horario manualmente"
                            >
                              🕒
                            </button>
                          </div>
                          
                          <div className="partido-equipos">
                            <div className="equipo">
                              <span className="equipo-icon">🏫</span>
                              <span className="equipo-nombre">
                                {partido.equipoA.curso} {partido.equipoA.paralelo}
                              </span>
                            </div>
                            <div className="vs-divider">VS</div>
                            <div className="equipo">
                              <span className="equipo-icon">🏫</span>
                              <span className="equipo-nombre">
                                {partido.equipoB.curso} {partido.equipoB.paralelo}
                              </span>
                            </div>
                          </div>
                          
                          <div className="partido-info">
                            <div className="info-item">
                              <span className="info-icon">🏆</span>
                              <span>{partido.grupo}</span>
                            </div>
                            <div className="info-item">
                              <span className="info-icon">⚡</span>
                              <span>{partido.estado}</span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="slot-vacio">
                          <span className="vacio-text">Libre</span>
                          <span className="drop-hint">Suelta aquí</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Selector de Horario */}
      {showTimeSelector && selectedMatch && (
        <div className="modal-overlay">
          <div className="time-selector-modal">
            <div className="modal-header">
              <h3>Seleccionar Horario</h3>
              <button 
                className="close-btn"
                onClick={() => setShowTimeSelector(false)}
              >
                ✕
              </button>
            </div>
            
            <div className="match-info">
              <p><strong>{selectedMatch.equipoA.curso} {selectedMatch.equipoA.paralelo}</strong> vs <strong>{selectedMatch.equipoB.curso} {selectedMatch.equipoB.paralelo}</strong></p>
            </div>

            <div className="time-grid">
              {diasLaborables.map(dia => (
                <div key={dia} className="time-day-column">
                  <h4>{dia.charAt(0).toUpperCase() + dia.slice(1)}</h4>
                  {horariosDisponibles.map(hora => {
                    const partidoEnSlot = horariosPorDia[dia]?.[hora];
                    const isOccupied = partidoEnSlot && partidoEnSlot.id !== selectedMatch.id;
                    const canPlace = !isOccupied; // Simplificado para el modal
                    
                    return (
                      <button
                        key={hora}
                        className={`time-slot ${isOccupied ? 'occupied' : ''} ${!canPlace ? 'disabled' : ''}`}
                        disabled={!canPlace}
                        onClick={() => assignTimeManually(dia, hora)}
                      >
                        <span className="time-label">{hora}</span>
                        {isOccupied && (
                          <span className="occupied-text">
                            {partidoEnSlot.equipoA.curso} vs {partidoEnSlot.equipoB.curso}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
