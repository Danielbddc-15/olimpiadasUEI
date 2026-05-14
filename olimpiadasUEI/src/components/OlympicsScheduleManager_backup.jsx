import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, setDoc, getDoc } from "../api/firestoreCompat";
import { db } from '../firebase/config';
import '../styles/OlympicsScheduleManager.css';

const OlympicsScheduleManager = () => {
  // Función para ordenar horarios correctamente
  const sortTimeSlots = (timeSlots) => {
    return [...timeSlots].sort((a, b) => {
      const [hoursA, minutesA] = a.split(':').map(Number);
      const [hoursB, minutesB] = b.split(':').map(Number);
      
      const totalMinutesA = hoursA * 60 + minutesA;
      const totalMinutesB = hoursB * 60 + minutesB;
      
      return totalMinutesA - totalMinutesB;
    });
  };

  // Estados principales
  const [olympicsConfig, setOlympicsConfig] = useState({
    startDate: '',
    timeSlots: [
      '7:05', '7:50', '8:35', '9:20', '10:05', 
      '10:50', '11:35', '12:20', '13:00'
    ],
    weeksCount: 4,
    disciplineDays: {
      futbol: [], // Se calculará automáticamente (todos los días)
      basquet: [], // Configurable
      voley: [] // Configurable
    },
    customDisciplineDays: {
      basquet: [],
      voley: []
    }
  });

  const [allMatches, setAllMatches] = useState({
    futbol: [],
    basquet: [],
    voley: []
  });

  const [weeklySchedule, setWeeklySchedule] = useState({});
  const [currentWeek, setCurrentWeek] = useState(1);
  const [loading, setLoading] = useState(true);

  // Estados para el modal de asignación
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [availableMatches, setAvailableMatches] = useState([]);
  const [filteredMatches, setFilteredMatches] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [disciplineFilter, setDisciplineFilter] = useState('todos');
  const [categoryFilter, setCategoryFilter] = useState('todos');

  // Días de la semana
  const diasSemana = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];

  // Función para calcular días de disciplinas según día de inicio
  const calculateDisciplineDays = (startDate, useCustom = false) => {
    if (!startDate) return { futbol: [], basquet: [], voley: [] };

    // Fútbol: siempre todos los días de lunes a viernes
    const futbolDays = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
    
    // Si se usan configuraciones personalizadas
    if (useCustom && olympicsConfig.customDisciplineDays) {
      return {
        futbol: futbolDays,
        basquet: olympicsConfig.customDisciplineDays.basquet,
        voley: olympicsConfig.customDisciplineDays.voley
      };
    }

    // Configuración automática basada en día de inicio
    const startDay = new Date(startDate).getDay(); // 0=Domingo, 1=Lunes, ..., 5=Viernes
    const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const startDayName = dayNames[startDay];
    
    // Básquet: día de inicio y día siguiente (si es posible)
    let basquetDays = [];
    const workDays = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
    const startIndex = workDays.indexOf(startDayName);
    
    if (startIndex !== -1) {
      basquetDays.push(startDayName);
      // Agregar día siguiente si no es fin de semana
      const nextIndex = (startIndex + 1) % 5;
      if (nextIndex !== 0 || startIndex !== 4) { // Evitar sábado
        basquetDays.push(workDays[nextIndex]);
      }
      // Si solo hay un día, agregar otro día disponible
      if (basquetDays.length === 1) {
        const thirdIndex = (startIndex + 2) % 5;
        basquetDays.push(workDays[thirdIndex]);
      }
    }
    
    // Vóley: días restantes
    const voleyDays = workDays.filter(day => !basquetDays.includes(day));
    
    return { futbol: futbolDays, basquet: basquetDays, voley: voleyDays };
  };

  // Cargar configuración desde Firebase
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const configDoc = await getDoc(doc(db, 'olympicsConfig', 'general'));
        if (configDoc.exists()) {
          const data = configDoc.data();
          setOlympicsConfig(prev => ({ 
            ...prev, 
            ...data,
            // Asegurar que los timeSlots estén ordenados
            timeSlots: data.timeSlots ? sortTimeSlots(data.timeSlots) : prev.timeSlots
          }));
        }
      } catch (error) {
        console.error('Error loading config:', error);
      }
    };
    loadConfig();
  }, []);

  // Recalcular días de disciplinas cuando cambie la fecha de inicio
  useEffect(() => {
    if (olympicsConfig.startDate) {
      const disciplineDays = calculateDisciplineDays(olympicsConfig.startDate);
      setOlympicsConfig(prev => ({
        ...prev,
        disciplineDays
      }));
    }
  }, [olympicsConfig.startDate]);

  // Cargar partidos de todas las disciplinas
  useEffect(() => {
    const unsubscribes = [];

    ['futbol', 'basquet', 'voley'].forEach(discipline => {
      const q = query(collection(db, 'matches'), where('disciplina', '==', discipline));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const matches = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setAllMatches(prev => ({ ...prev, [discipline]: matches }));
      });
      unsubscribes.push(unsubscribe);
    });

    return () => unsubscribes.forEach(unsub => unsub());
  }, []);

  // Actualizar partidos disponibles cuando cambian los datos
  useEffect(() => {
    updateAvailableMatches();
  }, [allMatches, weeklySchedule]);

  // Filtrar partidos según criterios de búsqueda
  useEffect(() => {
    let filtered = availableMatches;

    // Filtro por disciplina
    if (disciplineFilter !== 'todos') {
      filtered = filtered.filter(match => match.disciplina === disciplineFilter);
    }

    // Filtro por categoría
    if (categoryFilter !== 'todos') {
      filtered = filtered.filter(match => match.categoria === categoryFilter);
    }

    // Filtro por término de búsqueda
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(match => 
        match.equipoA?.curso?.toLowerCase().includes(term) ||
        match.equipoB?.curso?.toLowerCase().includes(term) ||
        match.categoria?.toLowerCase().includes(term) ||
        match.nivel?.toLowerCase().includes(term) ||
        match.genero?.toLowerCase().includes(term)
      );
    }

    setFilteredMatches(filtered);
  }, [availableMatches, disciplineFilter, categoryFilter, searchTerm]);

  // Cargar horario existente desde Firebase cuando se cargan los partidos
  useEffect(() => {
    if (Object.values(allMatches).some(arr => arr.length > 0)) {
      loadExistingSchedule();
      setLoading(false);
    }
  }, [allMatches]);

  // Cargar horario existente
  const loadExistingSchedule = () => {
    const schedule = {};

    // Inicializar estructura de semanas
    for (let week = 1; week <= olympicsConfig.weeksCount; week++) {
      schedule[week] = {};
      
      diasSemana.forEach(day => {
        schedule[week][day] = {};
        olympicsConfig.timeSlots.forEach(time => {
          schedule[week][day][time] = null;
        });
      });
    }

    // Cargar partidos existentes con horarios
    Object.keys(allMatches).forEach(discipline => {
      allMatches[discipline].forEach(match => {
        if (match.fecha && match.hora && match.semana && match.dia) {
          const week = match.semana;
          const day = match.dia;
          const time = match.hora;
          
          if (schedule[week] && schedule[week][day] && schedule[week][day].hasOwnProperty(time)) {
            schedule[week][day][time] = { ...match, disciplina: discipline };
          }
        }
      });
    });

    setWeeklySchedule(schedule);
  };

  // Generar horario automático basado en reglas
  const generateAutomaticSchedule = () => {
    if (!olympicsConfig.startDate) {
      alert('Por favor, selecciona una fecha de inicio primero');
      return;
    }

    const startDate = new Date(olympicsConfig.startDate);
    const schedule = {};

    // Inicializar estructura de semanas
    for (let week = 1; week <= olympicsConfig.weeksCount; week++) {
      schedule[week] = {};
      
      diasSemana.forEach(day => {
        schedule[week][day] = {};
        olympicsConfig.timeSlots.forEach(time => {
          schedule[week][day][time] = null;
        });
      });
    }

    // Obtener todos los partidos sin horario asignado
    const partidosSinHorario = [];
    Object.keys(allMatches).forEach(discipline => {
      allMatches[discipline].forEach(match => {
        if (!match.fecha || !match.hora) {
          partidosSinHorario.push({ ...match, disciplina: discipline });
        }
      });
    });

    // Distribuir partidos según las reglas
    let currentWeekIndex = 1;
    let partidosAsignados = 0;

    partidosSinHorario.forEach(partido => {
      const { disciplina } = partido;
      let asignado = false;

      // Intentar asignar en la semana actual
      for (let week = currentWeekIndex; week <= olympicsConfig.weeksCount && !asignado; week++) {
        const dayOrder = getDayOrderForDiscipline(disciplina, week);
        
        dayOrder.forEach(day => {
          if (asignado) return;
          
          olympicsConfig.timeSlots.forEach(time => {
            if (asignado) return;
            
            if (!schedule[week][day][time]) {
              schedule[week][day][time] = partido;
              asignado = true;
              partidosAsignados++;
            }
          });
        });
      }
    });

    setWeeklySchedule(schedule);
    console.log(`Partidos asignados automáticamente: ${partidosAsignados}`);
  };

  // Obtener orden de días según la disciplina y semana
  const getDayOrderForDiscipline = (disciplina, week) => {
    // Usar la configuración calculada de días por disciplina
    if (olympicsConfig.disciplineDays && olympicsConfig.disciplineDays[disciplina]) {
      return olympicsConfig.disciplineDays[disciplina];
    }
    
    // Fallback a la lógica anterior si no hay configuración
    if (disciplina === 'futbol') {
      return diasSemana; // Todos los días
    }
    
    if (disciplina === 'basquet') {
      // Semanas impares: Martes-Jueves, Semanas pares: Lunes-Miércoles-Viernes
      return week % 2 === 1 ? ['Martes', 'Jueves'] : ['Lunes', 'Miércoles', 'Viernes'];
    }
    
    if (disciplina === 'voley') {
      // Semanas impares: Lunes-Miércoles-Viernes, Semanas pares: Martes-Jueves
      return week % 2 === 1 ? ['Lunes', 'Miércoles', 'Viernes'] : ['Martes', 'Jueves'];
    }
    
    return [];
  };

  // Guardar configuración
  const saveConfig = async () => {
    try {
      await setDoc(doc(db, 'olympicsConfig', 'general'), olympicsConfig);
      alert('Configuración guardada exitosamente');
    } catch (error) {
      console.error('Error saving config:', error);
      alert('Error al guardar la configuración');
    }
  };

  // Limpiar todos los horarios
  const clearAllSchedules = async () => {
    const confirmed = window.confirm(
      '¿Estás seguro de que quieres limpiar TODOS los horarios existentes? Esta acción no se puede deshacer.'
    );
    
    if (!confirmed) return;

    const updates = [];
    
    Object.keys(allMatches).forEach(discipline => {
      allMatches[discipline].forEach(match => {
        if (match.fecha || match.hora || match.semana || match.dia) {
          updates.push(updateDoc(doc(db, 'matches', match.id), {
            fecha: null,
            hora: null,
            semana: null,
            dia: null
          }));
        }
      });
    });

    try {
      await Promise.all(updates);
      alert(`Horarios eliminados de ${updates.length} partidos`);
      loadExistingSchedule(); // Recargar vista
    } catch (error) {
      console.error('Error clearing schedules:', error);
      alert('Error al limpiar los horarios');
    }
  };

  // Aplicar horarios a los partidos en Firebase
  const applyScheduleToFirebase = async () => {
    const updates = [];
    
    Object.keys(weeklySchedule).forEach(week => {
      Object.keys(weeklySchedule[week]).forEach(day => {
        Object.keys(weeklySchedule[week][day]).forEach(time => {
          const match = weeklySchedule[week][day][time];
          if (match) {
            const fecha = calculateDateForWeekAndDay(week, day);
            updates.push(updateDoc(doc(db, 'matches', match.id), {
              fecha: fecha,
              hora: time,
              semana: parseInt(week),
              dia: day
            }));
          }
        });
      });
    });

    try {
      await Promise.all(updates);
      alert(`Horarios aplicados a ${updates.length} partidos`);
    } catch (error) {
      console.error('Error applying schedule:', error);
      alert('Error al aplicar los horarios');
    }
  };

  // Remover partido específico del horario
  const removeMatchFromSchedule = async (week, day, time) => {
    const match = weeklySchedule[week][day][time];
    if (!match) return;

    const confirmed = window.confirm(
      `¿Remover el partido ${match.equipoA?.curso} vs ${match.equipoB?.curso} del horario?`
    );
    
    if (!confirmed) return;

    try {
      await updateDoc(doc(db, 'matches', match.id), {
        fecha: null,
        hora: null,
        semana: null,
        dia: null
      });
      
      // Actualizar estado local
      setWeeklySchedule(prev => {
        const newSchedule = { ...prev };
        newSchedule[week][day][time] = null;
        return newSchedule;
      });
      
      alert('Partido removido del horario');
    } catch (error) {
      console.error('Error removing match:', error);
      alert('Error al remover el partido');
    }
  };

  // Calcular fecha específica para semana y día
  const calculateDateForWeekAndDay = (week, day) => {
    const startDate = new Date(olympicsConfig.startDate);
    const dayIndex = diasSemana.indexOf(day);
    const weekOffset = (parseInt(week) - 1) * 7;
    const dayOffset = dayIndex;
    
    const targetDate = new Date(startDate);
    targetDate.setDate(startDate.getDate() + weekOffset + dayOffset);
    
    return targetDate.toISOString().split('T')[0];
  };

  // Actualizar lista de partidos disponibles (sin horario asignado)
  const updateAvailableMatches = () => {
    const available = [];
    Object.keys(allMatches).forEach(discipline => {
      allMatches[discipline].forEach(match => {
        if (!match.fecha || !match.hora) {
          available.push({ ...match, disciplina: discipline });
        }
      });
    });
    setAvailableMatches(available);
  };

  // Abrir modal de asignación
  const openAssignModal = (week, day, time) => {
    setSelectedSlot({ week, day, time });
    setShowAssignModal(true);
    setSearchTerm('');
    
    // Determinar qué disciplinas están permitidas en este día
    const allowedDisciplines = [];
    if (olympicsConfig.disciplineDays) {
      Object.keys(olympicsConfig.disciplineDays).forEach(discipline => {
        if (olympicsConfig.disciplineDays[discipline].includes(day)) {
          allowedDisciplines.push(discipline);
        }
      });
    }
    
    // Si solo hay una disciplina permitida, pre-seleccionarla
    if (allowedDisciplines.length === 1) {
      setDisciplineFilter(allowedDisciplines[0]);
    } else {
      setDisciplineFilter('todos');
    }
    
    setCategoryFilter('todos');
  };

  // Cerrar modal de asignación
  const closeAssignModal = () => {
    setShowAssignModal(false);
    setSelectedSlot(null);
    setSearchTerm('');
    setDisciplineFilter('todos');
    setCategoryFilter('todos');
  };

  // Asignar partido al slot seleccionado
  const assignMatchToSlot = async (match) => {
    if (!selectedSlot) return;

    const { week, day, time } = selectedSlot;
    const fecha = calculateDateForWeekAndDay(week, day);

    try {
      await updateDoc(doc(db, 'matches', match.id), {
        fecha: fecha,
        hora: time,
        semana: parseInt(week),
        dia: day
      });

      // Actualizar estado local
      setWeeklySchedule(prev => {
        const newSchedule = { ...prev };
        if (!newSchedule[week]) newSchedule[week] = {};
        if (!newSchedule[week][day]) newSchedule[week][day] = {};
        newSchedule[week][day][time] = { ...match, fecha, hora: time, semana: parseInt(week), dia: day };
        return newSchedule;
      });

      closeAssignModal();
      alert('Partido asignado exitosamente');
    } catch (error) {
      console.error('Error assigning match:', error);
      alert('Error al asignar el partido');
    }
  };

  // Obtener categorías únicas para el filtro
  const getUniqueCategories = () => {
    const categories = new Set();
    availableMatches.forEach(match => {
      if (match.categoria) categories.add(match.categoria);
    });
    return Array.from(categories).sort();
  };

  // Agregar nuevo horario
  const addTimeSlot = () => {
    const newTime = prompt('Ingresa el nuevo horario (formato HH:MM):');
    if (newTime && /^\d{1,2}:\d{2}$/.test(newTime)) {
      // Validar que el horario no exista ya
      if (olympicsConfig.timeSlots.includes(newTime)) {
        alert('Este horario ya existe');
        return;
      }
      
      setOlympicsConfig(prev => ({
        ...prev,
        timeSlots: sortTimeSlots([...prev.timeSlots, newTime])
      }));
    } else if (newTime) {
      alert('Formato inválido. Use HH:MM (ejemplo: 14:30)');
    }
  };

  // Eliminar horario
  const removeTimeSlot = (timeToRemove) => {
    setOlympicsConfig(prev => ({
      ...prev,
      timeSlots: prev.timeSlots.filter(time => time !== timeToRemove)
    }));
  };

  if (loading) {
    return <div className="loading">Cargando configuración...</div>;
  }

  return (
    <div className="olympics-schedule-manager">
      <div className="config-header">
        <h2>🏆 Gestión de Horarios Olímpicos</h2>
        <p>Configure los horarios automáticos para todas las disciplinas</p>
      </div>

      {/* Configuración General */}
      <div className="config-section">
        <h3>⚙️ Configuración General</h3>
        <div className="config-grid">
          <div className="config-item">
            <label>📅 Fecha de Inicio de Olimpiadas:</label>
            <input
              type="date"
              value={olympicsConfig.startDate}
              onChange={(e) => setOlympicsConfig(prev => ({
                ...prev,
                startDate: e.target.value
              }))}
            />
          </div>
          
          <div className="config-item">
            <label>📊 Número de Semanas:</label>
            <input
              type="number"
              min="1"
              max="10"
              value={olympicsConfig.weeksCount}
              onChange={(e) => setOlympicsConfig(prev => ({
                ...prev,
                weeksCount: parseInt(e.target.value)
              }))}
            />
          </div>
        </div>
      </div>

      {/* Configuración de Horarios */}
      <div className="config-section">
        <h3>🕐 Horarios Disponibles</h3>
        <div className="time-slots-container">
          {olympicsConfig.timeSlots.map((time, index) => (
            <div key={index} className="time-slot-item">
              <span>{time}</span>
              <button
                className="remove-time-btn"
                onClick={() => removeTimeSlot(time)}
                title="Eliminar horario"
              >
                ×
              </button>
            </div>
          ))}
          <button className="add-time-btn" onClick={addTimeSlot}>
            + Agregar Horario
          </button>
        </div>
      </div>

      {/* Configuración de Días por Disciplina */}
      <div className="config-section">
        <h3>� Distribución de Días por Disciplina</h3>
        {olympicsConfig.startDate ? (
          <div className="discipline-days-grid">
            <div className="discipline-day-item futbol">
              <span className="discipline-icon">⚽</span>
              <div className="discipline-info">
                <strong>Fútbol</strong>
                <p>Días: {olympicsConfig.disciplineDays?.futbol?.join(', ') || 'Calculando...'}</p>
              </div>
            </div>
            
            <div className="discipline-day-item basquet">
              <span className="discipline-icon">🏀</span>
              <div className="discipline-info">
                <strong>Básquet</strong>
                <p>Días: {olympicsConfig.disciplineDays?.basquet?.join(', ') || 'Calculando...'}</p>
              </div>
            </div>
            
            <div className="discipline-day-item voley">
              <span className="discipline-icon">🏐</span>
              <div className="discipline-info">
                <strong>Vóley</strong>
                <p>Días: {olympicsConfig.disciplineDays?.voley?.join(', ') || 'Calculando...'}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="no-start-date">
            <p>⚠️ Selecciona una fecha de inicio para ver la distribución de días</p>
          </div>
        )}
      </div>

      {/* Reglas de Distribución */}
      <div className="config-section">
        <h3>📋 Lógica de Distribución</h3>
        <div className="rules-info">
          <div className="rule-explanation">
            <h4>🎯 Cómo funciona:</h4>
            <ul>
              <li><strong>Fútbol:</strong> Se juega todos los días laborales (Lunes a Viernes)</li>
              <li><strong>Básquet:</strong> Se asignan 2 días fijos comenzando desde el día de inicio</li>
              <li><strong>Vóley:</strong> Se asignan los días restantes que no usa Básquet</li>
            </ul>
          </div>
          <div className="example-distribution">
            <h4>📋 Ejemplo:</h4>
            <p>Si las olimpiadas inician un <strong>Martes</strong>:</p>
            <ul>
              <li>🏀 <strong>Básquet:</strong> Martes y Miércoles</li>
              <li>🏐 <strong>Vóley:</strong> Lunes, Jueves y Viernes</li>
              <li>⚽ <strong>Fútbol:</strong> Todos los días</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Resumen de Partidos */}
      <div className="config-section">
        <h3>📊 Resumen de Partidos</h3>
        <div className="matches-summary">
          {Object.keys(allMatches).map(discipline => (
            <div key={discipline} className={`summary-item ${discipline}`}>
              <span className="discipline-name">
                {discipline === 'futbol' ? '⚽ Fútbol' : 
                 discipline === 'basquet' ? '🏀 Básquet' : '🏐 Vóley'}
              </span>
              <span className="matches-count">
                {allMatches[discipline].length} partidos
              </span>
              <span className="unscheduled-count">
                {allMatches[discipline].filter(m => !m.fecha || !m.hora).length} sin horario
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Vista de Semana Actual */}
      <div className="config-section">
        <h3>📅 Vista de Horarios - Semana {currentWeek}</h3>
        <div className="week-navigation">
          <button 
            onClick={() => setCurrentWeek(Math.max(1, currentWeek - 1))}
            disabled={currentWeek === 1}
          >
            ← Anterior
          </button>
          <span>Semana {currentWeek} de {olympicsConfig.weeksCount}</span>
          <button 
            onClick={() => setCurrentWeek(Math.min(olympicsConfig.weeksCount, currentWeek + 1))}
            disabled={currentWeek === olympicsConfig.weeksCount}
          >
            Siguiente →
          </button>
        </div>

        {weeklySchedule[currentWeek] && (
          <div className="schedule-grid">
            <div className="schedule-header">
              <div className="time-column">Hora</div>
              {diasSemana.map(day => (
                <div key={day} className="day-column">{day}</div>
              ))}
            </div>
            
            {olympicsConfig.timeSlots.map(time => (
              <div key={time} className="schedule-row">
                <div className="time-cell">{time}</div>
                {diasSemana.map(day => (
                  <div key={day} className="schedule-cell">
                    {weeklySchedule[currentWeek][day][time] ? (
                      <div className={`match-card ${weeklySchedule[currentWeek][day][time].disciplina}`}>
                        <button 
                          className="remove-match-btn"
                          onClick={() => removeMatchFromSchedule(currentWeek, day, time)}
                          title="Remover del horario"
                        >
                          ×
                        </button>
                        <div className="match-teams">
                          {weeklySchedule[currentWeek][day][time].equipoA?.curso} vs {weeklySchedule[currentWeek][day][time].equipoB?.curso}
                        </div>
                        <div className="match-discipline">
                          {weeklySchedule[currentWeek][day][time].disciplina}
                        </div>
                        <div className="match-category">
                          {weeklySchedule[currentWeek][day][time].categoria}
                        </div>
                      </div>
                    ) : (
                      <div 
                        className="empty-slot"
                        onClick={() => openAssignModal(currentWeek, day, time)}
                        title="Clic para asignar partido"
                      >
                        <span className="plus-icon">+</span>
                        <span className="assign-text">Asignar</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Botones de Acción */}
      <div className="action-buttons">
        <button className="btn-primary" onClick={saveConfig}>
          💾 Guardar Configuración
        </button>
        
        <button className="btn-secondary" onClick={generateAutomaticSchedule}>
          🔄 Generar Horario Automático
        </button>
        
        <button 
          className="btn-success" 
          onClick={applyScheduleToFirebase}
          disabled={Object.keys(weeklySchedule).length === 0}
        >
          ✅ Aplicar Horarios a Firebase
        </button>
        
        <button className="btn-danger" onClick={clearAllSchedules}>
          🗑️ Limpiar Todos los Horarios
        </button>
      </div>

      {/* Modal de Asignación de Partidos */}
      {showAssignModal && (
        <div className="modal-overlay" onClick={closeAssignModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📋 Asignar Partido</h3>
              <button className="modal-close" onClick={closeAssignModal}>×</button>
            </div>
            
            <div className="modal-slot-info">
              <p>
                <strong>Slot seleccionado:</strong> {selectedSlot?.day} - {selectedSlot?.time} 
                (Semana {selectedSlot?.week})
              </p>
            </div>

            {/* Filtros */}
            <div className="modal-filters">
              <div className="filter-group">
                <label>🔍 Buscar:</label>
                <input
                  type="text"
                  placeholder="Buscar por equipos, categoría, nivel..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="search-input"
                />
              </div>

              <div className="filter-group">
                <label>🏃 Disciplina:</label>
                <select 
                  value={disciplineFilter} 
                  onChange={(e) => setDisciplineFilter(e.target.value)}
                  className="filter-select"
                >
                  <option value="todos">Todas las disciplinas</option>
                  <option value="futbol">⚽ Fútbol</option>
                  <option value="basquet">🏀 Básquet</option>
                  <option value="voley">🏐 Vóley</option>
                </select>
              </div>

              <div className="filter-group">
                <label>📊 Categoría:</label>
                <select 
                  value={categoryFilter} 
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="filter-select"
                >
                  <option value="todos">Todas las categorías</option>
                  {getUniqueCategories().map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Lista de Partidos */}
            <div className="modal-matches-list">
              <div className="matches-header">
                <h4>Partidos Disponibles ({filteredMatches.length})</h4>
              </div>
              
              <div className="matches-container">
                {filteredMatches.length === 0 ? (
                  <div className="no-matches">
                    <p>No hay partidos disponibles con los filtros seleccionados</p>
                  </div>
                ) : (
                  filteredMatches.map(match => (
                    <div 
                      key={match.id} 
                      className={`match-item ${match.disciplina}`}
                      onClick={() => assignMatchToSlot(match)}
                    >
                      <div className="match-item-header">
                        <span className="discipline-badge">
                          {match.disciplina === 'futbol' ? '⚽' : 
                           match.disciplina === 'basquet' ? '🏀' : '🏐'} 
                          {match.disciplina}
                        </span>
                        <span className="category-badge">{match.categoria}</span>
                      </div>
                      
                      <div className="match-teams-info">
                        <strong>{match.equipoA?.curso}</strong> vs <strong>{match.equipoB?.curso}</strong>
                      </div>
                      
                      <div className="match-details">
                        <span>📊 {match.nivel}</span>
                        <span>👥 {match.genero}</span>
                        {match.fase && <span>🏆 {match.fase}</span>}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={closeAssignModal}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OlympicsScheduleManager;

const styles = `
.olympics-schedule-manager {
  max-width: 1400px;
  margin: 0 auto;
  padding: 30px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: 30px;
}

.schedule-header {
  text-align: center;
  color: white;
  margin-bottom: 20px;
  width: 100%;
}

.schedule-header h1 {
  font-size: 2.8rem;
  margin-bottom: 15px;
  text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
}

.schedule-header p {
  font-size: 1.3rem;
  opacity: 0.9;
}

.config-section {
  background: white;
  border-radius: 15px;
  padding: 30px;
  margin-bottom: 25px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.1);
  border: 1px solid rgba(255,255,255,0.2);
  width: 100%;
  max-width: 1200px;
}

.config-section h3 {
  color: #2d3748;
  margin-bottom: 25px;
  font-size: 1.5rem;
  display: flex;
  align-items: center;
  gap: 10px;
  text-align: center;
  justify-content: center;
}

.config-form {
  display: flex;
  flex-direction: column;
  gap: 25px;
  align-items: center;
}

.config-row {
  display: flex;
  gap: 30px;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  width: 100%;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 200px;
}

.input-group label {
  font-weight: 600;
  color: #4a5568;
  font-size: 1rem;
}

.input-group input,
.input-group select {
  padding: 12px 15px;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  font-size: 1rem;
  transition: all 0.3s ease;
}

.input-group input:focus,
.input-group select:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.save-config-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 15px 40px;
  border-radius: 10px;
  font-size: 1.1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  margin-top: 20px;
}

.save-config-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(102, 126, 234, 0.3);
}

.save-config-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.discipline-days-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
  margin-top: 20px;
}

.discipline-day-item {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 20px;
  border-radius: 12px;
  border-left: 4px solid;
  transition: all 0.3s ease;
}

.discipline-day-item.futbol {
  background: linear-gradient(135deg, #48bb78, #38a169);
  border-left-color: #22543d;
  color: white;
}

.discipline-day-item.basquet {
  background: linear-gradient(135deg, #ed8936, #dd6b20);
  border-left-color: #9c4221;
  color: white;
}

.discipline-day-item.voley {
  background: linear-gradient(135deg, #4299e1, #3182ce);
  border-left-color: #2a4365;
  color: white;
}

.discipline-icon {
  font-size: 2rem;
  opacity: 0.9;
}

.discipline-info strong {
  font-size: 1.2rem;
  margin-bottom: 5px;
  display: block;
}

.discipline-info p {
  font-size: 1rem;
  opacity: 0.9;
  margin: 0;
}

.no-start-date {
  text-align: center;
  padding: 40px;
  color: #718096;
  background: #f7fafc;
  border-radius: 10px;
  border: 2px dashed #e2e8f0;
}

.rules-info {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 30px;
  margin-top: 20px;
}

.rule-explanation,
.example-distribution {
  background: #f8f9fa;
  padding: 25px;
  border-radius: 12px;
  border: 1px solid #e9ecef;
}

.rule-explanation h4,
.example-distribution h4 {
  color: #495057;
  margin-bottom: 15px;
  font-size: 1.2rem;
}

.rule-explanation ul,
.example-distribution ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.rule-explanation li,
.example-distribution li {
  padding: 8px 0;
  border-bottom: 1px solid #e9ecef;
  display: flex;
  align-items: center;
  gap: 10px;
}

.rule-explanation li:last-child,
.example-distribution li:last-child {
  border-bottom: none;
}

.schedule-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  gap: 25px;
  width: 100%;
  max-width: 1200px;
}

.time-slot-card {
  background: white;
  border-radius: 15px;
  padding: 25px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.1);
  border: 1px solid rgba(255,255,255,0.2);
  transition: all 0.3s ease;
}

.time-slot-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 12px 40px rgba(0,0,0,0.15);
}

.time-slot-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 2px solid #f1f5f9;
}

.time-slot-time {
  font-size: 1.4rem;
  font-weight: 700;
  color: #2d3748;
  display: flex;
  align-items: center;
  gap: 8px;
}

.delete-slot-btn {
  background: #e53e3e;
  color: white;
  border: none;
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.3s ease;
}

.delete-slot-btn:hover {
  background: #c53030;
  transform: scale(1.05);
}

.disciplines-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 15px;
}

.discipline-slot {
  background: #f8fafc;
  border: 2px dashed #cbd5e0;
  border-radius: 10px;
  padding: 20px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
  min-height: 100px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 10px;
}

.discipline-slot:hover {
  border-color: #667eea;
  background: #edf2f7;
  transform: translateY(-2px);
}

.discipline-slot.occupied {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  border: 2px solid #553c9a;
}

.discipline-slot.occupied:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 25px rgba(102, 126, 234, 0.3);
}

.discipline-name {
  font-weight: 600;
  font-size: 1.1rem;
}

.discipline-details {
  font-size: 0.9rem;
  opacity: 0.9;
}

.add-slot-section {
  width: 100%;
  max-width: 1200px;
  text-align: center;
}

.add-slot-form {
  background: white;
  border-radius: 15px;
  padding: 30px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.1);
  border: 1px solid rgba(255,255,255,0.2);
  display: flex;
  flex-direction: column;
  gap: 20px;
  align-items: center;
}

.add-slot-form h3 {
  color: #2d3748;
  margin-bottom: 15px;
  font-size: 1.4rem;
}

.time-inputs {
  display: flex;
  gap: 20px;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
}

.add-time-btn {
  background: linear-gradient(135deg, #48bb78, #38a169);
  color: white;
  border: none;
  padding: 12px 30px;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.add-time-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(72, 187, 120, 0.3);
}

.add-time-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.assign-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.75);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.assign-modal-content {
  background: white;
  border-radius: 15px;
  padding: 30px;
  max-width: 800px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.modal-header {
  text-align: center;
  margin-bottom: 25px;
  padding-bottom: 15px;
  border-bottom: 2px solid #f1f5f9;
}

.modal-header h3 {
  color: #2d3748;
  font-size: 1.5rem;
  margin-bottom: 10px;
}

.slot-info {
  background: #f8f9fa;
  padding: 15px;
  border-radius: 8px;
  margin: 15px 0;
  text-align: center;
}

.modal-filters {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 15px;
  margin-bottom: 25px;
  padding: 20px;
  background: #f8f9fa;
  border-radius: 10px;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.filter-group label {
  font-weight: 600;
  color: #4a5568;
  font-size: 0.9rem;
}

.search-input,
.filter-select {
  padding: 10px 12px;
  border: 2px solid #e2e8f0;
  border-radius: 6px;
  font-size: 0.9rem;
  transition: all 0.3s ease;
}

.search-input:focus,
.filter-select:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.modal-matches-list {
  margin-bottom: 20px;
}

.matches-header {
  margin-bottom: 15px;
  text-align: center;
}

.matches-header h4 {
  color: #2d3748;
  font-size: 1.2rem;
}

.matches-container {
  max-height: 300px;
  overflow-y: auto;
  border: 2px solid #f1f5f9;
  border-radius: 8px;
  padding: 10px;
}

.match-item {
  background: white;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  padding: 15px;
  margin-bottom: 10px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.match-item:hover {
  border-color: #667eea;
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.1);
  transform: translateY(-2px);
}

.match-item.futbol:hover {
  border-color: #48bb78;
  box-shadow: 0 4px 15px rgba(72, 187, 120, 0.1);
}

.match-item.basquet:hover {
  border-color: #ed8936;
  box-shadow: 0 4px 15px rgba(237, 137, 54, 0.1);
}

.match-item.voley:hover {
  border-color: #4299e1;
  box-shadow: 0 4px 15px rgba(66, 153, 225, 0.1);
}

.match-item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.discipline-badge {
  background: #667eea;
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: capitalize;
}

.match-item.futbol .discipline-badge {
  background: #48bb78;
}

.match-item.basquet .discipline-badge {
  background: #ed8936;
}

.match-item.voley .discipline-badge {
  background: #4299e1;
}

.category-badge {
  background: #e2e8f0;
  color: #4a5568;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: 600;
}

.match-teams-info {
  color: #2d3748;
  font-size: 1rem;
  margin-bottom: 10px;
  text-align: center;
}

.match-details {
  display: flex;
  justify-content: space-around;
  gap: 10px;
  font-size: 0.8rem;
  color: #4a5568;
}

.no-matches {
  text-align: center;
  padding: 40px;
  color: #718096;
}

.modal-footer {
  display: flex;
  justify-content: center;
  padding-top: 20px;
  border-top: 2px solid #f1f5f9;
}

.btn-secondary {
  background: #e2e8f0;
  color: #4a5568;
  border: none;
  padding: 12px 25px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-secondary:hover {
  background: #cbd5e0;
  transform: translateY(-2px);
}

@media (max-width: 768px) {
  .olympics-schedule-manager {
    padding: 20px;
    gap: 20px;
  }
  
  .schedule-header h1 {
    font-size: 2.2rem;
  }
  
  .config-section {
    padding: 20px;
  }
  
  .config-row {
    flex-direction: column;
    gap: 15px;
  }
  
  .rules-info {
    grid-template-columns: 1fr;
    gap: 20px;
  }
  
  .discipline-days-grid {
    grid-template-columns: 1fr;
  }
  
  .schedule-grid {
    grid-template-columns: 1fr;
  }
  
  .time-inputs {
    flex-direction: column;
    gap: 15px;
  }
  
  .modal-filters {
    grid-template-columns: 1fr;
  }
  
  .assign-modal-content {
    width: 95%;
    padding: 20px;
  }
}
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = styles;
  document.head.appendChild(styleSheet);
}
