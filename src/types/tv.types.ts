export interface Channel {
  id              : number;
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
  id          : number;
  name        : string;
  description : string;
  startTime   : string;
  endTime     : string;
  channelId   : number;
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
