/**
 * Lógica avanzada de alternancia para disciplinas deportivas
 * Maneja la rotación automática entre vóley y básquet
 */

import { WORK_DAYS, DISCIPLINES_CONFIG } from './DisciplineScheduler.js';

/**
 * Clase para manejar la lógica de alternancia entre disciplinas
 */
export class AlternationLogic {
  constructor(startingDiscipline = 'voley') {
    this.alternatingDisciplines = ['voley', 'basquet'];
    this.currentIndex = this.alternatingDisciplines.indexOf(startingDiscipline);
    this.dailyPattern = this.generateDailyPattern();
  }

  /**
   * Genera el patrón diario de disciplinas para toda la semana
   */
  generateDailyPattern() {
    const pattern = {};
    
    WORK_DAYS.forEach((day, index) => {
      const disciplines = ['futbol']; // Fútbol siempre presente
      
      // Alternancia entre vóley y básquet
      const alternatingIndex = index % 2;
      const alternatingDiscipline = this.alternatingDisciplines[alternatingIndex];
      disciplines.push(alternatingDiscipline);
      
      pattern[day] = {
        index,
        disciplines,
        alternatingDiscipline,
        priority: this.getDisciplinePriority(alternatingDiscipline)
      };
    });
    
    return pattern;
  }

  /**
   * Obtiene la prioridad de una disciplina para el día
   */
  getDisciplinePriority(discipline) {
    const priorities = {
      futbol: 1, // Máxima prioridad - siempre se juega
      voley: 2,  // Prioridad alternante
      basquet: 2 // Prioridad alternante
    };
    
    return priorities[discipline] || 3;
  }

  /**
   * Obtiene las disciplinas que se juegan en un día específico
   * @param {string} day - Día de la semana
   */
  getDisciplinesForDay(day) {
    return this.dailyPattern[day]?.disciplines || ['futbol'];
  }

  /**
   * Verifica si una disciplina se juega en un día específico
   * @param {string} day - Día de la semana
   * @param {string} discipline - Disciplina a verificar
   */
  isDisciplineActiveOnDay(day, discipline) {
    const dayDisciplines = this.getDisciplinesForDay(day);
    return dayDisciplines.includes(discipline);
  }

  /**
   * Obtiene la disciplina alternante para un día específico
   * @param {string} day - Día de la semana
   */
  getAlternatingDisciplineForDay(day) {
    return this.dailyPattern[day]?.alternatingDiscipline;
  }

  /**
   * Obtiene el siguiente día donde se juega una disciplina específica
   * @param {string} currentDay - Día actual
   * @param {string} discipline - Disciplina buscada
   */
  getNextDayForDiscipline(currentDay, discipline) {
    const currentIndex = WORK_DAYS.indexOf(currentDay);
    
    // Para fútbol, cualquier día es válido
    if (discipline === 'futbol') {
      const nextIndex = (currentIndex + 1) % WORK_DAYS.length;
      return WORK_DAYS[nextIndex];
    }
    
    // Para disciplinas alternantes
    for (let i = 1; i <= WORK_DAYS.length; i++) {
      const nextIndex = (currentIndex + i) % WORK_DAYS.length;
      const nextDay = WORK_DAYS[nextIndex];
      
      if (this.isDisciplineActiveOnDay(nextDay, discipline)) {
        return nextDay;
      }
    }
    
    return null;
  }

  /**
   * Calcula el patrón completo de rotación para múltiples semanas
   * @param {number} weeks - Número de semanas a calcular
   */
  calculateRotationPattern(weeks = 4) {
    const pattern = {};
    
    for (let week = 0; week < weeks; week++) {
      pattern[`semana_${week + 1}`] = {};
      
      WORK_DAYS.forEach((day, dayIndex) => {
        const globalDayIndex = (week * WORK_DAYS.length) + dayIndex;
        const alternatingIndex = globalDayIndex % 2;
        const alternatingDiscipline = this.alternatingDisciplines[alternatingIndex];
        
        pattern[`semana_${week + 1}`][day] = {
          disciplines: ['futbol', alternatingDiscipline],
          alternatingDiscipline,
          weekDay: dayIndex,
          globalDay: globalDayIndex
        };
      });
    }
    
    return pattern;
  }

  /**
   * Optimiza la distribución de partidos considerando la alternancia
   * @param {Array} matches - Lista de partidos
   */
  optimizeMatchDistribution(matches) {
    const distribution = {
      futbol: { matches: [], recommendedDays: [...WORK_DAYS] },
      voley: { matches: [], recommendedDays: [] },
      basquet: { matches: [], recommendedDays: [] }
    };

    // Separar partidos por disciplina
    matches.forEach(match => {
      const discipline = match.disciplina || 'futbol';
      if (distribution[discipline]) {
        distribution[discipline].matches.push(match);
      }
    });

    // Asignar días recomendados para disciplinas alternantes
    WORK_DAYS.forEach(day => {
      const alternatingDiscipline = this.getAlternatingDisciplineForDay(day);
      distribution[alternatingDiscipline].recommendedDays.push(day);
    });

    return distribution;
  }

  /**
   * Valida que la alternancia se mantenga correctamente
   * @param {Object} schedule - Cronograma completo
   */
  validateAlternationPattern(schedule) {
    const validation = {
      isValid: true,
      errors: [],
      warnings: []
    };

    WORK_DAYS.forEach((day, index) => {
      const expectedAlternating = this.getAlternatingDisciplineForDay(day);
      const daySchedule = schedule[day];
      
      if (!daySchedule) {
        validation.errors.push(`No existe cronograma para ${day}`);
        validation.isValid = false;
        return;
      }

      // Verificar que fútbol esté presente
      const hasFootball = this.hasDisciplineScheduled(daySchedule, 'futbol');
      if (!hasFootball) {
        validation.warnings.push(`Fútbol no programado el ${day}`);
      }

      // Verificar alternancia correcta
      const hasExpectedAlternating = this.hasDisciplineScheduled(daySchedule, expectedAlternating);
      const hasWrongAlternating = this.hasDisciplineScheduled(
        daySchedule, 
        expectedAlternating === 'voley' ? 'basquet' : 'voley'
      );

      if (!hasExpectedAlternating && hasWrongAlternating) {
        validation.errors.push(
          `Alternancia incorrecta el ${day}: esperado ${expectedAlternating}, encontrado ${expectedAlternating === 'voley' ? 'basquet' : 'voley'}`
        );
        validation.isValid = false;
      }
    });

    return validation;
  }

  /**
   * Verifica si una disciplina está programada en un día
   * @param {Object} daySchedule - Cronograma del día
   * @param {string} discipline - Disciplina a verificar
   */
  hasDisciplineScheduled(daySchedule, discipline) {
    if (!daySchedule.timeSlots) return false;
    
    return Object.values(daySchedule.timeSlots).some(timeSlot => 
      timeSlot[discipline] !== null && timeSlot[discipline] !== undefined
    );
  }

  /**
   * Sugiere reubicación de partidos para mantener alternancia
   * @param {Object} schedule - Cronograma actual
   */
  suggestRelocation(schedule) {
    const suggestions = [];
    const validation = this.validateAlternationPattern(schedule);
    
    if (validation.isValid) {
      return suggestions;
    }

    validation.errors.forEach(error => {
      if (error.includes('Alternancia incorrecta')) {
        const day = error.match(/el (\w+):/)?.[1];
        const expectedDiscipline = error.match(/esperado (\w+),/)?.[1];
        const wrongDiscipline = error.match(/encontrado (\w+)/)?.[1];
        
        if (day && expectedDiscipline && wrongDiscipline) {
          const targetDay = this.getNextDayForDiscipline(day, wrongDiscipline);
          
          suggestions.push({
            type: 'relocate',
            from: { day, discipline: wrongDiscipline },
            to: { day: targetDay, discipline: wrongDiscipline },
            reason: `Mantener alternancia correcta: ${expectedDiscipline} debe jugar el ${day}`
          });
        }
      }
    });

    return suggestions;
  }

  /**
   * Genera un reporte de la alternancia actual
   * @param {Object} schedule - Cronograma completo
   */
  generateAlternationReport(schedule) {
    const report = {
      pattern: this.dailyPattern,
      validation: this.validateAlternationPattern(schedule),
      statistics: {
        totalDays: WORK_DAYS.length,
        footballDays: 0,
        volleyDays: 0,
        basketballDays: 0
      },
      recommendations: []
    };

    // Calcular estadísticas
    WORK_DAYS.forEach(day => {
      const daySchedule = schedule[day];
      if (daySchedule) {
        if (this.hasDisciplineScheduled(daySchedule, 'futbol')) {
          report.statistics.footballDays++;
        }
        if (this.hasDisciplineScheduled(daySchedule, 'voley')) {
          report.statistics.volleyDays++;
        }
        if (this.hasDisciplineScheduled(daySchedule, 'basquet')) {
          report.statistics.basketballDays++;
        }
      }
    });

    // Generar recomendaciones
    if (!report.validation.isValid) {
      report.recommendations = this.suggestRelocation(schedule);
    }

    return report;
  }

  /**
   * Restablece el patrón de alternancia
   * @param {string} startingDiscipline - Disciplina inicial ('voley' o 'basquet')
   */
  resetAlternationPattern(startingDiscipline = 'voley') {
    this.currentIndex = this.alternatingDisciplines.indexOf(startingDiscipline);
    this.dailyPattern = this.generateDailyPattern();
  }

  /**
   * Exporta la configuración de alternancia
   */
  exportConfiguration() {
    return {
      alternatingDisciplines: this.alternatingDisciplines,
      dailyPattern: this.dailyPattern,
      rotationPattern: this.calculateRotationPattern(),
      metadata: {
        generatedAt: new Date().toISOString(),
        version: '1.0.0'
      }
    };
  }
}

/**
 * Función de utilidad para crear una nueva instancia de lógica de alternancia
 * @param {string} startingDiscipline - Disciplina inicial
 */
export function createAlternationLogic(startingDiscipline = 'voley') {
  return new AlternationLogic(startingDiscipline);
}

/**
 * Función de utilidad para validar un patrón de alternancia
 * @param {Object} schedule - Cronograma a validar
 * @param {string} startingDiscipline - Disciplina inicial
 */
export function validateScheduleAlternation(schedule, startingDiscipline = 'voley') {
  const logic = new AlternationLogic(startingDiscipline);
  return logic.validateAlternationPattern(schedule);
}

/**
 * Función de utilidad para obtener disciplinas por día
 * @param {string} day - Día de la semana
 * @param {string} startingDiscipline - Disciplina inicial
 */
export function getDisciplinesForDay(day, startingDiscipline = 'voley') {
  const logic = new AlternationLogic(startingDiscipline);
  return logic.getDisciplinesForDay(day);
}
