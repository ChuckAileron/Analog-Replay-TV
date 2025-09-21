import React, { useState, useEffect } from 'react';
import type { TVProgram } from '../types/program.types';
import { programManager } from '../features/programs/programManager';
import '../styles/config-components.css';
import '../styles/programs.css';
import '../styles/loading-states.css';
import '../styles/folder-select.css';

type ProgramFormData = TVProgram;

const DEFAULT_PROGRAM: ProgramFormData = {
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

function ProgramConfig() {
  const [programs, setPrograms] = useState<TVProgram[]>([]);
  const [currentView, setCurrentView] = useState<'list' | 'create' | 'edit' | 'import'>('list');
  const [formData, setFormData] = useState<ProgramFormData>(DEFAULT_PROGRAM);
  const [channelInput, setChannelInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPrograms();
  }, []);

  const loadPrograms = async () => {
    setIsLoading(true);
    setError(null);
    try {
      console.log('Loading programs...');
      const loadedPrograms = await programManager.getPrograms();
      console.log('Programs loaded:', loadedPrograms);
      setPrograms(loadedPrograms);
    } catch (error) {
      console.error('Error loading programs:', error);
      setError('Error al cargar los programas. Por favor, intenta de nuevo.');
      setPrograms([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImport = async () => {
    try {
      const filePath = await window.electronAPI.selectProgramFile();
      if (filePath) {
        await programManager.importProgramFile(filePath);
        await loadPrograms();
      }
    } catch (error) {
      console.error('Error importing program:', error);
      alert('Error al importar el programa. Por favor, verifica el archivo e intenta de nuevo.');
    }
  };



  const handleDelete = async (program: TVProgram) => {
    if (window.confirm(`¿Estás seguro de eliminar el programa "${program.name}"?`)) {
      try {
        await programManager.deleteProgram(program.id);
        await loadPrograms();
      } catch (error) {
        console.error('Error deleting program:', error);
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
        await programManager.updateProgram(formData.id, formData);
      } else {
        // Al agregar un nuevo programa, omitimos el id porque se generará automáticamente
        const { id, ...programData } = formData;
        await programManager.addProgram(programData);
      }
      setCurrentView('list');
      setFormData(DEFAULT_PROGRAM);
      await loadPrograms();
    } catch (error) {
      console.error('Error saving program:', error);
      alert('Error al guardar el programa. Por favor, verifica los datos e intenta de nuevo.');
    }
  };

  const renderProgramForm = () => (
    <form onSubmit={handleSubmit} className="program-form">
      <div className="form-group">
        <label htmlFor="name">Nombre del Programa:</label>
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
          {currentView === 'edit' ? 'Actualizar Programa' : 'Crear Programa'}
        </button>
        <button
          type="button"
          className="config-button"
          onClick={() => {
            setFormData(DEFAULT_PROGRAM);
            setCurrentView('list');
          }}
        >
          Cancelar
        </button>
      </div>
    </form>
  );

  const renderProgramsList = () => (
    <div className="programs-list">
      <div className="config-actions">
        <button onClick={() => setCurrentView('create')} className="config-button">
          Crear Programa
        </button>
        <button onClick={() => setCurrentView('import')} className="config-button">
          Importar Programa
        </button>
      </div>

      <h3>Programas Configurados</h3>
      {isLoading && <p className="loading-message">Cargando programas...</p>}
      {error && (
        <div className="error-message">
          {error}
          <button onClick={loadPrograms} className="config-button">
            Reintentar
          </button>
        </div>
      )}
      {!isLoading && !error && programs.length === 0 && (
        <p className="no-items-message">No hay programas configurados</p>
      )}
      {!isLoading && !error && programs.length > 0 &&
        programs.map((program) => (
          <div key={program.name} className="program-item">
            <div className="program-list-item-info">
              <div className="program-list-header">
                <span className="program-list-title">{program.name}</span>
              </div>
              <div className="program-list-details">
                <div className="program-channels">
                  <span className="detail-label">Canales:</span>
                  <div className="channel-tags">
                    {program.channel.map((ch, idx) => (
                      <span key={idx} className="channel-tag-small">
                        {ch}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="program-seasons">
                  <span className="detail-label">Temporadas:</span>
                  <div className="season-summary">
                    {program.seasons.map((season, idx) => (
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
            <div className="program-actions">
              <button
                onClick={() => {
                  setFormData(program);
                  setCurrentView('edit');
                }}
                className="config-button"
              >
                Editar
              </button>
              <button
                onClick={() => handleDelete(program)}
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
      <p>Selecciona un archivo JSON con la configuración del programa para importar.</p>
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
    <div className="program-config">
      <h2>Configuración de Programas</h2>
      
      {currentView === 'list' && renderProgramsList()}
      {(currentView === 'create' || currentView === 'edit') && renderProgramForm()}
      {currentView === 'import' && renderImportView()}
    </div>
  );
};

export default React.memo(ProgramConfig);