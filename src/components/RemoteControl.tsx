import React, { useState, useEffect, useCallback, useRef } from 'react';
import '../styles/remote-control.css';

interface RemoteControlProps {
  tvStyle: '90s' | '00s';
  isPoweredOn: boolean;
  isMuted: boolean;
  onClose: () => void;
  onPowerToggle: () => void;
  onChannelUp: () => void;
  onChannelDown: () => void;
  onVolumeUp: () => void;
  onVolumeDown: () => void;
  onMuteToggle: () => void;
  onMenuToggle: () => void;
  onGuideToggle: () => void;
  onGoToChannel: (channelNumber: number) => void;
  onLastChannel: () => void;
}

// Distribución tipo "control remoto real": una grilla de 3 columnas.
// `null` representa un espacio vacío para mantener la alineación visual.
const GRID: (string | null)[][] = [
  ['power', null, 'mute'],
  ['guide', null, 'menu'],
  ['chUp', null, 'volUp'],
  ['chDown', null, 'volDown'],
  ['num1', 'num2', 'num3'],
  ['num4', 'num5', 'num6'],
  ['num7', 'num8', 'num9'],
  ['last', 'num0', 'ok'],
];

function findPosition(id: string): [number, number] {
  for (let r = 0; r < GRID.length; r++) {
    for (let c = 0; c < GRID[r].length; c++) {
      if (GRID[r][c] === id) return [r, c];
    }
  }
  return [0, 0];
}

function moveFocus(currentId: string, direction: 'up' | 'down' | 'left' | 'right'): string {
  const [r, c] = findPosition(currentId);
  const rows = GRID.length;
  const cols = GRID[0].length;

  if (direction === 'left' || direction === 'right') {
    let nc = c;
    for (let i = 0; i < cols; i++) {
      nc = direction === 'left' ? (nc - 1 + cols) % cols : (nc + 1) % cols;
      const candidate = GRID[r][nc];
      if (candidate) return candidate;
    }
  } else {
    let nr = r;
    for (let i = 0; i < rows; i++) {
      nr = direction === 'up' ? (nr - 1 + rows) % rows : (nr + 1) % rows;
      const candidate = GRID[nr][c];
      if (candidate) return candidate;
    }
  }
  return currentId;
}

export const RemoteControl: React.FC<RemoteControlProps> = ({
  tvStyle,
  isPoweredOn,
  isMuted,
  onClose,
  onPowerToggle,
  onChannelUp,
  onChannelDown,
  onVolumeUp,
  onVolumeDown,
  onMuteToggle,
  onMenuToggle,
  onGuideToggle,
  onGoToChannel,
  onLastChannel
}) => {
  const [focusedId, setFocusedId] = useState<string>('power');
  const [digitBuffer, setDigitBuffer] = useState<string>('');
  const containerRef = useRef<HTMLDivElement>(null);

  // El resto de botones (aparte de "power") se deshabilitan cuando la TV está apagada,
  // igual que en un control remoto real.
  const isDisabled = (id: string) => id !== 'power' && !isPoweredOn;

  const handleDigitPress = useCallback((digit: string) => {
    if (!isPoweredOn) return;
    setDigitBuffer(prev => (prev + digit).slice(-3)); // máximo 3 dígitos
  }, [isPoweredOn]);

  const handleOk = useCallback(() => {
    if (!isPoweredOn || !digitBuffer) return;
    const channelNumber = parseInt(digitBuffer, 10);
    if (!isNaN(channelNumber)) {
      onGoToChannel(channelNumber);
    }
    setDigitBuffer('');
  }, [digitBuffer, isPoweredOn, onGoToChannel]);

  const handleClearOrLast = useCallback(() => {
    if (!isPoweredOn) return;
    if (digitBuffer) {
      setDigitBuffer('');
    } else {
      onLastChannel();
    }
  }, [digitBuffer, isPoweredOn, onLastChannel]);

  const activateButton = useCallback((id: string) => {
    if (isDisabled(id)) return;
    switch (id) {
      case 'power': onPowerToggle(); break;
      case 'mute': onMuteToggle(); break;
      case 'guide': onGuideToggle(); break;
      case 'menu': onMenuToggle(); break;
      case 'chUp': onChannelUp(); break;
      case 'chDown': onChannelDown(); break;
      case 'volUp': onVolumeUp(); break;
      case 'volDown': onVolumeDown(); break;
      case 'ok': handleOk(); break;
      case 'last': handleClearOrLast(); break;
      default:
        if (id.startsWith('num')) {
          handleDigitPress(id.replace('num', ''));
        }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPoweredOn, onPowerToggle, onMuteToggle, onGuideToggle, onMenuToggle, onChannelUp, onChannelDown, onVolumeUp, onVolumeDown, handleOk, handleClearOrLast, handleDigitPress]);

  // Navegación por teclado: flechas mueven el foco, Enter activa el botón enfocado,
  // Escape cierra el panel del control remoto.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case 'ArrowUp':
          event.preventDefault();
          setFocusedId(prev => moveFocus(prev, 'up'));
          break;
        case 'ArrowDown':
          event.preventDefault();
          setFocusedId(prev => moveFocus(prev, 'down'));
          break;
        case 'ArrowLeft':
          event.preventDefault();
          setFocusedId(prev => moveFocus(prev, 'left'));
          break;
        case 'ArrowRight':
          event.preventDefault();
          setFocusedId(prev => moveFocus(prev, 'right'));
          break;
        case 'Enter':
          event.preventDefault();
          activateButton(focusedId);
          break;
        case 'Escape':
          event.preventDefault();
          onClose();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusedId, activateButton, onClose]);

  const renderButton = (id: string | null, label: string, extraClass = '') => {
    if (!id) return <div className="remote-btn-spacer" key={Math.random()} />;
    const disabled = isDisabled(id);
    return (
      <button
        key={id}
        type="button"
        className={`remote-btn ${extraClass} ${focusedId === id ? 'focused' : ''} ${disabled ? 'disabled' : ''}`}
        disabled={disabled}
        onClick={() => {
          setFocusedId(id);
          activateButton(id);
        }}
        onMouseEnter={() => setFocusedId(id)}
      >
        {label}
      </button>
    );
  };

  const labels: Record<string, string> = {
    power: '⏻',
    mute: isMuted ? '🔇' : '🔊',
    guide: 'GUIDE',
    menu: 'MENU',
    chUp: 'CH ▲',
    chDown: 'CH ▼',
    volUp: 'VOL ▲',
    volDown: 'VOL ▼',
    num1: '1', num2: '2', num3: '3',
    num4: '4', num5: '5', num6: '6',
    num7: '7', num8: '8', num9: '9',
    num0: '0',
    last: digitBuffer ? 'CLR' : 'LAST',
    ok: 'OK'
  };

  return (
    <div className={`remote-control style-${tvStyle}`} ref={containerRef}>
      <div className="remote-header">
        <span className="remote-title">{tvStyle === '90s' ? 'CONTROL REMOTO' : 'Control Remoto'}</span>
        <div className="remote-digit-display">{digitBuffer || '---'}</div>
        <button type="button" className="remote-close" onClick={onClose} title="Cerrar control remoto">
          ✕
        </button>
      </div>

      <div className="remote-grid">
        {GRID.map((row, rowIndex) => (
          <div className="remote-row" key={rowIndex}>
            {row.map((id, colIndex) => {
              const extraClass = id === 'power' ? 'power-btn' : id === 'mute' ? 'mute-btn' : '';
              return (
                <React.Fragment key={`${rowIndex}-${colIndex}`}>
                  {renderButton(id, id ? labels[id] : '', extraClass)}
                </React.Fragment>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

export default RemoteControl;
