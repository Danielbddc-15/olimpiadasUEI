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
import { useParams } from "react-router-dom";
import { Link, useLocation } from "react-router-dom";
import "../styles/ProfesorHorarios.css";

export default function ProfesorHorarios() {
  const { discipline } = useParams();
  const location = useLocation();
  const [matches, setMatches] = useState([]);
  const [horariosPorDia, setHorariosPorDia] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedMatches, setSelectedMatches] = useState(new Set());
  const [draggedMatch, setDraggedMatch] = useState(null);
  const [showTimeSelector, setShowTimeSelector] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState(null);

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

  // Funciones para drag and drop
  const handleDragStart = (e, partido) => {
    setDraggedMatch(partido);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, targetDia, targetHora) => {
    e.preventDefault();
    
    if (!draggedMatch) return;

    // Verificar si ya hay un partido en esa hora
    const existingMatch = horariosPorDia[targetDia][targetHora];
    
    // ELIMINADA: Validación de equipos por día - Ahora se permite múltiples partidos por equipo

    // Actualizar el horario
    const nuevosHorarios = { ...horariosPorDia };
    
    // Quitar el partido de su posición anterior
    Object.keys(nuevosHorarios).forEach(dia => {
      Object.keys(nuevosHorarios[dia]).forEach(hora => {
        if (nuevosHorarios[dia][hora] && nuevosHorarios[dia][hora].id === draggedMatch.id) {
          nuevosHorarios[dia][hora] = null;
        }
      });
    });

    // Si hay un partido en el destino, intercambiarlo
    if (existingMatch) {
      // Buscar la posición anterior del partido arrastrado
      let draggedMatchOldSlot = null;
      Object.keys(horariosPorDia).forEach(dia => {
        Object.keys(horariosPorDia[dia]).forEach(hora => {
          if (horariosPorDia[dia][hora] && horariosPorDia[dia][hora].id === draggedMatch.id) {
            draggedMatchOldSlot = { dia, hora };
          }
        });
      });

      if (draggedMatchOldSlot) {
        nuevosHorarios[draggedMatchOldSlot.dia][draggedMatchOldSlot.hora] = {
          ...existingMatch,
          diaAsignado: draggedMatchOldSlot.dia,
          horaAsignada: draggedMatchOldSlot.hora
        };
      }
    }

    // Colocar el partido arrastrado en la nueva posición
    nuevosHorarios[targetDia][targetHora] = {
      ...draggedMatch,
      diaAsignado: targetDia,
      horaAsignada: targetHora
    };

    setHorariosPorDia(nuevosHorarios);
    
    // Actualizar en Firebase
    updateFirestore(draggedMatch.id, targetDia, targetHora);
    if (existingMatch) {
      const oldSlot = Object.keys(horariosPorDia).find(dia => 
        Object.keys(horariosPorDia[dia]).find(hora => 
          horariosPorDia[dia][hora] && horariosPorDia[dia][hora].id === draggedMatch.id
        )
      );
      if (oldSlot) {
        const oldHora = Object.keys(horariosPorDia[oldSlot]).find(hora => 
          horariosPorDia[oldSlot][hora] && horariosPorDia[oldSlot][hora].id === draggedMatch.id
        );
        if (oldHora) {
          updateFirestore(existingMatch.id, oldSlot, oldHora);
        }
      }
    }

    setDraggedMatch(null);
  };

  // Función para asignar hora manualmente
  const assignTimeManually = (partido) => {
    setSelectedMatch(partido);
    setShowTimeSelector(true);
  };

  // Función para seleccionar hora específica
  const selectSpecificTime = (dia, hora) => {
    if (!selectedMatch) return;

    // Verificar si ya hay un partido en esa hora
    const existingMatch = horariosPorDia[dia][hora];
    
    // Verificar conflictos de equipos
    const equipoA = `${selectedMatch.equipoA.curso} ${selectedMatch.equipoA.paralelo}`;
    const equipoB = `${selectedMatch.equipoB.curso} ${selectedMatch.equipoB.paralelo}`;
    
    const equiposEnDia = Object.values(horariosPorDia[dia])
      .filter(p => p && p.id !== selectedMatch.id)
      .flatMap(p => [
        `${p.equipoA.curso} ${p.equipoA.paralelo}`,
        `${p.equipoB.curso} ${p.equipoB.paralelo}`
      ]);

    if (equiposEnDia.includes(equipoA) || equiposEnDia.includes(equipoB)) {
      alert('Uno de los equipos ya tiene un partido programado ese día');
      return;
    }

    const nuevosHorarios = { ...horariosPorDia };
    
    // Quitar el partido de su posición anterior
    Object.keys(nuevosHorarios).forEach(d => {
      Object.keys(nuevosHorarios[d]).forEach(h => {
        if (nuevosHorarios[d][h] && nuevosHorarios[d][h].id === selectedMatch.id) {
          nuevosHorarios[d][h] = null;
        }
      });
    });

    // Colocar en la nueva posición
    nuevosHorarios[dia][hora] = {
      ...selectedMatch,
      diaAsignado: dia,
      horaAsignada: hora
    };

    setHorariosPorDia(nuevosHorarios);
    updateFirestore(selectedMatch.id, dia, hora);
    
    setShowTimeSelector(false);
    setSelectedMatch(null);
  };

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

  // Función para mover partidos seleccionados al siguiente día
  const moverPartidosAlSiguienteDia = async () => {
    if (selectedMatches.size === 0) return;

    const partidosAMover = [];
    
    // Recopilar partidos seleccionados
    Object.values(horariosPorDia).forEach(dia => {
      Object.values(dia).forEach(partido => {
        if (partido && selectedMatches.has(partido.id)) {
          partidosAMover.push(partido);
        }
      });
    });

    // Actualizar estado de partidos para reorganización
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
    <div className="profesor-horarios-container">
      {/* Header */}
      <div className="profesor-header">
        <div className="header-icon">📅</div>
        <h1 className="profesor-title">Gestión de Horarios</h1>
        <p className="profesor-subtitle">
          Organización semanal de partidos de{" "}
          {discipline === "futbol" ? "Fútbol" : discipline === "voley" ? "Vóley" : "Básquet"}
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
                    <div key={hora} className="horario-slot">
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
                            <div className="partido-actions">
                              <button 
                                className="time-select-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  assignTimeManually(partido);
                                }}
                                title="Seleccionar hora específica"
                              >
                                ⏰
                              </button>
                            </div>
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
                        <div 
                          className="slot-vacio"
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, dia, hora)}
                        >
                          <span className="vacio-text">Arrastrar partido aquí</span>
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

      {/* Modal para seleccionar hora específica */}
      {showTimeSelector && selectedMatch && (
        <div className="modal-overlay" onClick={() => setShowTimeSelector(false)}>
          <div className="time-selector-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Seleccionar Hora para el Partido</h3>
              <button 
                className="close-modal-btn"
                onClick={() => setShowTimeSelector(false)}
              >
                ✕
              </button>
            </div>
            
            <div className="match-info">
              <div className="teams">
                <span className="team">{selectedMatch.equipoA.curso} {selectedMatch.equipoA.paralelo}</span>
                <span className="vs">vs</span>
                <span className="team">{selectedMatch.equipoB.curso} {selectedMatch.equipoB.paralelo}</span>
              </div>
            </div>

            <div className="time-grid">
              {diasLaborables.map(dia => (
                <div key={dia} className="day-column">
                  <h4 className="day-title">{dia.charAt(0).toUpperCase() + dia.slice(1)}</h4>
                  <div className="time-slots">
                    {horariosDisponibles.map(hora => {
                      const isOccupied = horariosPorDia[dia]?.[hora] !== null;
                      const isSameMatch = horariosPorDia[dia]?.[hora]?.id === selectedMatch.id;
                      
                      return (
                        <button
                          key={hora}
                          className={`time-slot ${isOccupied && !isSameMatch ? 'occupied' : ''} ${isSameMatch ? 'current' : ''}`}
                          disabled={isOccupied && !isSameMatch}
                          onClick={() => selectSpecificTime(dia, hora)}
                        >
                          {hora}
                          {isOccupied && !isSameMatch && <span className="occupied-indicator">🔒</span>}
                          {isSameMatch && <span className="current-indicator">📍</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
