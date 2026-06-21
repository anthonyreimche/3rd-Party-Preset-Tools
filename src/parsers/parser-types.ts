export interface LightroomPreset {
  name: string;
  settings: Record<string, unknown>;
}

export interface ParsedPreset {
  name: string;
  params: Record<string, unknown>;
}
