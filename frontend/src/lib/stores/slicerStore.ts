import { writable, derived } from 'svelte/store';
import type {
  PixelFrame,
  SelectionGroup,
  SpriteSelection,
  SlicerMode,
  Direction
} from '../types';
import { extractSubFrame } from '../utils/frameUtils';

// --- ELM MODEL ---
export interface SlicerModel {
  mode: SlicerMode;
  sourceFrame: PixelFrame | null;
  zoom: number;
  removeWhiteBg: boolean;

  // Groups
  groups: SelectionGroup[];
  activeGroupIdx: number;

  // Manual Selections
  manualSelections: SpriteSelection[];
  manualActiveId: number | null;
  nextManualId: number;

  // Grid Parameters
  gridRows: number;
  gridCols: number;
  gridOffsetX: number;
  gridOffsetY: number;
  gridSpacingX: number;
  gridSpacingY: number;

  // Grid Cell Overrides
  gridGroupOverrides: Record<number, string>;
  gridDisabledCells: Record<number, boolean>;

  // Inspection Modal
  modalSelectionId: number | null;
}

// --- INITIAL MODEL ---
export const initialModel: SlicerModel = {
  mode: 'manual',
  sourceFrame: null,
  zoom: 1.0,
  removeWhiteBg: false,

  groups: [
    { name: 'Idle', color: '#e63946' },
    { name: 'Run', color: '#2a9d8f' },
    { name: 'Attack', color: '#457b9d' }
  ],
  activeGroupIdx: 0,

  manualSelections: [
    { id: 1, x: 8, y: 8, width: 48, height: 48, groupName: 'Idle' },
    { id: 2, x: 68, y: 8, width: 48, height: 48, groupName: 'Idle' },
    { id: 3, x: 8, y: 68, width: 48, height: 48, groupName: 'Run' },
    { id: 4, x: 68, y: 68, width: 48, height: 48, groupName: 'Run' }
  ],
  manualActiveId: 1,
  nextManualId: 5,

  gridRows: 2,
  gridCols: 2,
  gridOffsetX: 0,
  gridOffsetY: 0,
  gridSpacingX: 0,
  gridSpacingY: 0,

  gridGroupOverrides: {},
  gridDisabledCells: {},

  modalSelectionId: null
};

// --- ELM MESSAGES ---
export type SlicerMsg =
  | { type: 'SET_SOURCE_FRAME'; frame: PixelFrame }
  | { type: 'SET_MODE'; mode: SlicerMode }
  | { type: 'SET_ZOOM'; delta: number }
  | { type: 'TOGGLE_REMOVE_WHITE_BG' }
  | { type: 'SET_ACTIVE_GROUP'; index: number }
  | { type: 'ADD_GROUP' }
  | { type: 'RENAME_GROUP'; name: string }
  | { type: 'DELETE_GROUP'; index: number }
  | { type: 'SELECT_BOX'; id: number }
  | { type: 'CREATE_MANUAL_BOX'; x: number; y: number; w: number; h: number }
  | { type: 'ADD_ADJACENT_BOX'; direction: Direction }
  | { type: 'DELETE_BOX'; id: number }
  | { type: 'CLEAR_MANUAL_BOXES' }
  | { type: 'SET_GRID_PARAM'; key: 'gridRows' | 'gridCols' | 'gridOffsetX' | 'gridOffsetY' | 'gridSpacingX' | 'gridSpacingY'; value: number }
  | { type: 'CLICK_GRID_CELL'; id: number }
  | { type: 'ASSIGN_GROUP_TO_ALL_CELLS' }
  | { type: 'SET_MODAL'; id: number | null };

// --- ELM UPDATE REDUCER ---
function slicerReducer(model: SlicerModel, msg: SlicerMsg): SlicerModel {
  switch (msg.type) {
    case 'SET_SOURCE_FRAME':
      return { ...model, sourceFrame: msg.frame };

    case 'SET_MODE':
      return { ...model, mode: msg.mode };

    case 'SET_ZOOM':
      return { ...model, zoom: Math.max(0.25, Math.min(5.0, model.zoom + msg.delta)) };

    case 'TOGGLE_REMOVE_WHITE_BG':
      return { ...model, removeWhiteBg: !model.removeWhiteBg };

    case 'SET_ACTIVE_GROUP':
      return { ...model, activeGroupIdx: msg.index };

    case 'ADD_GROUP': {
      const colors = ['#e63946', '#2a9d8f', '#457b9d', '#e76f51', '#9c27b0', '#00bcd4'];
      const newIdx = model.groups.length + 1;
      const newGroup: SelectionGroup = {
        name: `Group ${newIdx}`,
        color: colors[(newIdx - 1) % colors.length]
      };
      return {
        ...model,
        groups: [...model.groups, newGroup],
        activeGroupIdx: model.groups.length
      };
    }

    case 'RENAME_GROUP': {
      const current = model.groups[model.activeGroupIdx];
      if (!current) return model;
      const oldName = current.name;
      const newName = msg.name;

      const newGroups = [...model.groups];
      newGroups[model.activeGroupIdx] = { ...current, name: newName };

      const newManuals = model.manualSelections.map((s) =>
        s.groupName === oldName ? { ...s, groupName: newName } : s
      );

      const newOverrides = { ...model.gridGroupOverrides };
      Object.keys(newOverrides).forEach((k) => {
        const id = Number(k);
        if (newOverrides[id] === oldName) newOverrides[id] = newName;
      });

      return {
        ...model,
        groups: newGroups,
        manualSelections: newManuals,
        gridGroupOverrides: newOverrides
      };
    }

    case 'DELETE_GROUP': {
      if (model.groups.length <= 1) return model;
      const oldName = model.groups[msg.index].name;
      const newGroups = model.groups.filter((_, i) => i !== msg.index);
      const newActiveIdx = Math.min(model.activeGroupIdx, newGroups.length - 1);
      const fallbackName = newGroups[newActiveIdx].name;

      const newManuals = model.manualSelections.map((s) =>
        s.groupName === oldName ? { ...s, groupName: fallbackName } : s
      );

      return {
        ...model,
        groups: newGroups,
        activeGroupIdx: newActiveIdx,
        manualSelections: newManuals
      };
    }

    case 'SELECT_BOX':
      return { ...model, manualActiveId: msg.id };

    case 'CREATE_MANUAL_BOX': {
      const activeGroup = model.groups[model.activeGroupIdx] || model.groups[0];
      const newBox: SpriteSelection = {
        id: model.nextManualId,
        x: msg.x,
        y: msg.y,
        width: msg.w,
        height: msg.h,
        groupName: activeGroup.name
      };
      return {
        ...model,
        manualSelections: [...model.manualSelections, newBox],
        manualActiveId: model.nextManualId,
        nextManualId: model.nextManualId + 1
      };
    }

    case 'ADD_ADJACENT_BOX': {
      const active = model.manualSelections.find((s) => s.id === model.manualActiveId);
      if (!active || !model.sourceFrame) return model;

      let newX = active.x;
      let newY = active.y;

      if (msg.direction === 'left') newX -= active.width;
      if (msg.direction === 'right') newX += active.width;
      if (msg.direction === 'up') newY -= active.height;
      if (msg.direction === 'down') newY += active.height;

      if (
        newX >= 0 &&
        newY >= 0 &&
        newX + active.width <= model.sourceFrame.width &&
        newY + active.height <= model.sourceFrame.height
      ) {
        const activeGroup = model.groups[model.activeGroupIdx] || model.groups[0];
        const newBox: SpriteSelection = {
          id: model.nextManualId,
          x: newX,
          y: newY,
          width: active.width,
          height: active.height,
          groupName: activeGroup.name
        };
        return {
          ...model,
          manualSelections: [...model.manualSelections, newBox],
          manualActiveId: model.nextManualId,
          nextManualId: model.nextManualId + 1
        };
      }
      return model;
    }

    case 'DELETE_BOX': {
      if (model.mode === 'manual') {
        const remaining = model.manualSelections.filter((s) => s.id !== msg.id);
        return {
          ...model,
          manualSelections: remaining,
          manualActiveId: remaining.length ? remaining[remaining.length - 1].id : null,
          modalSelectionId: model.modalSelectionId === msg.id ? null : model.modalSelectionId
        };
      } else {
        const newDisabled = { ...model.gridDisabledCells };
        newDisabled[msg.id] = !newDisabled[msg.id]; // Toggle disabled
        return { ...model, gridDisabledCells: newDisabled };
      }
    }

    case 'CLEAR_MANUAL_BOXES':
      return { ...model, manualSelections: [], manualActiveId: null, modalSelectionId: null };

    case 'SET_GRID_PARAM':
      return { ...model, [msg.key]: Math.max(0, msg.value) };

    case 'CLICK_GRID_CELL': {
      const activeGroup = model.groups[model.activeGroupIdx] || model.groups[0];
      const newOverrides = { ...model.gridGroupOverrides, [msg.id]: activeGroup.name };
      return { ...model, gridGroupOverrides: newOverrides, manualActiveId: msg.id };
    }

    case 'ASSIGN_GROUP_TO_ALL_CELLS': {
      const activeGroup = model.groups[model.activeGroupIdx] || model.groups[0];
      const newOverrides: Record<number, string> = {};
      const totalCells = model.gridRows * model.gridCols;
      for (let i = 1; i <= totalCells; i++) {
        newOverrides[i] = activeGroup.name;
      }
      return { ...model, gridGroupOverrides: newOverrides };
    }

    case 'SET_MODAL':
      return { ...model, modalSelectionId: msg.id };

    default:
      return model;
  }
}

// --- STORE CREATION ---
function createSlicerStore() {
  const { subscribe, update, set } = writable<SlicerModel>(initialModel);

  return {
    subscribe,
    dispatch: (msg: SlicerMsg) => update((model) => slicerReducer(model, msg)),
    reset: (frame: PixelFrame) => set({ ...initialModel, sourceFrame: frame })
  };
}

export const slicerStore = createSlicerStore();

// --- DERIVED DERIVATIONS (SINGLE SOURCE OF TRUTH) ---
export const currentSelections = derived(slicerStore, ($m) => {
  if ($m.mode === 'manual') {
    return $m.manualSelections;
  }

  // Compute Grid Selections dynamically in real-time
  if (!$m.sourceFrame) return [];

  const availableW = $m.sourceFrame.width - $m.gridOffsetX - ($m.gridCols - 1) * $m.gridSpacingX;
  const availableH = $m.sourceFrame.height - $m.gridOffsetY - ($m.gridRows - 1) * $m.gridSpacingY;

  const cellW = Math.max(1, Math.floor(availableW / $m.gridCols));
  const cellH = Math.max(1, Math.floor(availableH / $m.gridRows));

  const selections: SpriteSelection[] = [];
  let id = 1;

  for (let r = 0; r < $m.gridRows; r++) {
    for (let c = 0; c < $m.gridCols; c++) {
      const x = $m.gridOffsetX + c * (cellW + $m.gridSpacingX);
      const y = $m.gridOffsetY + r * (cellH + $m.gridSpacingY);

      const groupName = $m.gridGroupOverrides[id] || $m.groups[r % $m.groups.length].name;
      const enabled = !$m.gridDisabledCells[id];

      selections.push({
        id,
        x,
        y,
        width: cellW,
        height: cellH,
        groupName,
        enabled
      });
      id++;
    }
  }

  return selections;
});

export const extractedSlices = derived([slicerStore, currentSelections], ([$m, $sels]) => {
  if (!$m.sourceFrame) return [];

  return $sels
    .filter((s) => s.enabled !== false)
    .map((sel) => ({
      id: sel.id,
      frame: extractSubFrame($m.sourceFrame!, sel, $m.removeWhiteBg),
      groupName: sel.groupName,
      width: sel.width,
      height: sel.height
    }));
});
