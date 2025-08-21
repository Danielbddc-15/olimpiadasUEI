/**
 * Sistema modular para gestión de cronogramas deportivos
 * Maneja múltiples disciplinas con reglas específicas de programación
 */

// Configuración de disciplinas deportivas
export const DISCIPLINES_CONFIG = {
  futbol: {
    name: 'Fútbol',
    frequency: 'daily', // Se juega todos los días
    icon: '⚽',
    color: '#4CAF50'
  },
  voley: {
    name: 'Vóley',
    frequency: 'alternate', // Se juega día por medio
    icon: '🏐',
    color: '#2196F3',
    alternateWith: 'basquet'
  },
  basquet: {
    name: 'Básquet',
    frequency: 'alternate', // Se juega día por medio
    icon: '🏀',
    color: '#FF9800',
    alternateWith: 'voley'
  }
};

// Días laborables disponibles
export const WORK_DAYS = [
  'lunes',
  'martes', 
  'miércoles',
  'jueves',
  'viernes'
];

// Horarios disponibles (intervalos de 45 minutos)
export const AVAILABLE_TIMES = [
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

/**
 * Clase principal para gestión de cronogramas deportivos
 */
export class DisciplineScheduler {
  constructor() {
    this.schedule = this.initializeSchedule();
    this.assignedTeamsPerDay = {};
  }

  /**
   * Inicializa la estructura del cronograma
   */
  initializeSchedule() {
    const schedule = {};
    
    WORK_DAYS.forEach(day => {
      schedule[day] = {
        disciplines: this.getDisciplinesForDay(day),
        timeSlots: this.initializeTimeSlots()
      };
    });

    return schedule;
  }

  /**
   * Inicializa los slots de tiempo disponibles
   */
  initializeTimeSlots() {
    const timeSlots = {};
    
    AVAILABLE_TIMES.forEach(time => {
      timeSlots[time] = {
        futbol: null,
        voley: null,
        basquet: null
      };
    });

    return timeSlots;
  }

  /**
   * Determina qué disciplinas se juegan en un día específico
   * @param {string} day - Día de la semana
   */
  getDisciplinesForDay(day) {
    const dayIndex = WORK_DAYS.indexOf(day);
    const disciplines = ['futbol']; // Fútbol siempre se juega
    
    // Alternancia entre vóley y básquet
    if (dayIndex % 2 === 0) {
      disciplines.push('voley');
    } else {
      disciplines.push('basquet');
    }
    
    return disciplines;
  }

  /**
   * Asigna un partido a un slot específico
   * @param {string} day - Día de la semana
   * @param {string} time - Hora del día
   * @param {string} discipline - Disciplina deportiva
   * @param {Object} match - Datos del partido
   */
  assignMatch(day, time, discipline, match) {
    if (!this.isValidAssignment(day, time, discipline, match)) {
      throw new Error('Asignación no válida');
    }

    this.schedule[day].timeSlots[time][discipline] = match;
    this.trackTeamUsage(day, match);
    
    return true;
  }

  /**
   * Valida si una asignación es posible
   * @param {string} day - Día de la semana
   * @param {string} time - Hora del día
   * @param {string} discipline - Disciplina deportiva
   * @param {Object} match - Datos del partido
   */
  isValidAssignment(day, time, discipline, match) {
    // Verificar que la disciplina se juegue ese día
    if (!this.schedule[day].disciplines.includes(discipline)) {
      return false;
    }

    // Verificar que el slot esté libre
    if (this.schedule[day].timeSlots[time][discipline] !== null) {
      return false;
    }

    // Verificar que los equipos no jueguen más de una vez por día
    return !this.teamsAlreadyPlayingOnDay(day, match);
  }

  /**
   * Verifica si los equipos ya están jugando ese día
   * @param {string} day - Día de la semana
   * @param {Object} match - Datos del partido
   */
  teamsAlreadyPlayingOnDay(day, match) {
    if (!this.assignedTeamsPerDay[day]) {
      this.assignedTeamsPerDay[day] = new Set();
    }

    const teamA = this.getTeamIdentifier(match.equipoA);
    const teamB = this.getTeamIdentifier(match.equipoB);
    
    return this.assignedTeamsPerDay[day].has(teamA) || 
           this.assignedTeamsPerDay[day].has(teamB);
  }

  /**
   * Registra el uso de equipos por día
   * @param {string} day - Día de la semana
   * @param {Object} match - Datos del partido
   */
  trackTeamUsage(day, match) {
    if (!this.assignedTeamsPerDay[day]) {
      this.assignedTeamsPerDay[day] = new Set();
    }

    const teamA = this.getTeamIdentifier(match.equipoA);
    const teamB = this.getTeamIdentifier(match.equipoB);
    
    this.assignedTeamsPerDay[day].add(teamA);
    this.assignedTeamsPerDay[day].add(teamB);
  }

  /**
   * Genera un identificador único para un equipo
   * @param {Object} team - Datos del equipo
   */
  getTeamIdentifier(team) {
    return `${team.curso}_${team.paralelo}`;
  }

  /**
   * Asignación automática de partidos según las reglas
   * @param {Array} matches - Lista de partidos por disciplina
   */
  autoAssignMatches(matches) {
    const results = {
      assigned: [],
      conflicts: [],
      unassigned: []
    };

    // Separar partidos por disciplina
    const matchesByDiscipline = this.groupMatchesByDiscipline(matches);

    // Procesar cada disciplina
    Object.keys(matchesByDiscipline).forEach(discipline => {
      const disciplineMatches = matchesByDiscipline[discipline];
      
      disciplineMatches.forEach(match => {
        const assignment = this.findBestSlot(discipline, match);
        
        if (assignment) {
          try {
            this.assignMatch(assignment.day, assignment.time, discipline, match);
            results.assigned.push({
              match,
              day: assignment.day,
              time: assignment.time,
              discipline
            });
          } catch (error) {
            results.conflicts.push({
              match,
              error: error.message,
              discipline
            });
          }
        } else {
          results.unassigned.push({
            match,
            discipline,
            reason: 'No hay slots disponibles'
          });
        }
      });
    });

    return results;
  }

  /**
   * Agrupa partidos por disciplina
   * @param {Array} matches - Lista de partidos
   */
  groupMatchesByDiscipline(matches) {
    return matches.reduce((groups, match) => {
      const discipline = match.disciplina || 'futbol';
      if (!groups[discipline]) {
        groups[discipline] = [];
      }
      groups[discipline].push(match);
      return groups;
    }, {});
  }

  /**
   * Encuentra el mejor slot disponible para un partido
   * @param {string} discipline - Disciplina deportiva
   * @param {Object} match - Datos del partido
   */
  findBestSlot(discipline, match) {
    // Priorizar días donde se juega la disciplina
    const availableDays = WORK_DAYS.filter(day => 
      this.schedule[day].disciplines.includes(discipline)
    );

    for (const day of availableDays) {
      for (const time of AVAILABLE_TIMES) {
        if (this.isValidAssignment(day, time, discipline, match)) {
          return { day, time };
        }
      }
    }

    return null;
  }

  /**
   * Obtiene el cronograma completo
   */
  getSchedule() {
    return this.schedule;
  }

  /**
   * Obtiene el cronograma de un día específico
   * @param {string} day - Día de la semana
   */
  getDaySchedule(day) {
    return this.schedule[day];
  }

  /**
   * Obtiene estadísticas del cronograma
   */
  getScheduleStats() {
    let totalMatches = 0;
    let assignedMatches = 0;
    const disciplineStats = {};

    Object.keys(DISCIPLINES_CONFIG).forEach(discipline => {
      disciplineStats[discipline] = {
        total: 0,
        assigned: 0,
        days: []
      };
    });

    WORK_DAYS.forEach(day => {
      const dayData = this.schedule[day];
      
      Object.keys(dayData.timeSlots).forEach(time => {
        Object.keys(dayData.timeSlots[time]).forEach(discipline => {
          totalMatches++;
          disciplineStats[discipline].total++;
          
          if (dayData.timeSlots[time][discipline] !== null) {
            assignedMatches++;
            disciplineStats[discipline].assigned++;
            
            if (!disciplineStats[discipline].days.includes(day)) {
              disciplineStats[discipline].days.push(day);
            }
          }
        });
      });
    });

    return {
      totalSlots: totalMatches,
      assignedSlots: assignedMatches,
      utilizationRate: (assignedMatches / totalMatches) * 100,
      byDiscipline: disciplineStats
    };
  }

  /**
   * Exporta el cronograma a formato JSON
   */
  exportToJSON() {
    return {
      schedule: this.schedule,
      config: DISCIPLINES_CONFIG,
      stats: this.getScheduleStats(),
      metadata: {
        generatedAt: new Date().toISOString(),
        version: '1.0.0'
      }
    };
  }

  /**
   * Limpia el cronograma
   */
  clearSchedule() {
    this.schedule = this.initializeSchedule();
    this.assignedTeamsPerDay = {};
  }

  /**
   * Remueve un partido del cronograma
   * @param {string} day - Día de la semana
   * @param {string} time - Hora del día
   * @param {string} discipline - Disciplina deportiva
   */
  removeMatch(day, time, discipline) {
    if (this.schedule[day] && this.schedule[day].timeSlots[time]) {
      const match = this.schedule[day].timeSlots[time][discipline];
      
      if (match) {
        this.schedule[day].timeSlots[time][discipline] = null;
        
        // Remover equipos del tracking
        const teamA = this.getTeamIdentifier(match.equipoA);
        const teamB = this.getTeamIdentifier(match.equipoB);
        
        if (this.assignedTeamsPerDay[day]) {
          this.assignedTeamsPerDay[day].delete(teamA);
          this.assignedTeamsPerDay[day].delete(teamB);
        }
        
        return match;
      }
    }
    
    return null;
  }
}

/**
 * Función de utilidad para crear una nueva instancia del scheduler
 */
export function createScheduler() {
  return new DisciplineScheduler();
}

/**
 * Función de utilidad para validar configuración de disciplinas
 */
export function validateDisciplineConfig(config) {
  const requiredFields = ['name', 'frequency', 'icon', 'color'];
  
  return Object.keys(config).every(discipline => {
    const disciplineConfig = config[discipline];
    return requiredFields.every(field => disciplineConfig.hasOwnProperty(field));
  });
}
