import type { TVSettings } from '../types/tv.types';
import { MenuBase } from './MenuBase';

interface Menu00sProps {
  settings: TVSettings;
  onAspectRatioToggle: () => void;
  onStyleToggle: () => void;
  isMenuOpen: boolean;
}

export const Menu00s = ({
  settings,
  onAspectRatioToggle,
  onStyleToggle,
  isMenuOpen
}: Menu00sProps) => {
  return (
    <MenuBase
      settings={settings}
      onAspectRatioToggle={onAspectRatioToggle}
      onStyleToggle={onStyleToggle}
      isMenuOpen={isMenuOpen}
      menuClassName="menu-00s"
      menuTitle="Settings Menu"
      aspectRatioLabel="Display Format"
      styleLabel="TV Style"
    />
  );
};
