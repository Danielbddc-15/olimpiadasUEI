import React, { useState } from 'react';
import '../styles/OlympicsConfig.css';

const OlympicsConfig = ({ 
  isOpen, 
  onClose, 
  olympicsWeeks, 
  customTimes, 
  onUpdateWeeks, 
  onUpdateTimes 
}) => {
  const [weeks, setWeeks] = useState(olympicsWeeks);
  const [times, setTimes] = useState([...customTimes]);
  const [newTime, setNewTime] = useState('');

  if (!isOpen) return null;

  const handleSave = () => {
    onUpdateWeeks(weeks);
    onUpdateTimes(times);
    onClose();
  };

  const addTime = () => {
    if (newTime && !times.includes(newTime)) {
      const newTimes = [...times, newTime].sort();
      setTimes(newTimes);
      setNewTime('');
    }
  };

  const removeTime = (timeToRemove) => {
    if (times.length > 1) {
      setTimes(times.filter(time => time !== timeToRemove));
    }
  };

  const resetToDefault = () => {
    const defaultTimes = [
      '08:00', '08:45', '09:30', '10:15', '11:00', '11:45',
      '12:30', '13:15', '14:00', '14:45', '15:30', '16:15'
    ];
    setTimes(defaultTimes);
  };

  return (
    <div className="olympics-config-overlay">
      <div className="olympics-config-modal">
        <div className="olympics-config-header">
          <h2>⚙️ Configuración de Olimpiadas</h2>
          <button 
            className="olympics-config-close" 
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className="olympics-config-content">
          {/* Configuración de semanas */}
          <div className="config-section">
            <h3>📅 Duración de las Olimpiadas</h3>
            <div className="weeks-config">
              <label htmlFor="weeks-input">Número de semanas:</label>
              <input
                id="weeks-input"
                type="number"
                min="1"
                max="12"
                value={weeks}
                onChange={(e) => setWeeks(parseInt(e.target.value))}
                className="weeks-input"
              />
              <span className="weeks-help">
                Las olimpiadas durarán {weeks} semana{weeks !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {/* Configuración de horarios */}
          <div className="config-section">
            <h3>🕐 Horarios de Juego</h3>
            
            <div className="times-add">
              <input
                type="time"
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
                className="time-input"
              />
              <button 
                onClick={addTime}
                className="add-time-btn"
                disabled={!newTime || times.includes(newTime)}
              >
                ➕ Agregar
              </button>
              <button 
                onClick={resetToDefault}
                className="reset-times-btn"
              >
                🔄 Horarios por defecto
              </button>
            </div>

            <div className="times-list">
              {times.map((time, index) => (
                <div key={index} className="time-item">
                  <span className="time-value">{time}</span>
                  <button 
                    onClick={() => removeTime(time)}
                    className="remove-time-btn"
                    disabled={times.length <= 1}
                    title="Eliminar horario"
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>
            
            <div className="times-summary">
              Total de horarios disponibles: {times.length}
            </div>
          </div>

          {/* Nueva lógica de disciplinas */}
          <div className="config-section">
            <h3>🏃‍♂️ Lógica de Disciplinas</h3>
            <div className="discipline-logic">
              <div className="discipline-rule">
                <span className="discipline-icon">⚽</span>
                <strong>Fútbol:</strong> Todos los días
              </div>
              <div className="discipline-rule">
                <span className="discipline-icon">🏐</span>
                <strong>Vóley:</strong> Días impares (Lunes, Miércoles, Viernes)
              </div>
              <div className="discipline-rule">
                <span className="discipline-icon">🏀</span>
                <strong>Básquet:</strong> Días pares (Martes, Jueves)
              </div>
              <div className="flexibility-note">
                <span className="flexibility-icon">🔄</span>
                <strong>Flexibilidad:</strong> Los equipos pueden jugar múltiples partidos por d��a
              </div>
            </div>
          </div>
        </div>

        <div className="olympics-config-footer">
          <button 
            onClick={onClose}
            className="config-btn config-btn-cancel"
          >
            Cancelar
          </button>
          <button 
            onClick={handleSave}
            className="config-btn config-btn-save"
          >
            💾 Guardar Configuración
          </button>
        </div>
      </div>
    </div>
  );
};

export default OlympicsConfig;
