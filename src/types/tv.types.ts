export interface Channel {
  id              : string | number; // Soporte para UUIDs (string) y IDs legacy (number)
  uuid?           : string;          // UUID opcional para nueva estructura
  name            : string;
  number          : number;
  description?    : string;
  isEnabled       : boolean;
  currentProgram? : Program;
}

export interface ChannelConfig {
  channels: Channel[];
}

export interface Program {
  id          : string | number; // Soporte para UUIDs y IDs legacy
  name        : string;
  description : string;
  startTime   : string;
  endTime     : string;
  channelId   : string | number; // Soporte para UUIDs y IDs legacy
}

export type AspectRatio = '16:9' | '4:3';
export type TVStyle     = '90s' | '00s';

/**
 * Shader del filtro CRT. Solo aplica en el estilo 90s.
 *
 * - `analog-replay`: filtro original de Analog Replay TV (Canvas 2D).
 * - `royale`:        shader WebGL inspirado en crt-royale (ver electron/services/crtShaders.ts).
 */
export type CRTFilterStyle = 'analog-replay' | 'royale';

export interface TVSettings {
  brightness  : number;
  contrast    : number;
  volume      : number;
  isMuted     : boolean;
  aspectRatio : AspectRatio;
  tvStyle     : TVStyle;
  crtFilter   : boolean;
  crtStyle    : CRTFilterStyle; // Shader del filtro CRT (solo estilo 90s)
  tvFrame     : boolean; // Bisel/marco de la TV (solo estilo 90s; el 00s va siempre sin marco)
  lastChannel : number; // Último canal sintonizado, para restaurarlo al reabrir la app
}

export interface ChannelGuide {
  channelId : number;
  programs  : Program[];
}
