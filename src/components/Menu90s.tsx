import type { TVSettings } from '../types/tv.types';
import { MenuBase } from './MenuBase';

interface Menu90sProps {
  settings: TVSettings;
  onAspectRatioToggle: () => void;
  onStyleToggle: () => void;
  isMenuOpen: boolean;
}

export const Menu90s = ({
  settings,
  onAspectRatioToggle,
  onStyleToggle,
  isMenuOpen
}: Menu90sProps) => {
  return (
    <MenuBase
      settings={settings}
      onAspectRatioToggle={onAspectRatioToggle}
      onStyleToggle={onStyleToggle}
      isMenuOpen={isMenuOpen}
      menuClassName="menu-90s style-90s content-container"
      menuTitle="SETTINGS MENU"
      aspectRatioLabel="ASPECT"
      styleLabel="TV ERA"
    />
  );
};
