/**
 * Utilidades para lectura y procesamiento de archivos Excel
 * Maneja la importación y exportación de cronogramas deportivos
 */

import * as XLSX from 'xlsx';
import { DISCIPLINES_CONFIG, WORK_DAYS, AVAILABLE_TIMES } from './DisciplineScheduler.js';
import { createAlternationLogic } from './AlternationLogic.js';

/**
 * Clase para procesar archivos Excel de cronogramas deportivos
 */
export class ExcelProcessor {
  constructor() {
    this.workbook = null;
    this.sheets = {};
    this.processedData = {};
  }

  /**
   * Lee un archivo Excel desde una URL o archivo local
   * @param {string|File} source - URL del archivo o objeto File
   */
  async readExcelFile(source) {
    try {
      let arrayBuffer;

      if (typeof source === 'string') {
        // Leer desde URL
        const response = await fetch(source);
        if (!response.ok) {
          throw new Error(`Error al descargar archivo: ${response.statusText}`);
        }
        arrayBuffer = await response.arrayBuffer();
      } else if (source instanceof File) {
        // Leer desde archivo local
        arrayBuffer = await this.fileToArrayBuffer(source);
      } else {
        throw new Error('Fuente de archivo no válida');
      }

      this.workbook = XLSX.read(arrayBuffer, { type: 'array' });
      this.extractSheets();
      
      return this.workbook;
    } catch (error) {
      console.error('Error leyendo archivo Excel:', error);
      throw error;
    }
  }

  /**
   * Convierte un archivo a ArrayBuffer
   * @param {File} file - Archivo a convertir
   */
  fileToArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(new Error('Error leyendo archivo'));
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Extrae todas las hojas del workbook
   */
  extractSheets() {
    if (!this.workbook) {
      throw new Error('No hay workbook cargado');
    }

    this.workbook.SheetNames.forEach(sheetName => {
      const worksheet = this.workbook.Sheets[sheetName];
      this.sheets[sheetName] = XLSX.utils.sheet_to_json(worksheet, { 
        header: 1,
        defval: ''
      });
    });
  }

  /**
   * Procesa datos del Excel para generar cronograma
   * @param {string} sheetName - Nombre de la hoja a procesar
   */
  processScheduleData(sheetName) {
    if (!this.sheets[sheetName]) {
      throw new Error(`Hoja "${sheetName}" no encontrada`);
    }

    const rawData = this.sheets[sheetName];
    const processedData = {
      dates: [],
      matches: [],
      disciplines: new Set(),
      metadata: {
        totalRows: rawData.length,
        processedAt: new Date().toISOString()
      }
    };

    // Procesar cada fila (cada fila = un día)
    rawData.forEach((row, index) => {
      if (index === 0) return; // Saltar header si existe

      const dayData = this.processDay(row, index);
      if (dayData) {
        processedData.dates.push(dayData);
        processedData.matches.push(...dayData.matches);
        dayData.disciplines.forEach(d => processedData.disciplines.add(d));
      }
    });

    this.processedData = processedData;
    return processedData;
  }

  /**
   * Procesa una fila individual (un día)
   * @param {Array} row - Datos de la fila
   * @param {number} index - Índice de la fila
   */
  processDay(row, index) {
    if (!row || row.length === 0) return null;

    // Estructura esperada: [Fecha, Disciplinas, Equipos, Horarios, ...]
    const [fecha, disciplinasStr, equiposStr, horariosStr, ...additional] = row;

    if (!fecha) return null;

    const dayData = {
      date: this.parseDate(fecha),
      dayOfWeek: this.getDayOfWeek(fecha),
      disciplines: this.parseDisciplines(disciplinasStr),
      matches: [],
      rawData: row
    };

    // Procesar partidos del día
    const equipos = this.parseTeams(equiposStr);
    const horarios = this.parseSchedules(horariosStr);

    // Generar partidos basados en los datos
    dayData.matches = this.generateMatchesFromDayData({
      date: dayData.date,
      dayOfWeek: dayData.dayOfWeek,
      disciplines: dayData.disciplines,
      teams: equipos,
      schedules: horarios
    });

    return dayData;
  }

  /**
   * Parsea la fecha del Excel
   * @param {any} fechaCell - Celda de fecha
   */
  parseDate(fechaCell) {
    if (!fechaCell) return null;

    // Si es un número de serie de Excel
    if (typeof fechaCell === 'number') {
      return XLSX.SSF.parse_date_code(fechaCell);
    }

    // Si es una cadena, intentar parsear
    if (typeof fechaCell === 'string') {
      const parsed = new Date(fechaCell);
      return isNaN(parsed.getTime()) ? null : parsed;
    }

    return fechaCell instanceof Date ? fechaCell : null;
  }

  /**
   * Obtiene el día de la semana en español
   * @param {Date|string} date - Fecha
   */
  getDayOfWeek(date) {
    const dayNames = {
      0: 'domingo',
      1: 'lunes',
      2: 'martes',
      3: 'miércoles',
      4: 'jueves',
      5: 'viernes',
      6: 'sábado'
    };

    const dateObj = date instanceof Date ? date : new Date(date);
    return dayNames[dateObj.getDay()] || 'desconocido';
  }

  /**
   * Parsea las disciplinas desde el Excel
   * @param {string} disciplinasStr - String de disciplinas
   */
  parseDisciplines(disciplinasStr) {
    if (!disciplinasStr) return [];

    const disciplines = disciplinasStr
      .toLowerCase()
      .split(/[,;|]/)
      .map(d => d.trim())
      .filter(d => d.length > 0);

    // Mapear nombres comunes a disciplinas estándar
    return disciplines.map(d => {
      if (d.includes('futbol') || d.includes('fútbol')) return 'futbol';
      if (d.includes('voley') || d.includes('volei')) return 'voley';
      if (d.includes('basquet') || d.includes('básquet') || d.includes('basketball')) return 'basquet';
      return d;
    }).filter(d => Object.keys(DISCIPLINES_CONFIG).includes(d));
  }

  /**
   * Parsea equipos desde el Excel
   * @param {string} equiposStr - String de equipos
   */
  parseTeams(equiposStr) {
    if (!equiposStr) return [];

    // Patrones comunes: "8A vs 8B", "8A - 8B", "8°A vs 8°B"
    const matches = equiposStr.match(/(\d+°?[A-Z])\s*(?:vs|v\/s|-)\s*(\d+°?[A-Z])/gi);

    if (matches) {
      return matches.map(match => {
        const [, teamA, teamB] = match.match(/(\d+°?[A-Z])\s*(?:vs|v\/s|-)\s*(\d+°?[A-Z])/i);
        return {
          equipoA: this.parseTeamName(teamA),
          equipoB: this.parseTeamName(teamB)
        };
      });
    }

    return [];
  }

  /**
   * Parsea un nombre de equipo
   * @param {string} teamName - Nombre del equipo
   */
  parseTeamName(teamName) {
    const clean = teamName.replace(/°/g, '').trim();
    const match = clean.match(/(\d+)([A-Z]+)/);
    
    if (match) {
      return {
        curso: match[1],
        paralelo: match[2]
      };
    }

    return {
      curso: clean,
      paralelo: ''
    };
  }

  /**
   * Parsea horarios desde el Excel
   * @param {string} horariosStr - String de horarios
   */
  parseSchedules(horariosStr) {
    if (!horariosStr) return [];

    // Patrones de tiempo: "08:00", "8:00", "08:00-08:45"
    const timePattern = /(\d{1,2}):(\d{2})(?:-(\d{1,2}):(\d{2}))?/g;
    const schedules = [];
    let match;

    while ((match = timePattern.exec(horariosStr)) !== null) {
      const [, startHour, startMin, endHour, endMin] = match;
      
      const startTime = `${startHour.padStart(2, '0')}:${startMin}`;
      const endTime = endHour && endMin ? 
        `${endHour.padStart(2, '0')}:${endMin}` : 
        this.calculateEndTime(startTime);

      schedules.push({
        start: startTime,
        end: endTime,
        duration: this.calculateDuration(startTime, endTime)
      });
    }

    return schedules;
  }

  /**
   * Calcula la hora de finalización (45 minutos después)
   * @param {string} startTime - Hora de inicio
   */
  calculateEndTime(startTime) {
    const [hours, minutes] = startTime.split(':').map(Number);
    const startMinutes = hours * 60 + minutes;
    const endMinutes = startMinutes + 45; // 45 minutos de duración
    
    const endHours = Math.floor(endMinutes / 60);
    const endMins = endMinutes % 60;
    
    return `${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`;
  }

  /**
   * Calcula la duración entre dos tiempos
   * @param {string} startTime - Hora de inicio
   * @param {string} endTime - Hora de finalización
   */
  calculateDuration(startTime, endTime) {
    const [startHours, startMinutes] = startTime.split(':').map(Number);
    const [endHours, endMinutes] = endTime.split(':').map(Number);
    
    const startTotalMinutes = startHours * 60 + startMinutes;
    const endTotalMinutes = endHours * 60 + endMinutes;
    
    return endTotalMinutes - startTotalMinutes;
  }

  /**
   * Genera partidos basados en los datos del día
   * @param {Object} dayData - Datos del día
   */
  generateMatchesFromDayData({ date, dayOfWeek, disciplines, teams, schedules }) {
    const matches = [];
    const alternationLogic = createAlternationLogic();

    // Verificar qué disciplinas deberían jugarse según las reglas
    const expectedDisciplines = alternationLogic.getDisciplinesForDay(dayOfWeek);

    disciplines.forEach((discipline, index) => {
      if (teams[index] && schedules[index]) {
        const match = {
          id: `${date.toISOString().split('T')[0]}_${discipline}_${index}`,
          disciplina: discipline,
          equipoA: teams[index].equipoA,
          equipoB: teams[index].equipoB,
          fecha: dayOfWeek,
          hora: schedules[index].start,
          duracion: schedules[index].duration,
          estado: 'programado',
          fase: 'grupos1',
          grupo: `Grupo ${index + 1}`,
          isValidAlternation: expectedDisciplines.includes(discipline)
        };

        matches.push(match);
      }
    });

    return matches;
  }

  /**
   * Exporta cronograma a Excel
   * @param {Object} schedule - Cronograma completo
   * @param {string} filename - Nombre del archivo
   */
  exportScheduleToExcel(schedule, filename = 'cronograma_deportivo.xlsx') {
    const workbook = XLSX.utils.book_new();

    // Crear hoja resumen
    this.createSummarySheet(workbook, schedule);

    // Crear hoja por disciplina
    Object.keys(DISCIPLINES_CONFIG).forEach(discipline => {
      this.createDisciplineSheet(workbook, schedule, discipline);
    });

    // Crear hoja de horarios por día
    this.createDailyScheduleSheet(workbook, schedule);

    // Descargar archivo
    XLSX.writeFile(workbook, filename);
  }

  /**
   * Crea hoja resumen del cronograma
   * @param {Object} workbook - Workbook de Excel
   * @param {Object} schedule - Cronograma
   */
  createSummarySheet(workbook, schedule) {
    const data = [
      ['Resumen del Cronograma Deportivo'],
      [''],
      ['Día', 'Fútbol', 'Vóley', 'Básquet', 'Total Partidos'],
      ['']
    ];

    WORK_DAYS.forEach(day => {
      const daySchedule = schedule[day];
      let footballCount = 0;
      let volleyCount = 0;
      let basketballCount = 0;

      if (daySchedule && daySchedule.timeSlots) {
        Object.values(daySchedule.timeSlots).forEach(timeSlot => {
          if (timeSlot.futbol) footballCount++;
          if (timeSlot.voley) volleyCount++;
          if (timeSlot.basquet) basketballCount++;
        });
      }

      const total = footballCount + volleyCount + basketballCount;
      data.push([
        day.charAt(0).toUpperCase() + day.slice(1),
        footballCount,
        volleyCount,
        basketballCount,
        total
      ]);
    });

    const worksheet = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Resumen');
  }

  /**
   * Crea hoja para una disciplina específica
   * @param {Object} workbook - Workbook de Excel
   * @param {Object} schedule - Cronograma
   * @param {string} discipline - Disciplina
   */
  createDisciplineSheet(workbook, schedule, discipline) {
    const disciplineConfig = DISCIPLINES_CONFIG[discipline];
    const data = [
      [`Cronograma - ${disciplineConfig.name}`],
      [''],
      ['Día', 'Hora', 'Equipo A', 'Equipo B', 'Grupo', 'Fase', 'Estado'],
      ['']
    ];

    WORK_DAYS.forEach(day => {
      const daySchedule = schedule[day];
      
      if (daySchedule && daySchedule.timeSlots) {
        Object.entries(daySchedule.timeSlots).forEach(([time, timeSlot]) => {
          const match = timeSlot[discipline];
          
          if (match) {
            data.push([
              day.charAt(0).toUpperCase() + day.slice(1),
              time,
              `${match.equipoA.curso} ${match.equipoA.paralelo}`,
              `${match.equipoB.curso} ${match.equipoB.paralelo}`,
              match.grupo || '',
              match.fase || 'grupos1',
              match.estado || 'programado'
            ]);
          }
        });
      }
    });

    const worksheet = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook, worksheet, disciplineConfig.name);
  }

  /**
   * Crea hoja de horarios por día
   * @param {Object} workbook - Workbook de Excel
   * @param {Object} schedule - Cronograma
   */
  createDailyScheduleSheet(workbook, schedule) {
    const headers = ['Hora', ...WORK_DAYS.map(day => 
      day.charAt(0).toUpperCase() + day.slice(1)
    )];
    
    const data = [
      ['Horarios por Día'],
      [''],
      headers,
      ['']
    ];

    AVAILABLE_TIMES.forEach(time => {
      const row = [time];
      
      WORK_DAYS.forEach(day => {
        const daySchedule = schedule[day];
        const matches = [];
        
        if (daySchedule && daySchedule.timeSlots && daySchedule.timeSlots[time]) {
          Object.entries(daySchedule.timeSlots[time]).forEach(([discipline, match]) => {
            if (match) {
              const disciplineIcon = DISCIPLINES_CONFIG[discipline]?.icon || '';
              matches.push(`${disciplineIcon} ${match.equipoA.curso}${match.equipoA.paralelo} vs ${match.equipoB.curso}${match.equipoB.paralelo}`);
            }
          });
        }
        
        row.push(matches.join('\n'));
      });
      
      data.push(row);
    });

    const worksheet = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Horarios por Día');
  }

  /**
   * Valida los datos procesados
   */
  validateProcessedData() {
    if (!this.processedData.matches || this.processedData.matches.length === 0) {
      return {
        isValid: false,
        errors: ['No se encontraron partidos en el archivo']
      };
    }

    const errors = [];
    const warnings = [];

    this.processedData.matches.forEach((match, index) => {
      // Validar estructura del partido
      if (!match.equipoA || !match.equipoB) {
        errors.push(`Partido ${index + 1}: Equipos no válidos`);
      }

      if (!match.disciplina || !Object.keys(DISCIPLINES_CONFIG).includes(match.disciplina)) {
        errors.push(`Partido ${index + 1}: Disciplina no válida (${match.disciplina})`);
      }

      if (!match.isValidAlternation) {
        warnings.push(`Partido ${index + 1}: No respeta la alternancia esperada`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      totalMatches: this.processedData.matches.length,
      disciplines: Array.from(this.processedData.disciplines)
    };
  }

  /**
   * Obtiene los datos procesados
   */
  getProcessedData() {
    return this.processedData;
  }

  /**
   * Limpia los datos procesados
   */
  clearData() {
    this.workbook = null;
    this.sheets = {};
    this.processedData = {};
  }
}

/**
 * Función de utilidad para procesar un archivo Excel rápidamente
 * @param {string|File} source - Fuente del archivo
 * @param {string} sheetName - Nombre de la hoja (opcional)
 */
export async function processExcelFile(source, sheetName = null) {
  const processor = new ExcelProcessor();
  
  await processor.readExcelFile(source);
  
  const firstSheet = sheetName || Object.keys(processor.sheets)[0];
  const processedData = processor.processScheduleData(firstSheet);
  const validation = processor.validateProcessedData();
  
  return {
    data: processedData,
    validation,
    processor
  };
}

/**
 * Función de utilidad para exportar cronograma a Excel
 * @param {Object} schedule - Cronograma completo
 * @param {string} filename - Nombre del archivo
 */
export function exportScheduleToExcel(schedule, filename = 'cronograma_deportivo.xlsx') {
  const processor = new ExcelProcessor();
  processor.exportScheduleToExcel(schedule, filename);
}
