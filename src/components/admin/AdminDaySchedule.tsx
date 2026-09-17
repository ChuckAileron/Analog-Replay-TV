import React, { useCallback, useEffect, useMemo, useState } from 'react';

interface ScheduleEntryLike {
  id: string;
  showId: string | number;
  showName: string;
  season?: number;
  episode?: number;
  episodeTitle?: string;
  channelId: string;
  channelName?: string;
  startTime: string;
  endTime: string;
  duration?: string;
  type?: 'show' | 'commercial' | 'filler';
}

interface ChannelLike {
  id: number | string;
  uuid?: string;
  number: number;
  name: string;
  isEnabled?: boolean;
}

interface ChannelDayEntry {
  channelId: string;
  channelNumber: number;
  channelName: string;
  entries: ScheduleEntryLike[];
}

const SLOT_MINUTES = 30;
const SLOTS_PER_DAY = 1440 / SLOT_MINUTES;

const matchesChannel = (entryChannelId: string, channel: ChannelLike): boolean => {
  return (
    entryChannelId === channel.uuid ||
    entryChannelId === String(channel.id) ||
    (typeof entryChannelId === 'string' && entryChannelId.toLowerCase() === String(channel.name).toLowerCase())
  );
};

const formatMinuteLabel = (minuteOfDay: number): string => {
  const h = Math.floor(minuteOfDay / 60);
  const m = minuteOfDay % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

/**
 * Vista de la programación de un día por canal, con la misma información que
 * muestra la aplicación (cada canal y lo que emite en cada franja de 30 min).
 * Permite validar visualmente que la programación se generó correctamente.
 */
export const AdminDaySchedule: React.FC = () => {
  const [date, setDate] = useState<Date | null>(null);
  const [primaryYear, setPrimaryYear] = useState<number>(new Date().getFullYear());
  const [channels, setChannels] = useState<ChannelLike[]>([]);
  const [entries, setEntries] = useState<ScheduleEntryLike[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadConfigAndDate = useCallback(async () => {
    try {
      const config = await window.electronAPI.schedule.getCurrentConfig().catch(() => null);
      const year =
        typeof config?.primaryYear === 'number' && config.primaryYear > 0
          ? config.primaryYear
          : new Date().getFullYear();
      setPrimaryYear(year);
      // Día actual, pero dentro del año principal de la programación (igual que
      // la app cruza la hora del dispositivo con la programación generada).
      const now = new Date();
      setDate(new Date(year, now.getMonth(), now.getDate()));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    loadConfigAndDate();
  }, [loadConfigAndDate]);

  useEffect(() => {
    if (!date) return;
    const year = date.getFullYear();
    const month = date.getMonth() + 1;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const channelsCfg = await window.electronAPI.loadChannelsConfig().catch(() => null);
        const monthSchedule = await window.electronAPI.schedule.getMonthSchedule(year, month);
        setChannels(channelsCfg?.channels ?? []);
        setEntries(Array.isArray(monthSchedule?.entries) ? monthSchedule.entries : []);
      } catch (err) {
        console.error('❌ [Admin] Error cargando programación del día:', err);
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [date]);

  const dayStart = useMemo(() => {
    if (!date) return 0;
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0).getTime();
  }, [date]);

  const dayEnd = dayStart + 86400000;

  const channelsOfDay = useMemo<ChannelDayEntry[]>(() => {
    if (!date) return [];

    const enabledChannels = channels
      .filter((ch) => ch.isEnabled !== false)
      .sort((a, b) => a.number - b.number);

    const rows: ChannelDayEntry[] = enabledChannels
      .map((ch) => {
        const channelEntries = entries
          .filter(
            (entry) =>
              matchesChannel(entry.channelId, ch) &&
              new Date(entry.startTime).getTime() < dayEnd &&
              new Date(entry.endTime).getTime() > dayStart
          )
          .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

        return {
          channelId: ch.uuid || String(ch.id),
          channelNumber: ch.number,
          channelName: ch.name,
          entries: channelEntries
        };
      })
      .filter((row) => row.entries.length > 0);

    // Canales que aparecen en la programación pero no en la config de canales
    const configuredIds = new Set<string>([
      ...enabledChannels.map((ch) => ch.uuid || String(ch.id)),
      ...enabledChannels.map((ch) => String(ch.id)),
      ...enabledChannels.map((ch) => ch.name.toLowerCase())
    ]);

    const extraChannelIds = new Map<string, { channelId: string; channelName: string; channelNumber: number }>();
    for (const entry of entries) {
      if (configuredIds.has(entry.channelId.toLowerCase())) continue;
      if (rows.some((row) => row.channelId === entry.channelId)) continue;
      if (configuredIds.has(entry.channelName?.toLowerCase() ?? '')) continue;

      const key = entry.channelId;
      if (!extraChannelIds.has(key)) {
        extraChannelIds.set(key, {
          channelId: key,
          channelName: entry.channelName || key,
          channelNumber: rows.length + extraChannelIds.size + 1
        });
      }
    }

    for (const extra of extraChannelIds.values()) {
      const extraEntries = entries
        .filter(
          (entry) =>
            entry.channelId === extra.channelId &&
            new Date(entry.startTime).getTime() < dayEnd &&
            new Date(entry.endTime).getTime() > dayStart
        )
        .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

      rows.push({ ...extra, entries: extraEntries });
    }

    return rows;
  }, [channels, entries, date, dayStart, dayEnd]);

  const getEntryForSlot = (channelEntries: ScheduleEntryLike[], slotIndex: number): ScheduleEntryLike | null => {
    const slotStart = dayStart + slotIndex * SLOT_MINUTES * 60000;
    const slotEnd = slotStart + SLOT_MINUTES * 60000;

    return (
      channelEntries.find((entry) => {
        const start = new Date(entry.startTime).getTime();
        const end = new Date(entry.endTime).getTime();
        return start < slotEnd && end > slotStart;
      }) || null
    );
  };

  const dayLabel = date
    ? date.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : '';

  const changeDay = (offset: number) => {
    if (!date) return;
    setDate(new Date(date.getFullYear(), date.getMonth(), date.getDate() + offset));
  };

  const goToToday = () => {
    const now = new Date();
    setDate(new Date(primaryYear, now.getMonth(), now.getDate()));
  };

  const goToDate = (year: number, month: number, day: number) => {
    setDate(new Date(year, month - 1, day));
  };

  return (
    <div className="admin-panel admin-day-schedule">
      <h3>Programación del día</h3>
      <p className="admin-panel-hint">
        Muestra, por canal, lo que se está transmitiendo hoy cruzando la hora del dispositivo con
        la programación generada. Refresca automáticamente al abrir la pantalla.
      </p>

      <div className="admin-day-schedule-controls">
        <button className="admin-button-secondary" onClick={() => changeDay(-1)} title="Día anterior">
          ← Día anterior
        </button>

        <div className="admin-day-picker">
          <label>
            Año
            <select
              value={date ? date.getFullYear() : ''}
              onChange={(e) => {
                if (!date) return;
                const y = Number(e.target.value);
                goToDate(y, date.getMonth() + 1, date.getDate());
              }}
            >
              {Array.from({ length: 80 }, (_, i) => 1950 + i)
                .filter((y) => y >= 1950 && y <= new Date().getFullYear())
                .map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
            </select>
          </label>

          <label>
            Mes
            <select
              value={date ? date.getMonth() + 1 : ''}
              onChange={(e) => {
                if (!date) return;
                const m = Number(e.target.value);
                goToDate(date.getFullYear(), m, date.getDate());
              }}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {m.toString().padStart(2, '0')}
                </option>
              ))}
            </select>
          </label>

          <label>
            Día
            <select
              value={date ? date.getDate() : ''}
              onChange={(e) => {
                if (!date) return;
                const d = Number(e.target.value);
                goToDate(date.getFullYear(), date.getMonth() + 1, d);
              }}
            >
              {date &&
                Array.from({ length: new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate() }, (_, i) => i + 1).map(
                  (d) => (
                    <option key={d} value={d}>
                      {d.toString().padStart(2, '0')}
                    </option>
                  )
                )}
            </select>
          </label>
        </div>

        <button className="admin-button-primary" onClick={goToToday}>
          Hoy
        </button>
        <button className="admin-button-secondary" onClick={() => changeDay(1)} title="Día siguiente">
          Día siguiente →
        </button>
      </div>

      <div className="admin-schedule-day-title">{dayLabel}</div>

      {loading && (
        <p className="admin-loading">Cargando programación del día...</p>
      )}

      {error && !loading && (
        <div className="admin-error-panel admin-panel">
          <p>{error}</p>
        </div>
      )}

      {!loading && !error && (
        <>
          {channelsOfDay.length === 0 ? (
            <p className="admin-schedule-empty-text">
              No hay programación generada para este día. Verifica que exista una programación
              activa o elige otro día.
            </p>
          ) : (
            <div className="admin-day-grid-wrap">
              <div className="admin-day-grid">
                <div className="admin-day-grid-header-row">
                  <div className="admin-grid-channel-head">CANAL</div>
                  {Array.from({ length: SLOTS_PER_DAY }, (_, i) => (
                    <div key={i} className="admin-grid-time-head">
                      {formatMinuteLabel(i * SLOT_MINUTES)}
                    </div>
                  ))}
                </div>

                {channelsOfDay.map((channel) => (
                  <div key={channel.channelId} className="admin-day-grid-row">
                    <div className="admin-grid-channel-cell">
                      <span className="admin-grid-channel-number">{channel.channelNumber}</span>
                      <span className="admin-grid-channel-name">{channel.channelName}</span>
                    </div>
                    {Array.from({ length: SLOTS_PER_DAY }, (_, slotIndex) => {
                      const entry = getEntryForSlot(channel.entries, slotIndex);
                      const isFiller = entry?.type === 'filler' || entry?.showId === 'analog-replay-tv-filler';

                      return (
                        <div
                          key={slotIndex}
                          className={`admin-grid-slot ${isFiller ? 'filler' : entry ? 'show' : 'empty'}`}
                          title={
                            entry
                              ? `${entry.showName} · T${entry.season ?? 0}E${entry.episode ?? 0} · ${new Date(
                                  entry.startTime
                                ).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })} – ${new Date(
                                  entry.endTime
                                ).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}`
                              : 'Sin programación'
                          }
                        >
                          {entry ? (isFiller ? 'AnalogReplayTV' : entry.showName) : '---'}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="admin-day-legend">
            <span className="admin-legend-item">
              <span className="admin-legend-swatch show" /> Show real
            </span>
            <span className="admin-legend-item">
              <span className="admin-legend-swatch filler" /> Relleno (AnalogReplayTV)
            </span>
            <span className="admin-legend-item">
              <span className="admin-legend-swatch empty" /> Sin programación
            </span>
          </div>
        </>
      )}
    </div>
  );
};