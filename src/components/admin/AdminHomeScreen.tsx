import React, { useCallback, useEffect, useState } from 'react';
import type { Channel } from '../../types/tv.types';
import type { TVShow } from '../../types/show.types';
import { channelManager } from '../../features/channels/channelManager';
import { showManager } from '../../features/shows/showManager';
import type { AdminScreenId } from './AdminApp';

interface AdminHomeScreenProps {
  onNavigate: (screen: AdminScreenId) => void;
}

type ScheduleStatus = 'needs_year_selection' | 'ready' | 'initializing';

interface HomeData {
  channels: Channel[];
  shows: TVShow[];
  scheduleStatus: ScheduleStatus | null;
  primaryYear: number | null;
  generatedMonths: string[];
  lastGenerated: string | null;
}

const loadHomeData = async (): Promise<HomeData> => {
  const [channels, shows, scheduleStatusRaw, config] = await Promise.all([
    channelManager.initialize().then(() => channelManager.getChannels()).catch(() => [] as Channel[]),
    showManager.getShows().catch(() => [] as TVShow[]),
    window.electronAPI?.schedule?.initialize().catch(() => null as ScheduleStatus | null),
    window.electronAPI?.schedule?.getCurrentConfig().catch(() => null as any),
  ]);

  return {
    channels,
    shows,
    scheduleStatus: (scheduleStatusRaw as ScheduleStatus | null) ?? null,
    primaryYear: typeof config?.primaryYear === 'number' && config.primaryYear > 0 ? config.primaryYear : null,
    generatedMonths: Array.isArray(config?.generatedMonths) ? config.generatedMonths : [],
    lastGenerated: typeof config?.lastGenerated === 'string' && config.lastGenerated ? config.lastGenerated : null,
  };
};

export const AdminHomeScreen: React.FC<AdminHomeScreenProps> = ({ onNavigate }) => {
  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const result = await loadHomeData();
    setData(result);
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const enabledChannels = (data?.channels || []).filter(ch => ch.isEnabled !== false);
  const totalEpisodes = (data?.shows || []).reduce(
    (total, show) => total + show.seasons.reduce((s, season) => s + (season.episodes?.length || 0), 0),
    0
  );

  const scheduleReady = data?.scheduleStatus === 'ready' && data?.primaryYear != null;

  return (
    <div className="admin-home">
      {loading && (
        <div className="admin-panel">
          <p className="admin-loading">Cargando resumen de la configuración...</p>
        </div>
      )}

      {!loading && !data && (
        <div className="admin-panel admin-error-panel">
          <p>No se pudo cargar la información de configuración.</p>
        </div>
      )}

      {!loading && data && (
        <>
          {/* Stat cards */}
          <div className="admin-stats">
            <button className="admin-stat" onClick={() => onNavigate('channels')} title="Administrar canales">
              <span className="admin-stat-icon">📡</span>
              <span className="admin-stat-value">{enabledChannels.length}{data.channels.length !== enabledChannels.length ? ` / ${data.channels.length}` : ''}</span>
              <span className="admin-stat-label">Canales</span>
            </button>

            <button className="admin-stat" onClick={() => onNavigate('shows')} title="Administrar programas">
              <span className="admin-stat-icon">🎬</span>
              <span className="admin-stat-value">{data.shows.length}</span>
              <span className="admin-stat-label">Programas</span>
            </button>

            <button className="admin-stat" onClick={() => onNavigate('schedule')} title="Ver programación">
              <span className="admin-stat-icon">🎞️</span>
              <span className="admin-stat-value">{totalEpisodes}</span>
              <span className="admin-stat-label">Episodios</span>
            </button>

            <button className={`admin-stat ${scheduleReady ? '' : 'admin-stat-warning'}`} onClick={() => onNavigate('schedule')} title="Ver programación">
              <span className="admin-stat-icon">📅</span>
              <span className="admin-stat-value">
                {scheduleReady ? data.primaryYear : '—'}
              </span>
              <span className="admin-stat-label">
                {scheduleReady ? 'Programación activa' : 'Sin programación'}
              </span>
            </button>
          </div>

          {/* Resumen de programación */}
          <div className="admin-panel">
            <h3>Resumen de la programación</h3>
            {scheduleReady ? (
              <ul className="admin-summary-list">
                <li>
                  <span className="admin-summary-key">Año principal:</span>
                  <span className="admin-summary-value">{data.primaryYear}</span>
                </li>
                <li>
                  <span className="admin-summary-key">Meses generados:</span>
                  <span className="admin-summary-value">{data.generatedMonths.length}</span>
                </li>
                {data.lastGenerated && (
                  <li>
                    <span className="admin-summary-key">Última generación:</span>
                    <span className="admin-summary-value">
                      {new Date(data.lastGenerated).toLocaleDateString('es', {
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
            ) : (
              <div className="admin-empty-schedule">
                <p>
                  Todavía no hay una programación generada. Crea o revisa tus canales y programas,
                  y luego genera la programación.
                </p>
                <div className="admin-actions">
                  <button className="admin-button-primary" onClick={() => onNavigate('schedule')}>
                    Configurar Programación
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Acciones rápidas */}
          <div className="admin-panel">
            <h3>Acciones rápidas</h3>
            <div className="admin-actions">
              <button className="admin-button-primary" onClick={() => onNavigate('channels')}>
                + Crear Canal
              </button>
              <button className="admin-button-primary" onClick={() => onNavigate('shows')}>
                + Crear Programa
              </button>
              <button className="admin-button-secondary" onClick={() => onNavigate('schedule')}>
                Resetear Programación
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};