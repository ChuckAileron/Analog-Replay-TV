import type { TVSettings } from '../types/tv.types';
import { MenuBase } from './MenuBase';

interface Menu00sProps {
  settings: TVSettings;
  onAspectRatioToggle: () => void;
  onStyleToggle: () => void;
  onResetSchedule?: () => void;
  isMenuOpen: boolean;
}

export const Menu00s = ({
  settings,
  onAspectRatioToggle,
  onStyleToggle,
  onResetSchedule,
  isMenuOpen
}: Menu00sProps) => {
  return (
    <MenuBase
      settings={settings}
      onAspectRatioToggle={onAspectRatioToggle}
      onStyleToggle={onStyleToggle}
      onResetSchedule={onResetSchedule}
      isMenuOpen={isMenuOpen}
      menuClassName="menu-00s"
      menuTitle="Settings Menu"
      aspectRatioLabel="Display Format"
      styleLabel="TV Style"
    />
  );
};
