export interface Color {
  r: number;
  g: number;
  b: number;
  a: number;
}

export type Tool = 'pencil' | 'eraser' | 'eyedropper' | 'select' | 'lasso';

export interface PixelFrame {
  id: string;
  width: number;
  height: number;
  pixels: (Color | null)[];
  groupId?: string;
  tag?: string;
}

export interface Group {
  id: string;
  name: string;
  color: string;
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

export type Screen = 'dashboard' | 'editor' | 'overview' | 'slicer' | 'text-to-pixel';
