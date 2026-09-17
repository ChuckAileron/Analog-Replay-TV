import React from 'react';
import '../styles/analog-replay-filler.css';

interface AnalogReplayFillerProps {
  tvStyle: '90s' | '00s';
}

/**
 * Pantalla de relleno mostrada cuando un episodio termina antes de completar
 * su slot de 30 minutos de programación. Simula una "identificación de
 * estación" con el logo animado de AnalogReplayTV, con un estilo visual
 * acorde a la época elegida (90s: CRT verde fosforescente; 2000s: gradiente
 * azul con brillo). A futuro este espacio será usado para comerciales reales.
 */
export const AnalogReplayFiller: React.FC<AnalogReplayFillerProps> = ({ tvStyle }) => {
  const is90s = tvStyle === '90s';

  return (
    <div className={`analog-filler ${is90s ? 'analog-filler-90s' : 'analog-filler-00s'}`}>
      {is90s && <div className="analog-filler-scanlines" />}

      <div className="analog-filler-logo-wrapper">
        <div className="analog-filler-logo">
          <span className="analog-filler-word analog-filler-word-1">ANALOG</span>
          <span className="analog-filler-word analog-filler-word-2">REPLAY</span>
          <span className="analog-filler-word analog-filler-word-3">TV</span>
        </div>
        <div className="analog-filler-subtitle">
          {is90s ? 'YA VOLVEMOS...' : 'Ya volvemos...'}
        </div>
      </div>

      <div className="analog-filler-bars" aria-hidden="true">
        <span /><span /><span /><span /><span /><span /><span />
      </div>
    </div>
  );
};

export default AnalogReplayFiller;
