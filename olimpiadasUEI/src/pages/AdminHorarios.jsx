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

  // Estados para navegación por semanas
  const [currentWeek, setCurrentWeek] = useState(1);
  const [totalWeeks, setTotalWeeks] = useState(1);
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

  // Funciones para navegación de semanas
  const calculateTotalWeeks = (matches) => {
    if (matches.length === 0) return 1;

    // Calcular partidos únicos (sin considerar los ya programados)
    const partidosPendientes = matches.filter(m => !m.fecha || !m.hora);
    const partidosProgramados = matches.filter(m => m.fecha && m.hora);

    // Capacidad por semana: 5 días × horarios × equipos únicos por día
    const slotsPerWeek = diasLaborables.length * horariosDisponibles.length;
    const equiposUnicos = new Set();

    matches.forEach(match => {
      const equipoA = `${match.equipoA.curso}_${match.equipoA.paralelo}`;
      const equipoB = `${match.equipoB.curso}_${match.equipoB.paralelo}`;
      equiposUnicos.add(equipoA);
      equiposUnicos.add(equipoB);
    });

    // Estimar partidos por semana considerando la restricción de un equipo por día
    const maxPartidosPorSemana = Math.min(slotsPerWeek, Math.floor(equiposUnicos.size / 2) * diasLaborables.length);
    const weeksNeeded = Math.ceil(matches.length / maxPartidosPorSemana);

    return Math.max(1, weeksNeeded);
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
  const getDisciplineForDay = (dayName) => {
    const disciplines = ['futbol']; // Fútbol siempre se juega

    // Verificar qué otras disciplinas se juegan ese día
    if (disciplineConfig.voley === dayName) {
      disciplines.push('voley');
    }
    if (disciplineConfig.basquet === dayName) {
      disciplines.push('basquet');
    }

    return disciplines;
  };

  const validateDisciplineAssignment = (partido, dia) => {
    const allowedDisciplines = getDisciplineForDay(dia);

    if (!allowedDisciplines.includes(partido.disciplina)) {
      return {
        valid: false,
        message: `${partido.disciplina} no está programado para ${dia}. Disciplinas permitidas: ${allowedDisciplines.join(', ')}`
      };
    }

    return { valid: true };
  };

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
    const startIndex = diasLaborables.indexOf(startDay);
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

  // Funciones de filtros
  const limpiarFiltros = () => {
    setFiltroGenero("");
    setFiltroNivelEducacional("");
    setFiltroCategoria("");
    setFaseActiva("todas");

    localStorage.removeItem(`olimpiadas_horarios_filtro_genero_${discipline}`);
    localStorage.removeItem(`olimpiadas_horarios_filtro_nivel_educacional_${discipline}`);
    localStorage.removeItem(`olimpiadas_horarios_filtro_categoria_${discipline}`);
    localStorage.removeItem(`olimpiadas_horarios_fase_activa_${discipline}`);
  };

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

  // Extraer opciones únicas para filtros
  const generosDisponibles = [...new Set(equipos.map(eq => eq.genero).filter(Boolean))];
  const nivelesDisponibles = filtroGenero
    ? [...new Set(equipos.filter(eq => eq.genero === filtroGenero).map(eq => eq.nivelEducacional).filter(Boolean))]
    : [...new Set(equipos.map(eq => eq.nivelEducacional).filter(Boolean))];
  const categoriasDisponibles = filtroNivelEducacional
    ? [...new Set(equipos.filter(eq => eq.genero === filtroGenero && eq.nivelEducacional === filtroNivelEducacional).map(eq => eq.categoria).filter(Boolean))]
    : filtroGenero
    ? [...new Set(equipos.filter(eq => eq.genero === filtroGenero).map(eq => eq.categoria).filter(Boolean))]
    : [...new Set(equipos.map(eq => eq.categoria).filter(Boolean))];

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

    // Validar que la disciplina puede jugar en este día
    const disciplineValidation = validateDisciplineAssignment(draggedMatch, targetDia);
    if (!disciplineValidation.valid) {
      alert(disciplineValidation.message);
      setDraggedMatch(null);
      return;
    }

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
          semana: currentWeek,
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
    </div>
  );
}
