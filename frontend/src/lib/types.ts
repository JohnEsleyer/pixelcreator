export type Screen = 'dashboard' | 'editor' | 'overview' | 'slicer' | 'composer';

export type Tool = 'pencil' | 'eraser' | 'eyedropper' | 'select' | 'lasso';

export interface Color {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface Group {
  id: string;
  name: string;
  color: string;
}

export interface PixelFrame {
  id: string;
  width: number;
  height: number;
  pixels: (Color | null)[];
  groupId: string;
  tag?: string;
}

export interface SpriteSelection {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  groupName: string;
  enabled: boolean;
}

export interface Project {
  id: number;
  name: string;
  width: number;
  height: number;
  groups: Group[];
  frames: PixelFrame[];
  activeGroupId: string;
  currentFrameIndexInGroup: number;
  fps: number;
  onionSkinEnabled: boolean;
  zoom: number;
}

// --- World Composer Types ---

export interface WorldEntity {
  id: string;
  projectId: number;
  name: string;
  x: number;
  y: number;
  zIndex: number;
  activeGroupId: string;
  scale: number;
  flipX: boolean;
  flipY: boolean;
  opacity: number;
  playing: boolean;
}

export interface WorldScene {
  id: string;
  name: string;
  width: number;
  height: number;
  bgColor: string;
  entities: WorldEntity[];
}
