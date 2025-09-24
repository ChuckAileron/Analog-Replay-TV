import React, { useState, useEffect } from 'react';
import type { TVShow } from '../types/show.types';
import { showManager } from '../features/shows/showManager';
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
    }]
  }]
};

function ShowConfig() {
  const [shows, setShows] = useState<TVShow[]>([]);
  const [currentView, setCurrentView] = useState<'list' | 'create' | 'edit' | 'import'>('list');
  const [formData, setFormData] = useState<ShowFormData>(DEFAULT_SHOW);
  const [channelInput, setChannelInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadShows();
  }, []);

  const loadShows = async () => {
    setIsLoading(true);
    setError(null);
    try {
      console.log('Loading shows...');
      const loadedShows = await showManager.getShows();
      console.log('Shows loaded:', loadedShows);
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
          }]
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (currentView === 'edit') {
        await showManager.updateShow(formData.id, formData);
      } else {
        // Al agregar un nuevo show, omitimos el id porque se generará automáticamente
        const { id, ...showData } = formData;
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

  const renderShowForm = () => (
    <form onSubmit={handleSubmit} className="show-form">
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

      <div className="form-group">
        <label htmlFor="channel">Canales (nombres alternativos):</label>
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
                    setFormData(prev => ({
                      ...prev,
                      channel: [...prev.channel, newChannel]
                    }));
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
                  setFormData(prev => ({
                    ...prev,
                    channel: [...prev.channel, newChannel]
                  }));
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
              {ch}
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
                        // Primero actualizamos la ruta de la carpeta
                        handleSeasonChange(seasonIndex, 'contentPath', folderPath);
                        
                        // Luego obtenemos la información de los videos
                        const videos = await window.electronAPI.getFolderVideos(folderPath);
                        
                        if (videos && videos.length > 0) {
                          // Actualizamos los episodios con la información de los videos
                          setFormData(prev => {
                            const updatedSeasons = [...prev.seasons];
                            updatedSeasons[seasonIndex] = {
                              ...updatedSeasons[seasonIndex],
                              episodes: videos.map(video => ({
                                episode: video.episode,
                                title: video.title,
                                duration: video.duration,
                                fileName: video.fileName
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
          </div>          <div className="episodes-list">
            <h4>Episodios</h4>
            {season.episodes.map((episode, episodeIndex) => (
              <div key={episodeIndex} className="episode-item">
                <div className="form-group">
                  <label>Número:</label>
                  <input
                    type="number"
                    value={episode.episode}
                    onChange={(e) => handleEpisodeChange(seasonIndex, episodeIndex, 'episode', e.target.value)}
                    min="1"
                  />
                </div>
                <div className="form-group">
                  <label>Título:</label>
                  <input
                    type="text"
                    value={episode.title}
                    onChange={(e) => handleEpisodeChange(seasonIndex, episodeIndex, 'title', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Duración:</label>
                  <input
                    type="text"
                    value={episode.duration}
                    onChange={(e) => handleEpisodeChange(seasonIndex, episodeIndex, 'duration', e.target.value)}
                    placeholder="00:00"
                  />
                </div>
              </div>
            ))}
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
              </div>
              <div className="show-list-details">
                <div className="show-channels">
                  <span className="detail-label">Canales:</span>
                  <div className="channel-tags">
                    {show.channel.map((ch, idx) => (
                      <span key={idx} className="channel-tag-small">
                        {ch}
                      </span>
                    ))}
                  </div>
                </div>
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
                  setFormData(show);
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