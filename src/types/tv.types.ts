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

export interface TVSettings {
  brightness  : number;
  contrast    : number;
  volume      : number;
  isMuted     : boolean;
  aspectRatio : AspectRatio;
  tvStyle     : TVStyle;
  crtFilter   : boolean;
}

export interface ChannelGuide {
  channelId : number;
  programs  : Program[];
}

export type ControlAction = 
  | { type: 'CHANNEL_UP' }
  | { type: 'CHANNEL_DOWN' }
  | { type: 'SET_CHANNEL'; channel: number }
  | { type: 'TOGGLE_GUIDE' }
  | { type: 'TOGGLE_SETTINGS' }
  | { type: 'UPDATE_SETTINGS'; settings: Partial<TVSettings> };
