import React, { useCallback, useEffect, useState } from 'react';
import { ScheduleSetup } from '../ScheduleSetup';
import { AdminDaySchedule } from './AdminDaySchedule';
import type { AdminScreenId } from './AdminApp';

interface AdminScheduleScreenProps {
  onNavigate: (screen: AdminScreenId) => void;
}

interface ScheduleState {
  status: 'needs_year_selection' | 'ready' | 'initializing' | null;
  primaryYear: number | null;
  secondaryYears: number[];
  generatedMonths: string[];
  lastGenerated: string | null;
  currentYear: number | null;
}

const EMPTY_STATE: ScheduleState = {
  status: null,
  primaryYear: null,
  secondaryYears: [],
  generatedMonths: [],
  lastGenerated: null,
  currentYear: null,
};

const loadScheduleState = async (): Promise<ScheduleState> => {
  const [statusRaw, config] = await Promise.all([
    window.electronAPI?.schedule?.initialize().catch(() => null),
    window.electronAPI?.schedule?.getCurrentConfig().catch(() => null),
  ]);

  return {
    status: (statusRaw as ScheduleState['status']) ?? null,
    primaryYear: typeof config?.primaryYear === 'number' && config.primaryYear > 0 ? config.primaryYear : null,
    secondaryYears: Array.isArray(config?.secondaryYears) ? config.secondaryYears : [],
    generatedMonths: Array.isArray(config?.generatedMonths) ? config.generatedMonths : [],
    lastGenerated: typeof config?.lastGenerated === 'string' && config.lastGenerated ? config.lastGenerated : null,
    currentYear: typeof config?.currentYear === 'number' ? config.currentYear : null,
  };
};

export const AdminScheduleScreen: React.FC<AdminScheduleScreenProps> = () => {
  const [state, setState] = useState<ScheduleState>(EMPTY_STATE);
  const [loading, setLoading] = useState(true);
  const [showSetup, setShowSetup] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    const next = await loadScheduleState();
    setState(next);
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const handleReset = async () => {
    const confirmed = window.confirm(
      '¿Estás seguro de que quieres resetear la programación?\n\n' +
        'Se borrará toda la programación generada y deberás elegir un año nuevamente para volver a generarla.'
    );
    if (!confirmed) return;

    setResetting(true);
    setMessage(null);
    try {
      const result = await window.electronAPI.schedule.reset();
      if (!result.success) {
        throw new Error(result.error || 'Error desconocido al resetear la programación');
      }
      await reload();
      setMessage({ type: 'ok', text: 'Programación reseteada correctamente.' });
    } catch (error) {
      console.error('❌ [Admin] Error reseteando programación:', error);
      setMessage({ type: 'error', text: `No se pudo resetear la programación: ${error instanceof Error ? error.message : String(error)}` });
    } finally {
      setResetting(false);
    }
  };

  const handleSetupComplete = async (year: number) => {
    console.log(`✅ [Admin] Programación generada para el año ${year}`);
    setShowSetup(false);
    await reload();
    setMessage({ type: 'ok', text: `Programación generada para el año ${year}.` });
  };

  if (showSetup) {
    return <ScheduleSetup onSetupComplete={handleSetupComplete} onCancel={() => setShowSetup(false)} />;
  }

  const isReady = state.status === 'ready' && state.primaryYear != null;

  return (
    <div className="admin-schedule">
      {loading && (
        <div className="admin-panel">
          <p className="admin-loading">Consultando el estado de la programación...</p>
        </div>
      )}

      {!loading && (
        <>
          <div className="admin-panel">
            <div className="admin-schedule-status-row">
              <span className={`admin-status-badge ${isReady ? 'ok' : 'warn'}`}>
                {isReady ? 'Programación activa' : 'Sin programación'}
              </span>
              {state.status === 'initializing' && (
                <span className="admin-status-badge">Inicializando...</span>
              )}
            </div>

            {(isReady || state.primaryYear != null) && (
              <ul className="admin-summary-list">
                <li>
                  <span className="admin-summary-key">Año principal:</span>
                  <span className="admin-summary-value">{state.primaryYear}</span>
                </li>
                {state.secondaryYears.length > 0 && (
                  <li>
                    <span className="admin-summary-key">Años secundarios:</span>
                    <span className="admin-summary-value">{state.secondaryYears.join(', ')}</span>
                  </li>
                )}
                <li>
                  <span className="admin-summary-key">Meses generados:</span>
                  <span className="admin-summary-value">{state.generatedMonths.length}</span>
                </li>
                {state.lastGenerated && (
                  <li>
                    <span className="admin-summary-key">Última generación:</span>
                    <span className="admin-summary-value">
                      {new Date(state.lastGenerated).toLocaleDateString('es', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </li>
                )}
              </ul>
            )}

            {!isReady && state.primaryYear == null && (
              <p className="admin-schedule-empty-text">
                No hay programación generada todavía. Genera una eligiendo el año de transmisión.
              </p>
            )}
          </div>

          {message && (
            <div className={`admin-message ${message.type}`}>
              {message.text}
            </div>
          )}

          <div className="admin-panel">
            <h3>Generar programación</h3>
            <p className="admin-panel-hint">
              Elige el año principal y el sistema asignará automáticamente los programas a los
              canales y distribuirá los horarios durante todo el año.
            </p>
            <div className="admin-actions">
              <button className="admin-button-primary" onClick={() => setShowSetup(true)}>
                {isReady ? 'Regenerar Programación' : 'Generar Programación'}
              </button>
            </div>
          </div>

          <AdminDaySchedule key={state.primaryYear ?? 'none'} />

          <div className="admin-panel admin-danger-panel">
            <h3>Zona de riesgo</h3>
            <p className="admin-panel-hint">
              Resetear la programación borra toda la programación generada. Deberás elegir un año
              nuevamente para volver a generarla.
            </p>
            <div className="admin-actions">
              <button className="admin-button-danger" onClick={handleReset} disabled={resetting}>
                {resetting ? 'Resetando...' : 'Resetear Programación'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};