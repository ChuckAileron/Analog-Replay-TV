import React, { useState } from 'react';
import { ChannelConfig } from '../ChannelConfig';
import ShowConfig from '../ShowConfig';
import { AdminHomeScreen } from './AdminHomeScreen';
import { AdminScheduleScreen } from './AdminScheduleScreen';

export type AdminScreenId = 'home' | 'channels' | 'shows' | 'schedule';

type ScreenMeta = {
  title: string;
  subtitle: string;
};

const SCREENS: Record<AdminScreenId, ScreenMeta> = {
  home:     { title: 'Inicio', subtitle: 'Resumen general de la configuración' },
  channels: { title: 'Canales', subtitle: 'Crear, editar y eliminar canales' },
  shows:    { title: 'Programas', subtitle: 'Crear, editar y eliminar programas (shows)' },
  schedule: { title: 'Programación', subtitle: 'Estado, generación y reseteo de la programación' },
};

const NAV_ITEMS: Array<{ id: AdminScreenId; label: string; icon: string }> = [
  { id: 'home',     label: 'Inicio',       icon: '🏠' },
  { id: 'channels', label: 'Canales',      icon: '📡' },
  { id: 'shows',    label: 'Programas',    icon: '🎬' },
  { id: 'schedule', label: 'Programación', icon: '📅' },
];

export const AdminApp: React.FC = () => {
  const [history, setHistory] = useState<AdminScreenId[]>(['home']);

  const current = history[history.length - 1];
  const canGoBack = history.length > 1;

  // Navega a una pantalla manteniendo un historial apilado para que el botón
  // "Volver" permita regresar a pantallas anteriores.
  const navigate = (screen: AdminScreenId) => {
    setHistory(prev => {
      const last = prev[prev.length - 1];
      if (last === screen) return prev;

      // Si el destino es la pantalla inmediatamente anterior, regresar a ella
      // (evita ciclos Inicio ↔ pantalla duplicando entradas del historial).
      if (prev.length > 1 && prev[prev.length - 2] === screen) {
        return prev.slice(0, -1);
      }

      return [...prev, screen];
    });
  };

  const goBack = () => {
    setHistory(prev => (prev.length > 1 ? prev.slice(0, -1) : prev));
  };

  const goHome = () => {
    setHistory(prev => (prev[prev.length - 1] === 'home' ? prev : [...prev, 'home']));
  };

  const meta = SCREENS[current];

  // Titulo del historial (cadena "Inicio › Canales › ...") para orientar al usuario
  const breadcrumb = history.map(id => SCREENS[id].title).join(' › ');

  const renderScreen = () => {
    switch (current) {
      case 'channels':
        return <ChannelConfig />;
      case 'shows':
        return <ShowConfig />;
      case 'schedule':
        return <AdminScheduleScreen onNavigate={navigate} />;
      default:
        return <AdminHomeScreen onNavigate={navigate} />;
    }
  };

  return (
    <div className="admin-console">
      {/* Barra superior al estilo de una app de escritorio */}
      <header className="admin-titlebar">
        <div className="admin-titlebar-brand">
          <span className="admin-brand-logo">📺</span>
          <span className="admin-brand-name">AnalogReplayTV</span>
          <span className="admin-brand-separator">•</span>
          <span className="admin-brand-sub">Configuración</span>
        </div>

        {canGoBack && (
          <button className="admin-back-button" onClick={goBack} title="Volver a la pantalla anterior">
            ← Volver
          </button>
        )}

        <div className="admin-titlebar-breadcrumb" title={breadcrumb}>
          {breadcrumb}
        </div>

        <div className="admin-titlebar-date">
          {new Date().toLocaleDateString('es', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </div>
      </header>

      <div className="admin-body">
        {/* Barra lateral de navegación */}
        <nav className="admin-sidebar">
          <div className="admin-sidebar-label">Menú</div>
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              className={`admin-nav-button ${current === item.id ? 'active' : ''}`}
              onClick={() => navigate(item.id)}
            >
              <span className="admin-nav-icon">{item.icon}</span>
              <span className="admin-nav-label">{item.label}</span>
            </button>
          ))}

          <div className="admin-sidebar-spacer" />

          <button className="admin-nav-button" onClick={goHome} title="Ir a la pantalla de inicio">
            <span className="admin-nav-icon">↩</span>
            <span className="admin-nav-label">Ir a Inicio</span>
          </button>
        </nav>

        {/* Área de contenido */}
        <main className="admin-content">
          <div className="admin-content-header">
            <h2>{meta.title}</h2>
            <p>{meta.subtitle}</p>
          </div>
          {renderScreen()}
        </main>
      </div>
    </div>
  );
};