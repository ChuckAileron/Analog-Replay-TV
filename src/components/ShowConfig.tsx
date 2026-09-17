import React, { useState, useEffect } from 'react';
import type { TVShow } from '../types/show.types';
import type { Channel } from '../types/tv.types';
import { showManager } from '../features/shows/showManager';
import { channelManager } from '../features/channels/channelManager';
import { getEpisodeFileNames } from '../utils/episodeFiles';
import '../styles/config-components.css';
import '../styles/shows.css';
import '../styles/loading-states.css';
import '../styles/folder-select.css';

type ShowFormData = TVShow;

const DEFAULT_SHOW: ShowFormData = {
  id: 0,
  name: "",
  channel: [],
  seasons: [{
    season: 1,
    year: new Date().getFullYear(),
    episodes: [{
      episode: 1,
      title: "",
      duration: "00:00"
    }],
    contentPath: '',
    contentPaths: []
  }],
  airYears: [],
  airUntilToDate: false
};

function ShowConfig() {
  const [shows, setShows] = useState<TVShow[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [currentView, setCurrentView] = useState<'list' | 'create' | 'edit' | 'import'>('list');
  const [formData, setFormData] = useState<ShowFormData>(DEFAULT_SHOW);
  const [channelInput, setChannelInput] = useState('');
  const [airYearInput, setAirYearInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Resuelve un canal guardado en el show (puede ser id, uuid o nombre) al nombre visible del canal
  const getChannelLabel = (ch: string): string => {
    const match = channels.find((channel) =>
      String(channel.id) === ch ||
      channel.uuid === ch ||
      channel.name.toLowerCase() === ch.toLowerCase()
    );
    return match ? match.name : ch;
  };

  useEffect(() => {
    loadShows();
    loadChannels();
  }, []);

  const loadChannels = async () => {
    try {
      await channelManager.initialize();
      const loadedChannels = await channelManager.getChannels();
      setChannels(loadedChannels);
    } catch (error) {
      console.error('Error loading channels:', error);
    }
  };

  const loadShows = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const loadedShows = await showManager.getShows();
      setShows(loadedShows);
    } catch (error) {
      console.error('Error loading shows:', error);
      setError('Error al cargar los shows. Por favor, intenta de nuevo.');
      setShows([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImport = async () => {
    try {
      const filePath = await window.electronAPI.selectShowFile();
      if (filePath) {
        await showManager.importShowFile(filePath);
        await loadShows();
      }
    } catch (error) {
      console.error('Error importing show:', error);
      alert('Error al importar el show. Por favor, verifica el archivo e intenta de nuevo.');
    }
  };

  const handleDelete = async (show: TVShow) => {
    if (window.confirm(`¿Estás seguro de eliminar el show "${show.name}"?`)) {
      try {
        await showManager.deleteShow(show.id);
        await loadShows();
      } catch (error) {
        console.error('Error deleting show:', error);
      }
    }
  };

  const handleAddSeason = () => {
    setFormData(prev => ({
      ...prev,
      seasons: [
        ...prev.seasons,
        {
          season: prev.seasons.length + 1,
          year: new Date().getFullYear(),
          episodes: [{
            episode: 1,
            title: '',
            duration: '00:00'
          }],
          contentPath: '',
          contentPaths: []
        }
      ]
    }));
  };

  const handleAddEpisode = (seasonIndex: number) => {
    setFormData(prev => {
      const updatedSeasons = [...prev.seasons];
      updatedSeasons[seasonIndex] = {
        ...updatedSeasons[seasonIndex],
        episodes: [
          ...updatedSeasons[seasonIndex].episodes,
          {
            episode: updatedSeasons[seasonIndex].episodes.length + 1,
            title: '',
            duration: '00:00'
          }
        ]
      };
      return { ...prev, seasons: updatedSeasons };
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name !== 'channel') {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleSeasonChange = (seasonIndex: number, field: string, value: string | number) => {
    setFormData(prev => {
      const updatedSeasons = [...prev.seasons];
      updatedSeasons[seasonIndex] = {
        ...updatedSeasons[seasonIndex],
        [field]: field === 'year' ? parseInt(value.toString()) : value
      };
      return { ...prev, seasons: updatedSeasons };
    });
  };

  const handleEpisodeChange = (seasonIndex: number, episodeIndex: number, field: string, value: string | number) => {
    setFormData(prev => {
      const updatedSeasons = [...prev.seasons];
      const updatedEpisodes = [...updatedSeasons[seasonIndex].episodes];
      updatedEpisodes[episodeIndex] = {
        ...updatedEpisodes[episodeIndex],
        [field]: field === 'episode' ? parseInt(value.toString()) : value
      };
      updatedSeasons[seasonIndex] = {
        ...updatedSeasons[seasonIndex],
        episodes: updatedEpisodes
      };
      return { ...prev, seasons: updatedSeasons };
    });
  };

  // Agrega una carpeta adicional a una temporada. Además de registrar la
  // ruta, intenta emparejar cada episodio existente contra los archivos
  // reales de la nueva carpeta (por nombre exacto, tolerante, o por código
  // de episodio) y agrega el nombre de archivo encontrado a la lista de
  // nombres candidatos (`fileNames`) de ese episodio, para que el reproductor
  // pueda usarlo sin importar en cuál carpeta esté realmente el archivo.
  const handleAddContentPath = async (seasonIndex: number) => {
    try {
      const folderPath = await window.electronAPI.selectFolder();
      if (!folderPath) return;

      const season = formData.seasons[seasonIndex];
      const existingPaths = season.contentPaths || [];

      // Evitar duplicados
      if (season.contentPath === folderPath || existingPaths.includes(folderPath)) {
        return;
      }

      // Intentar emparejar los episodios existentes con archivos de la nueva carpeta
      let matches: Record<number, string | null> = {};
      try {
        const episodesPayload = season.episodes.map(ep => ({
          episode: ep.episode,
          fileNames: getEpisodeFileNames(ep)
        }));
        matches = await window.electronAPI.matchFolderEpisodes(folderPath, episodesPayload);
      } catch (matchError) {
        console.error('Error emparejando episodios con la nueva carpeta:', matchError);
      }

      setFormData(prev => {
        const updatedSeasons = [...prev.seasons];
        const currentSeason = updatedSeasons[seasonIndex];
        const currentPaths = currentSeason.contentPaths || [];

        const updatedEpisodes = currentSeason.episodes.map(ep => {
          const matchedFileName = matches[ep.episode];
          if (!matchedFileName) return ep;

          const currentFileNames = getEpisodeFileNames(ep);
          if (currentFileNames.includes(matchedFileName)) return ep;

          return {
            ...ep,
            fileNames: [...currentFileNames, matchedFileName]
          };
        });

        updatedSeasons[seasonIndex] = {
          ...currentSeason,
          contentPaths: [...currentPaths, folderPath],
          episodes: updatedEpisodes
        };

        return { ...prev, seasons: updatedSeasons };
      });
    } catch (error) {
      console.error('Error selecting additional folder:', error);
    }
  };

  // Elimina una carpeta adicional de una temporada
  const handleRemoveContentPath = (seasonIndex: number, pathIndex: number) => {
    setFormData(prev => {
      const updatedSeasons = [...prev.seasons];
      const season = updatedSeasons[seasonIndex];
      const newPaths = (season.contentPaths || []).filter((_, i) => i !== pathIndex);
      updatedSeasons[seasonIndex] = { ...season, contentPaths: newPaths };
      return { ...prev, seasons: updatedSeasons };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (currentView === 'edit') {
        await showManager.updateShow(formData.id, formData);
      } else {
        const { id: _unused, ...showData } = formData;
        void _unused;
        await showManager.addShow(showData);
      }
      setCurrentView('list');
      setFormData(DEFAULT_SHOW);
      await loadShows();
    } catch (error) {
      console.error('Error saving show:', error);
      alert('Error al guardar el show. Por favor, verifica los datos e intenta de nuevo.');
    }
  };

  // Agrega un año de transmisión
  const handleAddAirYear = () => {
    const year = parseInt(airYearInput.trim());
    if (!isNaN(year) && year >= 1900 && year <= 2100) {
      const current = formData.airYears || [];
      if (!current.includes(year)) {
        setFormData(prev => ({ ...prev, airYears: [...current, year].sort((a, b) => a - b) }));
      }
      setAirYearInput('');
    }
  };

  // Elimina un año de transmisión
  const handleRemoveAirYear = (year: number) => {
    setFormData(prev => ({
      ...prev,
      airYears: (prev.airYears || []).filter(y => y !== year)
    }));
  };

  const renderShowForm = () => (
    <form onSubmit={handleSubmit} className="show-form">
      {/* Nombre */}
      <div className="form-group">
        <label htmlFor="name">Nombre del Show:</label>
        <input
          type="text"
          id="name"
          name="name"
          value={formData.name}
          onChange={handleChange}
          required
        />
      </div>

      {/* Canales */}
      <div className="form-group">
        <label htmlFor="channel">Canales:</label>
        <div className="input-with-button">
          <input
            type="text"
            id="channel"
            name="channel"
            placeholder="Ej: Nickelodeon, Nick"
            value={channelInput}
            onChange={(e) => setChannelInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (channelInput.trim()) {
                  const newChannel = channelInput.trim();
                  if (!formData.channel.includes(newChannel)) {
                    setFormData(prev => ({ ...prev, channel: [...prev.channel, newChannel] }));
                  }
                  setChannelInput('');
                }
              }
            }}
          />
          <button
            type="button"
            className="config-button"
            onClick={() => {
              if (channelInput.trim()) {
                const newChannel = channelInput.trim();
                if (!formData.channel.includes(newChannel)) {
                  setFormData(prev => ({ ...prev, channel: [...prev.channel, newChannel] }));
                }
                setChannelInput('');
              }
            }}
          >
            Agregar Canal
          </button>
        </div>
        <div className="channel-list">
          {formData.channel.map((ch, index) => (
            <div key={index} className="channel-tag">
              {getChannelLabel(ch)}
              <button
                type="button"
                onClick={() => {
                  setFormData(prev => ({
                    ...prev,
                    channel: prev.channel.filter((_, i) => i !== index)
                  }));
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Años de transmisión */}
      <div className="form-group">
        <label>Años de transmisión:</label>
        <div className="air-years-section">
          {/* Fila 1: input + botón */}
          <div className="input-with-button">
            <input
              type="number"
              placeholder="Ej: 1999"
              value={airYearInput}
              min="1900"
              max="2100"
              onChange={(e) => setAirYearInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddAirYear();
                }
              }}
            />
            <button type="button" className="config-button" onClick={handleAddAirYear}>
              Agregar Año
            </button>
          </div>
          {/* Fila 2: checkbox */}
          <label className="checkbox-label until-date-label">
            <input
              type="checkbox"
              checked={formData.airUntilToDate || false}
              onChange={(e) => setFormData(prev => ({ ...prev, airUntilToDate: e.target.checked }))}
            />
            <span>Hasta la fecha</span>
            <span className="checkbox-hint">(siempre en programación)</span>
          </label>
          {/* Tags de años agregados */}
          {(formData.airYears || []).length > 0 && (
            <div className="air-years-list">
              {(formData.airYears || []).map((year) => (
                <div key={year} className="year-tag">
                  {year}
                  <button type="button" onClick={() => handleRemoveAirYear(year)}>×</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Temporadas */}
      {formData.seasons.map((season, seasonIndex) => (
        <div key={seasonIndex} className="season-section">
          <h3>Temporada {season.season}</h3>
          <div className="season-form">
            <div className="form-group">
              <label>Año:</label>
              <input
                type="number"
                value={season.year}
                onChange={(e) => handleSeasonChange(seasonIndex, 'year', e.target.value)}
                min="1900"
                max="2100"
              />
            </div>

            {/* Carpeta principal */}
            <div className="form-group">
              <label>Carpeta de contenido:</label>
              <div className="folder-select">
                <input
                  type="text"
                  value={season.contentPath || ''}
                  readOnly
                  placeholder="Selecciona la carpeta de contenido..."
                />
                <button
                  type="button"
                  className="config-button"
                  onClick={async () => {
                    try {
                      const folderPath = await window.electronAPI.selectFolder();
                      if (folderPath) {
                        handleSeasonChange(seasonIndex, 'contentPath', folderPath);
                        const videos = await window.electronAPI.getFolderVideos(folderPath);
                        if (videos && videos.length > 0) {
                          setFormData(prev => {
                            const updatedSeasons = [...prev.seasons];
                            updatedSeasons[seasonIndex] = {
                              ...updatedSeasons[seasonIndex],
                              episodes: videos.map(video => ({
                                episode: video.episode,
                                title: video.title,
                                duration: video.duration,
                                fileName: video.fileName,
                                fileNames: [video.fileName]
                              }))
                            };
                            return { ...prev, seasons: updatedSeasons };
                          });
                        } else {
                          alert('No se encontraron archivos de video en la carpeta seleccionada.');
                        }
                      }
                    } catch (error) {
                      console.error('Error processing folder:', error);
                      alert('Error al procesar la carpeta. Por favor, verifica que contenga archivos de video válidos.');
                    }
                  }}
                >
                  Seleccionar Carpeta
                </button>
              </div>
            </div>

            {/* Carpetas adicionales */}
            <div className="form-group">
              <label>Carpetas adicionales:</label>
              <div className="additional-paths">
                {(season.contentPaths || []).map((p, pathIndex) => (
                  <div key={pathIndex} className="additional-path-item">
                    <span className="additional-path-text" title={p}>{p}</span>
                    <button
                      type="button"
                      className="remove-path-btn"
                      onClick={() => handleRemoveContentPath(seasonIndex, pathIndex)}
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="config-button add-path-btn"
                  onClick={() => handleAddContentPath(seasonIndex)}
                >
                  + Agregar Carpeta
                </button>
              </div>
            </div>
          </div>

          {/* Episodios — grilla compacta */}
          <div className="episodes-list">
            <h4>Episodios ({season.episodes.length})</h4>
            <div className="episodes-grid">
              <div className="episodes-grid-header">
                <span>#</span>
                <span>Título</span>
                <span>Duración</span>
              </div>
              {season.episodes.map((episode, episodeIndex) => (
                <div key={episodeIndex} className="episodes-grid-row">
                  <input
                    type="number"
                    value={episode.episode}
                    onChange={(e) => handleEpisodeChange(seasonIndex, episodeIndex, 'episode', e.target.value)}
                    min="1"
                    className="episode-num-input"
                  />
                  <input
                    type="text"
                    value={episode.title}
                    onChange={(e) => handleEpisodeChange(seasonIndex, episodeIndex, 'title', e.target.value)}
                    className="episode-title-input"
                    placeholder="Título del episodio"
                  />
                  <input
                    type="text"
                    value={episode.duration}
                    onChange={(e) => handleEpisodeChange(seasonIndex, episodeIndex, 'duration', e.target.value)}
                    className="episode-duration-input"
                    placeholder="00:00"
                  />
                </div>
              ))}
            </div>
            <button
              type="button"
              className="config-button"
              onClick={() => handleAddEpisode(seasonIndex)}
            >
              Agregar Episodio
            </button>
          </div>
        </div>
      ))}

      <button
        type="button"
        className="config-button"
        onClick={handleAddSeason}
      >
        Agregar Temporada
      </button>

      <div className="form-actions">
        <button type="submit" className="config-button">
          {currentView === 'edit' ? 'Actualizar Show' : 'Crear Show'}
        </button>
        <button
          type="button"
          className="config-button"
          onClick={() => {
            setFormData(DEFAULT_SHOW);
            setCurrentView('list');
          }}
        >
          Cancelar
        </button>
      </div>
    </form>
  );

  const renderShowsList = () => (
    <div className="shows-list">
      <div className="config-actions">
        <button onClick={() => setCurrentView('create')} className="config-button">
          Crear Show
        </button>
        <button onClick={() => setCurrentView('import')} className="config-button">
          Importar Show
        </button>
      </div>

      <h3>Shows Configurados</h3>
      {isLoading && <p className="loading-message">Cargando shows...</p>}
      {error && (
        <div className="error-message">
          {error}
          <button onClick={loadShows} className="config-button">
            Reintentar
          </button>
        </div>
      )}
      {!isLoading && !error && shows.length === 0 && (
        <p className="no-items-message">No hay shows configurados</p>
      )}
      {!isLoading && !error && shows.length > 0 &&
        shows.map((show) => (
          <div key={show.name} className="show-item">
            <div className="show-list-item-info">
              <div className="show-list-header">
                <span className="show-list-title">{show.name}</span>
                {show.airUntilToDate && (
                  <span className="until-date-badge">Hasta la fecha</span>
                )}
              </div>
              <div className="show-list-details">
                <div className="show-channels">
                  <span className="detail-label">Canales:</span>
                  <div className="channel-tags">
                    {show.channel.map((ch, idx) => (
                      <span key={idx} className="channel-tag-small">
                        {getChannelLabel(ch)}
                      </span>
                    ))}
                  </div>
                </div>
                {(show.airYears && show.airYears.length > 0) && (
                  <div className="show-air-years">
                    <span className="detail-label">Transmisión:</span>
                    <div className="air-year-tags">
                      {show.airYears.map((year) => (
                        <span key={year} className="year-tag-small">{year}</span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="show-seasons">
                  <span className="detail-label">Temporadas:</span>
                  <div className="season-summary">
                    {show.seasons.map((season, idx) => (
                      <div key={idx} className="season-info">
                        <span className="season-number">T{season.season}</span>
                        <span className="season-year">({season.year})</span>
                        <span className="episode-count">{season.episodes.length} ep.</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="show-actions">
              <button
                onClick={() => {
                  setFormData({
                    ...show,
                    airYears: show.airYears || [],
                    airUntilToDate: show.airUntilToDate || false,
                    seasons: show.seasons.map(s => ({
                      ...s,
                      contentPaths: s.contentPaths || []
                    }))
                  });
                  setCurrentView('edit');
                }}
                className="config-button"
              >
                Editar
              </button>
              <button
                onClick={() => handleDelete(show)}
                className="config-button delete-button"
              >
                Eliminar
              </button>
            </div>
          </div>
        ))}
    </div>
  );

  const renderImportView = () => (
    <div className="import-view">
      <p>Selecciona un archivo JSON con la configuración del show para importar.</p>
      <div className="config-actions">
        <button onClick={handleImport} className="config-button">
          Seleccionar Archivo
        </button>
        <button onClick={() => setCurrentView('list')} className="config-button">
          Cancelar
        </button>
      </div>
    </div>
  );

  return (
    <div className="show-config">
      <h2>Configuración de Shows</h2>

      {currentView === 'list' && renderShowsList()}
      {(currentView === 'create' || currentView === 'edit') && renderShowForm()}
      {currentView === 'import' && renderImportView()}
    </div>
  );
};

export default React.memo(ShowConfig);
