import React, { useState, useEffect } from 'react';
import type { CommercialContext } from '../types/commercial.types';
import { CommercialService } from '../services/CommercialService';
import '../styles/config-components.css';

interface CommercialFormData {
  name: string;
  description: string;
  channel: string[];
}

interface CommercialItemFormData {
  year: number;
  duration: string;
  fileName: string;
}

export const CommercialConfig: React.FC = () => {
  const [contexts, setContexts] = useState<CommercialContext[]>([]);
  const [formData, setFormData] = useState<CommercialFormData>({
    name: '',
    description: '',
    channel: []
  });
  const [commercialFormData, setCommercialFormData] = useState<CommercialItemFormData>({
    year: new Date().getFullYear(),
    duration: '00:30',
    fileName: ''
  });
  const [editingContext, setEditingContext] = useState<CommercialContext | null>(null);
  const [selectedContext, setSelectedContext] = useState<CommercialContext | null>(null);
  const [currentView, setCurrentView] = useState<'list' | 'create' | 'edit' | 'view-context'>('list');
  const [newChannelInput, setNewChannelInput] = useState('');
  
  const commercialService = CommercialService.getInstance();

  const loadContexts = async () => {
    try {
      const config = await commercialService.getConfig();
      setContexts(config.contexts);
    } catch (error) {
      console.error('Error al cargar contextos de comerciales:', error);
    }
  };

  useEffect(() => {
    loadContexts();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleCommercialInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCommercialFormData(prev => ({
      ...prev,
      [name]: name === 'year' ? parseInt(value) || new Date().getFullYear() : value
    }));
  };

  const handleAddChannel = () => {
    if (newChannelInput.trim() && !formData.channel.includes(newChannelInput.trim())) {
      setFormData(prev => ({
        ...prev,
        channel: [...prev.channel, newChannelInput.trim()]
      }));
      setNewChannelInput('');
    }
  };

  const handleRemoveChannel = (channelToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      channel: prev.channel.filter(channel => channel !== channelToRemove)
    }));
  };

  const handleSubmitContext = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const config = await commercialService.getConfig();
      
      if (editingContext) {
        // Actualizar contexto existente
        const updatedContexts = config.contexts.map(context =>
          context.id === editingContext.id
            ? { ...editingContext, ...formData }
            : context
        );
        
        await commercialService.updateConfig({
          ...config,
          contexts: updatedContexts
        });
      } else {
        // Crear nuevo contexto
        const newContext: CommercialContext = {
          id: `context-${Date.now()}`,
          ...formData,
          commercials: []
        };
        
        await commercialService.updateConfig({
          ...config,
          contexts: [...config.contexts, newContext]
        });
      }
      
      await loadContexts();
      resetForm();
      setCurrentView('list');
    } catch (error) {
      console.error('Error al guardar contexto:', error);
    }
  };

  const handleAddCommercial = async () => {
    if (!selectedContext) return;
    
    try {
      const config = await commercialService.getConfig();
      const updatedContexts = config.contexts.map(context => {
        if (context.id === selectedContext.id) {
          return {
            ...context,
            commercials: [...context.commercials, commercialFormData]
          };
        }
        return context;
      });
      
      await commercialService.updateConfig({
        ...config,
        contexts: updatedContexts
      });
      
      await loadContexts();
      
      // Actualizar contexto seleccionado
      const updatedContext = updatedContexts.find(c => c.id === selectedContext.id);
      if (updatedContext) {
        setSelectedContext(updatedContext);
      }
      
      // Reset form
      setCommercialFormData({
        year: new Date().getFullYear(),
        duration: '00:30',
        fileName: ''
      });
    } catch (error) {
      console.error('Error al agregar comercial:', error);
    }
  };

  const handleDeleteContext = async (contextId: string) => {
    if (confirm('¿Estás seguro de que quieres eliminar este contexto de comerciales?')) {
      try {
        const config = await commercialService.getConfig();
        const updatedContexts = config.contexts.filter(context => context.id !== contextId);
        
        await commercialService.updateConfig({
          ...config,
          contexts: updatedContexts
        });
        
        await loadContexts();
      } catch (error) {
        console.error('Error al eliminar contexto:', error);
      }
    }
  };

  const handleDeleteCommercial = async (contextId: string, commercialIndex: number) => {
    if (confirm('¿Estás seguro de que quieres eliminar este comercial?')) {
      try {
        const config = await commercialService.getConfig();
        const updatedContexts = config.contexts.map(context => {
          if (context.id === contextId) {
            return {
              ...context,
              commercials: context.commercials.filter((_, index) => index !== commercialIndex)
            };
          }
          return context;
        });
        
        await commercialService.updateConfig({
          ...config,
          contexts: updatedContexts
        });
        
        await loadContexts();
        
        // Actualizar contexto seleccionado si es necesario
        if (selectedContext && selectedContext.id === contextId) {
          const updatedContext = updatedContexts.find(c => c.id === contextId);
          if (updatedContext) {
            setSelectedContext(updatedContext);
          }
        }
      } catch (error) {
        console.error('Error al eliminar comercial:', error);
      }
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      channel: []
    });
    setEditingContext(null);
  };

  const startEdit = (context: CommercialContext) => {
    setFormData({
      name: context.name,
      description: context.description || '',
      channel: [...context.channel]
    });
    setEditingContext(context);
    setCurrentView('edit');
  };

  const viewContext = (context: CommercialContext) => {
    setSelectedContext(context);
    setCurrentView('view-context');
  };

  const renderContextList = () => (
    <div className="config-container">
      <div className="config-header">
        <h2>Configuración de Comerciales</h2>
        <button 
          className="btn-primary"
          onClick={() => setCurrentView('create')}
        >
          Nuevo Contexto
        </button>
      </div>
      
      <div className="context-list">
        {contexts.length === 0 ? (
          <div className="empty-state">
            <p>No hay contextos de comerciales configurados.</p>
          </div>
        ) : (
          contexts.map((context) => (
            <div key={context.id} className="context-card">
              <div className="context-info">
                <h3>{context.name}</h3>
                {context.description && <p>{context.description}</p>}
                <div className="context-details">
                  <span><strong>Canales:</strong> {context.channel.join(', ')}</span>
                  <span><strong>Comerciales:</strong> {context.commercials.length}</span>
                </div>
              </div>
              <div className="context-actions">
                <button onClick={() => viewContext(context)}>Ver</button>
                <button onClick={() => startEdit(context)}>Editar</button>
                <button 
                  className="btn-danger"
                  onClick={() => handleDeleteContext(context.id)}
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const renderContextForm = () => (
    <div className="config-container">
      <div className="config-header">
        <h2>{editingContext ? 'Editar Contexto' : 'Nuevo Contexto'}</h2>
        <button onClick={() => { setCurrentView('list'); resetForm(); }}>
          Volver
        </button>
      </div>
      
      <form onSubmit={handleSubmitContext} className="config-form">
        <div className="form-group">
          <label>Nombre del contexto:</label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            required
            placeholder="ej. Coca-Cola 90s"
          />
        </div>
        
        <div className="form-group">
          <label>Descripción:</label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            placeholder="Descripción del contexto de comerciales"
          />
        </div>
        
        <div className="form-group">
          <label>Canales asociados:</label>
          <div className="channel-input-group">
            <input
              type="text"
              value={newChannelInput}
              onChange={(e) => setNewChannelInput(e.target.value)}
              placeholder="Nombre del canal"
            />
            <button type="button" onClick={handleAddChannel}>Agregar</button>
          </div>
          
          {formData.channel.length > 0 && (
            <div className="channel-tags">
              {formData.channel.map((channel) => (
                <span key={channel} className="channel-tag">
                  {channel}
                  <button
                    type="button"
                    onClick={() => handleRemoveChannel(channel)}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
        
        <div className="form-actions">
          <button type="submit" className="btn-primary">
            {editingContext ? 'Actualizar' : 'Crear'} Contexto
          </button>
          <button type="button" onClick={() => { setCurrentView('list'); resetForm(); }}>
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );

  const renderContextView = () => {
    if (!selectedContext) return null;
    
    return (
      <div className="config-container">
        <div className="config-header">
          <h2>{selectedContext.name}</h2>
          <button onClick={() => setCurrentView('list')}>
            Volver
          </button>
        </div>
        
        <div className="context-details-view">
          {selectedContext.description && (
            <p><strong>Descripción:</strong> {selectedContext.description}</p>
          )}
          <p><strong>Canales:</strong> {selectedContext.channel.join(', ')}</p>
        </div>
        
        <div className="commercials-section">
          <div className="section-header">
            <h3>Comerciales ({selectedContext.commercials.length})</h3>
          </div>
          
          <div className="add-commercial-form">
            <h4>Agregar Comercial</h4>
            <div className="commercial-form-row">
              <input
                type="number"
                name="year"
                value={commercialFormData.year}
                onChange={handleCommercialInputChange}
                placeholder="Año"
                min="1950"
                max="2030"
              />
              <input
                type="text"
                name="duration"
                value={commercialFormData.duration}
                onChange={handleCommercialInputChange}
                placeholder="Duración (mm:ss)"
                pattern="[0-9]{1,2}:[0-9]{2}"
              />
              <input
                type="text"
                name="fileName"
                value={commercialFormData.fileName}
                onChange={handleCommercialInputChange}
                placeholder="Ruta del archivo"
                required
              />
              <button type="button" onClick={handleAddCommercial}>
                Agregar
              </button>
            </div>
          </div>
          
          <div className="commercials-list">
            {selectedContext.commercials.length === 0 ? (
              <p>No hay comerciales en este contexto.</p>
            ) : (
              selectedContext.commercials.map((commercial, index) => (
                <div key={index} className="commercial-item">
                  <div className="commercial-info">
                    <span><strong>Año:</strong> {commercial.year}</span>
                    <span><strong>Duración:</strong> {commercial.duration}</span>
                    <span><strong>Archivo:</strong> {commercial.fileName}</span>
                  </div>
                  <button
                    className="btn-danger"
                    onClick={() => handleDeleteCommercial(selectedContext.id, index)}
                  >
                    Eliminar
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderCurrentView = () => {
    switch (currentView) {
      case 'create':
      case 'edit':
        return renderContextForm();
      case 'view-context':
        return renderContextView();
      default:
        return renderContextList();
    }
  };

  return renderCurrentView();
};

export default CommercialConfig;