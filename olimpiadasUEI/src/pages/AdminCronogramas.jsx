import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import { createScheduler, DISCIPLINES_CONFIG, WORK_DAYS, AVAILABLE_TIMES } from '../utils/DisciplineScheduler.js';
import { createAlternationLogic } from '../utils/AlternationLogic.js';
import { processExcelFile, ExcelProcessor } from '../utils/ExcelProcessor.js';
import { exportSchedule } from '../utils/ExportManager.js';
import '../styles/AdminCronogramas.css';

export default function AdminCronogramas() {
  const navigate = useNavigate();
  
  // Estados principales
  const [scheduler, setScheduler] = useState(null);
  const [alternationLogic, setAlternationLogic] = useState(null);
  const [currentSchedule, setCurrentSchedule] = useState({});
  const [loading, setLoading] = useState(false);
  
  // Estados para datos
  const [matches, setMatches] = useState([]);
  const [filteredMatches, setFilteredMatches] = useState([]);
  
  // Estados para filtros y configuración
  const [selectedDiscipline, setSelectedDiscipline] = useState('todas');
  const [startingAlternation, setStartingAlternation] = useState('voley');
  const [viewMode, setViewMode] = useState('cronograma'); // cronograma, importar, exportar, configurar
  
  // Estados para importación
  const [importFile, setImportFile] = useState(null);
  const [importProgress, setImportProgress] = useState(null);
  const [importResults, setImportResults] = useState(null);
  
  // Estados para exportación
  const [exportFormat, setExportFormat] = useState('excel');
  const [exportOptions, setExportOptions] = useState({
    includeSummary: true,
    includeStats: true
  });
  
  // Estados para estadísticas
  const [scheduleStats, setScheduleStats] = useState(null);
  const [alternationReport, setAlternationReport] = useState(null);

  // Inicialización
  useEffect(() => {
    initializeSystem();
    loadMatches();
  }, []);

  useEffect(() => {
    if (scheduler && matches.length > 0) {
      generateSchedule();
    }
  }, [scheduler, matches, startingAlternation]);

  const initializeSystem = () => {
    const newScheduler = createScheduler();
    const newAlternationLogic = createAlternationLogic(startingAlternation);
    
    setScheduler(newScheduler);
    setAlternationLogic(newAlternationLogic);
  };

  const loadMatches = async () => {
    setLoading(true);
    try {
      const allMatches = [];
      
      // Cargar partidos de todas las disciplinas
      for (const discipline of Object.keys(DISCIPLINES_CONFIG)) {
        const q = query(
          collection(db, "matches"),
          where("disciplina", "==", discipline),
          where("estado", "in", ["pendiente", "programado"])
        );
        
        const snapshot = await getDocs(q);
        const disciplineMatches = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        allMatches.push(...disciplineMatches);
      }
      
      setMatches(allMatches);
      setFilteredMatches(allMatches);
    } catch (error) {
      console.error('Error cargando partidos:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateSchedule = () => {
    if (!scheduler || !alternationLogic) return;
    
    setLoading(true);
    
    try {
      // Limpiar cronograma anterior
      scheduler.clearSchedule();
      
      // Asignar partidos automáticamente
      const results = scheduler.autoAssignMatches(filteredMatches);
      
      // Obtener cronograma generado
      const newSchedule = scheduler.getSchedule();
      setCurrentSchedule(newSchedule);
      
      // Generar estadísticas
      const stats = scheduler.getScheduleStats();
      setScheduleStats(stats);
      
      // Generar reporte de alternancia
      const report = alternationLogic.generateAlternationReport(newSchedule);
      setAlternationReport(report);
      
      console.log('Cronograma generado:', {
        schedule: newSchedule,
        results,
        stats,
        report
      });
      
    } catch (error) {
      console.error('Error generando cronograma:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileImport = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    setImportFile(file);
    setLoading(true);
    setImportProgress('Procesando archivo...');
    
    try {
      const result = await processExcelFile(file);
      
      setImportResults(result);
      setImportProgress('Archivo procesado correctamente');
      
      if (result.validation.isValid) {
        // Integrar partidos importados
        const importedMatches = result.data.matches;
        setMatches(prev => [...prev, ...importedMatches]);
        setFilteredMatches(prev => [...prev, ...importedMatches]);
      }
      
    } catch (error) {
      console.error('Error importando archivo:', error);
      setImportProgress(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (!currentSchedule || Object.keys(currentSchedule).length === 0) {
      alert('No hay cronograma para exportar');
      return;
    }
    
    setLoading(true);
    
    try {
      const result = await exportSchedule(currentSchedule, exportFormat, {
        ...exportOptions,
        filename: `cronograma_${new Date().toISOString().slice(0, 10)}`
      });
      
      console.log('Exportación completada:', result);
      alert(`Cronograma exportado correctamente como ${result.filename}`);
      
    } catch (error) {
      console.error('Error exportando:', error);
      alert(`Error al exportar: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const applyDisciplineFilter = (discipline) => {
    if (discipline === 'todas') {
      setFilteredMatches(matches);
    } else {
      setFilteredMatches(matches.filter(match => match.disciplina === discipline));
    }
    setSelectedDiscipline(discipline);
  };

  const updateAlternationStart = (discipline) => {
    setStartingAlternation(discipline);
    const newLogic = createAlternationLogic(discipline);
    setAlternationLogic(newLogic);
  };

  const renderScheduleGrid = () => {
    if (!currentSchedule || Object.keys(currentSchedule).length === 0) {
      return (
        <div className="empty-schedule">
          <div className="empty-icon">📅</div>
          <h3>No hay cronograma generado</h3>
          <p>Carga partidos y genera el cronograma automáticamente</p>
          <button 
            className="generate-btn"
            onClick={generateSchedule}
            disabled={matches.length === 0}
          >
            Generar Cronograma
          </button>
        </div>
      );
    }

    return (
      <div className="schedule-grid">
        <div className="grid-header">
          <div className="time-column">Hora</div>
          {WORK_DAYS.map(day => (
            <div key={day} className="day-column">
              {day.charAt(0).toUpperCase() + day.slice(1)}
            </div>
          ))}
        </div>
        
        {AVAILABLE_TIMES.map(time => (
          <div key={time} className="time-row">
            <div className="time-label">{time}</div>
            {WORK_DAYS.map(day => (
              <div key={`${day}-${time}`} className="schedule-cell">
                {currentSchedule[day]?.timeSlots?.[time] && 
                  Object.entries(currentSchedule[day].timeSlots[time]).map(([discipline, match]) => 
                    match && (
                      <div key={discipline} className={`match-card discipline-${discipline}`}>
                        <div className="discipline-header">
                          <span className="discipline-icon">
                            {DISCIPLINES_CONFIG[discipline]?.icon}
                          </span>
                          <span className="discipline-name">
                            {DISCIPLINES_CONFIG[discipline]?.name}
                          </span>
                        </div>
                        <div className="match-teams">
                          <span className="team">
                            {match.equipoA.curso}{match.equipoA.paralelo}
                          </span>
                          <span className="vs">vs</span>
                          <span className="team">
                            {match.equipoB.curso}{match.equipoB.paralelo}
                          </span>
                        </div>
                        <div className="match-info">
                          <span className="group">{match.grupo}</span>
                          <span className="phase">{match.fase}</span>
                        </div>
                      </div>
                    )
                  )
                }
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  };

  const renderStatsPanel = () => {
    if (!scheduleStats) return null;

    return (
      <div className="stats-panel">
        <h3>📊 Estadísticas del Cronograma</h3>
        
        <div className="stats-summary">
          <div className="stat-card">
            <div className="stat-value">{scheduleStats.totalSlots}</div>
            <div className="stat-label">Slots Totales</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{scheduleStats.assignedSlots}</div>
            <div className="stat-label">Slots Ocupados</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{scheduleStats.utilizationRate.toFixed(1)}%</div>
            <div className="stat-label">Utilización</div>
          </div>
        </div>

        <div className="discipline-stats">
          <h4>Por Disciplina</h4>
          {Object.entries(scheduleStats.byDiscipline).map(([discipline, stats]) => (
            <div key={discipline} className="discipline-stat">
              <span className="discipline-icon">
                {DISCIPLINES_CONFIG[discipline]?.icon}
              </span>
              <span className="discipline-name">
                {DISCIPLINES_CONFIG[discipline]?.name}
              </span>
              <span className="stat-numbers">
                {stats.assigned}/{stats.total} 
                ({stats.days.length} días)
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderAlternationStatus = () => {
    if (!alternationReport) return null;

    return (
      <div className="alternation-panel">
        <h3>🔄 Estado de Alternancia</h3>
        
        <div className="alternation-status">
          <div className={`status-indicator ${alternationReport.validation.isValid ? 'valid' : 'invalid'}`}>
            {alternationReport.validation.isValid ? '✅ Válido' : '❌ Con errores'}
          </div>
        </div>

        {alternationReport.validation.errors.length > 0 && (
          <div className="alternation-errors">
            <h4>Errores:</h4>
            {alternationReport.validation.errors.map((error, index) => (
              <div key={index} className="error-item">❌ {error}</div>
            ))}
          </div>
        )}

        {alternationReport.validation.warnings.length > 0 && (
          <div className="alternation-warnings">
            <h4>Advertencias:</h4>
            {alternationReport.validation.warnings.map((warning, index) => (
              <div key={index} className="warning-item">⚠️ {warning}</div>
            ))}
          </div>
        )}

        <div className="alternation-pattern">
          <h4>Patrón Esperado:</h4>
          {WORK_DAYS.map(day => {
            const expectedDisciplines = alternationLogic?.getDisciplinesForDay(day) || [];
            return (
              <div key={day} className="day-pattern">
                <span className="day-name">{day}:</span>
                <span className="disciplines">
                  {expectedDisciplines.map(d => DISCIPLINES_CONFIG[d]?.icon).join(' ')}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderImportSection = () => (
    <div className="import-section">
      <h3>📂 Importar desde Excel</h3>
      
      <div className="import-controls">
        <div className="file-input-wrapper">
          <input
            type="file"
            id="excel-file"
            accept=".xlsx,.xls"
            onChange={handleFileImport}
            className="file-input"
          />
          <label htmlFor="excel-file" className="file-input-label">
            📄 Seleccionar archivo Excel
          </label>
        </div>
        
        {importFile && (
          <div className="file-info">
            <span className="file-name">{importFile.name}</span>
            <span className="file-size">
              {(importFile.size / 1024).toFixed(1)} KB
            </span>
          </div>
        )}
      </div>

      {importProgress && (
        <div className="import-progress">
          <div className="progress-message">{importProgress}</div>
        </div>
      )}

      {importResults && (
        <div className="import-results">
          <h4>Resultados de la Importación:</h4>
          
          <div className="validation-summary">
            <div className={`validation-status ${importResults.validation.isValid ? 'valid' : 'invalid'}`}>
              {importResults.validation.isValid ? '✅ Válido' : '❌ Con errores'}
            </div>
            <div className="matches-found">
              Partidos encontrados: {importResults.validation.totalMatches}
            </div>
            <div className="disciplines-found">
              Disciplinas: {importResults.validation.disciplines.join(', ')}
            </div>
          </div>

          {importResults.validation.errors.length > 0 && (
            <div className="import-errors">
              <h5>Errores:</h5>
              {importResults.validation.errors.map((error, index) => (
                <div key={index} className="error-item">❌ {error}</div>
              ))}
            </div>
          )}

          {importResults.validation.warnings.length > 0 && (
            <div className="import-warnings">
              <h5>Advertencias:</h5>
              {importResults.validation.warnings.map((warning, index) => (
                <div key={index} className="warning-item">⚠️ {warning}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderExportSection = () => (
    <div className="export-section">
      <h3>📤 Exportar Cronograma</h3>
      
      <div className="export-controls">
        <div className="export-format">
          <label>Formato:</label>
          <select 
            value={exportFormat} 
            onChange={(e) => setExportFormat(e.target.value)}
            className="format-select"
          >
            <option value="excel">Excel (.xlsx)</option>
            <option value="json">JSON (.json)</option>
            <option value="csv">CSV (.csv)</option>
            <option value="pdf">PDF (Imprimir)</option>
          </select>
        </div>

        <div className="export-options">
          <label>
            <input
              type="checkbox"
              checked={exportOptions.includeSummary}
              onChange={(e) => setExportOptions(prev => ({
                ...prev,
                includeSummary: e.target.checked
              }))}
            />
            Incluir resumen
          </label>
          
          <label>
            <input
              type="checkbox"
              checked={exportOptions.includeStats}
              onChange={(e) => setExportOptions(prev => ({
                ...prev,
                includeStats: e.target.checked
              }))}
            />
            Incluir estadísticas
          </label>
        </div>

        <button 
          className="export-btn"
          onClick={handleExport}
          disabled={!currentSchedule || Object.keys(currentSchedule).length === 0}
        >
          🚀 Exportar Cronograma
        </button>
      </div>
    </div>
  );

  const renderConfigSection = () => (
    <div className="config-section">
      <h3>⚙️ Configuración</h3>
      
      <div className="config-controls">
        <div className="config-group">
          <label>Disciplina inicial para alternancia:</label>
          <select 
            value={startingAlternation} 
            onChange={(e) => updateAlternationStart(e.target.value)}
            className="config-select"
          >
            <option value="voley">Vóley</option>
            <option value="basquet">Básquet</option>
          </select>
        </div>

        <div className="config-group">
          <label>Filtrar por disciplina:</label>
          <select 
            value={selectedDiscipline} 
            onChange={(e) => applyDisciplineFilter(e.target.value)}
            className="config-select"
          >
            <option value="todas">Todas las disciplinas</option>
            {Object.entries(DISCIPLINES_CONFIG).map(([key, config]) => (
              <option key={key} value={key}>
                {config.icon} {config.name}
              </option>
            ))}
          </select>
        </div>

        <div className="config-actions">
          <button 
            className="regenerate-btn"
            onClick={generateSchedule}
            disabled={loading || matches.length === 0}
          >
            🔄 Regenerar Cronograma
          </button>
          
          <button 
            className="clear-btn"
            onClick={() => {
              scheduler?.clearSchedule();
              setCurrentSchedule({});
              setScheduleStats(null);
              setAlternationReport(null);
            }}
          >
            🗑️ Limpiar Cronograma
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="admin-cronogramas-container">
      {/* Header */}
      <div className="admin-header">
        <button onClick={() => navigate('/admin')} className="back-btn">
          ← Volver al Panel
        </button>
        <div className="header-content">
          <div className="header-icon">📅</div>
          <h1 className="admin-title">Gestión de Cronogramas</h1>
          <p className="admin-subtitle">
            Sistema integral para múltiples disciplinas deportivas
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="view-tabs">
        <button 
          className={`tab ${viewMode === 'cronograma' ? 'active' : ''}`}
          onClick={() => setViewMode('cronograma')}
        >
          📅 Cronograma
        </button>
        <button 
          className={`tab ${viewMode === 'importar' ? 'active' : ''}`}
          onClick={() => setViewMode('importar')}
        >
          📂 Importar
        </button>
        <button 
          className={`tab ${viewMode === 'exportar' ? 'active' : ''}`}
          onClick={() => setViewMode('exportar')}
        >
          📤 Exportar
        </button>
        <button 
          className={`tab ${viewMode === 'configurar' ? 'active' : ''}`}
          onClick={() => setViewMode('configurar')}
        >
          ⚙️ Configurar
        </button>
      </div>

      {/* Loading Overlay */}
      {loading && (
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
          <p>Procesando...</p>
        </div>
      )}

      {/* Main Content */}
      <div className="main-content">
        {/* Sidebar with stats and status */}
        <div className="sidebar">
          {renderStatsPanel()}
          {renderAlternationStatus()}
        </div>

        {/* Main Content Area */}
        <div className="content-area">
          {viewMode === 'cronograma' && (
            <div className="cronograma-view">
              <div className="cronograma-header">
                <h2>Cronograma Semanal</h2>
                <div className="legend">
                  {Object.entries(DISCIPLINES_CONFIG).map(([key, config]) => (
                    <div key={key} className="legend-item">
                      <span className="legend-icon">{config.icon}</span>
                      <span className="legend-name">{config.name}</span>
                    </div>
                  ))}
                </div>
              </div>
              {renderScheduleGrid()}
            </div>
          )}

          {viewMode === 'importar' && renderImportSection()}
          {viewMode === 'exportar' && renderExportSection()}
          {viewMode === 'configurar' && renderConfigSection()}
        </div>
      </div>

      {/* Summary Footer */}
      <div className="summary-footer">
        <div className="summary-item">
          <span className="summary-label">Total Partidos:</span>
          <span className="summary-value">{filteredMatches.length}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Disciplinas:</span>
          <span className="summary-value">
            {Object.keys(DISCIPLINES_CONFIG).length}
          </span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Utilización:</span>
          <span className="summary-value">
            {scheduleStats ? `${scheduleStats.utilizationRate.toFixed(1)}%` : '0%'}
          </span>
        </div>
      </div>
    </div>
  );
}
