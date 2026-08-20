import { writable, derived } from 'svelte/store';
import type { PixelFrame, Group, SpriteSelection, Color } from '../types';

export interface SlicerState {
  sourceFrame: PixelFrame | null;
  mode: 'manual' | 'grid';
  gridRows: number;
  gridCols: number;
  gridOffsetX: number;
  gridOffsetY: number;
  gridSpacingX: number;
  gridSpacingY: number;
  zoom: number;
  panX: number;
  panY: number;
  groups: Group[];
  activeGroupIdx: number;
  manualActiveId: number | null;
  manualSelections: SpriteSelection[];
  disabledCellIds: number[];
  gridCellGroupMap: Record<number, string>;
  removeWhiteBg: boolean;
  modalSelectionId: number | null;
  nextManualId: number;
}

const initialGroups: Group[] = [
  { id: 'g-main', name: 'Main', color: '#e63946' },
  { id: 'g-run', name: 'Run', color: '#2a9d8f' },
  { id: 'g-attack', name: 'Attack', color: '#457b9d' },
  { id: 'g-jump', name: 'Jump', color: '#e76f51' }
];

const initialState: SlicerState = {
  sourceFrame: null,
  mode: 'grid',
  gridRows: 2,
  gridCols: 2,
  gridOffsetX: 0,
  gridOffsetY: 0,
  gridSpacingX: 0,
  gridSpacingY: 0,
  zoom: 1.0,
  panX: 0,
  panY: 0,
  groups: initialGroups,
  activeGroupIdx: 0,
  manualActiveId: null,
  manualSelections: [],
  disabledCellIds: [],
  gridCellGroupMap: {},
  removeWhiteBg: false,
  modalSelectionId: null,
  nextManualId: 1
};

function createSlicerStore() {
  const { subscribe, set, update } = writable<SlicerState>(initialState);

  return {
    subscribe,
    dispatch: (action: any) => {
      update((state) => {
        switch (action.type) {
          case 'SET_SOURCE_FRAME': {
            return {
              ...state,
              sourceFrame: action.frame,
              manualActiveId: null,
              manualSelections: [],
              disabledCellIds: [],
              gridCellGroupMap: {},
              panX: 0,
              panY: 0,
              zoom: 1.0
            };
          }

          case 'SET_MODE': {
            return { ...state, mode: action.mode };
          }

          case 'SET_GRID_PARAM': {
            const val = Math.max(0, action.value);
            return { ...state, [action.key]: val };
          }

          case 'SET_ZOOM': {
            const newZoom = Math.max(0.2, Math.min(8.0, state.zoom + action.delta));
            return { ...state, zoom: newZoom };
          }

          case 'SET_PAN': {
            return { ...state, panX: action.panX, panY: action.panY };
          }

          case 'RESET_VIEW': {
            return { ...state, zoom: 1.0, panX: 0, panY: 0 };
          }

          case 'SET_ACTIVE_GROUP': {
            return { ...state, activeGroupIdx: action.index };
          }

          case 'ADD_GROUP': {
            const palette = ['#e63946', '#2a9d8f', '#457b9d', '#e76f51', '#9c27b0', '#00bcd4', '#ffb703'];
            const idx = state.groups.length + 1;
            const newG: Group = {
              id: `g-${Date.now()}`,
              name: `Action ${idx}`,
              color: palette[(idx - 1) % palette.length]
            };
            return {
              ...state,
              groups: [...state.groups, newG],
              activeGroupIdx: state.groups.length
            };
          }

          case 'RENAME_GROUP': {
            const groups = [...state.groups];
            if (groups[state.activeGroupIdx]) {
              groups[state.activeGroupIdx] = { ...groups[state.activeGroupIdx], name: action.name };
            }
            return { ...state, groups };
          }

          case 'DELETE_GROUP': {
            if (state.groups.length <= 1) return state;
            const groups = state.groups.filter((_, i) => i !== action.index);
            return {
              ...state,
              groups,
              activeGroupIdx: Math.max(0, state.activeGroupIdx - 1)
            };
          }

          case 'CLICK_GRID_CELL': {
            const cellId = action.id;
            const activeGroup = state.groups[state.activeGroupIdx] || state.groups[0];
            const currentTag = state.gridCellGroupMap[cellId];

            if (currentTag === activeGroup.name && !state.disabledCellIds.includes(cellId)) {
              return {
                ...state,
                disabledCellIds: [...state.disabledCellIds, cellId]
              };
            } else if (state.disabledCellIds.includes(cellId)) {
              return {
                ...state,
                disabledCellIds: state.disabledCellIds.filter((id) => id !== cellId),
                gridCellGroupMap: { ...state.gridCellGroupMap, [cellId]: activeGroup.name }
              };
            } else {
              return {
                ...state,
                gridCellGroupMap: { ...state.gridCellGroupMap, [cellId]: activeGroup.name }
              };
            }
          }

          case 'UNASSIGN_CELL':
          case 'TOGGLE_CELL_ENABLE': {
            const cellId = action.id;
            const isDisabled = state.disabledCellIds.includes(cellId);
            return {
              ...state,
              disabledCellIds: isDisabled
                ? state.disabledCellIds.filter((id) => id !== cellId)
                : [...state.disabledCellIds, cellId]
            };
          }

          case 'ENABLE_ALL_CELLS': {
            return { ...state, disabledCellIds: [] };
          }

          case 'UNASSIGN_ALL_CELLS': {
            if (state.mode === 'grid') {
              const rows = state.gridRows;
              const cols = state.gridCols;
              const allIds = Array.from({ length: rows * cols }, (_, i) => i + 1);
              return { ...state, disabledCellIds: allIds };
            }
            return state;
          }

          case 'ASSIGN_GROUP_TO_ALL_CELLS': {
            const activeGroup = state.groups[state.activeGroupIdx] || state.groups[0];
            const rows = state.gridRows;
            const cols = state.gridCols;
            const newMap: Record<number, string> = {};
            for (let i = 1; i <= rows * cols; i++) {
              newMap[i] = activeGroup.name;
            }
            return { ...state, gridCellGroupMap: newMap, disabledCellIds: [] };
          }

          case 'CREATE_MANUAL_BOX': {
            const activeGroup = state.groups[state.activeGroupIdx] || state.groups[0];
            const newSel: SpriteSelection = {
              id: state.nextManualId,
              x: action.x,
              y: action.y,
              width: action.w,
              height: action.h,
              groupName: activeGroup.name,
              enabled: true
            };
            return {
              ...state,
              manualSelections: [...state.manualSelections, newSel],
              manualActiveId: state.nextManualId,
              nextManualId: state.nextManualId + 1
            };
          }

          case 'SELECT_BOX': {
            return { ...state, manualActiveId: action.id };
          }

          case 'ADD_ADJACENT_BOX': {
            if (state.manualActiveId === null) return state;
            const cur = state.manualSelections.find((s) => s.id === state.manualActiveId);
            if (!cur) return state;

            let nx = cur.x, ny = cur.y;
            if (action.direction === 'left') nx -= cur.width;
            if (action.direction === 'right') nx += cur.width;
            if (action.direction === 'up') ny -= cur.height;
            if (action.direction === 'down') ny += cur.height;

            const activeGroup = state.groups[state.activeGroupIdx] || state.groups[0];
            const newSel: SpriteSelection = {
              id: state.nextManualId,
              x: Math.max(0, nx),
              y: Math.max(0, ny),
              width: cur.width,
              height: cur.height,
              groupName: activeGroup.name,
              enabled: true
            };

            return {
              ...state,
              manualSelections: [...state.manualSelections, newSel],
              manualActiveId: state.nextManualId,
              nextManualId: state.nextManualId + 1
            };
          }

          case 'DELETE_BOX': {
            return {
              ...state,
              manualSelections: state.manualSelections.filter((s) => s.id !== action.id),
              disabledCellIds: [...state.disabledCellIds, action.id],
              manualActiveId: state.manualActiveId === action.id ? null : state.manualActiveId,
              modalSelectionId: state.modalSelectionId === action.id ? null : state.modalSelectionId
            };
          }

          case 'CLEAR_MANUAL_BOXES': {
            return { ...state, manualSelections: [], manualActiveId: null };
          }

          case 'TOGGLE_REMOVE_WHITE_BG': {
            return { ...state, removeWhiteBg: !state.removeWhiteBg };
          }

          case 'SET_MODAL': {
            return { ...state, modalSelectionId: action.id };
          }

          default:
            return state;
        }
      });
    }
  };
}

export const slicerStore = createSlicerStore();

export const currentSelections = derived(slicerStore, ($s) => {
  if (!$s.sourceFrame) return [];

  if ($s.mode === 'manual') {
    return $s.manualSelections.map((sel) => ({
      ...sel,
      enabled: sel.enabled !== false && !$s.disabledCellIds.includes(sel.id)
    }));
  }

  const { sourceFrame, gridRows, gridCols, gridOffsetX, gridOffsetY, gridSpacingX, gridSpacingY } = $s;
  const W = sourceFrame.width;
  const H = sourceFrame.height;

  const cols = Math.max(1, gridCols);
  const rows = Math.max(1, gridRows);

  const cellW = Math.max(1, Math.floor((W - gridOffsetX - (cols - 1) * gridSpacingX) / cols));
  const cellH = Math.max(1, Math.floor((H - gridOffsetY - (rows - 1) * gridSpacingY) / rows));

  const list: SpriteSelection[] = [];
  const defaultGroup = $s.groups[0]?.name || 'Main';

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const id = r * cols + c + 1;
      const x = gridOffsetX + c * (cellW + gridSpacingX);
      const y = gridOffsetY + r * (cellH + gridSpacingY);

      if (x < W && y < H) {
        const groupName = $s.gridCellGroupMap[id] || defaultGroup;
        const enabled = !$s.disabledCellIds.includes(id);

        list.push({
          id,
          x,
          y,
          width: Math.min(cellW, W - x),
          height: Math.min(cellH, H - y),
          groupName,
          enabled
        });
      }
    }
  }

  return list;
});

export const extractedSlices = derived([slicerStore, currentSelections], ([$s, $selections]) => {
  if (!$s.sourceFrame) return [];

  const src = $s.sourceFrame;
  const slices: {
    id: number;
    groupName: string;
    width: number;
    height: number;
    enabled: boolean;
    frame: PixelFrame;
  }[] = [];

  $selections.forEach((sel) => {
    const pixels: (Color | null)[] = new Array(sel.width * sel.height).fill(null);

    for (let sy = 0; sy < sel.height; sy++) {
      for (let sx = 0; sx < sel.width; sx++) {
        const srcX = sel.x + sx;
        const srcY = sel.y + sy;

        if (srcX >= 0 && srcX < src.width && srcY >= 0 && srcY < src.height) {
          const px = src.pixels[srcY * src.width + srcX];
          if (px) {
            if ($s.removeWhiteBg && px.r > 0.92 && px.g > 0.92 && px.b > 0.92) {
              pixels[sy * sel.width + sx] = null;
            } else {
              pixels[sy * sel.width + sx] = { ...px };
            }
          }
        }
      }
    }

    const frame: PixelFrame = {
      id: `slice-${sel.id}-${Date.now()}`,
      width: sel.width,
      height: sel.height,
      pixels,
      groupId: '',
      tag: sel.groupName
    };

    slices.push({
      id: sel.id,
      groupName: sel.groupName,
      width: sel.width,
      height: sel.height,
      enabled: sel.enabled,
      frame
    });
  });

  return slices;
});
