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
  const [allMatches, setAllMatches] = useState([]); // Para todas las disciplinas
  const [horariosPorDia, setHorariosPorDia] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedPhase, setSelectedPhase] = useState("todos");
  
  // Estados para navegación por semanas
  const [currentWeek, setCurrentWeek] = useState(1);
  const [totalWeeks, setTotalWeeks] = useState(() => {
    const saved = localStorage.getItem('olimpiadas_weeks_count');
    return saved ? parseInt(saved) : 4;
  });
  const [weeklySchedule, setWeeklySchedule] = useState({});

  // Estados para configuración de cronograma (desde AdminHorarios)
  const [disciplineConfig, setDisciplineConfig] = useState(() => {
    const saved = localStorage.getItem(`olimpiadas_horarios_discipline_config_${discipline}`);
    return saved ? JSON.parse(saved) : {
      futbol: 'todos', // todos los días
      voley: 'lunes', // día específico para vóley
      basquet: 'martes' // día específico para básquet
    };
  });

  const [startDay, setStartDay] = useState(() => {
    return localStorage.getItem(`olimpiadas_horarios_start_day_${discipline}`) || 'lunes';
  });

  // Días laborables de la semana
  const diasLaborables = [
    'lunes',
    'martes', 
    'miércoles',
    'jueves',
    'viernes'
  ];

  // Configuración de disciplinas con colores
  const disciplinasConfig = {
    futbol: { nombre: 'Fútbol', color: '#4CAF50', icon: '⚽' },
    voley: { nombre: 'Vóley', color: '#2196F3', icon: '🏐' },
    basquet: { nombre: 'Básquet', color: '#FF9800', icon: '🏀' }
  };

  // Funciones de navegación
  const goToDisciplineSelector = () => {
    navigate('/selector');
  };

  const goToLogin = () => {
    navigate('/');
  };

  // Horarios disponibles (ahora configurables)
  const horariosDisponibles = (() => {
    const saved = localStorage.getItem('olimpiadas_custom_times');
    return saved ? JSON.parse(saved) : [
      '08:00', '08:45', '09:30', '10:15', '11:00', '11:45',
      '12:30', '13:15', '14:00', '14:45', '15:30', '16:15'
    ];
  })();

  // Nueva lógica de disciplinas: Fútbol todos los días, Vóley/Básquet alternando
  const getDisciplinesForDay = (dayName) => {
    const dayIndex = diasLaborables.indexOf(dayName);
    const disciplines = ['futbol']; // Fútbol todos los días

    // Nueva lógica: Vóley días impares (0,2,4), Básquet días pares (1,3)
    if (dayIndex % 2 === 0) {
      disciplines.push('voley');
    } else {
      disciplines.push('basquet');
    }

    return disciplines;
  };

  // Obtener partidos en tiempo real - primero cargar todas las disciplinas
  useEffect(() => {
    setLoading(true);
    
    // Cargar todos los partidos para la vista general
    const unsubscribeAll = onSnapshot(collection(db, "matches"), (snapshot) => {
      try {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setAllMatches(data);
      } catch (error) {
        console.error("Error cargando todos los partidos:", error);
      }
    });

    // Cargar partidos específicos de la disciplina actual
    const q = query(
      collection(db, "matches"),
      where("disciplina", "==", discipline)
    );
    
    const unsubscribeDiscipline = onSnapshot(q, (snapshot) => {
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
    
    return () => {
      unsubscribeAll();
      unsubscribeDiscipline();
    };
  }, [discipline]);

  // Calcular el número total de semanas basado en los partidos programados
  useEffect(() => {
    if (allMatches.length > 0) {
      const semanasEncontradas = allMatches
        .filter(m => m.semana && m.semana > 0)
        .map(m => m.semana);
      
      if (semanasEncontradas.length > 0) {
        const maxSemana = Math.max(...semanasEncontradas);
        setTotalWeeks(maxSemana);
      } else {
        // Si no hay partidos con semana asignada, calcular basándose en el número de partidos
        const partidosPorSemana = 20; // Estimación conservadora
        const semanas = Math.ceil(allMatches.length / partidosPorSemana);
        setTotalWeeks(Math.max(4, semanas)); // Mínimo 4 semanas
      }
    }
  }, [allMatches]);

  // Escuchar cambios en la configuración del administrador
  useEffect(() => {
    const handleStorageChange = () => {
      // Actualizar configuración de disciplinas
      const savedConfig = localStorage.getItem(`olimpiadas_horarios_discipline_config_${discipline}`);
      if (savedConfig) {
        setDisciplineConfig(JSON.parse(savedConfig));
      }
      
      // Actualizar día de inicio
      const savedStartDay = localStorage.getItem(`olimpiadas_horarios_start_day_${discipline}`);
      if (savedStartDay) {
        setStartDay(savedStartDay);
      }
    };

    // Escuchar cambios en localStorage
    window.addEventListener('storage', handleStorageChange);
    
    // También verificar cambios cada cierto tiempo (para cambios en la misma pestaña)
    const interval = setInterval(handleStorageChange, 1000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [discipline]);

  // Generar cronograma semanal basado en la configuración del administrador
  useEffect(() => {
    if (allMatches.length === 0) return;

    const schedule = {};
    const orderedDays = getOrderedDays();
    
    // Inicializar estructura para múltiples semanas
    for (let week = 1; week <= totalWeeks; week++) {
      schedule[`semana_${week}`] = {};
      orderedDays.forEach(dia => {
        schedule[`semana_${week}`][dia] = {
          disciplinas: getDisciplinasDelDia(week, dia),
          partidos: {}
        };
        
        // Inicializar horarios para cada disciplina del día
        schedule[`semana_${week}`][dia].disciplinas.forEach(disciplina => {
          schedule[`semana_${week}`][dia].partidos[disciplina] = {};
          horariosDisponibles.forEach(hora => {
            schedule[`semana_${week}`][dia].partidos[disciplina][hora] = null;
          });
        });
      });
    }

    // Distribuir partidos en el cronograma
    allMatches.forEach(partido => {
      if (partido.fecha && partido.hora && partido.semana && partido.disciplina) {
        const weekKey = `semana_${partido.semana}`;
        const dia = partido.fecha;
        const hora = partido.hora;
        const disciplina = partido.disciplina;
        
        if (schedule[weekKey] && 
            schedule[weekKey][dia] && 
            schedule[weekKey][dia].partidos[disciplina] &&
            schedule[weekKey][dia].partidos[disciplina][hora] !== undefined) {
          schedule[weekKey][dia].partidos[disciplina][hora] = partido;
        }
      }
    });

    setWeeklySchedule(schedule);
    
    // Debug: Log para verificar la estructura del cronograma
    console.log('Cronograma semanal generado:', {
      totalSemanas: totalWeeks,
      semanasEnCronograma: Object.keys(schedule).length,
      semanaActual: currentWeek,
      partidosTotales: allMatches.length,
      partidosConSemana: allMatches.filter(p => p.semana).length
    });
  }, [allMatches, totalWeeks, disciplineConfig, startDay]);

  // Función para determinar qué disciplinas juegan cada día según la configuración del admin
  const getDisciplinasDelDia = (semana, dia) => {
    const disciplines = [];
    
    // Fútbol siempre se juega (configuración por defecto)
    if (disciplineConfig.futbol === 'todos') {
      disciplines.push('futbol');
    }
    
    // Verificar vóley
    if (disciplineConfig.voley === dia) {
      disciplines.push('voley');
    }
    
    // Verificar básquet
    if (disciplineConfig.basquet === dia) {
      disciplines.push('basquet');
    }
    
    return disciplines;
  };

  // Función para obtener los días ordenados según el día de inicio configurado
  const getOrderedDays = () => {
    const startIndex = diasLaborables.indexOf(startDay);
    return [
      ...diasLaborables.slice(startIndex),
      ...diasLaborables.slice(0, startIndex)
    ];
  };

  // Organizar partidos por horarios para la disciplina actual y semana actual
  useEffect(() => {
    if (!weeklySchedule[`semana_${currentWeek}`]) {
      setHorariosPorDia({});
      return;
    }

    const horarios = {};
    const semanaActual = weeklySchedule[`semana_${currentWeek}`];
    const orderedDays = getOrderedDays();
    
    // Inicializar estructura de horarios para la disciplina actual usando días ordenados
    orderedDays.forEach(dia => {
      horarios[dia] = {};
      horariosDisponibles.forEach(hora => {
        horarios[dia][hora] = null;
      });
      
      // Copiar SOLO partidos que están específicamente programados para esta semana
      if (semanaActual[dia] && 
          semanaActual[dia].partidos[discipline] && 
          semanaActual[dia].disciplinas.includes(discipline)) {
        Object.entries(semanaActual[dia].partidos[discipline]).forEach(([hora, partido]) => {
          if (partido && partido.semana === currentWeek) {
            horarios[dia][hora] = {
              ...partido,
              diaAsignado: dia,
              horaAsignada: hora
            };
          }
        });
      }
    });

    setHorariosPorDia(horarios);
    
    // Debug: Log para verificar los horarios de la semana actual
    const partidosEncontrados = Object.values(horarios).reduce((total, dia) => {
      return total + Object.values(dia).filter(p => p !== null).length;
    }, 0);
    
    console.log(`Horarios para semana ${currentWeek}:`, {
      disciplina: discipline,
      partidosEncontrados,
      diasDisponibles: orderedDays.filter(dia => {
        const semanaData = weeklySchedule[`semana_${currentWeek}`];
        return semanaData && semanaData[dia] && semanaData[dia].disciplinas.includes(discipline);
      })
    });
  }, [currentWeek, weeklySchedule, discipline, disciplineConfig, startDay]);

  // Funciones de navegación por semanas
  const navegarSemana = (direccion) => {
    if (direccion === 'anterior' && currentWeek > 1) {
      const nuevaSemana = currentWeek - 1;
      setCurrentWeek(nuevaSemana);
      console.log(`Navegando a semana anterior: ${nuevaSemana}`);
    } else if (direccion === 'siguiente' && currentWeek < totalWeeks) {
      const nuevaSemana = currentWeek + 1;
      setCurrentWeek(nuevaSemana);
      console.log(`Navegando a semana siguiente: ${nuevaSemana}`);
    }
  };

  // Función para obtener las disciplinas de un día específico
  const getDisciplinasDelDiaActual = (dia) => {
    const semanaData = weeklySchedule[`semana_${currentWeek}`];
    if (!semanaData || !semanaData[dia]) {
      return [];
    }
    return semanaData[dia].disciplinas || [];
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

  // Obtener fases únicas para filtros
  const fasesUnicas = [...new Set(matches.map(m => m.fase).filter(Boolean))];

  // Filtrar partidos por fase
  const partidosFiltrados = selectedPhase === "todos" 
    ? matches 
    : matches.filter(m => m.fase === selectedPhase);

  return (
    <div className="profesor-horarios-container">
      {/* Header con navegación */}
      <div className="profesor-header" style={{ position: 'relative' }}>
        {/* Botones de navegación en la esquina superior izquierda */}
        <div style={{
          position: 'absolute',
          top: '1rem',
          left: '1rem',
          display: 'flex',
          gap: '0.5rem',
          zIndex: 10
        }}>
          <button
            onClick={goToDisciplineSelector}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
            title="Volver a selección de disciplinas"
          >
            🏠 Disciplinas
          </button>
          
          <button
            onClick={goToLogin}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
            title="Salir al login"
          >
            🚪 Salir
          </button>
        </div>

        <div className="header-icon">📅</div>
        <h1 className="profesor-title">Horarios de Partidos</h1>
        <p className="profesor-subtitle">
          Programación semanal de{" "}
          {discipline === "futbol" ? "Fútbol" : discipline === "voley" ? "Vóley" : "Básquet"}
        </p>
      </div>

      {/* Navegación por semanas */}
      <div className="week-navigation" style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '1rem',
        margin: '1rem 0',
        padding: '1rem',
        backgroundColor: '#f8f9fa',
        borderRadius: '12px',
        border: '1px solid #dee2e6'
      }}>
        <button
          onClick={() => navegarSemana('anterior')}
          disabled={currentWeek === 1}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: currentWeek === 1 ? '#e9ecef' : '#007bff',
            color: currentWeek === 1 ? '#6c757d' : 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: currentWeek === 1 ? 'not-allowed' : 'pointer',
            fontSize: '0.9rem',
            fontWeight: '500'
          }}
        >
          ⬅️ Semana Anterior
        </button>
        
        <div style={{
          padding: '0.5rem 1.5rem',
          backgroundColor: 'white',
          borderRadius: '8px',
          border: '2px solid #007bff',
          fontWeight: 'bold',
          color: '#007bff',
          fontSize: '1.1rem'
        }}>
          📅 Semana {currentWeek} de {totalWeeks}
        </div>
        
        <button
          onClick={() => navegarSemana('siguiente')}
          disabled={currentWeek === totalWeeks}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: currentWeek === totalWeeks ? '#e9ecef' : '#007bff',
            color: currentWeek === totalWeeks ? '#6c757d' : 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: currentWeek === totalWeeks ? 'not-allowed' : 'pointer',
            fontSize: '0.9rem',
            fontWeight: '500'
          }}
        >
          Semana Siguiente ➡️
        </button>
      </div>

      {/* Vista previa de disciplinas por día */}
      <div className="weekly-preview" style={{
        margin: '1rem 0',
        padding: '1rem',
        backgroundColor: '#fff',
        borderRadius: '12px',
        border: '1px solid #dee2e6',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <h3 style={{
          textAlign: 'center',
          marginBottom: '1rem',
          color: '#495057',
          fontSize: '1.1rem'
        }}>
          📋 Vista previa de la programación semanal
        </h3>
        
        <div className="days-preview" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem'
        }}>
          {getOrderedDays().map(dia => {
            const disciplinasDelDia = getDisciplinasDelDiaActual(dia);
            return (
              <div key={dia} style={{
                padding: '1rem',
                backgroundColor: '#f8f9fa',
                borderRadius: '8px',
                border: '1px solid #e9ecef',
                textAlign: 'center'
              }}>
                <h4 style={{
                  margin: '0 0 0.5rem 0',
                  color: '#495057',
                  textTransform: 'capitalize',
                  fontSize: '1rem'
                }}>
                  {dia}
                </h4>
                <div style={{
                  display: 'flex',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  flexWrap: 'wrap'
                }}>
                  {disciplinasDelDia.map(disciplinaKey => {
                    const config = disciplinasConfig[disciplinaKey];
                    const esActual = disciplinaKey === discipline;
                    return (
                      <span
                        key={disciplinaKey}
                        style={{
                          padding: '0.25rem 0.5rem',
                          backgroundColor: esActual ? config.color : '#e9ecef',
                          color: esActual ? 'white' : '#6c757d',
                          borderRadius: '12px',
                          fontSize: '0.8rem',
                          fontWeight: esActual ? 'bold' : 'normal',
                          border: esActual ? '2px solid #fff' : '1px solid #dee2e6'
                        }}
                      >
                        {config.icon} {config.nombre}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        
        <div style={{
          marginTop: '1rem',
          padding: '0.75rem',
          backgroundColor: '#e3f2fd',
          borderRadius: '8px',
          border: '1px solid #2196f3',
          textAlign: 'center',
          fontSize: '0.9rem',
          color: '#1565c0'
        }}>
          ℹ️ <strong>Información:</strong> Solo se muestran los horarios de <strong>{disciplinasConfig[discipline].nombre}</strong> 
          {discipline !== 'futbol' && (
            <span>. {disciplinasConfig[discipline].nombre} y Fútbol pueden tener partidos simultáneos en canchas diferentes.</span>
          )}
          <br/>
          <small style={{ fontSize: '0.8rem', marginTop: '0.5rem', display: 'block' }}>
            📋 <strong>Configuración actual:</strong> 
            {disciplineConfig.futbol === 'todos' && ' Fútbol: Todos los días'} 
            {disciplineConfig.voley !== 'ninguno' && ` | Vóley: ${disciplineConfig.voley}`}
            {disciplineConfig.basquet !== 'ninguno' && ` | Básquet: ${disciplineConfig.basquet}`}
            {` | Inicio: ${startDay}`}
          </small>
        </div>
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
        
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '1rem',
          margin: '0.5rem 0',
          padding: '0.5rem',
          backgroundColor: '#e8f4f8',
          borderRadius: '8px',
          fontSize: '0.9rem',
          color: '#2c5aa0'
        }}>
          📊 <strong>Debug:</strong> Mostrando semana {currentWeek} de {totalWeeks} | 
          Partidos en esta semana: {Object.values(horariosPorDia).reduce((total, dia) => {
            return total + Object.values(dia).filter(p => p !== null).length;
          }, 0)} |
          Disciplina: {disciplinasConfig[discipline].nombre}
        </div>

        <div className="selection-controls">
          <span className="selected-count">
            Semana {currentWeek} - Solo {disciplinasConfig[discipline].nombre}
          </span>
        </div>
      </div>

      {loading ? (
        <div className="loading-section">
          <div className="loading-spinner"></div>
          <p className="loading-text">Cargando horarios...</p>
        </div>
      ) : Object.keys(horariosPorDia).length === 0 || Object.values(horariosPorDia).every(dia => Object.values(dia).every(partido => partido === null)) ? (
        <div className="empty-state">
          <div className="empty-icon">📅</div>
          <h3>No hay partidos en la semana {currentWeek}</h3>
          <p>Los partidos pueden estar programados en otras semanas o aún no han sido asignados</p>
          <small style={{ marginTop: '1rem', display: 'block', color: '#666' }}>
            Usa la navegación de semanas para ver otros períodos del torneo
          </small>
        </div>
      ) : (
        <div className="horarios-grid">
          {getOrderedDays().map(dia => {
            const disciplinasDelDia = getDisciplinasDelDiaActual(dia);
            const disciplinaDisponible = disciplinasDelDia.includes(discipline);
            
            return (
              <div key={dia} className="dia-column">
                <div className="dia-header">
                  <h3 className="dia-title">
                    <span className="dia-icon">📅</span>
                    {dia.charAt(0).toUpperCase() + dia.slice(1)}
                  </h3>
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.25rem',
                    alignItems: 'center'
                  }}>
                    <button 
                      className="confirm-day-btn"
                      disabled={true}
                      style={{
                        backgroundColor: disciplinaDisponible ? '#28a745' : '#dc3545',
                        cursor: 'default'
                      }}
                    >
                      <span className="btn-icon">
                        {disciplinaDisponible ? '✅' : '❌'}
                      </span>
                      {disciplinaDisponible ? `${disciplinasConfig[discipline].nombre} Disponible` : `Sin ${disciplinasConfig[discipline].nombre}`}
                    </button>
                    
                    {/* Mostrar disciplinas del día */}
                    <div style={{
                      display: 'flex',
                      gap: '0.25rem',
                      flexWrap: 'wrap',
                      justifyContent: 'center'
                    }}>
                      {disciplinasDelDia.map(disc => (
                        <span
                          key={disc}
                          style={{
                            fontSize: '0.7rem',
                            padding: '0.1rem 0.3rem',
                            backgroundColor: disc === discipline ? disciplinasConfig[disc].color : '#e9ecef',
                            color: disc === discipline ? 'white' : '#6c757d',
                            borderRadius: '8px',
                            fontWeight: disc === discipline ? 'bold' : 'normal'
                          }}
                        >
                          {disciplinasConfig[disc].icon}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="horarios-lista">
                  {horariosDisponibles.map(hora => {
                    const partido = horariosPorDia[dia]?.[hora];
                    
                    return (
                      <div key={hora} className="horario-slot">
                        <div className="hora-label">{hora}</div>
                        {!disciplinaDisponible ? (
                          <div className="no-disponible-slot" style={{
                            padding: '1rem',
                            backgroundColor: '#f8f9fa',
                            border: '2px dashed #dee2e6',
                            borderRadius: '8px',
                            textAlign: 'center',
                            color: '#6c757d',
                            fontSize: '0.9rem'
                          }}>
                            <div>🚫 {disciplinasConfig[discipline].nombre}</div>
                            <div style={{ fontSize: '0.7rem', marginTop: '0.25rem' }}>
                              No programado para este día
                            </div>
                          </div>
                        ) : partido ? (
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
            );
          })}
        </div>
      )}
    </div>
  );
}
