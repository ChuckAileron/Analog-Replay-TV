import React, { useState } from 'react';
import '../styles/schedule-setup.css';

interface ScheduleSetupProps {
  onSetupComplete: (year: number) => void;
  onCancel: () => void;
}

export const ScheduleSetup: React.FC<ScheduleSetupProps> = ({ onSetupComplete, onCancel }) => {
  const [selectedDecade, setSelectedDecade] = useState<number | null>(null);
  const [selectedYear, setSelectedYear] = useState<number>(2025);
  const [isGenerating, setIsGenerating] = useState(false);

  const currentYear = new Date().getFullYear();
  
  // Generar décadas desde 1950 hasta la década actual
  const getCurrentDecade = (year: number) => Math.floor(year / 10) * 10;
  const currentDecade = getCurrentDecade(currentYear);
  const decades = [];
  
  for (let decade = 1950; decade <= currentDecade; decade += 10) {
    decades.push(decade);
  }

  // Generar años de la década seleccionada
  const getYearsForDecade = (decade: number): number[] => {
    const years = [];
    const startYear = decade;
    const endYear = Math.min(decade + 9, currentYear); // No mostrar años futuros
    
    for (let year = startYear; year <= endYear; year++) {
      years.push(year);
    }
    return years.reverse(); // Mostrar años más recientes primero
  };

  const getDecadeLabel = (decade: number): string => {
    const endYear = Math.min(decade + 9, currentYear);
    if (decade === currentDecade) {
      return `${decade}s (Actual)`;
    }
    return `${decade}s (${decade}-${endYear})`;
  };

  const getYearLabel = (year: number): string => {
    if (year === currentYear) {
      return `${year} (Actual)`;
    }
    
    // Años nostálgicos especiales
    const specialYears: { [key: number]: string } = {
      1999: '(Y2K Era)',
      2000: '(Nuevo Milenio)',
      1990: '(Era Dorada)',
      1980: '(Década Clásica)',
      1970: '(Retro)',
      1960: '(Vintage)',
    };

    return `${year} ${specialYears[year] || ''}`;
  };

  const handleDecadeSelect = (decade: number) => {
    setSelectedDecade(decade);
    // Seleccionar automáticamente el año más reciente de la década
    const years = getYearsForDecade(decade);
    setSelectedYear(years[0]);
  };

  const handleBack = () => {
    setSelectedDecade(null);
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      console.log(`🚀 [ScheduleSetup] Iniciando generación para el año ${selectedYear}`);
      
      const result = await window.electronAPI.schedule.generateYear(selectedYear);
      
      if (result.success) {
        console.log(`✅ [ScheduleSetup] Generación completada para ${selectedYear}`);
        onSetupComplete(selectedYear);
      } else {
        console.error(`❌ [ScheduleSetup] Error en generación:`, result.error);
        alert(`Error al generar programación: ${result.error}`);
        setIsGenerating(false);
      }
    } catch (error) {
      console.error('❌ [ScheduleSetup] Error:', error);
      alert('Error al generar programación');
      setIsGenerating(false);
    }
  };

  return (
    <div className="schedule-setup-overlay">
      <div className="schedule-setup-container">
        <div className="schedule-setup-header">
          <h2>🚀 Configuración Inicial de Programación</h2>
          <p>No se han encontrado programaciones configuradas. Selecciona el año principal para generar la programación inicial.</p>
        </div>

        <div className="schedule-setup-content">
          {!selectedDecade ? (
            // Selección de década
            <div className="decade-selection">
              <h3>Paso 1: Selecciona la Década</h3>
              <div className="decades-grid">
                {decades.map(decade => (
                  <button
                    key={decade}
                    onClick={() => handleDecadeSelect(decade)}
                    className={`decade-button ${decade === currentDecade ? 'current-decade' : ''}`}
                    disabled={isGenerating}
                  >
                    <span className="decade-label">{getDecadeLabel(decade)}</span>
                    <span className="decade-years">
                      {decade === currentDecade ? `${decade}-${currentYear}` : `${decade}-${decade + 9}`}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            // Selección de año específico
            <div className="year-selection">
              <div className="year-selection-header">
                <button onClick={handleBack} className="back-button" disabled={isGenerating}>
                  ← Volver a Décadas
                </button>
                <h3>Paso 2: Selecciona el Año ({selectedDecade}s)</h3>
              </div>
              
              <div className="years-grid">
                {getYearsForDecade(selectedDecade).map(year => (
                  <button
                    key={year}
                    onClick={() => setSelectedYear(year)}
                    className={`year-button ${year === selectedYear ? 'selected' : ''} ${year === currentYear ? 'current-year' : ''}`}
                    disabled={isGenerating}
                  >
                    {getYearLabel(year)}
                  </button>
                ))}
              </div>

              <div className="selected-year-info">
                <h4>Año Seleccionado: {selectedYear}</h4>
                <div className="setup-info">
                  <h3>¿Qué se generará?</h3>
                  <ul>
                    <li>📅 Programación mensual desde el mes actual hasta diciembre</li>
                    <li>📺 Asignación automática de shows a canales</li>
                    <li>⏰ Horarios distribuidos durante todo el día</li>
                    <li>🔄 Rotación inteligente de episodios y temporadas</li>
                  </ul>
                </div>

                <div className="setup-actions">
                  <button
                    onClick={onCancel}
                    disabled={isGenerating}
                    className="cancel-button"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    className="generate-button"
                  >
                    {isGenerating ? (
                      <>
                        <span className="spinner"></span>
                        Generando...
                      </>
                    ) : (
                      'Generar Programación'
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {isGenerating && (
          <div className="generation-progress">
            <div className="progress-bar">
              <div className="progress-fill"></div>
            </div>
            <p>Generando programación para {selectedYear}...</p>
          </div>
        )}
      </div>
    </div>
  );
};