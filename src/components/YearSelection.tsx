import React, { useState, useEffect } from 'react';
import '../styles/year-selection.css';

interface YearSelectionProps {
  onYearSelected: (year: number) => Promise<void>;
  isLoading?: boolean;
  error?: string | null;
}

/**
 * Componente para la selección inicial del año de programación
 * Se muestra cuando el usuario usa la aplicación por primera vez
 */
export const YearSelection: React.FC<YearSelectionProps> = ({
  onYearSelected,
  isLoading = false,
  error = null
}) => {
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Generar lista de años disponibles (desde 1950 hasta el año actual)
  const currentYear = new Date().getFullYear();
  const availableYears = Array.from(
    { length: currentYear - 1950 + 1 }, 
    (_, i) => currentYear - i
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isSubmitting || isLoading) return;
    
    setIsSubmitting(true);
    
    try {
      await onYearSelected(selectedYear);
    } catch (err) {
      console.error('Error seleccionando año:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedYear(parseInt(e.target.value));
  };

  // Selección de años populares
  const popularYears = [1980, 1985, 1990, 1995, 2000, 2005, 2010];

  return (
    <div className="year-selection-overlay">
      <div className="year-selection-modal">
        <div className="year-selection-header">
          <h1 className="app-title">📺 Analog Replay TV</h1>
          <h2 className="selection-title">¡Bienvenido a tu experiencia nostálgica!</h2>
          <p className="selection-description">
            Para comenzar, selecciona el año principal de emisión para tu programación. 
            Los shows de este año tendrán prioridad en la programación de todos los canales.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="year-selection-form">
          <div className="year-input-section">
            <label htmlFor="year-select" className="year-label">
              Año de emisión principal:
            </label>
            
            <div className="year-selector">
              <select
                id="year-select"
                value={selectedYear}
                onChange={handleYearChange}
                disabled={isSubmitting || isLoading}
                className="year-dropdown"
              >
                {availableYears.map(year => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>

            <div className="popular-years">
              <p className="popular-label">Años populares:</p>
              <div className="popular-buttons">
                {popularYears.map(year => (
                  <button
                    key={year}
                    type="button"
                    onClick={() => setSelectedYear(year)}
                    disabled={isSubmitting || isLoading}
                    className={`popular-year-btn ${selectedYear === year ? 'active' : ''}`}
                  >
                    {year}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {error && (
            <div className="year-error">
              <span className="error-icon">⚠️</span>
              <p className="error-message">{error}</p>
            </div>
          )}

          <div className="year-info">
            <div className="info-box">
              <h3>📋 Información sobre la programación:</h3>
              <ul>
                <li>Se priorizarán hasta 6 shows del año {selectedYear}</li>
                <li>Se completará con shows de años anteriores</li>
                <li>Cada show se mostrará 3 veces al día (mañana, tarde, noche)</li>
                <li>La programación se genera automáticamente para todo el año</li>
                <li>Puedes cambiar esta configuración más tarde desde el menú</li>
              </ul>
            </div>
          </div>

          <div className="form-actions">
            <button
              type="submit"
              disabled={isSubmitting || isLoading}
              className="confirm-year-btn"
            >
              {isSubmitting || isLoading ? (
                <>
                  <span className="loading-spinner"></span>
                  Generando programación...
                </>
              ) : (
                <>
                  <span className="confirm-icon">✨</span>
                  Crear programación para {selectedYear}
                </>
              )}
            </button>
          </div>
        </form>

        <div className="year-selection-footer">
          <p className="footer-text">
            Una vez confirmado, comenzará la generación de la programación anual. 
            Este proceso puede tomar unos momentos.
          </p>
        </div>
      </div>
    </div>
  );
};

/**
 * Componente de carga para mostrar mientras se genera la programación
 */
interface ScheduleGenerationLoadingProps {
  message?: string;
}

export const ScheduleGenerationLoading: React.FC<ScheduleGenerationLoadingProps> = ({
  message = "Generando programación..."
}) => {
  const [dots, setDots] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => {
        if (prev.length >= 3) return '';
        return prev + '.';
      });
    }, 500);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="schedule-generation-overlay">
      <div className="schedule-generation-modal">
        <div className="generation-content">
          <div className="loading-animation">
            <div className="tv-screen">
              <div className="screen-lines"></div>
              <div className="screen-static"></div>
            </div>
          </div>
          
          <h2 className="generation-title">{message}{dots}</h2>
          
          <div className="generation-steps">
            <div className="step active">
              <span className="step-icon">📺</span>
              <span className="step-text">Analizando canales disponibles</span>
            </div>
            <div className="step active">
              <span className="step-icon">🎬</span>
              <span className="step-text">Seleccionando shows</span>
            </div>
            <div className="step active">
              <span className="step-icon">📅</span>
              <span className="step-text">Creando programación anual</span>
            </div>
            <div className="step">
              <span className="step-icon">✅</span>
              <span className="step-text">Finalizando configuración</span>
            </div>
          </div>
          
          <p className="generation-description">
            Por favor espera mientras se genera tu programación personalizada. 
            Este proceso incluye la organización de shows por canal y la creación 
            de horarios para todo el año.
          </p>
        </div>
      </div>
    </div>
  );
};

export default YearSelection;