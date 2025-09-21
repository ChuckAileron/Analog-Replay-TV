export interface Channel {
  id:           string;
  name:         string;
  url:          string;
  description?: string;
  isEnabled:    boolean;
}

export interface ChannelConfig {
  channels:     Channel[];
  lastUpdated:  string;
}
