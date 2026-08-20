import { writable, derived } from 'svelte/store';
import type { PixelFrame, Color } from '../types';

export interface SelectionItem {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  groupName: string;
  enabled: boolean;
}

export interface SlicerGroup {
  name: string;
  color: string;
}

export interface SlicerState {
  sourceFrame: PixelFrame | null;
  mode: 'manual' | 'grid';
  gridRows: number;
  gridCols: number;
  gridOffsetX: number;
  gridOffsetY: number;
  gridSpacingX: number;
  gridSpacingY: number;
  gridCellOverrides: Record<number, { groupName: string; enabled: boolean }>;
  manualSelections: SelectionItem[];
  manualActiveId: number | null;
  groups: SlicerGroup[];
  activeGroupIdx: number;
  zoom: number;
  panX: number;
  panY: number;
  removeWhiteBg: boolean;
  modalSelectionId: number | null;
}

const initialState: SlicerState = {
  sourceFrame: null,
  mode: 'grid',
  gridRows: 4,
  gridCols: 4,
  gridOffsetX: 0,
  gridOffsetY: 0,
  gridSpacingX: 0,
  gridSpacingY: 0,
  gridCellOverrides: {},
  manualSelections: [],
  manualActiveId: null,
  groups: [
    { name: 'Idle', color: '#e63946' },
    { name: 'Walk', color: '#2a9d8f' },
    { name: 'Attack', color: '#e76f51' },
    { name: 'Special', color: '#9c27b0' }
  ],
  activeGroupIdx: 0,
  zoom: 1.0,
  panX: 0,
  panY: 0,
  removeWhiteBg: false,
  modalSelectionId: null
};

function createSlicerStore() {
  const { subscribe, update, set } = writable<SlicerState>(initialState);

  return {
    subscribe,
    dispatch(action: any) {
      update((state) => {
        switch (action.type) {
          case 'SET_SOURCE_FRAME':
            return {
              ...state,
              sourceFrame: action.frame,
              gridCellOverrides: {},
              manualSelections: [],
              manualActiveId: null,
              panX: 0,
              panY: 0,
              zoom: 1.0
            };

          case 'SET_MODE':
            return { ...state, mode: action.mode };

          case 'SET_GRID_PARAM':
            return {
              ...state,
              [action.key]: Math.max(0, action.value)
            };

          case 'CLICK_GRID_CELL': {
            const cellId = action.id;
            const currentOverride = state.gridCellOverrides[cellId];
            const activeGroup = state.groups[state.activeGroupIdx] || state.groups[0];

            const nextOverrides = { ...state.gridCellOverrides };
            if (currentOverride && currentOverride.enabled && currentOverride.groupName === activeGroup.name) {
              // Toggle off
              nextOverrides[cellId] = { groupName: '', enabled: false };
            } else {
              // Assign to active group
              nextOverrides[cellId] = { groupName: activeGroup.name, enabled: true };
            }
            return { ...state, gridCellOverrides: nextOverrides };
          }

          case 'UNASSIGN_CELL': {
            const nextOverrides = { ...state.gridCellOverrides };
            nextOverrides[action.id] = { groupName: '', enabled: false };
            return { ...state, gridCellOverrides: nextOverrides };
          }

          case 'ASSIGN_GROUP_TO_ALL_CELLS': {
            const activeGroup = state.groups[state.activeGroupIdx] || state.groups[0];
            const totalCells = state.gridRows * state.gridCols;
            const nextOverrides: Record<number, { groupName: string; enabled: boolean }> = {};
            for (let i = 1; i <= totalCells; i++) {
              nextOverrides[i] = { groupName: activeGroup.name, enabled: true };
            }
            return { ...state, gridCellOverrides: nextOverrides };
          }

          case 'UNASSIGN_ALL_CELLS': {
            const totalCells = state.gridRows * state.gridCols;
            const nextOverrides: Record<number, { groupName: string; enabled: boolean }> = {};
            for (let i = 1; i <= totalCells; i++) {
              nextOverrides[i] = { groupName: '', enabled: false };
            }
            return { ...state, gridCellOverrides: nextOverrides };
          }

          case 'ENABLE_ALL_CELLS': {
            const activeGroup = state.groups[state.activeGroupIdx] || state.groups[0];
            const totalCells = state.gridRows * state.gridCols;
            const nextOverrides = { ...state.gridCellOverrides };
            for (let i = 1; i <= totalCells; i++) {
              if (!nextOverrides[i] || !nextOverrides[i].enabled) {
                nextOverrides[i] = { groupName: activeGroup.name, enabled: true };
              }
            }
            return { ...state, gridCellOverrides: nextOverrides };
          }

          case 'CREATE_MANUAL_BOX': {
            const activeGroup = state.groups[state.activeGroupIdx] || state.groups[0];
            const newBox: SelectionItem = {
              id: Date.now(),
              x: action.x,
              y: action.y,
              width: action.w,
              height: action.h,
              groupName: activeGroup.name,
              enabled: true
            };
            return {
              ...state,
              manualSelections: [...state.manualSelections, newBox],
              manualActiveId: newBox.id
            };
          }

          case 'SELECT_BOX':
            return { ...state, manualActiveId: action.id };

          case 'DELETE_BOX':
            return {
              ...state,
              manualSelections: state.manualSelections.filter((b) => b.id !== action.id),
              manualActiveId: null
            };

          case 'CLEAR_MANUAL_BOXES':
            return { ...state, manualSelections: [], manualActiveId: null };

          case 'SET_ACTIVE_GROUP':
            return { ...state, activeGroupIdx: action.index };

          case 'ADD_GROUP': {
            const count = state.groups.length + 1;
            const palette = ['#457b9d', '#e76f51', '#9c27b0', '#00bcd4', '#2a9d8f', '#e63946'];
            const newGroup = {
              name: `Group ${count}`,
              color: palette[(count - 1) % palette.length]
            };
            return {
              ...state,
              groups: [...state.groups, newGroup],
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
            const groups = state.groups.filter((_, idx) => idx !== action.index);
            return {
              ...state,
              groups,
              activeGroupIdx: Math.max(0, state.activeGroupIdx - 1)
            };
          }

          case 'SET_ZOOM':
            return { ...state, zoom: Math.max(0.2, Math.min(8.0, state.zoom + action.delta)) };

          case 'SET_PAN':
            return { ...state, panX: action.panX, panY: action.panY };

          case 'RESET_VIEW':
            return { ...state, zoom: 1.0, panX: 0, panY: 0 };

          case 'TOGGLE_REMOVE_WHITE_BG':
            return { ...state, removeWhiteBg: !state.removeWhiteBg };

          case 'SET_MODAL':
            return { ...state, modalSelectionId: action.id };

          case 'TOGGLE_CELL_ENABLE': {
            const nextOverrides = { ...state.gridCellOverrides };
            const current = nextOverrides[action.id];
            const activeGroup = state.groups[state.activeGroupIdx] || state.groups[0];
            if (current && current.enabled) {
              nextOverrides[action.id] = { ...current, enabled: false };
            } else {
              nextOverrides[action.id] = { groupName: activeGroup.name, enabled: true };
            }
            return { ...state, gridCellOverrides: nextOverrides };
          }

          default:
            return state;
        }
      });
    },
    reset: () => set(initialState)
  };
}

export const slicerStore = createSlicerStore();

export const currentSelections = derived(slicerStore, ($state) => {
  if (!$state.sourceFrame) return [];

  if ($state.mode === 'manual') {
    return $state.manualSelections;
  }

  const { sourceFrame, gridRows, gridCols, gridOffsetX, gridOffsetY, gridSpacingX, gridSpacingY, gridCellOverrides } = $state;

  const totalSpacingW = (gridCols - 1) * gridSpacingX;
  const totalSpacingH = (gridRows - 1) * gridSpacingY;
  const availW = Math.max(0, sourceFrame.width - gridOffsetX - totalSpacingW);
  const availH = Math.max(0, sourceFrame.height - gridOffsetY - totalSpacingH);

  const cellW = Math.max(1, Math.floor(availW / gridCols));
  const cellH = Math.max(1, Math.floor(availH / gridRows));

  const items: SelectionItem[] = [];
  let idCounter = 1;

  for (let r = 0; r < gridRows; r++) {
    for (let c = 0; c < gridCols; c++) {
      const cellX = gridOffsetX + c * (cellW + gridSpacingX);
      const cellY = gridOffsetY + r * (cellH + gridSpacingY);
      const id = idCounter++;

      const override = gridCellOverrides[id];
      // Initially, cells are unassigned unless overridden
      const enabled = override ? override.enabled : false;
      const groupName = override && override.groupName ? override.groupName : '';

      items.push({
        id,
        x: cellX,
        y: cellY,
        width: cellW,
        height: cellH,
        groupName,
        enabled
      });
    }
  }

  return items;
});

export const extractedSlices = derived([slicerStore, currentSelections], ([$state, $selections]) => {
  if (!$state.sourceFrame) return [];

  const source = $state.sourceFrame;

  return $selections.map((sel) => {
    const pixels: (Color | null)[] = new Array(sel.width * sel.height).fill(null);

    for (let y = 0; y < sel.height; y++) {
      for (let x = 0; x < sel.width; x++) {
        const srcX = sel.x + x;
        const srcY = sel.y + y;

        if (srcX >= 0 && srcX < source.width && srcY >= 0 && srcY < source.height) {
          const px = source.pixels[srcY * source.width + srcX];
          if (px) {
            if ($state.removeWhiteBg && px.r > 0.92 && px.g > 0.92 && px.b > 0.92) {
              pixels[y * sel.width + x] = null;
            } else {
              pixels[y * sel.width + x] = { ...px };
            }
          }
        }
      }
    }

    const frame: PixelFrame = {
      id: `slice-${sel.id}`,
      width: sel.width,
      height: sel.height,
      pixels,
      tag: sel.groupName
    };

    return {
      id: sel.id,
      groupName: sel.groupName || 'Unassigned',
      enabled: sel.enabled,
      width: sel.width,
      height: sel.height,
      frame
    };
  });
});
