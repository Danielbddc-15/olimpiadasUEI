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
import { useToast } from "../components/Toast";
import "../styles/AdminHorarios.css";
import OlympicsConfig from "../components/OlympicsConfig";

export default function AdminHorarios() {
  const { discipline } = useParams();
  const navigate = useNavigate();
  const { showToast, ToastContainer } = useToast();
  const [matches, setMatches] = useState([]);
  const [horariosPorDia, setHorariosPorDia] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedMatches, setSelectedMatches] = useState(new Set());
  const [draggedMatch, setDraggedMatch] = useState(null);
  const [showTimeSelector, setShowTimeSelector] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState(null);
  
  // Estados para modal de selección de partidos disponibles
  const [showAvailableMatches, setShowAvailableMatches] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [availableMatches, setAvailableMatches] = useState([]);
  
  // Estado para búsqueda del modal
  const [searchTerm, setSearchTerm] = useState('');

  // Estados para navegación por semanas
  const [currentWeek, setCurrentWeek] = useState(1);
  const [totalWeeks, setTotalWeeks] = useState(() => {
    const saved = localStorage.getItem('olimpiadas_weeks_count');
    return saved ? parseInt(saved) : 4;
  });
  const [weeklySchedules, setWeeklySchedules] = useState({});

  // Estados para configuración de cronograma
  const [startDay, setStartDay] = useState(() => {
    return localStorage.getItem(`olimpiadas_horarios_start_day_${discipline}`) || 'lunes';
  });
  const [disciplineConfig, setDisciplineConfig] = useState(() => {
    const saved = localStorage.getItem(`olimpiadas_horarios_discipline_config_${discipline}`);
    return saved ? JSON.parse(saved) : {
      futbol: 'todos', // todos los días
      voley: 'lunes', // día específico para vóley
      basquet: 'martes' // día específico para básquet
    };
  });

  // Estados para configuración personalizada
  const [olympicsWeeks, setOlympicsWeeks] = useState(() => {
    const saved = localStorage.getItem('olimpiadas_weeks_count');
    return saved ? parseInt(saved) : 4;
  });
  const [customTimes, setCustomTimes] = useState(() => {
    const saved = localStorage.getItem('olimpiadas_custom_times');
    return saved ? JSON.parse(saved) : [
      '07:05', '07:50', '08:35', '09:20', '10:05', '10:50',
      '11:35', '12:20', '13:00'
    ];
  });
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);

  // Configuración de disciplinas actualizada para nueva lógica
  // Todas las disciplinas pueden jugar cualquier día (se elimina la restricción por día)
  const getDisciplinesForDay = (_dayName) => ['futbol', 'voley', 'basquet'];

  // Estados de filtros
  const [filtroGenero, setFiltroGenero] = useState(() => {
    return localStorage.getItem(`olimpiadas_horarios_filtro_genero_${discipline}`) || "";
  });
  const [filtroNivelEducacional, setFiltroNivelEducacional] = useState(() => {
    return localStorage.getItem(`olimpiadas_horarios_filtro_nivel_educacional_${discipline}`) || "";
  });
  const [filtroCategoria, setFiltroCategoria] = useState(() => {
    return localStorage.getItem(`olimpiadas_horarios_filtro_categoria_${discipline}`) || "";
  });
  const [faseActiva, setFaseActiva] = useState(() => {
    return localStorage.getItem(`olimpiadas_horarios_fase_activa_${discipline}`) || "todas";
  });

  // Estados para datos de los filtros
  const [equipos, setEquipos] = useState([]);
  const [filteredMatches, setFilteredMatches] = useState([]);
  
  // Estados para opciones de filtros dinámicos
  const [generosDisponibles, setGenerosDisponibles] = useState([]);
  const [nivelesDisponibles, setNivelesDisponibles] = useState([]);
  const [categoriasDisponibles, setCategoriasDisponibles] = useState([]);

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

  // Sincronizar totalWeeks con olympicsWeeks al inicio
  useEffect(() => {
    setTotalWeeks(olympicsWeeks);
  }, [olympicsWeeks]);

  // Días laborables de la semana
  const diasLaborables = [
    'lunes',
    'martes',
    'miércoles',
    'jueves',
    'viernes'
  ];

  // Funciones para navegación de semanas
  const calculateTotalWeeks = (matches) => {
    // Usar la configuración de semanas de olimpiadas
    return olympicsWeeks;
  };

  // Funciones de configuración
  const updateOlympicsWeeks = (weeks) => {
    setOlympicsWeeks(weeks);
    localStorage.setItem('olimpiadas_weeks_count', weeks.toString());
    setTotalWeeks(weeks);
  };

  // Función para limpiar filtros
  const limpiarFiltros = () => {
    setFiltroGenero("");
    setFiltroNivelEducacional("");
    setFiltroCategoria("");
    setFaseActiva("todas");

    // Limpiar localStorage
    localStorage.removeItem(`olimpiadas_horarios_filtro_genero_${discipline}`);
    localStorage.removeItem(`olimpiadas_horarios_filtro_nivel_educacional_${discipline}`);
    localStorage.removeItem(`olimpiadas_horarios_filtro_categoria_${discipline}`);
    localStorage.removeItem(`olimpiadas_horarios_fase_activa_${discipline}`);
  };

  const updateCustomTimes = (times) => {
    setCustomTimes(times);
    localStorage.setItem('olimpiadas_custom_times', JSON.stringify(times));
  };

  const addCustomTime = (time) => {
    if (time && !customTimes.includes(time)) {
      const newTimes = [...customTimes, time].sort();
      updateCustomTimes(newTimes);
    }
  };

  const removeCustomTime = (time) => {
    const newTimes = customTimes.filter(t => t !== time);
    if (newTimes.length > 0) {
      updateCustomTimes(newTimes);
    }
  };

  const resetToDefaultTimes = () => {
    const defaultTimes = [
      '08:00', '08:45', '09:30', '10:15', '11:00', '11:45',
      '12:30', '13:15', '14:00', '14:45', '15:30', '16:15'
    ];
    updateCustomTimes(defaultTimes);
  };

  // Función para abrir configuración
  const openConfigModal = () => {
    setShowConfigModal(true);
  };

  // Función para cerrar configuración
  const closeConfigModal = () => {
    setShowConfigModal(false);
  };

  const goToWeek = (weekNumber) => {
    if (weekNumber >= 1 && weekNumber <= totalWeeks) {
      setCurrentWeek(weekNumber);
    }
  };

  const goToPreviousWeek = () => {
    if (currentWeek > 1) {
      setCurrentWeek(currentWeek - 1);
    }
  };

  const goToNextWeek = () => {
    if (currentWeek < totalWeeks) {
      setCurrentWeek(currentWeek + 1);
    }
  };

  const getWeekLabel = (weekNumber) => {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + (weekNumber - 1) * 7);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);

    const formatDate = (date) => {
      return date.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit'
      });
    };

    return `Semana ${weekNumber} (${formatDate(startDate)} - ${formatDate(endDate)})`;
  };

  // Funciones para configuración de disciplinas
  // Todas las disciplinas permitidas cada día
  const getDisciplineForDay = (_dayName) => ['futbol', 'voley', 'basquet'];

  const validateDisciplineAssignment = (_partido, _dia) => ({ valid: true });

  const updateDisciplineConfig = (newConfig) => {
    // Validar que vóley y básquet no estén en el mismo día
    if (newConfig.voley === newConfig.basquet && newConfig.voley !== 'ninguno') {
      alert('Error: Vóley y Básquet no pueden programarse el mismo día');
      return false;
    }

    setDisciplineConfig(newConfig);
    localStorage.setItem(`olimpiadas_horarios_discipline_config_${discipline}`, JSON.stringify(newConfig));
    return true;
  };

  const updateStartDay = (newStartDay) => {
    setStartDay(newStartDay);
    localStorage.setItem(`olimpiadas_horarios_start_day_${discipline}`, newStartDay);
  };

  const getOrderedDays = () => {
    // Rotar columnas para comenzar por el primer día que tenga algún partido programado en la semana actual
    const semana = weeklySchedules[currentWeek] || horariosPorDia || {};
    const hasPartidos = (dia) => {
      const diaObj = semana[dia] || {};
      // diaObj puede ser objeto de horas -> partido o estructura anidada; probamos ambos
      if (diaObj.partidos) {
        // Estructura por disciplina -> hora
        return Object.values(diaObj.partidos).some(horas => Object.values(horas).some(p => !!p));
      }
      // Estructura directa hora -> partido
      return Object.values(diaObj).some(p => !!p);
    };
    let startIndex = diasLaborables.findIndex(d => hasPartidos(d));
    if (startIndex === -1) startIndex = 0;
    return [
      ...diasLaborables.slice(startIndex),
      ...diasLaborables.slice(0, startIndex)
    ];
  };

  // Funciones para rotación progresiva de disciplinas
  const getAvailableDaysForDiscipline = (disciplineName) => {
    if (disciplineName === 'futbol') {
      return getOrderedDays(); // Fútbol se juega todos los días
    }

    // Para vóley y básquet, obtener los días permitidos
    const allowedDays = [];
    getOrderedDays().forEach(day => {
      const dayDisciplines = getDisciplineForDay(day);
      if (dayDisciplines.includes(disciplineName)) {
        allowedDays.push(day);
      }
    });

    return allowedDays;
  };

  const getNextDayForDiscipline = (disciplineName, currentAssignments) => {
    const availableDays = getAvailableDaysForDiscipline(disciplineName);

    if (availableDays.length === 0) return null;

    // Contar cuántos partidos ya están asignados por día para esta disciplina
    const dayUsageCount = {};
    availableDays.forEach(day => {
      dayUsageCount[day] = 0;
    });

    // Contar asignaciones actuales
    Object.values(currentAssignments).forEach(weekSchedule => {
      availableDays.forEach(day => {
        if (weekSchedule[day]) {
          Object.values(weekSchedule[day]).forEach(match => {
            if (match && match.disciplina === disciplineName) {
              dayUsageCount[day]++;
            }
          });
        }
      });
    });

    // Encontrar el día con menor uso
    let minUsage = Math.min(...Object.values(dayUsageCount));
    let nextDay = availableDays.find(day => dayUsageCount[day] === minUsage);

    return nextDay;
  };

  const assignMatchWithProgression = (matches, allWeeklySchedules) => {
    // Separar partidos por disciplina
    const matchesByDiscipline = {
      futbol: matches.filter(m => m.disciplina === 'futbol'),
      voley: matches.filter(m => m.disciplina === 'voley'),
      basquet: matches.filter(m => m.disciplina === 'basquet')
    };

    const assignmentResults = {
      assigned: [],
      unassigned: []
    };

    // Procesar cada disciplina
    Object.entries(matchesByDiscipline).forEach(([disciplineName, disciplineMatches]) => {
      const availableDays = getAvailableDaysForDiscipline(disciplineName);

      if (availableDays.length === 0 || disciplineMatches.length === 0) return;

      let currentWeek = 1;
      let currentDayIndex = 0;
      let matchIndex = 0;

      while (matchIndex < disciplineMatches.length && currentWeek <= Object.keys(allWeeklySchedules).length) {
        const currentDay = availableDays[currentDayIndex];

        // Intentar llenar completamente el día actual antes de pasar al siguiente
        let dayFilled = false;

        for (let hourIndex = 0; hourIndex < horariosDisponibles.length && matchIndex < disciplineMatches.length; hourIndex++) {
          const currentHour = horariosDisponibles[hourIndex];
          const match = disciplineMatches[matchIndex];

          // Verificar que el slot esté libre
          if (!allWeeklySchedules[currentWeek][currentDay][currentHour]) {
            // Verificar que los equipos no jueguen más de una vez por día en esa semana
            const teamsInDay = getTeamsPlayingInDay(allWeeklySchedules[currentWeek][currentDay]);
            const matchTeams = [
              `${match.equipoA.curso}_${match.equipoA.paralelo}`,
              `${match.equipoB.curso}_${match.equipoB.paralelo}`
            ];

            const hasConflict = matchTeams.some(team => teamsInDay.includes(team));

            if (!hasConflict) {
              // Asignar el partido
              allWeeklySchedules[currentWeek][currentDay][currentHour] = {
                ...match,
                diaAsignado: currentDay,
                horaAsignada: currentHour,
                semanaAsignada: currentWeek
              };

              assignmentResults.assigned.push({
                match,
                day: currentDay,
                hour: currentHour,
                week: currentWeek,
                discipline: disciplineName
              });

              matchIndex++; // Avanzar al siguiente partido
              dayFilled = true;
            }
          }
        }

        // Si no se pudo asignar ningún partido en este día/semana, avanzar al siguiente día
        if (!dayFilled) {
          currentDayIndex = (currentDayIndex + 1) % availableDays.length;

          // Si completamos un ciclo de días, avanzar a la siguiente semana
          if (currentDayIndex === 0) {
            currentWeek++;
          }
        } else {
          // Se llenó el día (o se llenaron algunos slots), pasar al siguiente día en la rotación
          currentDayIndex = (currentDayIndex + 1) % availableDays.length;

          // Si completamos un ciclo de días, avanzar a la siguiente semana
          if (currentDayIndex === 0) {
            currentWeek++;
          }
        }
      }

      // Marcar partidos no asignados
      while (matchIndex < disciplineMatches.length) {
        assignmentResults.unassigned.push({
          match: disciplineMatches[matchIndex],
          discipline: disciplineName,
          reason: 'No hay más semanas/slots disponibles'
        });
        matchIndex++;
      }
    });

    return assignmentResults;
  };

  const getTeamsPlayingInDay = (daySchedule) => {
    const teams = [];
    Object.values(daySchedule).forEach(match => {
      if (match) {
        teams.push(`${match.equipoA.curso}_${match.equipoA.paralelo}`);
        teams.push(`${match.equipoB.curso}_${match.equipoB.paralelo}`);
      }
    });
    return teams;
  };

  // Horarios disponibles (ahora configurables)
  const horariosDisponibles = customTimes;

  // Cargar equipos para filtros
  useEffect(() => {
    const fetchEquipos = async () => {
      try {
        const q = query(
          collection(db, "equipos"),
          where("disciplina", "==", discipline)
        );
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setEquipos(data);
      } catch (error) {
        console.error("Error cargando equipos:", error);
      }
    };

    fetchEquipos();
  }, [discipline]);

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
        console.log("🔄 Firebase onSnapshot disparado, cambios:", snapshot.docChanges().length);
        snapshot.docChanges().forEach(change => {
          console.log(`   - ${change.type}: ${change.doc.id} - ${change.doc.data().equipoA?.curso}${change.doc.data().equipoA?.paralelo} vs ${change.doc.data().equipoB?.curso}${change.doc.data().equipoB?.paralelo}`);
        });
        
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        
        console.log("📊 Total partidos cargados desde Firebase:", data.length);
        
        // Verificar duplicados en los datos de Firebase
        const duplicateCheck = {};
        data.forEach(match => {
          const key = `${match.equipoA?.curso}${match.equipoA?.paralelo}-vs-${match.equipoB?.curso}${match.equipoB?.paralelo}`;
          duplicateCheck[key] = (duplicateCheck[key] || 0) + 1;
        });
        
        const duplicates = Object.entries(duplicateCheck).filter(([key, count]) => count > 1);
        if (duplicates.length > 0) {
          console.warn("⚠️ Duplicados detectados en Firebase:", duplicates);
        }
        
        setMatches(data);
      } catch (error) {
        console.error("Error cargando partidos:", error);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [discipline]);

  // Aplicar filtros a los partidos
  useEffect(() => {
    let filtered = matches;

    // Filtro por género
    if (filtroGenero) {
      filtered = filtered.filter((partido) => {
        const equipoA = equipos.find(
          (eq) => eq.curso === partido.equipoA.curso && eq.paralelo === partido.equipoA.paralelo
        );
        const equipoB = equipos.find(
          (eq) => eq.curso === partido.equipoB.curso && eq.paralelo === partido.equipoB.paralelo
        );
        return (equipoA && equipoA.genero === filtroGenero) || (equipoB && equipoB.genero === filtroGenero);
      });
    }

    // Filtro por nivel educacional
    if (filtroNivelEducacional) {
      filtered = filtered.filter((partido) => {
        const equipoA = equipos.find(
          (eq) => eq.curso === partido.equipoA.curso && eq.paralelo === partido.equipoA.paralelo
        );
        const equipoB = equipos.find(
          (eq) => eq.curso === partido.equipoB.curso && eq.paralelo === partido.equipoB.paralelo
        );
        return (equipoA && equipoA.nivelEducacional === filtroNivelEducacional) ||
               (equipoB && equipoB.nivelEducacional === filtroNivelEducacional);
      });
    }

    // Filtro por categoría
    if (filtroCategoria) {
      filtered = filtered.filter((partido) => {
        const equipoA = equipos.find(
          (eq) => eq.curso === partido.equipoA.curso && eq.paralelo === partido.equipoA.paralelo
        );
        const equipoB = equipos.find(
          (eq) => eq.curso === partido.equipoB.curso && eq.paralelo === partido.equipoB.paralelo
        );
        return (equipoA && equipoA.categoria === filtroCategoria) ||
               (equipoB && equipoB.categoria === filtroCategoria);
      });
    }

    // Filtro por fase
    if (faseActiva !== "todas") {
      filtered = filtered.filter((partido) => {
        const fase = partido.fase || "grupos1";
        return fase === faseActiva;
      });
    }

    setFilteredMatches(filtered);
  }, [matches, equipos, filtroGenero, filtroNivelEducacional, filtroCategoria, faseActiva]);

  // Calcular total de semanas y organizar partidos
  useEffect(() => {
    if (filteredMatches.length === 0) {
      setTotalWeeks(1);
      setWeeklySchedules({});
      setHorariosPorDia({});
      return;
    }

    // Calcular total de semanas necesarias
    const weeksNeeded = calculateTotalWeeks(filteredMatches);
    setTotalWeeks(weeksNeeded);

    // Obtener días ordenados según día de inicio
    const orderedDays = getOrderedDays();

    // Crear estructura para todas las semanas
    const allWeeklySchedules = {};

    for (let week = 1; week <= weeksNeeded; week++) {
      const weekSchedule = {};
      orderedDays.forEach(dia => {
        weekSchedule[dia] = {};
        horariosDisponibles.forEach(hora => {
          weekSchedule[dia][hora] = null;
        });
      });
      allWeeklySchedules[week] = weekSchedule;
    }

    // Distribuir partidos por semanas
    let currentWeekForAssignment = 1;
    const equiposUsadosPorSemana = {};

    // Función para verificar si un equipo ya juega en una semana específica
    const equipoYaJuegaEnSemana = (partido, semana, dia) => {
      const weekKey = `${semana}_${dia}`;
      if (!equiposUsadosPorSemana[weekKey]) {
        equiposUsadosPorSemana[weekKey] = new Set();
        // Agregar equipos que ya están programados ese día en esa semana
        Object.values(allWeeklySchedules[semana][dia]).forEach(p => {
          if (p) {
            const equipoA = `${p.equipoA.curso} ${p.equipoA.paralelo}`;
            const equipoB = `${p.equipoB.curso} ${p.equipoB.paralelo}`;
            equiposUsadosPorSemana[weekKey].add(equipoA);
            equiposUsadosPorSemana[weekKey].add(equipoB);
          }
        });
      }

      const equipoA = `${partido.equipoA.curso} ${partido.equipoA.paralelo}`;
      const equipoB = `${partido.equipoB.curso} ${partido.equipoB.paralelo}`;

      return equiposUsadosPorSemana[weekKey].has(equipoA) || equiposUsadosPorSemana[weekKey].has(equipoB);
    };

    // Función para marcar equipos como usados en una semana específica
    const marcarEquiposUsadosEnSemana = (partido, semana, dia) => {
      const weekKey = `${semana}_${dia}`;
      if (!equiposUsadosPorSemana[weekKey]) {
        equiposUsadosPorSemana[weekKey] = new Set();
      }

      const equipoA = `${partido.equipoA.curso} ${partido.equipoA.paralelo}`;
      const equipoB = `${partido.equipoB.curso} ${partido.equipoB.paralelo}`;

      equiposUsadosPorSemana[weekKey].add(equipoA);
      equiposUsadosPorSemana[weekKey].add(equipoB);
    };

    // Primero, colocar partidos que ya tienen fecha y hora asignada
    filteredMatches.forEach(partido => {
      if (partido.fecha && partido.hora && partido.semana) {
        const dia = partido.fecha;
        const hora = partido.hora;
        const semana = partido.semana;

        if (allWeeklySchedules[semana] && allWeeklySchedules[semana][dia] &&
            allWeeklySchedules[semana][dia][hora] !== undefined) {
          allWeeklySchedules[semana][dia][hora] = {
            ...partido,
            diaAsignado: dia,
            horaAsignada: hora,
            semanaAsignada: semana
          };
          marcarEquiposUsadosEnSemana(partido, semana, dia);
        }
      }
    });

    // Luego, asignar partidos sin programar usando rotación progresiva
    const partidosSinAsignar = filteredMatches.filter(m => !m.fecha || !m.hora || !m.semana);

    if (partidosSinAsignar.length > 0) {
      const assignmentResults = assignMatchWithProgression(partidosSinAsignar, allWeeklySchedules);

      // Log de resultados para debugging
      console.log('Resultados de asignación progresiva:', {
        asignados: assignmentResults.assigned.length,
        sinAsignar: assignmentResults.unassigned.length
      });

      // Agrupar asignaciones por disciplina y día para mostrar el patrón
      const groupedByDiscipline = {};
      assignmentResults.assigned.forEach(a => {
        if (!groupedByDiscipline[a.discipline]) {
          groupedByDiscipline[a.discipline] = {};
        }
        const dayKey = `${a.day} (Sem. ${a.week})`;
        if (!groupedByDiscipline[a.discipline][dayKey]) {
          groupedByDiscipline[a.discipline][dayKey] = [];
        }
        groupedByDiscipline[a.discipline][dayKey].push(`${a.hour}: ${a.match.equipoA.curso}${a.match.equipoA.paralelo} vs ${a.match.equipoB.curso}${a.match.equipoB.paralelo}`);
      });

      console.log('Patrón de llenado por disciplina:', groupedByDiscipline);

      // Mostrar partidos no asignados si los hay
      if (assignmentResults.unassigned.length > 0) {
        console.warn('Partidos sin asignar:', assignmentResults.unassigned);
      }
    }

    setWeeklySchedules(allWeeklySchedules);

    // Establecer horarios para la semana actual
    if (allWeeklySchedules[currentWeek]) {
      setHorariosPorDia(allWeeklySchedules[currentWeek]);
    }
  }, [filteredMatches, startDay, disciplineConfig]);

  // Actualizar horarios cuando cambie la semana actual
  useEffect(() => {
    if (weeklySchedules[currentWeek]) {
      setHorariosPorDia(weeklySchedules[currentWeek]);
    }
  }, [currentWeek, weeklySchedules]);

  // Guardar filtros en localStorage
  useEffect(() => {
    if (filtroGenero) {
      localStorage.setItem(`olimpiadas_horarios_filtro_genero_${discipline}`, filtroGenero);
    }
    if (filtroNivelEducacional) {
      localStorage.setItem(`olimpiadas_horarios_filtro_nivel_educacional_${discipline}`, filtroNivelEducacional);
    }
    if (filtroCategoria) {
      localStorage.setItem(`olimpiadas_horarios_filtro_categoria_${discipline}`, filtroCategoria);
    }
    if (faseActiva) {
      localStorage.setItem(`olimpiadas_horarios_fase_activa_${discipline}`, faseActiva);
    }
  }, [filtroGenero, filtroNivelEducacional, filtroCategoria, faseActiva, discipline]);

  // Limpiar filtros dependientes
  useEffect(() => {
    if (!filtroGenero) {
      setFiltroNivelEducacional("");
      setFiltroCategoria("");
    }
  }, [filtroGenero]);

  useEffect(() => {
    if (!filtroNivelEducacional) {
      setFiltroCategoria("");
    }
  }, [filtroNivelEducacional]);

  // Actualizar opciones dinámicas de filtros cuando cambien los datos
  useEffect(() => {
    const generos = [...new Set(matches.map(match => match.genero).filter(Boolean))];
    const niveles = [...new Set(matches.map(match => match.nivelEducacional).filter(Boolean))];
    const categorias = [...new Set(matches.map(match => match.categoria || match.grupo).filter(Boolean))];
    
    setGenerosDisponibles(generos);
    setNivelesDisponibles(niveles);
    setCategoriasDisponibles(categorias);
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

    // Validar que la disciplina puede jugar en este d��a
    const disciplineValidation = validateDisciplineAssignment(draggedMatch, targetDia);
    if (!disciplineValidation.valid) {
      alert(disciplineValidation.message);
      setDraggedMatch(null);
      return;
    }

    // Verificar si ya hay un partido en ese horario
    const partidoEnTarget = horariosPorDia[targetDia]?.[targetHora];

    // ELIMINADA: Restricción de un equipo por día - Ahora se permite múltiples partidos por equipo por día

    try {
      // Si hay un partido en el slot target, intercambiar posiciones
      if (partidoEnTarget) {
        // Intercambiar partidos
        await updateDoc(doc(db, "matches", draggedMatch.id), {
          fecha: targetDia,
          hora: targetHora,
          semana: currentWeek,
          estado: "programado"
        });

        await updateDoc(doc(db, "matches", partidoEnTarget.id), {
          fecha: draggedMatch.diaAsignado || null,
          hora: draggedMatch.horaAsignada || null,
          semana: draggedMatch.semanaAsignada || null,
          estado: draggedMatch.diaAsignado ? "programado" : "pendiente"
        });
      } else {
        // Solo mover el partido arrastrado
        await updateDoc(doc(db, "matches", draggedMatch.id), {
          fecha: targetDia,
          hora: targetHora,
          semana: currentWeek,
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

    // Validar que la disciplina puede jugar en este día
    const disciplineValidation = validateDisciplineAssignment(selectedMatch, dia);
    if (!disciplineValidation.valid) {
      alert(disciplineValidation.message);
      return;
    }

    // Verificar si hay partido en ese horario
    const partidoEnTarget = horariosPorDia[dia]?.[hora];

    // ELIMINADA: Validación de conflictos de equipos - Ahora se permite múltiples partidos por equipo por día

    try {
      if (partidoEnTarget) {
        // Intercambiar
        await updateDoc(doc(db, "matches", selectedMatch.id), {
          fecha: dia,
          hora: hora,
          semana: currentWeek,
          estado: "programado"
        });

        await updateDoc(doc(db, "matches", partidoEnTarget.id), {
          fecha: selectedMatch.diaAsignado || null,
          hora: selectedMatch.horaAsignada || null,
          semana: selectedMatch.semanaAsignada || null,
          estado: selectedMatch.diaAsignado ? "programado" : "pendiente"
        });
      } else {
        await updateDoc(doc(db, "matches", selectedMatch.id), {
          fecha: dia,
          hora: hora,
          semana: currentWeek,
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
      showToast(`${partidosAMover.length} partidos movidos para reorganización automática`, "success");
    } catch (error) {
      console.error("Error moviendo partidos:", error);
      showToast("Error al mover los partidos", "error");
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
          semana: currentWeek,
          estado: "programado"
        });
      }
      
      showToast(`Horarios del ${dia} confirmados correctamente`, "success");
    } catch (error) {
      console.error("Error confirmando horarios:", error);
      showToast("Error al confirmar los horarios", "error");
    }
  };

  // Función para filtrar partidos disponibles por búsqueda
  const filterAvailableMatches = (matches) => {
    if (!searchTerm.trim()) {
      return matches;
    }
    
    const searchLower = searchTerm.toLowerCase();
    return matches.filter(match => {
      // Buscar en equipos
      const equipoA = `${match.equipoA.curso} ${match.equipoA.paralelo}`.toLowerCase();
      const equipoB = `${match.equipoB.curso} ${match.equipoB.paralelo}`.toLowerCase();
      
      // Buscar en otras propiedades
      const disciplina = match.disciplina.toLowerCase();
      const genero = match.genero.toLowerCase();
      const categoria = (match.categoria || '').toLowerCase();
      const grupo = (match.grupo || '').toLowerCase();
      const nivelEducacional = match.nivelEducacional.toLowerCase();
      
      return equipoA.includes(searchLower) ||
             equipoB.includes(searchLower) ||
             disciplina.includes(searchLower) ||
             genero.includes(searchLower) ||
             categoria.includes(searchLower) ||
             grupo.includes(searchLower) ||
             nivelEducacional.includes(searchLower);
    });
  };

  // Función para limpiar búsqueda
  const clearSearch = () => {
    console.log("🧹 Limpiando búsqueda");
    setSearchTerm('');
  };

  // Función para mostrar partidos disponibles al hacer clic en slot vacío
  const handleEmptySlotClick = (dia, hora) => {
    // Verificar qué disciplinas pueden jugar en este día
    const allowedDisciplines = getDisciplinesForDay(dia);
    
    console.log("🔍 Debug info:");
    console.log("   - Día seleccionado:", dia);
    console.log("   - Hora seleccionada:", hora);
    console.log("   - Disciplina actual (URL):", discipline);
    console.log("   - Disciplinas permitidas en", dia, ":", allowedDisciplines);
    console.log("   - Total de partidos:", matches.length);
    
    // Filtrar partidos sin horario asignado que correspondan a las disciplinas permitidas
    const available = matches.filter(match => {
      console.log(`🎮 Evaluando partido ${match.id}:`);
      console.log(`   - Disciplina: ${match.disciplina}`);
      console.log(`   - Estado: ${match.estado}`);
      console.log(`   - Fecha: ${match.fecha}`);
      console.log(`   - Hora: ${match.hora}`);
      console.log(`   - Equipos: ${match.equipoA.curso}${match.equipoA.paralelo} vs ${match.equipoB.curso}${match.equipoB.paralelo}`);
      
      // Solo mostrar partidos sin horario asignado (pendientes o sin fecha/hora)
      const sinHorario = match.estado === 'pendiente' || !match.fecha || !match.hora;
      console.log(`   - Sin horario: ${sinHorario}`);
      if (!sinHorario) return false;
      
      // Verificar si la disciplina del partido está permitida en este día
      const disciplinaPermitida = allowedDisciplines.includes(match.disciplina);
      console.log(`   - Disciplina permitida: ${disciplinaPermitida}`);
      if (!disciplinaPermitida) return false;
      
      console.log(`   ✅ Partido incluido`);
      return true;
    });

    console.log("🎯 Partidos disponibles (antes de filtros):", available.length);
    console.log("📋 Detalles de partidos disponibles:", available.map(m => ({
      id: m.id,
      equipos: `${m.equipoA.curso}${m.equipoA.paralelo} vs ${m.equipoB.curso}${m.equipoB.paralelo}`,
      disciplina: m.disciplina
    })));

    // Verificar si hay duplicados
    const equiposCount = {};
    available.forEach(match => {
      const key = `${match.equipoA.curso}${match.equipoA.paralelo}-vs-${match.equipoB.curso}${match.equipoB.paralelo}`;
      equiposCount[key] = (equiposCount[key] || 0) + 1;
    });
    
    const duplicados = Object.entries(equiposCount).filter(([key, count]) => count > 1);
    if (duplicados.length > 0) {
      console.warn("⚠️ Se encontraron partidos duplicados:", duplicados);
    }

    setAvailableMatches(available);
    setSelectedSlot({ dia, hora });
    setShowAvailableMatches(true);
  };

  // Función para asignar un partido al slot seleccionado
  const assignMatchToSlot = async (match) => {
    console.log("🎯 Función assignMatchToSlot ejecutada para partido:", match.id);
    console.log("🎯 Detalles del partido:", {
      id: match.id,
      equipoA: match.equipoA,
      equipoB: match.equipoB,
      disciplina: match.disciplina,
      estado: match.estado
    });
    
    if (isAssigning) {
      console.log("⚠️ Ya se está asignando un partido, ignorando");
      return;
    }
    
    if (!selectedSlot) {
      console.log("❌ No hay slot seleccionado");
      return;
    }

    try {
      setIsAssigning(true);
      console.log(`📝 Asignando partido ${match.id} a ${selectedSlot.dia} ${selectedSlot.hora}`);
      console.log("📝 Estado antes de la actualización:", {
        matchesCount: matches.length,
        matchesWithSameTeams: matches.filter(m => 
          m.equipoA.curso === match.equipoA.curso && 
          m.equipoA.paralelo === match.equipoA.paralelo &&
          m.equipoB.curso === match.equipoB.curso && 
          m.equipoB.paralelo === match.equipoB.paralelo
        ).length
      });
      
      await updateDoc(doc(db, "matches", match.id), {
        fecha: selectedSlot.dia,
        hora: selectedSlot.hora,
        semana: currentWeek,
        estado: "programado"
      });

      console.log("✅ Partido asignado exitosamente en Firebase");
      showToast(`Partido asignado a ${selectedSlot.dia} ${selectedSlot.hora}`, "success");

      // Actualizar el estado local inmediatamente
      const updatedMatch = {
        ...match,
        fecha: selectedSlot.dia,
        hora: selectedSlot.hora,
        semana: currentWeek,
        estado: "programado"
      };

      // Actualizar la lista de partidos
      setMatches(prevMatches => {
        const newMatches = prevMatches.map(m => m.id === match.id ? updatedMatch : m);
        console.log("🔄 Actualizando matches localmente:", newMatches.find(m => m.id === match.id));
        return newMatches;
      });

      // Actualizar horariosPorDia directamente para respuesta inmediata
      setHorariosPorDia(prevHorarios => {
        const newHorarios = { ...prevHorarios };
        if (!newHorarios[selectedSlot.dia]) {
          newHorarios[selectedSlot.dia] = {};
        }
        newHorarios[selectedSlot.dia][selectedSlot.hora] = updatedMatch;
        console.log("🔄 Actualizando horariosPorDia directamente:", newHorarios);
        return newHorarios;
      });

      // Forzar actualización de horarios
      setTimeout(() => {
        console.log("🔄 Forzando reorganización de horarios");
        setFilteredMatches(prevFiltered => [...prevFiltered]);
      }, 100);

      // Cerrar modal y limpiar estados
      setShowAvailableMatches(false);
      setSelectedSlot(null);
      setAvailableMatches([]);
      clearSearch();
    } catch (error) {
      console.error("❌ Error asignando partido:", error);
      showToast("Error al asignar el partido", "error");
    } finally {
      setIsAssigning(false);
    }
  };

  // Función para eliminar horarios asignados
  const eliminarHorariosAsignados = async () => {
    const confirmMessage = `¿Estás seguro de que deseas eliminar TODOS los horarios asignados?

⚠️ Esta acción:
• Eliminará fechas y horas de todos los partidos programados
• Los partidos volverán al estado "pendiente"
• No se puede deshacer

¿Continuar?`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      console.log("🗑️ Iniciando eliminación de horarios asignados");
      
      // Buscar todos los partidos programados de esta disciplina
      const q = query(
        collection(db, "matches"),
        where("disciplina", "==", discipline),
        where("estado", "==", "programado")
      );
      
      const snapshot = await getDocs(q);
      const partidosProgramados = snapshot.docs;

      if (partidosProgramados.length === 0) {
        showToast("No hay partidos programados para eliminar", "info");
        return;
      }

      console.log(`📊 Encontrados ${partidosProgramados.length} partidos programados`);

      // Eliminar horarios de todos los partidos programados
      const batchPromises = partidosProgramados.map(doc => 
        updateDoc(doc.ref, {
          fecha: null,
          hora: null,
          semana: null,
          estado: "pendiente"
        })
      );

      await Promise.all(batchPromises);

      console.log("✅ Horarios eliminados exitosamente");
      showToast(`${partidosProgramados.length} horarios eliminados exitosamente`, "success");

      // Limpiar estados locales
      setHorariosPorDia({});
      setWeeklySchedules({});
      setSelectedMatches(new Set());

    } catch (error) {
      console.error("❌ Error eliminando horarios:", error);
      showToast("Error al eliminar horarios", "error");
    }
  };
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

      {/* Filtros */}
      <div className="filters-container">
        <h3>📊 Filtros:</h3>

        <div className="filters-row">
          <div className="filter-group">
            <label>🚻 Género:</label>
            <select
              value={filtroGenero}
              onChange={(e) => setFiltroGenero(e.target.value)}
              className="filter-select"
            >
              <option value="">Todos los géneros</option>
              {generosDisponibles.map((genero) => (
                <option key={genero} value={genero}>
                  {genero}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>🎓 Nivel:</label>
            <select
              value={filtroNivelEducacional}
              onChange={(e) => setFiltroNivelEducacional(e.target.value)}
              className="filter-select"
              disabled={!filtroGenero}
            >
              <option value="">Todos los niveles</option>
              {nivelesDisponibles.map((nivel) => (
                <option key={nivel} value={nivel}>
                  {nivel}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>🏷️ Categoría:</label>
            <select
              value={filtroCategoria}
              onChange={(e) => setFiltroCategoria(e.target.value)}
              className="filter-select"
              disabled={!filtroNivelEducacional}
            >
              <option value="">Todas las categorías</option>
              {categoriasDisponibles.map((categoria) => (
                <option key={categoria} value={categoria}>
                  {categoria}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>🏆 Fase:</label>
            <select
              value={faseActiva}
              onChange={(e) => setFaseActiva(e.target.value)}
              className="filter-select"
            >
              <option value="todas">Todas las fases</option>
              <option value="grupos1">Fase de Grupos 1</option>
              <option value="grupos3">Posicionamiento</option>
              <option value="semifinal">Semifinales</option>
              <option value="final">Finales</option>
              <option value="ida_vuelta">Ida y Vuelta</option>
            </select>
          </div>

          <button
            onClick={limpiarFiltros}
            className="clear-filters-btn"
            title="Limpiar todos los filtros"
          >
            🗑️ Limpiar
          </button>

          <button
            onClick={openConfigModal}
            className="config-olympics-btn"
            title="Configurar Olimpiadas"
          >
            ⚙️ Configurar Olimpiadas
          </button>
        </div>
      </div>

      {/* Configuración de Cronograma */}
      <div className="schedule-config-container">
        <h3>⚙️ Configuración del Cronograma:</h3>

        <div className="config-row">
          <div className="config-group">
            <label>📅 Día de inicio de la semana:</label>
            <select
              value={startDay}
              onChange={(e) => updateStartDay(e.target.value)}
              className="config-select"
            >
              {diasLaborables.map((dia) => (
                <option key={dia} value={dia}>
                  {dia.charAt(0).toUpperCase() + dia.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div className="config-group">
            <label>🏐 Día para Vóley:</label>
            <select
              value={disciplineConfig.voley}
              onChange={(e) => {
                const newConfig = { ...disciplineConfig, voley: e.target.value };
                updateDisciplineConfig(newConfig);
              }}
              className="config-select"
            >
              <option value="ninguno">No programar</option>
              {diasLaborables.map((dia) => (
                <option key={dia} value={dia} disabled={disciplineConfig.basquet === dia}>
                  {dia.charAt(0).toUpperCase() + dia.slice(1)}
                  {disciplineConfig.basquet === dia ? ' (ocupado por básquet)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="config-group">
            <label>🏀 Día para Básquet:</label>
            <select
              value={disciplineConfig.basquet}
              onChange={(e) => {
                const newConfig = { ...disciplineConfig, basquet: e.target.value };
                updateDisciplineConfig(newConfig);
              }}
              className="config-select"
            >
              <option value="ninguno">No programar</option>
              {diasLaborables.map((dia) => (
                <option key={dia} value={dia} disabled={disciplineConfig.voley === dia}>
                  {dia.charAt(0).toUpperCase() + dia.slice(1)}
                  {disciplineConfig.voley === dia ? ' (ocupado por vóley)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="discipline-schedule-preview">
          <h4>📋 Vista previa de la programación semanal:</h4>
          <div className="weekly-preview">
            {getOrderedDays().map(dia => {
              const disciplines = getDisciplineForDay(dia);
              return (
                <div key={dia} className="day-preview">
                  <span className="day-name">{dia.charAt(0).toUpperCase() + dia.slice(1)}</span>
                  <div className="day-disciplines">
                    {disciplines.map(discipline => (
                      <span key={discipline} className={`discipline-badge ${discipline}`}>
                        {discipline === 'futbol' ? '⚽' : discipline === 'voley' ? '🏐' : '🏀'}
                        {discipline.charAt(0).toUpperCase() + discipline.slice(1)}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="validation-status">
            {disciplineConfig.voley === disciplineConfig.basquet && disciplineConfig.voley !== 'ninguno' ? (
              <div className="validation-error">
                ❌ Error: Vóley y Básquet no pueden programarse el mismo día
              </div>
            ) : (
              <div className="validation-success">
                ✅ Configuración válida - Vóley y Básquet en días diferentes
              </div>
            )}
          </div>

          <div className="rotation-explanation">
            <h4>🔄 Rotación Progresiva por Disciplina:</h4>
            <div className="rotation-info">
              <div className="rotation-discipline">
                <span className="discipline-badge futbol">⚽ Fútbol</span>
                <span className="rotation-pattern">Todos los días (sin rotación)</span>
              </div>

              {disciplineConfig.voley !== 'ninguno' && (
                <div className="rotation-discipline">
                  <span className="discipline-badge voley">🏐 Vóley</span>
                  <span className="rotation-pattern">
                    {(() => {
                      const availableDays = getAvailableDaysForDiscipline('voley');
                      return availableDays.length > 0
                        ? `${availableDays.join(' → ')} → (repite ciclo)`
                        : 'No configurado';
                    })()}
                  </span>
                </div>
              )}

              {disciplineConfig.basquet !== 'ninguno' && (
                <div className="rotation-discipline">
                  <span className="discipline-badge basquet">🏀 Básquet</span>
                  <span className="rotation-pattern">
                    {(() => {
                      const availableDays = getAvailableDaysForDiscipline('basquet');
                      return availableDays.length > 0
                        ? `${availableDays.join(' → ')} → (repite ciclo)`
                        : 'No configurado';
                    })()}
                  </span>
                </div>
              )}
            </div>

            <div className="rotation-note">
              <strong>💡 Cómo funciona la rotación:</strong> Los partidos se asignan llenando
              completamente todos los horarios de un día antes de pasar al siguiente. Por ejemplo,
              si vóley está configurado para Lunes-Miércoles-Viernes:
              <br/>
              <strong>Paso 1:</strong> Se llenan TODOS los horarios del Lunes con partidos de vóley
              <br/>
              <strong>Paso 2:</strong> Se llenan TODOS los horarios del Miércoles con los siguientes partidos de vóley
              <br/>
              <strong>Paso 3:</strong> Se llenan TODOS los horarios del Viernes, y así sucesivamente.
            </div>
          </div>
        </div>
      </div>

      {/* Navegación por Semanas */}
      {totalWeeks > 1 && (
        <div className="week-navigation">
          <div className="week-navigation-header">
            <h3>📅 Navegación por Semanas</h3>
            <div className="week-summary">
              Total: {totalWeeks} semana{totalWeeks > 1 ? 's' : ''}
            </div>
          </div>

          <div className="week-controls">
            <button
              className="week-nav-btn prev-btn"
              onClick={goToPreviousWeek}
              disabled={currentWeek === 1}
              title="Semana anterior"
            >
              ← Anterior
            </button>

            <div className="week-selector">
              <select
                value={currentWeek}
                onChange={(e) => goToWeek(parseInt(e.target.value))}
                className="week-select"
              >
                {Array.from({ length: totalWeeks }, (_, i) => i + 1).map(week => (
                  <option key={week} value={week}>
                    {getWeekLabel(week)}
                  </option>
                ))}
              </select>
            </div>

            <button
              className="week-nav-btn next-btn"
              onClick={goToNextWeek}
              disabled={currentWeek === totalWeeks}
              title="Siguiente semana"
            >
              Siguiente →
            </button>
          </div>

          <div className="week-tabs">
            {Array.from({ length: Math.min(totalWeeks, 10) }, (_, i) => {
              const week = i + 1;
              if (totalWeeks <= 10) {
                return (
                  <button
                    key={week}
                    className={`week-tab ${currentWeek === week ? 'active' : ''}`}
                    onClick={() => goToWeek(week)}
                  >
                    S{week}
                  </button>
                );
              }
              return null;
            })}

            {totalWeeks > 10 && (
              <div className="week-indicator">
                Semana {currentWeek} de {totalWeeks}
              </div>
            )}
          </div>

          <div className="week-info">
            <div className="current-week-info">
              <span className="week-label">📍 {getWeekLabel(currentWeek)}</span>
              <span className="week-stats">
                {Object.values(horariosPorDia).reduce((total, dia) =>
                  total + Object.values(dia).filter(partido => partido !== null).length, 0
                )} partidos programados
              </span>
            </div>
          </div>
        </div>
      )}

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
        
        <div className="admin-controls">
          <button
            className="clear-schedules-btn"
            onClick={eliminarHorariosAsignados}
            title="Eliminar todos los horarios asignados"
          >
            <span className="btn-icon">🗑️</span>
            Limpiar Horarios
          </button>
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
      ) : filteredMatches.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📅</div>
          <h3>No hay partidos pendientes</h3>
          <p>Todos los partidos han sido programados o finalizados</p>
        </div>
      ) : (
        <div className="horarios-grid">
          {getOrderedDays().map(dia => {
            const allowedDisciplines = getDisciplineForDay(dia);
            return (
              <div key={dia} className="dia-column">
                <div className="dia-header">
                  <h3 className="dia-title">
                    <span className="dia-icon">📅</span>
                    {dia.charAt(0).toUpperCase() + dia.slice(1)}
                  </h3>
                  <div className="allowed-disciplines">
                    {allowedDisciplines.map(discipline => (
                      <span key={discipline} className={`discipline-icon ${discipline}`}>
                        {discipline === 'futbol' ? '⚽' : discipline === 'voley' ? '🏐' : '🏀'}
                      </span>
                    ))}
                  </div>
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
                          <div 
                            className="slot-vacio"
                            onClick={() => handleEmptySlotClick(dia, hora)}
                            style={{ cursor: 'pointer' }}
                            title="Haz clic para ver partidos disponibles"
                          >
                            <span className="vacio-text">Libre</span>
                            <span className="drop-hint">Clic para agregar</span>
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

      {/* Modal de Partidos Disponibles */}
      {showAvailableMatches && selectedSlot && (
        <div 
          className="modal-backdrop"
          onPointerDown={(e) => {
            console.log("🖱️ Click en backdrop del modal");
            if (e.target === e.currentTarget) {
              console.log("🚪 Cerrando modal desde backdrop");
              setShowAvailableMatches(false);
              setSelectedSlot(null);
              setAvailableMatches([]);
              clearSearch();
            }
          }}
        >
          <div 
            className="modal-content"
            onPointerDown={(e) => {
              console.log("🖱️ Click en contenido del modal");
              e.stopPropagation();
            }}
          >
            <div className="modal-header">
              <div className="header-info">
                <h3>Partidos Disponibles</h3>
                <p className="slot-info">
                  📅 {selectedSlot.dia.charAt(0).toUpperCase() + selectedSlot.dia.slice(1)} - 🕒 {selectedSlot.hora}
                </p>
              </div>
              <button 
                className="close-button"
                type="button"
                onPointerDown={(e) => {
                  console.log("❌ Click en botón cerrar");
                  e.stopPropagation();
                  setShowAvailableMatches(false);
                  setSelectedSlot(null);
                  setAvailableMatches([]);
                  clearSearch();
                }}
              >
                ✕
              </button>
            </div>

            {/* Barra de Búsqueda */}
            <div className="modal-search">
              <div className="search-container">
                <div className="search-input-wrapper">
                  <span className="search-icon">🔍</span>
                  <input
                    type="text"
                    placeholder="Buscar partidos por equipo, disciplina, género, categoría..."
                    value={searchTerm}
                    onChange={(e) => {
                      console.log("� Buscando:", e.target.value);
                      setSearchTerm(e.target.value);
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    className="search-input"
                  />
                  {searchTerm && (
                    <button
                      className="clear-search-btn"
                      type="button"
                      onPointerDown={(e) => {
                        console.log("❌ Limpiando búsqueda");
                        e.stopPropagation();
                        clearSearch();
                      }}
                    >
                      ❌
                    </button>
                  )}
                </div>
              </div>
            </div>
            
            <div className="modal-body">
              {(() => {
                console.log("🔄 Renderizando modal body");
                console.log("   - availableMatches:", availableMatches.length);
                console.log("   - searchTerm:", searchTerm);
                
                const filteredMatches = filterAvailableMatches(availableMatches);
                console.log("   - filteredMatches:", filteredMatches.length);
                console.log("   - filteredMatches detalle:", filteredMatches);
                
                return filteredMatches.length === 0 ? (
                  <div className="no-matches">
                    {availableMatches.length === 0 ? (
                      <>
                        <p>😔 No hay partidos disponibles para este horario</p>
                        <p className="hint">
                          Disciplinas permitidas en {selectedSlot.dia}: {getDisciplinesForDay(selectedSlot.dia).join(', ')}
                        </p>
                      </>
                    ) : (
                      <>
                        <p>🔍 No hay partidos que coincidan con los filtros aplicados</p>
                        <p className="hint">
                          Prueba ajustando o limpiando los filtros para ver más partidos
                        </p>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="matches-grid">
                    {filteredMatches.map(match => (
                      <div
                        key={match.id}
                        className="match-card"
                        onPointerDown={(e) => {
                          console.log("🎯 Click en partido:", match.id);
                          console.log("🎯 Event target:", e.target);
                          console.log("🎯 Current target:", e.currentTarget);
                          e.stopPropagation();
                          e.preventDefault();
                          
                          // Prevenir múltiples clicks
                          if (e.currentTarget.dataset.processing === 'true') {
                            console.log("⚠️ Ya se está procesando este click, ignorando");
                            return;
                          }
                          
                          e.currentTarget.dataset.processing = 'true';
                          
                          assignMatchToSlot(match).finally(() => {
                            // Limpiar el flag después de un pequeño delay
                            setTimeout(() => {
                              if (e.currentTarget) {
                                e.currentTarget.dataset.processing = 'false';
                              }
                            }, 1000);
                          });
                        }}
                      >
                        <div className="match-header">
                          <div
                            className="fase-badge"
                            style={{ backgroundColor: getTipoFase(match).color }}
                          >
                            <span className="fase-icon">{getTipoFase(match).icon}</span>
                            <span className="fase-text">{getTipoFase(match).tipo}</span>
                          </div>
                          <div className="disciplina-badge">
                            {match.disciplina === 'futbol' ? '⚽' : match.disciplina === 'voley' ? '🏐' : '🏀'}
                            {match.disciplina}
                          </div>
                        </div>

                        <div className="match-teams">
                          <div className="team">
                            <span className="team-icon">🏫</span>
                            <span className="team-name">
                              {match.equipoA.curso} {match.equipoA.paralelo}
                            </span>
                          </div>
                          <div className="vs-divider">VS</div>
                          <div className="team">
                            <span className="team-icon">🏫</span>
                            <span className="team-name">
                              {match.equipoB.curso} {match.equipoB.paralelo}
                            </span>
                          </div>
                        </div>

                        <div className="match-details">
                          <div className="detail-item">
                            <span className="detail-icon">🏆</span>
                            <span>{match.grupo || match.categoria}</span>
                          </div>
                          <div className="detail-item">
                            <span className="detail-icon">🚻</span>
                            <span>{match.genero}</span>
                          </div>
                          <div className="detail-item">
                            <span className="detail-icon">🎓</span>
                            <span>{match.nivelEducacional}</span>
                          </div>
                        </div>

                        <div className="assign-button">
                          <span>📌 Asignar a este horario</span>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Componente de Configuración de Olimpiadas */}
      <OlympicsConfig
        isOpen={showConfigModal}
        onClose={closeConfigModal}
        olympicsWeeks={olympicsWeeks}
        customTimes={customTimes}
        onUpdateWeeks={updateOlympicsWeeks}
        onUpdateTimes={updateCustomTimes}
      />
      <ToastContainer />
    </div>
  );
}
