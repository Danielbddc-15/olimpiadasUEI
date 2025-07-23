import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { useParams, useNavigate } from "react-router-dom";
import "../styles/PublicMatches.css";

export default function PublicHorarios() {
  const { discipline } = useParams();
  const navigate = useNavigate();
  const [matches, setMatches] = useState([]);
  const [horariosPorDia, setHorariosPorDia] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedPhase, setSelectedPhase] = useState("todos");

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
      where("disciplina", "==", discipline)
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

  // Obtener fases únicas para filtros
  const fasesUnicas = [...new Set(matches.map(m => m.fase).filter(Boolean))];

  // Filtrar partidos por fase
  const partidosFiltrados = selectedPhase === "todos" 
    ? matches 
    : matches.filter(m => m.fase === selectedPhase);

  return (
    <div className="profesor-horarios-container">
      {/* Header */}
      <div className="profesor-header">
        <div className="header-icon">📅</div>
        <h1 className="profesor-title">Horarios de Partidos</h1>
        <p className="profesor-subtitle">
          Programación semanal de{" "}
          {discipline === "futbol" ? "Fútbol" : discipline === "voley" ? "Vóley" : "Básquet"}
        </p>
      </div>

      {/* Controles estilo profesor */}
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
        
        <div className="selection-controls">
          <span className="selected-count">
            Solo Visualización
          </span>
        </div>
      </div>

      {loading ? (
        <div className="loading-section">
          <div className="loading-spinner"></div>
          <p className="loading-text">Cargando horarios...</p>
        </div>
      ) : matches.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📅</div>
          <h3>No hay partidos programados</h3>
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
                  disabled={true}
                >
                  <span className="btn-icon">👁️</span>
                  Solo Visualización
                </button>
              </div>

              <div className="horarios-lista">
                {horariosDisponibles.map(hora => {
                  const partido = horariosPorDia[dia]?.[hora];
                  
                  return (
                    <div key={hora} className="horario-slot">
                      <div className="hora-label">{hora}</div>
                      {partido ? (
                        <div className="partido-card view-only">
                          <div className="partido-header">
                            <div 
                              className="fase-badge"
                              style={{ backgroundColor: getTipoFase(partido).color }}
                            >
                              <span className="fase-icon">{getTipoFase(partido).icon}</span>
                              <span className="fase-text">{getTipoFase(partido).tipo}</span>
                            </div>
                            <div className="partido-actions">
                              <div className="status-indicator">
                                👁️
                              </div>
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
                            {partido.marcadorA !== null && partido.marcadorB !== null && (
                              <div className="info-item">
                                <span className="info-icon">📊</span>
                                <span>{partido.marcadorA} - {partido.marcadorB}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="slot-vacio">
                          <span className="vacio-text">Libre</span>
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
    </div>
  );
}
