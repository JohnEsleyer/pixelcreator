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

export type Tool = 'pencil' | 'eraser';
export type Screen = 'dashboard' | 'editor' | 'overview' | 'slicer';
export type Direction = 'left' | 'right' | 'up' | 'down';
export type SlicerMode = 'manual' | 'grid';
