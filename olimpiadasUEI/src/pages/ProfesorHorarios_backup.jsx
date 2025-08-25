import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  query,
  where,
  onSnapshot,
  updateDoc,
  doc,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { useParams, useNavigate } from "react-router-dom";
import "../styles/ProfesorHorarios.css";
import Loading from "../components/Loading";
import Toast from "../components/Toast";

export default function ProfesorHorarios() {
  const { discipline } = useParams();
  const navigate = useNavigate();
  
  // Estados principales
  const [matches, setMatches] = useState([]);
  const [horariosPorDia, setHorariosPorDia] = useState({});
  const [loading, setLoading] = useState(true);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState("success");
  
  // Estados para búsqueda
  const [searchTerm, setSearchTerm] = useState('');
  
  // Estados para gestión manual de horarios
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [showAvailableMatches, setShowAvailableMatches] = useState(false);
  const [availableMatches, setAvailableMatches] = useState([]);
  const [draggedMatch, setDraggedMatch] = useState(null);
  const [assigningMatch, setAssigningMatch] = useState(false); // Estado para prevenir asignaciones múltiples
  
  // Estados para navegación por semanas
  const [currentWeek, setCurrentWeek] = useState(1);
  const [totalWeeks, setTotalWeeks] = useState(() => {
    const saved = localStorage.getItem('olimpiadas_weeks_count');
    return saved ? parseInt(saved) : 4;
  });
  const [weeklySchedules, setWeeklySchedules] = useState({});

  // Estados para configuración de tiempo personalizada
  const [customTimes, setCustomTimes] = useState(() => {
    const saved = localStorage.getItem('olimpiadas_custom_times');
    return saved ? JSON.parse(saved) : [
      '07:05', '07:50', '08:35', '09:20', '10:05', '10:50',
      '11:35', '12:20', '13:00'
    ];
  });

  // Estados para configuración de disciplinas
  const [disciplineConfig, setDisciplineConfig] = useState(() => {
    const saved = localStorage.getItem(`olimpiadas_horarios_discipline_config_${discipline}`);
    return saved ? JSON.parse(saved) : {
      futbol: 'todos',
      voley: 'miercoles',
      basquet: 'martes'
    };
  });

  const [startDay, setStartDay] = useState(() => {
    return localStorage.getItem(`olimpiadas_horarios_start_day_${discipline}`) || 'lunes';
  });

  const [olympicsWeeks, setOlympicsWeeks] = useState(() => {
    const saved = localStorage.getItem('olimpiadas_weeks_count');
    return saved ? parseInt(saved) : 4;
  });

  // Configuración de disciplinas con colores
  const disciplinasConfig = {
    futbol: { nombre: 'Fútbol', color: '#4CAF50', icon: '⚽' },
    voley: { nombre: 'Vóley', color: '#2196F3', icon: '🏐' },
    basquet: { nombre: 'Básquet', color: '#FF9800', icon: '🏀' }
  };

  // Función para mostrar toast
  const showToastMessage = (message, type = "success") => {
    setToastMessage(message);
    setToastType(type);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

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
    navigate(`/profesor/${discipline}/equipos`);
  };

  const goToMatches = () => {
    navigate(`/profesor/${discipline}/partidos`);
  };

  const goToStandings = () => {
    navigate(`/profesor/${discipline}/posiciones`);
  };

  const goToHome = () => {
    navigate(`/profesor/${discipline}`);
  };

  // Días laborables de la semana
  const diasLaborables = [
    'lunes',
    'martes', 
    'miércoles',
    'jueves',
    'viernes'
  ];

  // Sincronizar totalWeeks con olympicsWeeks al inicio
  useEffect(() => {
    setTotalWeeks(olympicsWeeks);
  }, [olympicsWeeks]);

  // Funciones para navegación de semanas
  const calculateTotalWeeks = (matches) => {
    // Usar la configuración de semanas de olimpiadas
    return olympicsWeeks;
  };

  const nextWeek = () => {
    if (currentWeek < totalWeeks) {
      setCurrentWeek(currentWeek + 1);
    }
  };

  const prevWeek = () => {
    if (currentWeek > 1) {
      setCurrentWeek(currentWeek - 1);
    }
  };

  const getOrderedDays = () => {
    // Rotar columnas para comenzar por el primer día que tenga algún partido programado en la semana actual
    const semana = weeklySchedule[`semana_${currentWeek}`] || horariosPorDia || {};
    const hasPartidos = (dia) => {
      const diaObj = semana[dia] || {};
      if (diaObj.partidos) {
        return Object.values(diaObj.partidos).some(horas => Object.values(horas).some(p => !!p));
      }
      return Object.values(diaObj).some(p => !!p);
    };
    let startIndex = diasLaborables.findIndex(d => hasPartidos(d));
    if (startIndex === -1) startIndex = 0;
    return [
      ...diasLaborables.slice(startIndex),
      ...diasLaborables.slice(0, startIndex)
    ];
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
        
        // Deduplicar por ID para evitar duplicados
        const uniqueMatches = data.reduce((acc, match) => {
          const existingIndex = acc.findIndex(m => m.id === match.id);
          if (existingIndex === -1) {
            acc.push(match);
          } else {
            // Si existe, usar la versión más reciente
            acc[existingIndex] = match;
          }
          return acc;
        }, []);
        
        console.log("📊 Total partidos únicos cargados desde Firebase:", uniqueMatches.length);
        
        setMatches(uniqueMatches);
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

    // Deduplicar partidos filtrados para evitar duplicados en la visualización
    const uniqueFiltered = filtered.reduce((acc, partido) => {
      const existingIndex = acc.findIndex(p => p.id === partido.id);
      if (existingIndex === -1) {
        acc.push(partido);
      } else {
        // Mantener la versión más reciente
        acc[existingIndex] = partido;
      }
      return acc;
    }, []);

    console.log("🔍 Partidos después de filtros:", filtered.length);
    console.log("🔍 Partidos únicos después de deduplicación:", uniqueFiltered.length);

    setFilteredMatches(uniqueFiltered);
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

    // Colocar partidos que ya tienen fecha y hora asignada
    filteredMatches.forEach(partido => {
      if (partido.fecha && partido.hora && partido.semana) {
        const dia = partido.fecha;
        const hora = partido.hora;
        const semana = partido.semana;

        if (allWeeklySchedules[semana] && allWeeklySchedules[semana][dia] &&
            allWeeklySchedules[semana][dia][hora] !== undefined) {
          
          // Verificar si ya hay un partido en este slot
          if (allWeeklySchedules[semana][dia][hora] !== null) {
            console.warn(`⚠️ Slot ${dia} ${hora} semana ${semana} ya ocupado por partido ${allWeeklySchedules[semana][dia][hora].id}, se sobrescribe con partido ${partido.id}`);
          }
          
          allWeeklySchedules[semana][dia][hora] = {
            ...partido,
            diaAsignado: dia,
            horaAsignada: hora,
            semanaAsignada: semana
          };
          
          console.log(`📅 Partido ${partido.id} asignado a ${dia} ${hora} semana ${semana}`);
        }
      }
    });

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
    } else {
      setHorariosPorDia({});
    }
  }, [currentWeek, weeklySchedules]);

  // Actualizar opciones de filtros dinámicos
  useEffect(() => {
    if (equipos.length === 0) return;

    // Obtener géneros únicos
    const generos = [...new Set(equipos.map(eq => eq.genero).filter(Boolean))].sort();
    setGenerosDisponibles(generos);

    // Obtener niveles educacionales únicos
    const niveles = [...new Set(equipos.map(eq => eq.nivelEducacional).filter(Boolean))].sort();
    setNivelesDisponibles(niveles);

    // Obtener categorías únicas
    const categorias = [...new Set(equipos.map(eq => eq.categoria).filter(Boolean))].sort();
    setCategoriasDisponibles(categorias);
  }, [equipos]);

  // Guardar filtros en localStorage cuando cambien
  useEffect(() => {
    localStorage.setItem(`olimpiadas_horarios_filtro_genero_${discipline}`, filtroGenero);
  }, [filtroGenero, discipline]);

  useEffect(() => {
    localStorage.setItem(`olimpiadas_horarios_filtro_nivel_educacional_${discipline}`, filtroNivelEducacional);
  }, [filtroNivelEducacional, discipline]);

  useEffect(() => {
    localStorage.setItem(`olimpiadas_horarios_filtro_categoria_${discipline}`, filtroCategoria);
  }, [filtroCategoria, discipline]);

  useEffect(() => {
    localStorage.setItem(`olimpiadas_horarios_fase_activa_${discipline}`, faseActiva);
  }, [faseActiva, discipline]);

  // Funciones para gestión manual de horarios
  
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
      console.log(`   - Equipos: ${match.equipoA?.curso}${match.equipoA?.paralelo} vs ${match.equipoB?.curso}${match.equipoB?.paralelo}`);
      
      // Verificar que el partido tenga equipos válidos
      if (!match.equipoA || !match.equipoB || !match.equipoA.curso || !match.equipoB.curso) {
        console.log(`   ❌ Partido sin equipos válidos`);
        return false;
      }
      
      // Solo mostrar partidos sin horario asignado (pendientes o sin fecha/hora)
      const sinHorario = match.estado === 'pendiente' || !match.fecha || !match.hora || match.fecha === null || match.hora === null;
      console.log(`   - Sin horario: ${sinHorario}`);
      if (!sinHorario) return false;
      
      // Verificar si la disciplina del partido está permitida en este día
      const disciplinaPermitida = allowedDisciplines.includes(match.disciplina);
      console.log(`   - Disciplina permitida: ${disciplinaPermitida}`);
      if (!disciplinaPermitida) return false;
      
      console.log(`   ✅ Partido incluido`);
      return true;
    });

    console.log("🎯 Partidos disponibles (antes de deduplicación):", available.length);
    
    // Eliminar duplicados más estrictamente
    const uniqueMatches = [];
    const seenKeys = new Set();
    
    available.forEach(match => {
      // Crear múltiples claves para detectar duplicados
      const equipoKey1 = `${match.equipoA.curso}${match.equipoA.paralelo}-vs-${match.equipoB.curso}${match.equipoB.paralelo}`;
      const equipoKey2 = `${match.equipoB.curso}${match.equipoB.paralelo}-vs-${match.equipoA.curso}${match.equipoA.paralelo}`;
      const idKey = match.id;
      
      // Verificar si ya existe por cualquier clave
      const alreadyExists = seenKeys.has(equipoKey1) || seenKeys.has(equipoKey2) || seenKeys.has(idKey);
      
      if (!alreadyExists) {
        seenKeys.add(equipoKey1);
        seenKeys.add(equipoKey2);
        seenKeys.add(idKey);
        uniqueMatches.push(match);
        console.log(`✅ Partido único agregado: ${equipoKey1} (ID: ${match.id})`);
      } else {
        console.log(`⚠️ Partido duplicado omitido: ${equipoKey1} (ID: ${match.id})`);
      }
    });

    console.log("🎯 Partidos únicos disponibles:", uniqueMatches.length);
    console.log("📋 Detalles de partidos únicos:", uniqueMatches.map(m => ({
      id: m.id,
      equipos: `${m.equipoA?.curso}${m.equipoA?.paralelo} vs ${m.equipoB?.curso}${m.equipoB?.paralelo}`,
      disciplina: m.disciplina
    })));

    setAvailableMatches(uniqueMatches);
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
    
    // Prevenir múltiples asignaciones
    if (assigningMatch) {
      console.log("⚠️ Ya hay una asignación en proceso, cancelando...");
      return;
    }
    
    if (!selectedSlot) {
      console.log("❌ No hay slot seleccionado");
      return;
    }

    // Verificar si el slot ya está ocupado
    if (horariosPorDia[selectedSlot.dia] && horariosPorDia[selectedSlot.dia][selectedSlot.hora]) {
      console.log("❌ El slot ya está ocupado");
      showToastMessage("Ya hay un partido programado en este horario", "error");
      return;
    }

    // Verificar si el partido ya tiene horario asignado
    if (match.fecha && match.hora) {
      console.log("❌ El partido ya tiene horario asignado");
      showToastMessage("Este partido ya tiene un horario asignado", "error");
      return;
    }

    // Verificar duplicados en la lista actual con múltiples criterios
    const equipoKey = `${match.equipoA.curso}${match.equipoA.paralelo}-vs-${match.equipoB.curso}${match.equipoB.paralelo}`;
    const equipoKeyReverse = `${match.equipoB.curso}${match.equipoB.paralelo}-vs-${match.equipoA.curso}${match.equipoA.paralelo}`;
    
    const partidosConMismosEquipos = matches.filter(m => {
      if (!m.fecha || !m.hora) return false; // Solo verificar partidos ya programados
      
      const key1 = `${m.equipoA?.curso}${m.equipoA?.paralelo}-vs-${m.equipoB?.curso}${m.equipoB?.paralelo}`;
      const key2 = `${m.equipoB?.curso}${m.equipoB?.paralelo}-vs-${m.equipoA?.curso}${m.equipoA?.paralelo}`;
      
      return (key1 === equipoKey || key1 === equipoKeyReverse || 
              key2 === equipoKey || key2 === equipoKeyReverse) && 
              m.id !== match.id; // Excluir el partido actual
    });

    if (partidosConMismosEquipos.length > 0) {
      console.log("❌ Ya existe un partido programado con estos equipos:", partidosConMismosEquipos);
      showToastMessage("Ya existe un partido programado con estos equipos", "error");
      return;
    }

    // Verificar que el partido no esté ya en el slot objetivo
    const existingPartido = horariosPorDia[selectedSlot.dia]?.[selectedSlot.hora];
    if (existingPartido && existingPartido.id === match.id) {
      console.log("❌ Este partido ya está asignado a este slot");
      showToastMessage("Este partido ya está asignado a este horario", "error");
      return;
    }

    setAssigningMatch(true);

    try {
      console.log(`📝 Asignando partido ${match.id} a ${selectedSlot.dia} ${selectedSlot.hora}`);
      
      await updateDoc(doc(db, "matches", match.id), {
        fecha: selectedSlot.dia,
        hora: selectedSlot.hora,
        semana: currentWeek,
        estado: "programado"
      });

      console.log("✅ Partido asignado exitosamente en Firebase");
      showToastMessage(`Partido asignado a ${selectedSlot.dia} ${selectedSlot.hora}`, "success");

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
        
        // Verificar que no haya otro partido ya asignado
        if (newHorarios[selectedSlot.dia][selectedSlot.hora] && 
            newHorarios[selectedSlot.dia][selectedSlot.hora].id !== match.id) {
          console.warn(`⚠️ Sobrescribiendo partido ${newHorarios[selectedSlot.dia][selectedSlot.hora].id} con ${match.id}`);
        }
        
        newHorarios[selectedSlot.dia][selectedSlot.hora] = updatedMatch;
        console.log("🔄 Actualizando horariosPorDia directamente:", newHorarios);
        return newHorarios;
      });

      // Actualizar la lista filtrada si existe
      setFilteredMatches(prevFiltered => {
        if (prevFiltered.length > 0) {
          return prevFiltered.map(m => m.id === match.id ? updatedMatch : m);
        }
        return prevFiltered;
      });

      // Cerrar modal y limpiar estados
      setShowAvailableMatches(false);
      setSelectedSlot(null);
      setAvailableMatches([]);
      clearSearch();
    } catch (error) {
      console.error("❌ Error asignando partido:", error);
      showToastMessage("Error al asignar el partido", "error");
    } finally {
      setAssigningMatch(false);
    }
  };

  // Función para remover un partido de su slot
  const removeMatchFromSlot = async (match) => {
    if (!window.confirm(`¿Estás seguro de que quieres remover este partido del horario?\n\n${match.equipoA.curso} ${match.equipoA.paralelo} vs ${match.equipoB.curso} ${match.equipoB.paralelo}`)) {
      return;
    }

    try {
      await updateDoc(doc(db, "matches", match.id), {
        fecha: null,
        hora: null,
        semana: null,
        estado: "pendiente"
      });

      showToastMessage("Partido removido del horario", "success");

      // Actualizar estado local
      setMatches(prevMatches => {
        return prevMatches.map(m => 
          m.id === match.id 
            ? { ...m, fecha: null, hora: null, semana: null, estado: "pendiente" }
            : m
        );
      });

      // Actualizar horariosPorDia
      setHorariosPorDia(prevHorarios => {
        const newHorarios = { ...prevHorarios };
        if (newHorarios[match.fecha] && newHorarios[match.fecha][match.hora]) {
          newHorarios[match.fecha][match.hora] = null;
        }
        return newHorarios;
      });

    } catch (error) {
      console.error("❌ Error removiendo partido:", error);
      showToastMessage("Error al remover el partido", "error");
    }
  };

  // Funciones para drag and drop
  const handleDragStart = (e, partido) => {
    setDraggedMatch(partido);
    e.dataTransfer.effectAllowed = 'move';
    console.log("🎯 Iniciando drag para partido:", partido.id);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e, dia, hora) => {
    e.preventDefault();
    
    if (!draggedMatch) return;

    // Verificar si la disciplina puede jugar en este día
    const allowedDisciplines = getDisciplinesForDay(dia);
    if (!allowedDisciplines.includes(draggedMatch.disciplina)) {
      showToastMessage(`${draggedMatch.disciplina} no puede jugar los ${dia}`, "error");
      setDraggedMatch(null);
      return;
    }

    // Verificar si ya hay un partido en este slot
    if (horariosPorDia[dia] && horariosPorDia[dia][hora]) {
      showToastMessage("Ya hay un partido programado en este horario", "error");
      setDraggedMatch(null);
      return;
    }

    try {
      console.log(`📝 Moviendo partido ${draggedMatch.id} a ${dia} ${hora}`);
      
      await updateDoc(doc(db, "matches", draggedMatch.id), {
        fecha: dia,
        hora: hora,
        semana: currentWeek,
        estado: "programado"
      });

      showToastMessage(`Partido movido a ${dia} ${hora}`, "success");

      // Actualizar estado local
      const updatedMatch = {
        ...draggedMatch,
        fecha: dia,
        hora: hora,
        semana: currentWeek,
        estado: "programado"
      };

      setMatches(prevMatches => {
        return prevMatches.map(m => 
          m.id === draggedMatch.id ? updatedMatch : m
        );
      });

      // Actualizar horariosPorDia
      setHorariosPorDia(prevHorarios => {
        const newHorarios = { ...prevHorarios };
        
        // Remover del slot anterior si existe
        if (draggedMatch.fecha && draggedMatch.hora) {
          if (newHorarios[draggedMatch.fecha] && newHorarios[draggedMatch.fecha][draggedMatch.hora]) {
            newHorarios[draggedMatch.fecha][draggedMatch.hora] = null;
          }
        }
        
        // Agregar al nuevo slot
        if (!newHorarios[dia]) {
          newHorarios[dia] = {};
        }
        newHorarios[dia][hora] = updatedMatch;
        
        return newHorarios;
      });

    } catch (error) {
      console.error("❌ Error moviendo partido:", error);
      showToastMessage("Error al mover el partido", "error");
    }
    
    setDraggedMatch(null);
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

  // Función para filtrar partidos disponibles con búsqueda
  const filterAvailableMatches = (matches) => {
    if (!searchTerm.trim()) return matches;
    
    const term = searchTerm.toLowerCase();
    return matches.filter(match => {
      // Buscar en equipos
      const equipoA = `${match.equipoA.curso} ${match.equipoA.paralelo}`.toLowerCase();
      const equipoB = `${match.equipoB.curso} ${match.equipoB.paralelo}`.toLowerCase();
      
      // Buscar en grupo
      const grupo = (match.grupo || '').toLowerCase();
      
      // Buscar en fase
      const fase = getTipoFase(match).tipo.toLowerCase();
      
      return equipoA.includes(term) || 
             equipoB.includes(term) || 
             grupo.includes(term) || 
             fase.includes(term);
    });
  };

  // Función para limpiar búsqueda
  const clearSearch = () => {
    console.log("🧹 Limpiando búsqueda");
    setSearchTerm('');
  };

  return (
    <div className="profesor-horarios-container">
      {loading && <Loading />}
      
      {showToast && (
        <Toast
          message={toastMessage}
          type={toastType}
          onClose={() => setShowToast(false)}
        />
      )}

      {/* Header */}
      <div className="profesor-header">
        <div className="header-icon">📅</div>
        <h1 className="profesor-title">Horarios - {disciplinasConfig[discipline]?.nombre}</h1>
        <p className="profesor-subtitle">Visualización de partidos programados</p>
      </div>

      {/* Navegación */}
      <div className="profesor-nav">
        <button onClick={goToHome} className="nav-btn">
          <span className="nav-icon">🏠</span>
          Inicio
        </button>
        <button onClick={goToMatches} className="nav-btn">
          <span className="nav-icon">⚽</span>
          Partidos
        </button>
        <button onClick={goToStandings} className="nav-btn">
          <span className="nav-icon">🏆</span>
          Posiciones
        </button>
        <button onClick={goToTeams} className="nav-btn">
          <span className="nav-icon">👥</span>
          Equipos
        </button>
      </div>

      {/* Navegación por semanas */}
      <div className="week-navigation">
        <button 
          onClick={prevWeek} 
          disabled={currentWeek === 1}
          className="week-btn"
        >
          ⬅️ Anterior
        </button>
        <span className="week-indicator">
          Semana {currentWeek} de {totalWeeks}
        </span>
        <button 
          onClick={nextWeek} 
          disabled={currentWeek === totalWeeks}
          className="week-btn"
        >
          Siguiente ➡️
        </button>
      </div>

      {/* Controles y filtros */}
      <div className="horarios-controls">
        {/* Barra de búsqueda */}
        <div className="search-section">
          <div className="search-input-container">
            <input
              type="text"
              className="search-input"
              placeholder="🔍 Buscar equipos, grupos, fases..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button
                className="clear-search-btn"
                onClick={clearSearch}
                title="Limpiar búsqueda"
              >
                ✕
              </button>
            )}
          </div>
          {searchTerm && (
            <div className="search-results-count">
              🔍 Mostrando resultados para: "{searchTerm}"
            </div>
          )}
        </div>

        {/* Filtros */}
        <div className="filters-section">
          <div className="filter-group">
            <label>Género:</label>
            <select
              value={filtroGenero}
              onChange={(e) => setFiltroGenero(e.target.value)}
              className="filter-select"
            >
              <option value="">Todos</option>
              {generosDisponibles.map(genero => (
                <option key={genero} value={genero}>{genero}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Nivel:</label>
            <select
              value={filtroNivelEducacional}
              onChange={(e) => setFiltroNivelEducacional(e.target.value)}
              className="filter-select"
            >
              <option value="">Todos</option>
              {nivelesDisponibles.map(nivel => (
                <option key={nivel} value={nivel}>{nivel}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Categoría:</label>
            <select
              value={filtroCategoria}
              onChange={(e) => setFiltroCategoria(e.target.value)}
              className="filter-select"
            >
              <option value="">Todas</option>
              {categoriasDisponibles.map(categoria => (
                <option key={categoria} value={categoria}>{categoria}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Fase:</label>
            <select
              value={faseActiva}
              onChange={(e) => setFaseActiva(e.target.value)}
              className="filter-select"
            >
              <option value="todas">Todas</option>
              <option value="grupos1">Fase de Grupos 1</option>
              <option value="grupos3">Posicionamiento</option>
              <option value="semifinal">Semifinales</option>
              <option value="final">Finales</option>
            </select>
          </div>
        </div>

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
            Partidos programados: {Object.values(horariosPorDia).reduce((total, dia) => {
              return total + Object.values(dia).filter(p => p !== null).length;
            }, 0)}
          </span>
          
          <button 
            className="refresh-btn"
            onClick={() => window.location.reload()}
            title="Recargar página para limpiar posibles duplicados"
          >
            🔄 Actualizar
          </button>
        </div>
      </div>

      {/* Grid de horarios */}
      <div className="horarios-grid">
        {getOrderedDays().map(dia => {
          const disciplinasPermitidas = getDisciplinesForDay(dia);
          const puedeJugar = disciplinasPermitidas.includes(discipline);
          
          return (
            <div key={dia} className="dia-column">
              <div className="dia-header">
                <h3 className="dia-title">
                  <span className="dia-icon">📅</span>
                  {dia.charAt(0).toUpperCase() + dia.slice(1)}
                </h3>
                <button 
                  className="confirm-day-btn"
                  disabled={true}
                  style={{
                    backgroundColor: puedeJugar ? '#28a745' : '#dc3545',
                    cursor: 'default'
                  }}
                >
                  <span className="btn-icon">
                    {puedeJugar ? '✅' : '❌'}
                  </span>
                  {puedeJugar ? 'Disponible' : 'No disponible'}
                </button>
              </div>

              <div className="horarios-lista">
                {horariosDisponibles.map(hora => {
                  const partido = horariosPorDia[dia]?.[hora];
                  
                  return (
                    <div key={hora} className="horario-slot">
                      <div className="hora-label">{hora}</div>
                      {!puedeJugar ? (
                        <div className="no-disponible-slot">
                          <span>🚫 No disponible</span>
                        </div>
                      ) : partido ? (
                        <div 
                          className="partido-card"
                          draggable="true"
                          onDragStart={(e) => handleDragStart(e, partido)}
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
                                className="btn-remove"
                                onClick={() => removeMatchFromSlot(partido)}
                                title="Remover del horario"
                              >
                                ❌
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
                            {partido.marcadorA !== null && partido.marcadorB !== null && (
                              <div className="info-item">
                                <span className="info-icon">📊</span>
                                <span>{partido.marcadorA} - {partido.marcadorB}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div 
                          className="slot-vacio"
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, dia, hora)}
                          onClick={() => handleEmptySlotClick(dia, hora)}
                          style={{ cursor: 'pointer' }}
                        >
                          <span className="vacio-text">+ Agregar partido</span>
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

      {/* Modal para seleccionar partido */}
      {showAvailableMatches && selectedSlot && (
        <div className="modal-overlay" style={{ zIndex: 999999 }}>
          <div className="modal-content scheduling-modal" style={{ maxWidth: '1200px', width: '95%' }}>
            <div className="modal-header">
              <h3>
                {assigningMatch ? 
                  "Asignando partido..." : 
                  `Seleccionar partido para ${selectedSlot.dia} ${selectedSlot.hora}`
                }
              </h3>
              <button 
                className="close-button"
                disabled={assigningMatch}
                onClick={() => {
                  if (!assigningMatch) {
                    setShowAvailableMatches(false);
                    setSelectedSlot(null);
                    setAvailableMatches([]);
                    clearSearch();
                  }
                }}
                style={{ opacity: assigningMatch ? 0.5 : 1 }}
              >
                ✕
              </button>
            </div>
            
            <div className="modal-body">
              {/* Indicador de carga */}
              {assigningMatch && (
                <div className="loading-overlay">
                  <div className="loading-spinner">
                    <div className="spinner"></div>
                    <p>Asignando partido...</p>
                  </div>
                </div>
              )}
              
              {/* Barra de búsqueda */}
              <div className="search-section">
                <div className="search-bar">
                  <input
                    type="text"
                    placeholder="Buscar por equipo, grupo o fase..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    disabled={assigningMatch}
                  />
                  {searchTerm && (
                    <button 
                      className="clear-search" 
                      onClick={clearSearch}
                      disabled={assigningMatch}
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Lista de partidos disponibles */}
              <div className="available-matches">
                {filterAvailableMatches(availableMatches).length === 0 ? (
                  <div className="no-matches">
                    {searchTerm ? 
                      `No hay partidos que coincidan con "${searchTerm}"` : 
                      "No hay partidos disponibles para este horario"
                    }
                  </div>
                ) : (
                  <div className="matches-grid">
                    {filterAvailableMatches(availableMatches).map(match => (
                      <div 
                        key={match.id} 
                        className={`match-card ${assigningMatch ? 'disabled' : ''}`}
                        onClick={() => !assigningMatch && assignMatchToSlot(match)}
                        style={{ 
                          opacity: assigningMatch ? 0.5 : 1,
                          cursor: assigningMatch ? 'not-allowed' : 'pointer'
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
                          <div className="discipline-badge">
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
                        
                        <div className="match-info">
                          <div className="info-item">
                            <span className="info-icon">🏆</span>
                            <span>{match.grupo}</span>
                          </div>
                          <div className="info-item">
                            <span className="info-icon">📚</span>
                            <span>{match.categoria}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
