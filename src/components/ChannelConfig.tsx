import React, { useState, useEffect } from 'react';
import type { Channel } from '../types/tv.types';
import { channelManager } from '../features/channels/channelManager';
import '../styles/config-components.css';

interface ChannelFormData {
  name: string;
  number?: number;
  description?: string;
}

export const ChannelConfig: React.FC = () => {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [formData, setFormData] = useState<ChannelFormData>({
    name:         '',
    number:       undefined,
    description:  ''
  });
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null);
  const [currentView, setCurrentView] = useState<'list' | 'create' | 'edit' | 'import'>('list');
  
  const loadChannels = async () => {
    const channelList = await channelManager.getChannels();
    setChannels(channelList);
  };

  useEffect(() => {
    loadChannels();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'number' ? parseInt(value) || undefined : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingChannel) {
      // Actualizar canal existente
      await channelManager.updateChannel(editingChannel.id, {
        ...formData,
        number: formData.number || editingChannel.number
      });
      setEditingChannel(null);
    }
    else {
      // Agregar nuevo canal
      if (!formData.number) {
        alert('El número de canal es requerido');
        return;
      }
      await channelManager.addChannel({
        ...formData,
        number: formData.number,
        isEnabled: true
      });
    }

    // Recargar la lista de canales y limpiar formulario
    await loadChannels();
    setFormData({
      name:         '',
      number:       undefined,
      description:  ''
    });
  };

  const handleEdit = (channel: Channel) => {
    setEditingChannel(channel);
    setFormData({
      name:         channel.name,
      number:       channel.number,
      description:  channel.description
    });
  };

  const handleDelete = async (channelId: number) => {
    if (window.confirm('¿Estás seguro de que deseas eliminar este canal?')) {
      await channelManager.deleteChannel(channelId);
      await loadChannels();
    }
  };

  const handleImportChannels = async () => {
    try {
      const filePath = await window.electronAPI.selectChannelFile();
      if (filePath) {
        await window.electronAPI.importChannelFile(filePath);
        // Recargar los canales después de importar
        await loadChannels();
      }
    } catch (error) {
      console.error('Error importing channels:', error);
      alert('Error al importar canales. Por favor, verifica el archivo e intenta de nuevo.');
    }
  };

  const renderChannelForm = () => (
    <form onSubmit={handleSubmit} className="channel-form">
      <div className="form-group">
        <label htmlFor="name">Nombre del Canal:</label>
        <input
          type="text"
          id="name"
          name="name"
          value={formData.name}
          onChange={handleInputChange}
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="number">Número de Canal:</label>
        <input
          type="number"
          id="number"
          name="number"
          value={formData.number || ''}
          onChange={handleInputChange}
          min="1"
          max="999"
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="description">Descripción:</label>
        <textarea
          id="description"
          name="description"
          value={formData.description}
          onChange={handleInputChange}
        />
      </div>

      <div className="form-actions">
        <button type="submit" className="config-button">
          {editingChannel ? 'Actualizar Canal' : 'Agregar Canal'}
        </button>
        <button
          type="button"
          className="config-button"
          onClick={() => {
            setFormData({ name: '', number: undefined, description: '' });
            setCurrentView('list');
          }}
        >
          Cancelar
        </button>
      </div>
    </form>
  );

  const renderChannelsList = () => (
    <div className="channels-list">
      <div className="config-actions">
        <button onClick={() => setCurrentView('create')} className="config-button">
          Crear Canal
        </button>
        <button onClick={() => setCurrentView('import')} className="config-button">
          Importar Canales
        </button>
      </div>

      <h3>Canales Configurados</h3>
      {channels.map((channel: Channel) => (
        <div key={channel.id} className="channel-item">
          <div className="channel-list-item-info">
            <div className="channel-list-header">
              <span className="channel-list-number">Canal {channel.number}</span>
              <span className="channel-list-name">{channel.name}</span>
            </div>
            {channel.description && (
              <p className="channel-list-description">{channel.description}</p>
            )}
          </div>
          <div className="channel-actions">
            <button
              onClick={() => {
                handleEdit(channel);
                setCurrentView('edit');
              }}
              className="config-button"
            >
              Editar
            </button>
            <button
              onClick={() => handleDelete(channel.id)}
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
      <p>Selecciona un archivo JSON con la configuración de canales para importar.</p>
      <div className="config-actions">
        <button onClick={handleImportChannels} className="config-button">
          Seleccionar Archivo
        </button>
        <button onClick={() => setCurrentView('list')} className="config-button">
          Cancelar
        </button>
      </div>
    </div>
  );

  return (
    <div className="channel-config">
      <h2>Configuración de Canales</h2>
      
      {currentView === 'list' && renderChannelsList()}
      {(currentView === 'create' || currentView === 'edit') && renderChannelForm()}
      {currentView === 'import' && renderImportView()}
    </div>
  );
};
