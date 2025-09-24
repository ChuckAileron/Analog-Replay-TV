import React, { useState } from 'react';
import type { TVSettings } from '../types/tv.types';
import { ChannelConfig } from './ChannelConfig';
import ShowConfig from './ShowConfig';

interface MenuBaseProps {
  settings: TVSettings;
  onAspectRatioToggle: () => void;
  onStyleToggle: () => void;
  onCRTFilterToggle?: () => void;
  isMenuOpen: boolean;
  menuClassName: string;
  menuHeaderClassName?: string;
  menuOptionsClassName?: string;
  menuTitle: string;
  aspectRatioLabel: string;
  styleLabel: string;
}

export const MenuBase: React.FC<MenuBaseProps> = ({
  settings,
  onAspectRatioToggle,
  onStyleToggle,
  onCRTFilterToggle,
  isMenuOpen,
  menuClassName,
  menuHeaderClassName = 'menu-header',
  menuOptionsClassName = 'menu-options',
  menuTitle,
  aspectRatioLabel,
  styleLabel,
}) => {
  const [activeSection, setActiveSection] = useState<'settings' | 'channels' | 'programs'>('settings');

  if (!isMenuOpen) return null;

  return (
    <div className={menuClassName}>
      <div className={menuHeaderClassName}>
        {menuTitle}
      </div>

      <div className="menu-sections">
        <button
          className={`section-button ${activeSection === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveSection('settings')}
        >
          Settings
        </button>
        <button
          className={`section-button ${activeSection === 'channels' ? 'active' : ''}`}
          onClick={() => setActiveSection('channels')}
        >
          Channel Configuration
        </button>
        <button
          className={`section-button ${activeSection === 'programs' ? 'active' : ''}`}
          onClick={() => setActiveSection('programs')}
        >
          Programs
        </button>
      </div>

      {activeSection === 'settings' ? (
        <div className={menuOptionsClassName}>
          <button onClick={onAspectRatioToggle}>
            {aspectRatioLabel}: {settings.aspectRatio}
          </button>
          <button onClick={onStyleToggle}>
            {styleLabel}: {settings.tvStyle === '90s' ? '90\'s' : '00\'s'}
          </button>
          {settings.tvStyle === '90s' && onCRTFilterToggle && (
            <button onClick={onCRTFilterToggle}>
              CRT FILTER: {settings.crtFilter ? 'ON' : 'OFF'}
            </button>
          )}
        </div>
      ) : activeSection === 'channels' ? (
        <ChannelConfig />
      ) : (
        <ShowConfig />
      )}
    </div>
  );
};
