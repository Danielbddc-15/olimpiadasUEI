/**
 * Sistema de exportación de cronogramas deportivos
 * Maneja múltiples formatos de exportación: Excel, JSON, PDF, CSV
 */

import * as XLSX from 'xlsx';
import { DISCIPLINES_CONFIG, WORK_DAYS, AVAILABLE_TIMES } from './DisciplineScheduler.js';
import { createAlternationLogic } from './AlternationLogic.js';

/**
 * Clase principal para gestión de exportaciones
 */
export class ExportManager {
  constructor() {
    this.exportFormats = {
      excel: this.exportToExcel.bind(this),
      json: this.exportToJSON.bind(this),
      csv: this.exportToCSV.bind(this),
      pdf: this.exportToPDF.bind(this)
    };
  }

  /**
   * Exporta cronograma al formato especificado
   * @param {Object} schedule - Cronograma completo
   * @param {string} format - Formato de exportación
   * @param {Object} options - Opciones de exportación
   */
  export(schedule, format = 'excel', options = {}) {
    if (!this.exportFormats[format]) {
      throw new Error(`Formato de exportación no soportado: ${format}`);
    }

    const defaultOptions = {
      filename: `cronograma_deportivo_${this.getTimestamp()}`,
      includeStats: true,
      includeSummary: true,
      ...options
    };

    return this.exportFormats[format](schedule, defaultOptions);
  }

  /**
   * Exporta cronograma a Excel
   * @param {Object} schedule - Cronograma completo
   * @param {Object} options - Opciones de exportación
   */
  exportToExcel(schedule, options) {
    const workbook = XLSX.utils.book_new();

    // Hoja de resumen general
    if (options.includeSummary) {
      this.createSummarySheet(workbook, schedule);
    }

    // Hoja de estadísticas
    if (options.includeStats) {
      this.createStatsSheet(workbook, schedule);
    }

    // Hoja de cronograma por día
    this.createDailyScheduleSheet(workbook, schedule);

    // Hoja por disciplina
    Object.keys(DISCIPLINES_CONFIG).forEach(discipline => {
      this.createDisciplineSheet(workbook, schedule, discipline);
    });

    // Hoja de alternancia y validación
    this.createValidationSheet(workbook, schedule);

    // Hoja de datos en bruto (para importación posterior)
    this.createRawDataSheet(workbook, schedule);

    const filename = `${options.filename}.xlsx`;
    XLSX.writeFile(workbook, filename);
    
    return {
      success: true,
      filename,
      format: 'excel',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Crea hoja de resumen general
   */
  createSummarySheet(workbook, schedule) {
    const stats = this.calculateScheduleStats(schedule);
    
    const data = [
      ['CRONOGRAMA DEPORTIVO - RESUMEN EJECUTIVO'],
      ['Generado el:', new Date().toLocaleString('es-ES')],
      [''],
      ['ESTADÍSTICAS GENERALES'],
      ['Total de partidos programados:', stats.totalMatches],
      ['Utilización de slots:', `${stats.utilizationRate.toFixed(1)}%`],
      ['Días con partidos:', stats.activeDays],
      [''],
      ['POR DISCIPLINA'],
      ['Disciplina', 'Partidos', 'Días Activos', 'Promedio/Día'],
      ...Object.entries(stats.byDiscipline).map(([discipline, data]) => [
        DISCIPLINES_CONFIG[discipline]?.name || discipline,
        data.assigned,
        data.activeDays,
        (data.assigned / data.activeDays).toFixed(1)
      ]),
      [''],
      ['POR DÍA DE LA SEMANA'],
      ['Día', 'Fútbol', 'Vóley', 'Básquet', 'Total'],
      ...WORK_DAYS.map(day => {
        const dayStats = this.getDayStats(schedule, day);
        return [
          day.charAt(0).toUpperCase() + day.slice(1),
          dayStats.futbol,
          dayStats.voley,
          dayStats.basquet,
          dayStats.total
        ];
      }),
      [''],
      ['VALIDACIÓN DE ALTERNANCIA'],
      ['Cumple reglas de alternancia:', stats.alternationValid ? 'SÍ' : 'NO'],
      ['Errores encontrados:', stats.alternationErrors.length],
      ['Advertencias:', stats.alternationWarnings.length]
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(data);
    
    // Aplicar estilos básicos
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    for (let R = range.s.r; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
        const cell = worksheet[cellAddress];
        
        if (cell) {
          // Aplicar formato a headers
          if (R === 0 || (cell.v && typeof cell.v === 'string' && cell.v.includes('ESTADÍSTICAS'))) {
            cell.s = { font: { bold: true }, alignment: { horizontal: 'center' } };
          }
        }
      }
    }

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Resumen');
  }

  /**
   * Crea hoja de estadísticas detalladas
   */
  createStatsSheet(workbook, schedule) {
    const data = [
      ['ESTADÍSTICAS DETALLADAS'],
      [''],
      ['UTILIZACIÓN POR HORARIO'],
      ['Hora', ...WORK_DAYS.map(d => d.charAt(0).toUpperCase() + d.slice(1)), 'Total'],
      ...AVAILABLE_TIMES.map(time => {
        const row = [time];
        let totalHour = 0;
        
        WORK_DAYS.forEach(day => {
          const count = this.getMatchesAtTime(schedule, day, time);
          row.push(count);
          totalHour += count;
        });
        
        row.push(totalHour);
        return row;
      }),
      [''],
      ['EQUIPOS MÁS ACTIVOS'],
      ['Equipo', 'Partidos', 'Disciplinas'],
      ...this.getTeamActivity(schedule),
      [''],
      ['DISTRIBUCIÓN TEMPORAL'],
      ['Franja Horaria', 'Partidos', 'Porcentaje'],
      ...this.getTimeDistribution(schedule)
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Estadísticas');
  }

  /**
   * Crea hoja de cronograma por día
   */
  createDailyScheduleSheet(workbook, schedule) {
    const headers = ['Hora', ...WORK_DAYS.map(day => 
      day.charAt(0).toUpperCase() + day.slice(1)
    )];
    
    const data = [
      ['CRONOGRAMA SEMANAL'],
      [''],
      headers,
      ...AVAILABLE_TIMES.map(time => {
        const row = [time];
        
        WORK_DAYS.forEach(day => {
          const daySchedule = schedule[day];
          const matches = [];
          
          if (daySchedule && daySchedule.timeSlots && daySchedule.timeSlots[time]) {
            Object.entries(daySchedule.timeSlots[time]).forEach(([discipline, match]) => {
              if (match) {
                const icon = DISCIPLINES_CONFIG[discipline]?.icon || '';
                const vs = `${match.equipoA.curso}${match.equipoA.paralelo} vs ${match.equipoB.curso}${match.equipoB.paralelo}`;
                matches.push(`${icon} ${vs}`);
              }
            });
          }
          
          row.push(matches.join('\\n'));
        });
        
        return row;
      })
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Cronograma Semanal');
  }

  /**
   * Crea hoja para una disciplina específica
   */
  createDisciplineSheet(workbook, schedule, discipline) {
    const disciplineConfig = DISCIPLINES_CONFIG[discipline];
    const matches = this.getMatchesByDiscipline(schedule, discipline);
    
    const data = [
      [`CRONOGRAMA - ${disciplineConfig.name} ${disciplineConfig.icon}`],
      [''],
      ['Día', 'Hora', 'Equipo A', 'Equipo B', 'Grupo', 'Fase', 'Estado', 'Observaciones'],
      ...matches.map(match => [
        match.day.charAt(0).toUpperCase() + match.day.slice(1),
        match.time,
        `${match.equipoA.curso} ${match.equipoA.paralelo}`,
        `${match.equipoB.curso} ${match.equipoB.paralelo}`,
        match.grupo || 'Sin grupo',
        match.fase || 'grupos1',
        match.estado || 'programado',
        match.observaciones || ''
      ])
    ];

    // Agregar estadísticas de la disciplina
    data.push(
      [''],
      ['ESTADÍSTICAS'],
      ['Total de partidos:', matches.length],
      ['Días activos:', new Set(matches.map(m => m.day)).size],
      ['Promedio por día:', (matches.length / WORK_DAYS.length).toFixed(1)]
    );

    const worksheet = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook, worksheet, disciplineConfig.name);
  }

  /**
   * Crea hoja de validación y alternancia
   */
  createValidationSheet(workbook, schedule) {
    const alternationLogic = createAlternationLogic();
    const validation = alternationLogic.validateAlternationPattern(schedule);
    const report = alternationLogic.generateAlternationReport(schedule);
    
    const data = [
      ['VALIDACIÓN Y ALTERNANCIA'],
      [''],
      ['ESTADO GENERAL'],
      ['Cronograma válido:', validation.isValid ? 'SÍ' : 'NO'],
      ['Errores encontrados:', validation.errors.length],
      ['Advertencias:', validation.warnings.length],
      [''],
      ['PATRÓN DE ALTERNANCIA ESPERADO'],
      ['Día', 'Disciplinas Esperadas', 'Estado'],
      ...WORK_DAYS.map(day => {
        const expected = alternationLogic.getDisciplinesForDay(day);
        const status = this.validateDayAlternation(schedule, day, expected);
        return [
          day.charAt(0).toUpperCase() + day.slice(1),
          expected.join(', '),
          status ? '✓ Correcto' : '✗ Error'
        ];
      }),
      [''],
      ['ERRORES ENCONTRADOS'],
      ...validation.errors.map(error => ['ERROR:', error]),
      [''],
      ['ADVERTENCIAS'],
      ...validation.warnings.map(warning => ['ADVERTENCIA:', warning]),
      [''],
      ['RECOMENDACIONES'],
      ...report.recommendations.map(rec => [
        'RECOMENDACIÓN:', 
        `${rec.type}: ${rec.reason}`
      ])
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Validación');
  }

  /**
   * Crea hoja de datos en bruto para importación
   */
  createRawDataSheet(workbook, schedule) {
    const data = [
      ['DATOS EN BRUTO - IMPORTACIÓN'],
      ['Formato: Día | Hora | Disciplina | EquipoA_Curso | EquipoA_Paralelo | EquipoB_Curso | EquipoB_Paralelo | Grupo | Fase | Estado'],
      [''],
      ['Día', 'Hora', 'Disciplina', 'EquipoA_Curso', 'EquipoA_Paralelo', 'EquipoB_Curso', 'EquipoB_Paralelo', 'Grupo', 'Fase', 'Estado']
    ];

    WORK_DAYS.forEach(day => {
      const daySchedule = schedule[day];
      
      if (daySchedule && daySchedule.timeSlots) {
        Object.entries(daySchedule.timeSlots).forEach(([time, timeSlot]) => {
          Object.entries(timeSlot).forEach(([discipline, match]) => {
            if (match) {
              data.push([
                day,
                time,
                discipline,
                match.equipoA.curso,
                match.equipoA.paralelo,
                match.equipoB.curso,
                match.equipoB.paralelo,
                match.grupo || '',
                match.fase || 'grupos1',
                match.estado || 'programado'
              ]);
            }
          });
        });
      }
    });

    const worksheet = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Datos Brutos');
  }

  /**
   * Exporta cronograma a JSON
   */
  exportToJSON(schedule, options) {
    const exportData = {
      metadata: {
        version: '1.0.0',
        generatedAt: new Date().toISOString(),
        format: 'json',
        filename: options.filename
      },
      config: {
        disciplines: DISCIPLINES_CONFIG,
        workDays: WORK_DAYS,
        availableTimes: AVAILABLE_TIMES
      },
      schedule: schedule,
      statistics: options.includeStats ? this.calculateScheduleStats(schedule) : null,
      validation: this.validateExportData(schedule)
    };

    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `${options.filename}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return {
      success: true,
      filename: `${options.filename}.json`,
      format: 'json',
      size: jsonString.length,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Exporta cronograma a CSV
   */
  exportToCSV(schedule, options) {
    const headers = [
      'Día',
      'Hora', 
      'Disciplina',
      'Equipo A',
      'Equipo B',
      'Grupo',
      'Fase',
      'Estado',
      'Icono'
    ];

    const rows = [headers];

    WORK_DAYS.forEach(day => {
      const daySchedule = schedule[day];
      
      if (daySchedule && daySchedule.timeSlots) {
        Object.entries(daySchedule.timeSlots).forEach(([time, timeSlot]) => {
          Object.entries(timeSlot).forEach(([discipline, match]) => {
            if (match) {
              rows.push([
                day,
                time,
                discipline,
                `${match.equipoA.curso} ${match.equipoA.paralelo}`,
                `${match.equipoB.curso} ${match.equipoB.paralelo}`,
                match.grupo || '',
                match.fase || 'grupos1',
                match.estado || 'programado',
                DISCIPLINES_CONFIG[discipline]?.icon || ''
              ]);
            }
          });
        });
      }
    });

    const csvContent = rows.map(row => 
      row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ).join('\\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `${options.filename}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return {
      success: true,
      filename: `${options.filename}.csv`,
      format: 'csv',
      rows: rows.length - 1, // Sin contar header
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Exporta cronograma a PDF (implementación básica)
   */
  exportToPDF(schedule, options) {
    // Para una implementación completa se necesitaría una librería como jsPDF
    // Por ahora, convertimos a HTML y sugerimos imprimir
    
    const htmlContent = this.generateHTMLReport(schedule);
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.print();

    return {
      success: true,
      filename: `${options.filename}.pdf`,
      format: 'pdf',
      method: 'browser_print',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Genera reporte HTML para impresión
   */
  generateHTMLReport(schedule) {
    const stats = this.calculateScheduleStats(schedule);
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Cronograma Deportivo</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .header { text-align: center; margin-bottom: 30px; }
          .stats { background: #f5f5f5; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; font-weight: bold; }
          .discipline-icon { font-size: 16px; }
          .page-break { page-break-before: always; }
          @media print { .no-print { display: none; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Cronograma Deportivo</h1>
          <p>Generado el ${new Date().toLocaleString('es-ES')}</p>
        </div>
        
        <div class="stats">
          <h3>Estadísticas Generales</h3>
          <p><strong>Total de partidos:</strong> ${stats.totalMatches}</p>
          <p><strong>Utilización:</strong> ${stats.utilizationRate.toFixed(1)}%</p>
          <p><strong>Días activos:</strong> ${stats.activeDays}</p>
        </div>
        
        ${this.generateHTMLScheduleTable(schedule)}
        
        <div class="page-break"></div>
        ${this.generateHTMLDisciplineTables(schedule)}
      </body>
      </html>
    `;
  }

  /**
   * Genera tabla HTML del cronograma
   */
  generateHTMLScheduleTable(schedule) {
    let html = '<h3>Cronograma Semanal</h3><table>';
    
    // Headers
    html += '<tr><th>Hora</th>';
    WORK_DAYS.forEach(day => {
      html += `<th>${day.charAt(0).toUpperCase() + day.slice(1)}</th>`;
    });
    html += '</tr>';
    
    // Filas de horarios
    AVAILABLE_TIMES.forEach(time => {
      html += `<tr><td><strong>${time}</strong></td>`;
      
      WORK_DAYS.forEach(day => {
        const matches = this.getMatchesAtTimeDetailed(schedule, day, time);
        html += '<td>';
        
        matches.forEach(match => {
          const icon = DISCIPLINES_CONFIG[match.discipline]?.icon || '';
          html += `<span class="discipline-icon">${icon}</span> `;
          html += `${match.equipoA.curso}${match.equipoA.paralelo} vs ${match.equipoB.curso}${match.equipoB.paralelo}<br>`;
        });
        
        html += '</td>';
      });
      
      html += '</tr>';
    });
    
    html += '</table>';
    return html;
  }

  /**
   * Genera tablas HTML por disciplina
   */
  generateHTMLDisciplineTables(schedule) {
    let html = '';
    
    Object.entries(DISCIPLINES_CONFIG).forEach(([discipline, config]) => {
      const matches = this.getMatchesByDiscipline(schedule, discipline);
      
      html += `<h3>${config.icon} ${config.name}</h3>`;
      html += '<table>';
      html += '<tr><th>Día</th><th>Hora</th><th>Partido</th><th>Grupo</th><th>Fase</th></tr>';
      
      matches.forEach(match => {
        html += '<tr>';
        html += `<td>${match.day.charAt(0).toUpperCase() + match.day.slice(1)}</td>`;
        html += `<td>${match.time}</td>`;
        html += `<td>${match.equipoA.curso}${match.equipoA.paralelo} vs ${match.equipoB.curso}${match.equipoB.paralelo}</td>`;
        html += `<td>${match.grupo || 'Sin grupo'}</td>`;
        html += `<td>${match.fase || 'grupos1'}</td>`;
        html += '</tr>';
      });
      
      html += '</table>';
    });
    
    return html;
  }

  // Métodos auxiliares para estadísticas y cálculos

  /**
   * Calcula estadísticas del cronograma
   */
  calculateScheduleStats(schedule) {
    let totalMatches = 0;
    let activeDays = 0;
    const byDiscipline = {};
    
    // Inicializar estadísticas por disciplina
    Object.keys(DISCIPLINES_CONFIG).forEach(discipline => {
      byDiscipline[discipline] = {
        total: 0,
        assigned: 0,
        activeDays: 0,
        days: new Set()
      };
    });

    WORK_DAYS.forEach(day => {
      const daySchedule = schedule[day];
      let dayHasMatches = false;
      
      if (daySchedule && daySchedule.timeSlots) {
        Object.values(daySchedule.timeSlots).forEach(timeSlot => {
          Object.entries(timeSlot).forEach(([discipline, match]) => {
            if (match) {
              totalMatches++;
              dayHasMatches = true;
              byDiscipline[discipline].assigned++;
              byDiscipline[discipline].days.add(day);
            }
            byDiscipline[discipline].total++;
          });
        });
      }
      
      if (dayHasMatches) activeDays++;
    });

    // Calcular días activos por disciplina
    Object.keys(byDiscipline).forEach(discipline => {
      byDiscipline[discipline].activeDays = byDiscipline[discipline].days.size;
    });

    const utilizationRate = (totalMatches / (WORK_DAYS.length * AVAILABLE_TIMES.length * Object.keys(DISCIPLINES_CONFIG).length)) * 100;

    // Validar alternancia
    const alternationLogic = createAlternationLogic();
    const validation = alternationLogic.validateAlternationPattern(schedule);

    return {
      totalMatches,
      activeDays,
      utilizationRate,
      byDiscipline,
      alternationValid: validation.isValid,
      alternationErrors: validation.errors,
      alternationWarnings: validation.warnings
    };
  }

  /**
   * Obtiene estadísticas de un día específico
   */
  getDayStats(schedule, day) {
    const stats = { futbol: 0, voley: 0, basquet: 0, total: 0 };
    const daySchedule = schedule[day];
    
    if (daySchedule && daySchedule.timeSlots) {
      Object.values(daySchedule.timeSlots).forEach(timeSlot => {
        Object.entries(timeSlot).forEach(([discipline, match]) => {
          if (match) {
            stats[discipline]++;
            stats.total++;
          }
        });
      });
    }
    
    return stats;
  }

  /**
   * Obtiene número de partidos en un horario específico
   */
  getMatchesAtTime(schedule, day, time) {
    const daySchedule = schedule[day];
    let count = 0;
    
    if (daySchedule && daySchedule.timeSlots && daySchedule.timeSlots[time]) {
      Object.values(daySchedule.timeSlots[time]).forEach(match => {
        if (match) count++;
      });
    }
    
    return count;
  }

  /**
   * Obtiene partidos detallados en un horario específico
   */
  getMatchesAtTimeDetailed(schedule, day, time) {
    const matches = [];
    const daySchedule = schedule[day];
    
    if (daySchedule && daySchedule.timeSlots && daySchedule.timeSlots[time]) {
      Object.entries(daySchedule.timeSlots[time]).forEach(([discipline, match]) => {
        if (match) {
          matches.push({ ...match, discipline });
        }
      });
    }
    
    return matches;
  }

  /**
   * Obtiene partidos por disciplina
   */
  getMatchesByDiscipline(schedule, targetDiscipline) {
    const matches = [];
    
    WORK_DAYS.forEach(day => {
      const daySchedule = schedule[day];
      
      if (daySchedule && daySchedule.timeSlots) {
        Object.entries(daySchedule.timeSlots).forEach(([time, timeSlot]) => {
          const match = timeSlot[targetDiscipline];
          if (match) {
            matches.push({ ...match, day, time });
          }
        });
      }
    });
    
    return matches;
  }

  /**
   * Obtiene actividad de equipos
   */
  getTeamActivity(schedule) {
    const teamStats = {};
    
    WORK_DAYS.forEach(day => {
      const daySchedule = schedule[day];
      
      if (daySchedule && daySchedule.timeSlots) {
        Object.values(daySchedule.timeSlots).forEach(timeSlot => {
          Object.entries(timeSlot).forEach(([discipline, match]) => {
            if (match) {
              const teamA = `${match.equipoA.curso} ${match.equipoA.paralelo}`;
              const teamB = `${match.equipoB.curso} ${match.equipoB.paralelo}`;
              
              [teamA, teamB].forEach(team => {
                if (!teamStats[team]) {
                  teamStats[team] = { matches: 0, disciplines: new Set() };
                }
                teamStats[team].matches++;
                teamStats[team].disciplines.add(discipline);
              });
            }
          });
        });
      }
    });
    
    return Object.entries(teamStats)
      .map(([team, stats]) => [
        team,
        stats.matches,
        Array.from(stats.disciplines).join(', ')
      ])
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10); // Top 10
  }

  /**
   * Obtiene distribución temporal
   */
  getTimeDistribution(schedule) {
    const timeStats = {};
    let totalMatches = 0;
    
    AVAILABLE_TIMES.forEach(time => {
      timeStats[time] = 0;
      
      WORK_DAYS.forEach(day => {
        timeStats[time] += this.getMatchesAtTime(schedule, day, time);
      });
      
      totalMatches += timeStats[time];
    });
    
    return Object.entries(timeStats).map(([time, count]) => [
      time,
      count,
      totalMatches > 0 ? ((count / totalMatches) * 100).toFixed(1) + '%' : '0%'
    ]);
  }

  /**
   * Valida alternancia de un día
   */
  validateDayAlternation(schedule, day, expectedDisciplines) {
    const daySchedule = schedule[day];
    
    if (!daySchedule || !daySchedule.timeSlots) return false;
    
    const foundDisciplines = new Set();
    
    Object.values(daySchedule.timeSlots).forEach(timeSlot => {
      Object.keys(timeSlot).forEach(discipline => {
        if (timeSlot[discipline]) {
          foundDisciplines.add(discipline);
        }
      });
    });
    
    return expectedDisciplines.every(discipline => foundDisciplines.has(discipline));
  }

  /**
   * Valida datos de exportación
   */
  validateExportData(schedule) {
    const validation = {
      isValid: true,
      errors: [],
      warnings: []
    };

    if (!schedule || Object.keys(schedule).length === 0) {
      validation.isValid = false;
      validation.errors.push('Cronograma vacío');
      return validation;
    }

    WORK_DAYS.forEach(day => {
      if (!schedule[day]) {
        validation.warnings.push(`Día ${day} no tiene cronograma`);
      }
    });

    return validation;
  }

  /**
   * Genera timestamp para nombres de archivo
   */
  getTimestamp() {
    return new Date().toISOString().slice(0, 19).replace(/[:-]/g, '').replace('T', '_');
  }

  /**
   * Obtiene formatos soportados
   */
  getSupportedFormats() {
    return Object.keys(this.exportFormats);
  }
}

/**
 * Función de utilidad para exportación rápida
 * @param {Object} schedule - Cronograma completo
 * @param {string} format - Formato de exportación
 * @param {Object} options - Opciones adicionales
 */
export function exportSchedule(schedule, format = 'excel', options = {}) {
  const manager = new ExportManager();
  return manager.export(schedule, format, options);
}

/**
 * Función de utilidad para exportación múltiple
 * @param {Object} schedule - Cronograma completo
 * @param {Array} formats - Formatos a exportar
 * @param {Object} options - Opciones adicionales
 */
export function exportMultipleFormats(schedule, formats = ['excel', 'json'], options = {}) {
  const manager = new ExportManager();
  const results = [];
  
  formats.forEach(format => {
    try {
      const result = manager.export(schedule, format, options);
      results.push(result);
    } catch (error) {
      results.push({
        success: false,
        format,
        error: error.message
      });
    }
  });
  
  return results;
}
