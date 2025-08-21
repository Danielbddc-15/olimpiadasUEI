/**
 * Ejemplo de uso del sistema de gestión de cronogramas deportivos
 * Demuestra cómo usar todas las funcionalidades desarrolladas
 */

import { createScheduler } from './DisciplineScheduler.js';
import { createAlternationLogic } from './AlternationLogic.js';
import { processExcelFile } from './ExcelProcessor.js';
import { exportSchedule } from './ExportManager.js';

/**
 * Ejemplo completo de uso del sistema
 */
export async function runCompleteExample() {
  console.log('🏆 SISTEMA DE GESTIÓN DE CRONOGRAMAS DEPORTIVOS');
  console.log('=====================================');
  
  // 1. Inicializar el sistema
  console.log('\n1️⃣ Inicializando sistema...');
  const scheduler = createScheduler();
  const alternationLogic = createAlternationLogic('voley'); // Empezar con vóley
  
  // 2. Crear datos de ejemplo
  console.log('\n2️⃣ Creando datos de ejemplo...');
  const sampleMatches = createSampleMatches();
  console.log(`✅ Creados ${sampleMatches.length} partidos de ejemplo`);
  
  // 3. Generar cronograma automático
  console.log('\n3️⃣ Generando cronograma automático...');
  const results = scheduler.autoAssignMatches(sampleMatches);
  
  console.log(`✅ Partidos asignados: ${results.assigned.length}`);
  console.log(`⚠️ Conflictos: ${results.conflicts.length}`);
  console.log(`❌ Sin asignar: ${results.unassigned.length}`);
  
  // 4. Obtener y mostrar cronograma
  const schedule = scheduler.getSchedule();
  console.log('\n4️⃣ Cronograma generado:');
  displayScheduleSummary(schedule);
  
  // 5. Validar alternancia
  console.log('\n5️⃣ Validando alternancia...');
  const validation = alternationLogic.validateAlternationPattern(schedule);
  console.log(`✅ Válido: ${validation.isValid}`);
  console.log(`❌ Errores: ${validation.errors.length}`);
  console.log(`⚠️ Advertencias: ${validation.warnings.length}`);
  
  // 6. Generar estadísticas
  console.log('\n6️⃣ Estadísticas del cronograma:');
  const stats = scheduler.getScheduleStats();
  displayStatistics(stats);
  
  // 7. Generar reporte de alternancia
  console.log('\n7️⃣ Reporte de alternancia:');
  const report = alternationLogic.generateAlternationReport(schedule);
  displayAlternationReport(report);
  
  return {
    scheduler,
    alternationLogic,
    schedule,
    results,
    validation,
    stats,
    report
  };
}

/**
 * Ejemplo de importación desde Excel
 */
export async function exampleExcelImport(fileUrl) {
  console.log('\n📂 EJEMPLO DE IMPORTACIÓN EXCEL');
  console.log('==============================');
  
  try {
    // Procesar archivo Excel
    const result = await processExcelFile(fileUrl);
    
    console.log('✅ Archivo procesado correctamente');
    console.log(`📊 Partidos encontrados: ${result.data.matches.length}`);
    console.log(`🏆 Disciplinas: ${Array.from(result.data.disciplines).join(', ')}`);
    
    // Mostrar validación
    if (result.validation.isValid) {
      console.log('✅ Validación: Correcta');
    } else {
      console.log('❌ Validación: Con errores');
      result.validation.errors.forEach(error => {
        console.log(`   - ${error}`);
      });
    }
    
    // Mostrar advertencias
    if (result.validation.warnings.length > 0) {
      console.log('⚠️ Advertencias:');
      result.validation.warnings.forEach(warning => {
        console.log(`   - ${warning}`);
      });
    }
    
    return result;
    
  } catch (error) {
    console.error('❌ Error procesando archivo:', error.message);
    throw error;
  }
}

/**
 * Ejemplo de exportación múltiple
 */
export async function exampleMultipleExport(schedule) {
  console.log('\n📤 EJEMPLO DE EXPORTACIÓN MÚLTIPLE');
  console.log('===================================');
  
  const formats = ['excel', 'json', 'csv'];
  const results = [];
  
  for (const format of formats) {
    try {
      console.log(`📋 Exportando a ${format.toUpperCase()}...`);
      
      const result = await exportSchedule(schedule, format, {
        filename: `cronograma_ejemplo_${format}`,
        includeSummary: true,
        includeStats: true
      });
      
      console.log(`✅ ${format.toUpperCase()}: ${result.filename}`);
      results.push(result);
      
    } catch (error) {
      console.error(`❌ Error exportando ${format}:`, error.message);
      results.push({
        success: false,
        format,
        error: error.message
      });
    }
  }
  
  return results;
}

/**
 * Ejemplo de optimización de cronograma
 */
export function exampleScheduleOptimization() {
  console.log('\n🔧 EJEMPLO DE OPTIMIZACIÓN');
  console.log('==========================');
  
  const scheduler = createScheduler();
  const alternationLogic = createAlternationLogic('voley');
  
  // Crear partidos con diferentes prioridades
  const matches = createSampleMatches();
  
  // Optimizar distribución
  const distribution = alternationLogic.optimizeMatchDistribution(matches);
  
  console.log('📊 Distribución optimizada:');
  Object.entries(distribution).forEach(([discipline, data]) => {
    console.log(`   ${discipline}: ${data.matches.length} partidos`);
    console.log(`   Días recomendados: ${data.recommendedDays.join(', ')}`);
  });
  
  return distribution;
}

/**
 * Crear datos de ejemplo para pruebas
 */
function createSampleMatches() {
  const matches = [];
  let matchId = 1;
  
  // Partidos de fútbol
  for (let i = 0; i < 10; i++) {
    matches.push({
      id: `futbol_${matchId++}`,
      disciplina: 'futbol',
      equipoA: { curso: '8', paralelo: String.fromCharCode(65 + i) },
      equipoB: { curso: '8', paralelo: String.fromCharCode(66 + i) },
      grupo: `Grupo ${Math.ceil((i + 1) / 2)}`,
      fase: 'grupos1',
      estado: 'pendiente'
    });
  }
  
  // Partidos de vóley
  for (let i = 0; i < 8; i++) {
    matches.push({
      id: `voley_${matchId++}`,
      disciplina: 'voley',
      equipoA: { curso: '9', paralelo: String.fromCharCode(65 + i) },
      equipoB: { curso: '9', paralelo: String.fromCharCode(66 + i) },
      grupo: `Grupo ${Math.ceil((i + 1) / 2)}`,
      fase: 'grupos1',
      estado: 'pendiente'
    });
  }
  
  // Partidos de básquet
  for (let i = 0; i < 6; i++) {
    matches.push({
      id: `basquet_${matchId++}`,
      disciplina: 'basquet',
      equipoA: { curso: '1', paralelo: String.fromCharCode(65 + i) },
      equipoB: { curso: '1', paralelo: String.fromCharCode(66 + i) },
      grupo: `Grupo ${Math.ceil((i + 1) / 2)}`,
      fase: 'grupos1',
      estado: 'pendiente'
    });
  }
  
  return matches;
}

/**
 * Mostrar resumen del cronograma
 */
function displayScheduleSummary(schedule) {
  Object.entries(schedule).forEach(([day, dayData]) => {
    console.log(`\n📅 ${day.toUpperCase()}:`);
    console.log(`   Disciplinas activas: ${dayData.disciplines.join(', ')}`);
    
    let matchCount = 0;
    Object.values(dayData.timeSlots).forEach(timeSlot => {
      Object.values(timeSlot).forEach(match => {
        if (match) matchCount++;
      });
    });
    
    console.log(`   Partidos programados: ${matchCount}`);
  });
}

/**
 * Mostrar estadísticas
 */
function displayStatistics(stats) {
  console.log(`📊 Slots totales: ${stats.totalSlots}`);
  console.log(`✅ Slots ocupados: ${stats.assignedSlots}`);
  console.log(`📈 Utilización: ${stats.utilizationRate.toFixed(1)}%`);
  
  console.log('\n🏆 Por disciplina:');
  Object.entries(stats.byDiscipline).forEach(([discipline, data]) => {
    console.log(`   ${discipline}: ${data.assigned}/${data.total} (${data.days.length} días)`);
  });
}

/**
 * Mostrar reporte de alternancia
 */
function displayAlternationReport(report) {
  console.log(`🔄 Patrón válido: ${report.validation.isValid}`);
  console.log(`⚽ Días con fútbol: ${report.statistics.footballDays}`);
  console.log(`🏐 Días con vóley: ${report.statistics.volleyDays}`);
  console.log(`🏀 Días con básquet: ${report.statistics.basketballDays}`);
  
  if (report.recommendations.length > 0) {
    console.log('\n💡 Recomendaciones:');
    report.recommendations.forEach(rec => {
      console.log(`   - ${rec.reason}`);
    });
  }
}

/**
 * Función de demostración rápida
 */
export async function quickDemo() {
  console.log('🚀 DEMOSTRACIÓN RÁPIDA DEL SISTEMA');
  console.log('==================================');
  
  // Ejecutar ejemplo completo
  const result = await runCompleteExample();
  
  // Mostrar resultados finales
  console.log('\n🎯 RESULTADOS FINALES:');
  console.log(`✅ Sistema inicializado correctamente`);
  console.log(`📅 Cronograma generado para ${Object.keys(result.schedule).length} días`);
  console.log(`🏆 ${Object.keys(result.stats.byDiscipline).length} disciplinas gestionadas`);
  console.log(`📊 Utilización: ${result.stats.utilizationRate.toFixed(1)}%`);
  
  if (result.validation.isValid) {
    console.log(`✅ Alternancia válida`);
  } else {
    console.log(`⚠️ Alternancia con ${result.validation.errors.length} errores`);
  }
  
  console.log('\n🎉 ¡Demo completada exitosamente!');
  
  return result;
}

/**
 * Función para probar integración con Firebase
 */
export async function testFirebaseIntegration(db) {
  console.log('\n🔥 PRUEBA DE INTEGRACIÓN FIREBASE');
  console.log('==================================');
  
  try {
    // Simular carga de partidos desde Firebase
    console.log('📡 Simulando carga desde Firebase...');
    
    // En una implementación real, aquí cargarías desde Firebase:
    // const snapshot = await getDocs(collection(db, "matches"));
    // const matches = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
    
    const matches = createSampleMatches();
    console.log(`✅ Cargados ${matches.length} partidos`);
    
    // Procesar con el sistema
    const scheduler = createScheduler();
    const results = scheduler.autoAssignMatches(matches);
    const schedule = scheduler.getSchedule();
    
    console.log(`✅ Cronograma generado`);
    console.log(`📊 ${results.assigned.length} partidos asignados`);
    
    // Simular guardado en Firebase
    console.log('💾 Simulando guardado en Firebase...');
    
    // En una implementación real, aquí guardarías el cronograma:
    // await updateDoc(doc(db, "schedules", "current"), { schedule });
    
    console.log('✅ Integración Firebase completada');
    
    return {
      matches,
      schedule,
      results
    };
    
  } catch (error) {
    console.error('❌ Error en integración Firebase:', error);
    throw error;
  }
}

// Exportar función principal para uso directo
export default quickDemo;
