import React from 'react';

interface TVControlsProps {
  onChannelUp       : () => void;
  onChannelDown     : () => void;
  onGuideToggle     : () => void;
  onSettingsToggle  : () => void;
}

const TVControls: React.FC<TVControlsProps> = ({
  onChannelUp,
  onChannelDown,
  onGuideToggle,
  onSettingsToggle
}) => {
  return (
    <div className="tv-controls-panel">
      <div className="channel-controls">
        <button className="control-button channel-up" onClick={onChannelUp}>CH+</button>
        <button className="control-button channel-down" onClick={onChannelDown}>CH-</button>
      </div>
      <div className="menu-controls">
        <button className="control-button guide" onClick={onGuideToggle}>GUIDE</button>
        <button className="control-button settings" onClick={onSettingsToggle}>MENU</button>
      </div>
    </div>
  );
};

export default TVControls;
