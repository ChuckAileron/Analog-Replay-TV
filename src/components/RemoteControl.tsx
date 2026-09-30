import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { TVSettings, CRTFilterStyle } from '../types/tv.types';
import '../styles/remote-control.css';

interface RemoteControlProps {
  tvStyle: '90s' | '00s';
  settings: TVSettings;
  isPoweredOn: boolean;
  isMuted: boolean;
  onClose: () => void;
  onPowerToggle: () => void;
  onChannelUp: () => void;
  onChannelDown: () => void;
  onVolumeUp: () => void;
  onVolumeDown: () => void;
  onMuteToggle: () => void;
  onGuideToggle: () => void;
  onGoToChannel: (channelNumber: number) => void;
  onLastChannel: () => void;
  onAspectRatioToggle: () => void;
  onStyleToggle: () => void;
  onCRTFilterToggle: () => void;
  onCRTStyleToggle: () => void;
  onTVFrameToggle: () => void;
}

const FOCUS_ORDER = [
  'power', 'mute', 'guide', 'menu',
  'chUp', 'chDown', 'last',
  'num1', 'num2', 'num3', 'num4', 'num5',
  'num6', 'num7', 'num8', 'num9', 'num0', 'ok',
  'volUp', 'volDown'
];

// El filtro CRT y el bisel de la TV solo existen en el estilo 90s, así que sus
// filas desaparecen (y salen del recorrido del foco) cuando se cambia al estilo
// 00s. La fila para elegir el shader solo aparece si además el filtro está encendido.
const SETTINGS_FOCUS_ORDER = ['settingAspect', 'settingStyle', 'settingCrt', 'settingCrtStyle', 'settingFrame', 'settingBack'];
const SETTINGS_FOCUS_ORDER_NO_CRT_STYLE = ['settingAspect', 'settingStyle', 'settingCrt', 'settingFrame', 'settingBack'];
const SETTINGS_FOCUS_ORDER_NO_CRT = ['settingAspect', 'settingStyle', 'settingBack'];

const CRT_STYLE_LABELS: Record<CRTFilterStyle, string> = {
  'analog-replay': 'CRT Analog Replay TV',
  royale: 'CRT Royale'
};


// Botones que siguen funcionando con la TV apagada, igual que en un control
// remoto real: la energía y los ajustes de imagen son de nivel de sistema.
const ALWAYS_ENABLED = new Set(['power', 'menu']);

function moveFocus(currentId: string, direction: 'up' | 'down' | 'left' | 'right', order: string[]): string {
  const currentIndex = Math.max(0, order.indexOf(currentId));
  const step = direction === 'left' || direction === 'up' ? -1 : 1;
  return order[(currentIndex + step + order.length) % order.length];
}

export const RemoteControl: React.FC<RemoteControlProps> = ({
  tvStyle,
  settings,
  isPoweredOn,
  isMuted,
  onClose,
  onPowerToggle,
  onChannelUp,
  onChannelDown,
  onVolumeUp,
  onVolumeDown,
  onMuteToggle,
  onGuideToggle,
  onGoToChannel,
  onLastChannel,
  onAspectRatioToggle,
  onStyleToggle,
  onCRTFilterToggle,
  onCRTStyleToggle,
  onTVFrameToggle
}) => {
  const [focusedId, setFocusedId] = useState<string>('power');
  const [digitBuffer, setDigitBuffer] = useState<string>('');
  // El panel de ajustes vive dentro del propio control remoto: es la única
  // superficie de configuración que queda en la TV (estilo, aspecto y filtro CRT).
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // El resto de botones (aparte de "power" y "menu") se deshabilitan cuando la TV
  // está apagada, igual que en un control remoto real.
  const isDisabled = (id: string) => !ALWAYS_ENABLED.has(id) && !isPoweredOn;

  // Recorrido del foco según el panel visible: los botones del remoto o las
  // filas de ajustes. Si el foco guardado deja de existir (por ejemplo, la fila
  // del filtro CRT o la del bisel al cambiar al estilo 00s, o la del shader al
  // apagar el filtro), se vuelve al primer elemento.
  const activeFocusOrder = !settingsOpen
    ? FOCUS_ORDER
    : (settings.tvStyle !== '90s'
        ? SETTINGS_FOCUS_ORDER_NO_CRT
        : (settings.crtFilter ? SETTINGS_FOCUS_ORDER : SETTINGS_FOCUS_ORDER_NO_CRT_STYLE));
  const activeFocusedId = activeFocusOrder.includes(focusedId) ? focusedId : activeFocusOrder[0];

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
    // Ajustes de imagen: funcionan con la TV apagada.
    if (id === 'settingAspect') { onAspectRatioToggle(); return; }
    if (id === 'settingStyle') { onStyleToggle(); return; }
    if (id === 'settingCrt') { onCRTFilterToggle(); return; }
    if (id === 'settingCrtStyle') { onCRTStyleToggle(); return; }
    if (id === 'settingFrame') { onTVFrameToggle(); return; }
    if (id === 'settingBack') {
      setSettingsOpen(false);
      setFocusedId('menu');
      return;
    }
    if (isDisabled(id)) return;
    switch (id) {
      case 'power': onPowerToggle(); break;
      case 'mute': onMuteToggle(); break;
      case 'guide':
        onClose();
        onGuideToggle();
        break;
      case 'menu':
        setSettingsOpen(true);
        setFocusedId(SETTINGS_FOCUS_ORDER[0]);
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
  }, [isPoweredOn, onClose, onPowerToggle, onMuteToggle, onGuideToggle, onChannelUp, onChannelDown, onVolumeUp, onVolumeDown, handleOk, handleClearOrLast, handleDigitPress, onAspectRatioToggle, onStyleToggle, onCRTFilterToggle, onCRTStyleToggle, onTVFrameToggle]);

  // Navegación por teclado: flechas mueven el foco, Enter activa el botón enfocado,
  // Escape vuelve de los ajustes al remoto y, si ya está cerrado, cierra el panel.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case 'ArrowUp':
          event.preventDefault();
          setFocusedId(moveFocus(activeFocusedId, 'up', activeFocusOrder));
          break;
        case 'ArrowDown':
          event.preventDefault();
          setFocusedId(moveFocus(activeFocusedId, 'down', activeFocusOrder));
          break;
        case 'ArrowLeft':
          event.preventDefault();
          setFocusedId(moveFocus(activeFocusedId, 'left', activeFocusOrder));
          break;
        case 'ArrowRight':
          event.preventDefault();
          setFocusedId(moveFocus(activeFocusedId, 'right', activeFocusOrder));
          break;
        case 'Enter':
          event.preventDefault();
          activateButton(activeFocusedId);
          break;
        case 'Escape':
          event.preventDefault();
          if (settingsOpen) {
            setSettingsOpen(false);
            setFocusedId('menu');
          } else {
            onClose();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeFocusOrder, activeFocusedId, activateButton, onClose, settingsOpen]);

  const renderButton = (id: string, label: string, extraClass = '', title?: string) => {
    const disabled = isDisabled(id);
    return (
      <button
        key={id}
        type="button"
        className={`remote-btn ${extraClass} ${activeFocusedId === id ? 'focused' : ''} ${disabled ? 'disabled' : ''}`}
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

  // Fila de ajuste: etiqueta a la izquierda y valor actual a la derecha.
  // Se activa con clic o con Enter cuando tiene el foco.
  const renderSetting = (id: string, label: string, value: string) => (
    <button
      key={id}
      type="button"
      className={`remote-setting-row ${activeFocusedId === id ? 'focused' : ''}`}
      onClick={() => {
        setFocusedId(id);
        activateButton(id);
      }}
      onMouseEnter={() => setFocusedId(id)}
    >
      <span className="remote-setting-label">{label}</span>
      <strong className="remote-setting-value">{value}</strong>
    </button>
  );

  const labels: Record<string, string> = {
    power: 'POWER',
    mute: isMuted ? 'MUTED' : 'MUTE',
    guide: 'GUIDE',
    menu: 'SETTINGS',
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
            <span className="remote-title">
              {settingsOpen
                ? (tvStyle === '90s' ? 'AJUSTES' : 'Ajustes')
                : (tvStyle === '90s' ? 'CONTROL REMOTO' : 'Control remoto')}
            </span>
          </div>
          {!settingsOpen && (
            <div className={`remote-digit-display ${digitBuffer ? 'has-value' : ''}`} aria-label="Canal ingresado">
              <span>CANAL</span>
              <strong>{digitBuffer || '---'}</strong>
            </div>
          )}
          <button type="button" className="remote-close" onClick={onClose} title="Cerrar control remoto" aria-label="Cerrar control remoto">
            <span aria-hidden="true" />
          </button>
        </div>

        {settingsOpen ? (
          <div className="remote-settings-wrap">
            <section className="remote-group" aria-label="Ajustes de imagen">
              <span className="remote-group-label">Ajustes</span>
              <div className="remote-settings">
                {renderSetting('settingAspect', 'Aspecto', settings.aspectRatio)}
                {renderSetting('settingStyle', 'Estilo TV', settings.tvStyle === '90s' ? "90's" : "00's")}
                {settings.tvStyle === '90s' && renderSetting('settingCrt', 'Filtro CRT', settings.crtFilter ? 'ON' : 'OFF')}
                {settings.tvStyle === '90s' && settings.crtFilter && renderSetting('settingCrtStyle', 'Shader CRT', CRT_STYLE_LABELS[settings.crtStyle])}
                {settings.tvStyle === '90s' && renderSetting('settingFrame', 'Marco TV', settings.tvFrame ? 'ON' : 'OFF')}
                <button
                  type="button"
                  className={`remote-setting-back ${activeFocusedId === 'settingBack' ? 'focused' : ''}`}
                  onClick={() => {
                    setFocusedId('settingBack');
                    activateButton('settingBack');
                  }}
                  onMouseEnter={() => setFocusedId('settingBack')}
                >
                  ← Volver
                </button>
              </div>
            </section>
          </div>
        ) : (
          <div className="remote-controls">
            <section className="remote-group remote-system-group" aria-label="Controles del sistema">
              <span className="remote-group-label">Sistema</span>
              <div className="remote-button-grid remote-system-buttons">
                {renderButton('power', labels.power, 'power-btn', 'Encender o apagar')}
                {renderButton('mute', labels.mute, 'mute-btn', 'Silenciar')}
                {renderButton('guide', labels.guide, '', 'Abrir guía')}
                {renderButton('menu', labels.menu, '', 'Abrir ajustes')}
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
        )}
      </div>
    </div>
  );
};

export default RemoteControl;
