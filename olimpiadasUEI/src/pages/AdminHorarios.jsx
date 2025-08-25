import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase/config";
import "../styles/AdminHorarios.css";

export default function AdminHorarios() {
  const { discipline } = useParams();
  const navigate = useNavigate();
  
  const [matches, setMatches] = useState([]);
  const [horariosPorDia, setHorariosPorDia] = useState({});
  const [loading, setLoading] = useState(true);
  const [currentWeek, setCurrentWeek] = useState(1);
  const [totalWeeks, setTotalWeeks] = useState(1);

  const diasLaborables = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes'];
  
  const horariosDisponibles = (() => {
    const saved = localStorage.getItem('olimpiadas_custom_times');
    return saved ? JSON.parse(saved) : [
      '07:05', '07:50', '08:35', '09:20', '10:05', '10:50',
      '11:35', '12:20', '13:00'
    ];
  })();

  // Configuración de disciplinas con colores
  const disciplinasConfig = {
    futbol: { nombre: 'Fútbol', color: '#4CAF50', icon: '⚽' },
    voley: { nombre: 'Vóley', color: '#2196F3', icon: '🏐' },
    basquet: { nombre: 'Básquet', color: '#FF9800', icon: '🏀' }
  };

  // Función para convertir fecha (YYYY-MM-DD) a día de la semana
  const getFechaToDia = (fechaString) => {
    if (!fechaString) return null;
    
    // Si ya es un día de la semana, devolverlo directamente
    const diasValidos = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    if (diasValidos.includes(fechaString.toLowerCase())) {
      return fechaString.toLowerCase();
    }
    
    // Si es una fecha ISO, convertirla a día de la semana
    if (fechaString.includes('-')) {
      const fecha = new Date(fechaString + 'T00:00:00');
      const dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
      return dias[fecha.getDay()];
    }
    
    return fechaString.toLowerCase();
  };

  // Función para convertir días de la semana a fechas específicas
  const convertirDiaAFecha = (diaSemana) => {
    // Mapeo de días a fechas específicas según tu calendario
    const mapaDias = {
      'lunes': '2025-09-01',      // 1 de septiembre
      'martes': '2025-08-26',     // 26 de agosto (primera semana) o 2025-09-02 (segunda semana)
      'miércoles': '2025-08-27',  // 27 de agosto (primera semana) o 2025-09-03 (segunda semana)
      'jueves': '2025-08-28',     // 28 de agosto (primera semana) o 2025-09-04 (segunda semana)
      'viernes': '2025-09-05',    // 5 de septiembre
      'sábado': '2025-08-30'      // Asumiendo sábado como parte de la primera semana
    };
    
    return mapaDias[diaSemana.toLowerCase()] || diaSemana;
  };

  // Función para obtener la semana basada en fecha - Agrupación inteligente
  const getSemanaFromFecha = (fechaString) => {
    if (!fechaString) return null;
    
    // Convertir día de semana a fecha específica si es necesario
    const fechaEspecifica = convertirDiaAFecha(fechaString);
    
    // Si sigue siendo un día de la semana (no se pudo convertir), usar lógica alternativa
    if (fechaEspecifica === fechaString && !fechaString.includes('-')) {
      // Mapeo simple para agrupar días en semanas
      const semanasPorDia = {
        'martes': 1,     // 26 agosto - semana 1
        'miércoles': 1,  // 27 agosto - semana 1  
        'jueves': 1,     // 28 agosto - semana 1
        'sábado': 1,     // fin semana 1
        'lunes': 2,      // 1 septiembre - semana 2
        'viernes': 2     // 5 septiembre - semana 2
      };
      
      return semanasPorDia[fechaString.toLowerCase()] || 1;
    }
    
    // Lógica original para fechas ISO
    const fechasUnicas = [...new Set(matches
      .filter(m => m.fecha && m.estado === "programado")
      .map(m => convertirDiaAFecha(m.fecha))
      .filter(f => f.includes('-'))  // Solo fechas ISO
    )].sort();
    
    if (fechasUnicas.length === 0) {
      // Si no hay fechas ISO, usar el mapeo de días
      return fechaEspecifica.includes('-') ? 1 : 1;
    }
    
    // Agrupar fechas por semanas (cada 7 días)
    const primerFecha = new Date(fechasUnicas[0] + 'T00:00:00');
    const fechaPartido = new Date(fechaEspecifica + 'T00:00:00');
    
    // Calcular diferencia en días
    const diffTime = fechaPartido.getTime() - primerFecha.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    // Determinar semana (cada 7 días = nueva semana)
    return Math.floor(diffDays / 7) + 1;
  };

  // Función para obtener días ordenados comenzando por el primer día con partidos
  const getOrderedDays = () => {
    const hasPartidos = (dia) => {
      const diaData = horariosPorDia[dia] || {};
      return Object.values(diaData).some(p => !!p);
    };
    
    let startIndex = diasLaborables.findIndex(d => hasPartidos(d));
    if (startIndex === -1) startIndex = 0;
    
    return [
      ...diasLaborables.slice(startIndex),
      ...diasLaborables.slice(0, startIndex)
    ];
  };

  // Cargar partidos programados de la disciplina
  useEffect(() => {
    if (!discipline) return;

    setLoading(true);
    
    const matchesQuery = query(
      collection(db, "matches"),
      where("disciplina", "==", discipline),
      where("estado", "==", "programado")
    );

    const unsubscribe = onSnapshot(matchesQuery, (snapshot) => {
      try {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        // Deduplicar por id
        const uniqueById = Object.values(
          data.reduce((acc, m) => {
            acc[m.id] = m;
            return acc;
          }, {})
        );

        setMatches(uniqueById);
        
        // Calcular semanas automáticamente basándose en fechas reales
        const partidosConFecha = uniqueById.filter(m => m.fecha && m.estado === "programado");
        
        if (partidosConFecha.length > 0) {
          // Verificar si las fechas son días de semana o fechas ISO
          const tienenFechasISO = partidosConFecha.some(m => m.fecha && m.fecha.includes('-'));
          
          if (tienenFechasISO) {
            // Lógica original para fechas ISO
            const fechasUnicas = [...new Set(partidosConFecha
              .map(m => convertirDiaAFecha(m.fecha))
              .filter(f => f.includes('-'))
            )].sort();
            
            const primerFecha = new Date(fechasUnicas[0] + 'T00:00:00');
            const ultimaFecha = new Date(fechasUnicas[fechasUnicas.length - 1] + 'T00:00:00');
            
            const diffTime = ultimaFecha.getTime() - primerFecha.getTime();
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            const semanasCalculadas = Math.floor(diffDays / 7) + 1;
            
            setTotalWeeks(Math.max(1, semanasCalculadas));
          } else {
            // Para días de semana, usar 2 semanas por defecto basado en tu calendario
            setTotalWeeks(2);
          }
        } else {
          setTotalWeeks(1);
        }
        
      } catch (error) {
        console.error("Error cargando partidos:", error);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [discipline]);

  // Organizar partidos por horarios para la semana actual
  useEffect(() => {
    const horarios = {};
    
    // Inicializar estructura
    diasLaborables.forEach(dia => {
      horarios[dia] = {};
      horariosDisponibles.forEach(hora => {
        horarios[dia][hora] = null;
      });
    });

    // Llenar con partidos de la semana actual calculada dinámicamente
    const partidosSemana = matches.filter(m => {
      if (!m.fecha || !m.hora) return false;
      const semanaCalculada = getSemanaFromFecha(m.fecha);
      return semanaCalculada === currentWeek;
    });

    partidosSemana.forEach(partido => {
      const diaSemana = getFechaToDia(partido.fecha);
      if (diaSemana && horarios[diaSemana] && horarios[diaSemana][partido.hora] !== undefined) {
        horarios[diaSemana][partido.hora] = partido;
      }
    });

    setHorariosPorDia(horarios);
  }, [matches, currentWeek]);

  // Función para obtener el tipo de fase de un partido
  const getTipoFase = (partido) => {
    if (!partido.fase || partido.fase === 'grupos1') {
      return { tipo: 'Fase de Grupos 1', color: '#4CAF50', icon: '🏃‍♂️' };
    } else if (partido.fase === 'grupos3') {
      return { tipo: 'Posicionamiento', color: '#FF9800', icon: '🎯' };
    } else if (partido.fase === 'semifinal') {
      return { tipo: 'Semifinales', color: '#2196F3', icon: '🥈' };
    } else if (partido.fase === 'final') {
      return { tipo: 'Finales', color: '#9C27B0', icon: '🏆' };
    }
    return { tipo: partido.fase, color: '#666', icon: '🏅' };
  };

  // Navegación entre semanas
  const navegarSemana = (direccion) => {
    if (direccion === 'anterior' && currentWeek > 1) {
      setCurrentWeek(currentWeek - 1);
    } else if (direccion === 'siguiente' && currentWeek < totalWeeks) {
      setCurrentWeek(currentWeek + 1);
    }
  };

  // Funciones de navegación
  const goToDisciplineSelector = () => {
    navigate('/admin');
  };

  const goToMatches = () => {
    navigate(`/admin/${discipline}/partidos`);
  };

  const goToTeams = () => {
    navigate(`/admin/${discipline}/equipos`);
  };

  const goToStandings = () => {
    navigate(`/admin/${discipline}/tabla`);
  };

  const verDetallesPartido = (partido) => {
    const detailPages = {
      'futbol': `/admin/partido/${partido.id}`,
      'voley': `/admin-voley-match-detail/${partido.id}`,
      'basquet': `/admin-basquet-match-detail/${partido.id}`
    };
    navigate(detailPages[partido.disciplina] || `/admin/partido/${partido.id}`);
  };

  if (loading) {
    return (
      <div className="admin-horarios-container">
        <div className="loading-section">
          <div className="loading-spinner"></div>
          <p className="loading-text">Cargando horarios...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-horarios-container">
      {/* Header */}
      <div className="admin-header">
        <div className="admin-header-content">
          <div className="admin-title-section">
            <h1 className="admin-title">
              <span className="admin-icon">{disciplinasConfig[discipline]?.icon || '🏅'}</span>
              Horarios de {disciplinasConfig[discipline]?.nombre || discipline}
            </h1>
            <p className="admin-subtitle">Vista de horarios programados</p>
          </div>
          <div className="admin-nav-buttons">
            <button className="admin-nav-btn" onClick={goToDisciplineSelector}>
              🏠 Inicio
            </button>
            <button className="admin-nav-btn" onClick={goToMatches}>
              📋 Partidos
            </button>
            <button className="admin-nav-btn" onClick={goToTeams}>
              👥 Equipos
            </button>
            <button className="admin-nav-btn" onClick={goToStandings}>
              🏆 Posiciones
            </button>
          </div>
        </div>
      </div>

      {/* Controles de semana */}
      <div className="horarios-controls">
        <div className="week-navigation">
          <button
            className="week-nav-btn"
            onClick={() => navegarSemana('anterior')}
            disabled={currentWeek === 1}
          >
            ← Semana Anterior
          </button>
          
          <div className="current-week-info">
            <span className="week-label">Semana</span>
            <span className="week-number">{currentWeek}</span>
            <span className="week-total">de {totalWeeks}</span>
          </div>
          
          <button
            className="week-nav-btn"
            onClick={() => navegarSemana('siguiente')}
            disabled={currentWeek === totalWeeks}
          >
            Semana Siguiente →
          </button>
        </div>

        <div className="selection-controls">
          <span className="selected-count">
            {Object.values(horariosPorDia).reduce((total, dia) => 
              total + Object.values(dia).filter(p => p !== null).length, 0
            )} partidos programados esta semana
          </span>
        </div>
      </div>

      {/* Tabla de horarios */}
      {Object.keys(horariosPorDia).length === 0 || Object.values(horariosPorDia).every(dia => Object.values(dia).every(partido => partido === null)) ? (
        <div className="empty-state">
          <div className="empty-icon">📅</div>
          <h3>No hay partidos programados en la semana {currentWeek}</h3>
          <p>Los partidos se programan desde los detalles de cada partido individual</p>
        </div>
      ) : (
        <div className="horarios-grid">
          {getOrderedDays().map(dia => (
            <div key={dia} className="dia-column">
              <div className="dia-header">
                <h3 className="dia-title">
                  <span className="dia-icon">📅</span>
                  {dia.charAt(0).toUpperCase() + dia.slice(1)}
                </h3>
              </div>

              <div className="horarios-lista">
                {horariosDisponibles.map(hora => {
                  const partido = horariosPorDia[dia]?.[hora];
                  
                  return (
                    <div key={hora} className="horario-slot">
                      <div className="hora-label">{hora}</div>
                      {partido ? (
                        <div 
                          className="partido-card view-only"
                          onClick={() => verDetallesPartido(partido)}
                          style={{ cursor: 'pointer' }}
                        >
                          <div className="partido-header">
                            <div 
                              className="fase-badge"
                              style={{ backgroundColor: getTipoFase(partido).color }}
                            >
                              <span className="fase-icon">{getTipoFase(partido).icon}</span>
                              <span className="fase-text">{getTipoFase(partido).tipo}</span>
                            </div>
                          </div>
                          
                          <div className="partido-equipos">
                            <div className="equipo">
                              <div className="equipo-header">
                                <span className="equipo-icon">🏫</span>
                                <span className="equipo-genero">{partido.equipoA.genero === 'masculino' ? '♂️' : '♀️'}</span>
                              </div>
                              <div className="equipo-nombre">
                                <strong>{partido.equipoA.curso}{partido.equipoA.paralelo}</strong>
                              </div>
                              <div className="equipo-detalles">
                                <span className="equipo-categoria">{partido.equipoA.categoria}</span>
                                <span className="equipo-genero-texto">{partido.equipoA.genero}</span>
                              </div>
                            </div>
                            
                            <div className="vs-divider">
                              <span className="vs-text">VS</span>
                              <div className="vs-line"></div>
                            </div>
                            
                            <div className="equipo">
                              <div className="equipo-header">
                                <span className="equipo-icon">🏫</span>
                                <span className="equipo-genero">{partido.equipoB.genero === 'masculino' ? '♂️' : '♀️'}</span>
                              </div>
                              <div className="equipo-nombre">
                                <strong>{partido.equipoB.curso}{partido.equipoB.paralelo}</strong>
                              </div>
                              <div className="equipo-detalles">
                                <span className="equipo-categoria">{partido.equipoB.categoria}</span>
                                <span className="equipo-genero-texto">{partido.equipoB.genero}</span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="partido-info">
                            <div className="info-item">
                              <span className="info-icon">👥</span>
                              <span>{partido.grupo}</span>
                            </div>
                            {partido.marcadorA !== null && partido.marcadorB !== null && (
                              <div className="info-item">
                                <span className="info-icon">⚽</span>
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
