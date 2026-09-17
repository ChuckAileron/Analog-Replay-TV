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

const FOCUS_ORDER = [
  'power', 'mute', 'guide', 'menu',
  'chUp', 'chDown', 'last',
  'num1', 'num2', 'num3', 'num4', 'num5',
  'num6', 'num7', 'num8', 'num9', 'num0', 'ok',
  'volUp', 'volDown'
];

function moveFocus(currentId: string, direction: 'up' | 'down' | 'left' | 'right'): string {
  const currentIndex = Math.max(0, FOCUS_ORDER.indexOf(currentId));
  const step = direction === 'left' || direction === 'up' ? -1 : 1;
  return FOCUS_ORDER[(currentIndex + step + FOCUS_ORDER.length) % FOCUS_ORDER.length];
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
      case 'guide':
        onClose();
        onGuideToggle();
        break;
      case 'menu':
        onClose();
        onMenuToggle();
        break;
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
  }, [isPoweredOn, onClose, onPowerToggle, onMuteToggle, onGuideToggle, onMenuToggle, onChannelUp, onChannelDown, onVolumeUp, onVolumeDown, handleOk, handleClearOrLast, handleDigitPress]);

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

  const renderButton = (id: string, label: string, extraClass = '', title?: string) => {
    const disabled = isDisabled(id);
    return (
      <button
        key={id}
        type="button"
        className={`remote-btn ${extraClass} ${focusedId === id ? 'focused' : ''} ${disabled ? 'disabled' : ''}`}
        disabled={disabled}
        title={title || label}
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
    power: 'POWER',
    mute: isMuted ? 'MUTED' : 'MUTE',
    guide: 'GUIDE',
    menu: 'MENU',
    chUp: 'CH +',
    chDown: 'CH −',
    volUp: 'VOL +',
    volDown: 'VOL −',
    num1: '1', num2: '2', num3: '3',
    num4: '4', num5: '5', num6: '6',
    num7: '7', num8: '8', num9: '9',
    num0: '0',
    last: digitBuffer ? 'CLR' : 'LAST',
    ok: 'OK'
  };

  return (
    <div
      className={`remote-modal-layer style-${tvStyle}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="remote-control"
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Control remoto"
      >
        <div className="remote-header">
          <div className="remote-heading">
            <span className="remote-eyebrow">ANALOG REPLAY TV</span>
            <span className="remote-title">{tvStyle === '90s' ? 'CONTROL REMOTO' : 'Control remoto'}</span>
          </div>
          <div className={`remote-digit-display ${digitBuffer ? 'has-value' : ''}`} aria-label="Canal ingresado">
            <span>CANAL</span>
            <strong>{digitBuffer || '---'}</strong>
          </div>
          <button type="button" className="remote-close" onClick={onClose} title="Cerrar control remoto" aria-label="Cerrar control remoto">
            ×
          </button>
        </div>

        <div className="remote-controls">
          <section className="remote-group remote-system-group" aria-label="Controles del sistema">
            <span className="remote-group-label">Sistema</span>
            <div className="remote-button-grid remote-system-buttons">
              {renderButton('power', labels.power, 'power-btn', 'Encender o apagar')}
              {renderButton('mute', labels.mute, 'mute-btn', 'Silenciar')}
              {renderButton('guide', labels.guide, '', 'Abrir guía')}
              {renderButton('menu', labels.menu, '', 'Abrir menú')}
            </div>
          </section>

          <section className="remote-group remote-channel-group" aria-label="Controles de canal">
            <span className="remote-group-label">Canal</span>
            <div className="remote-button-grid remote-channel-buttons">
              {renderButton('chUp', labels.chUp)}
              {renderButton('chDown', labels.chDown)}
              {renderButton('last', labels.last, 'last-btn', digitBuffer ? 'Borrar canal ingresado' : 'Volver al canal anterior')}
            </div>
          </section>

          <section className="remote-group remote-numpad-group" aria-label="Teclado numérico">
            <span className="remote-group-label">Acceso directo</span>
            <div className="remote-button-grid remote-numpad">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map(number =>
                renderButton(`num${number}`, String(number), 'number-btn', `Ingresar ${number}`)
              )}
              {renderButton('ok', labels.ok, 'ok-btn', 'Ir al canal ingresado')}
            </div>
          </section>

          <section className="remote-group remote-volume-group" aria-label="Controles de volumen">
            <span className="remote-group-label">Volumen</span>
            <div className="remote-button-grid remote-volume-buttons">
              {renderButton('volUp', labels.volUp)}
              {renderButton('volDown', labels.volDown)}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default RemoteControl;
