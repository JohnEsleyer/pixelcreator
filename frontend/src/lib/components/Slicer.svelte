<script lang="ts">
  import { onMount } from 'svelte';
  import type { PixelFrame, Project } from '../types';
  import { slicerStore, currentSelections, extractedSlices } from '../stores/slicerStore';
  import SlicerCanvas from './SlicerCanvas.svelte';
  import PreviewCanvas from './PreviewCanvas.svelte';

  export let activeProject: Project | null;
  export let onBackToEditor: () => void;
  export let onUploadSheet: () => void;
  export let onLoadSampleSheet: () => Promise<PixelFrame>;
  export let onApplySlices: (slices: PixelFrame[], replace: boolean) => void;
  export let onPackFramesToSheet: (
    proj: Project
  ) => Promise<{ sheet: PixelFrame; selections: any[] }>;

  $: model = $slicerStore;
  $: selections = $currentSelections;
  $: slices = $extractedSlices;

  $: activeGroup = model.groups[model.activeGroupIdx] || model.groups[0];
  $: activeSelection = selections.find((s) => s.id === model.manualActiveId) || null;

  function dispatch(msg: any) {
    slicerStore.dispatch(msg);
  }

  async function handlePackTimeline() {
    if (!activeProject) return;
    const packed = await onPackFramesToSheet(activeProject);
    dispatch({ type: 'SET_SOURCE_FRAME', frame: packed.sheet });
  }

  onMount(async () => {
    if (!model.sourceFrame) {
      const sample = await onLoadSampleSheet();
      dispatch({ type: 'SET_SOURCE_FRAME', frame: sample });
    }
  });
</script>

<div class="slicer">
  <header class="slicer-header">
    <div class="header-left">
      <button class="btn" on:click={onBackToEditor}>← Editor</button>
      <h2>Sprite Sheet Slicer</h2>

      <div class="mode-tabs">
        <button
          class="tab-btn"
          class:active={model.mode === 'manual'}
          on:click={() => dispatch({ type: 'SET_MODE', mode: 'manual' })}
        >
          ✏ Manual Mode
        </button>
        <button
          class="tab-btn"
          class:active={model.mode === 'grid'}
          on:click={() => dispatch({ type: 'SET_MODE', mode: 'grid' })}
        >
          ▦ Grid Mode
        </button>
      </div>
    </div>

    <div class="header-right-actions">
      <button class="btn" on:click={onUploadSheet}>📁 Upload Sheet</button>
      <button class="btn" on:click={handlePackTimeline}>📦 Pack Project</button>
      <button class="btn secondary-apply" on:click={() => onApplySlices(slices.filter(s => s.enabled).map(s => s.frame), false)}>
        ➕ Append to Timeline
      </button>
      <button class="btn primary-apply" on:click={() => onApplySlices(slices.filter(s => s.enabled).map(s => s.frame), true)}>
        🚀 Process & Replace Timeline
      </button>
    </div>
  </header>

  <div class="slicer-body">
    <div class="panel sidebar scrollable-y">
      {#if model.mode === 'grid'}
        <h3>Full Grid Parameters</h3>
        <div class="grid-param-rows">
          <label>
            Rows: {model.gridRows}
            <div class="row">
              <button class="btn-sm" on:click={() => dispatch({ type: 'SET_GRID_PARAM', key: 'gridRows', value: model.gridRows - 1 })}>-</button>
              <input type="range" min="1" max="16" value={model.gridRows} on:input={(e) => dispatch({ type: 'SET_GRID_PARAM', key: 'gridRows', value: Number(e.currentTarget.value) })} />
              <button class="btn-sm" on:click={() => dispatch({ type: 'SET_GRID_PARAM', key: 'gridRows', value: model.gridRows + 1 })}>+</button>
            </div>
          </label>

          <label>
            Columns: {model.gridCols}
            <div class="row">
              <button class="btn-sm" on:click={() => dispatch({ type: 'SET_GRID_PARAM', key: 'gridCols', value: model.gridCols - 1 })}>-</button>
              <input type="range" min="1" max="16" value={model.gridCols} on:input={(e) => dispatch({ type: 'SET_GRID_PARAM', key: 'gridCols', value: Number(e.currentTarget.value) })} />
              <button class="btn-sm" on:click={() => dispatch({ type: 'SET_GRID_PARAM', key: 'gridCols', value: model.gridCols + 1 })}>+</button>
            </div>
          </label>

          <div class="row-inputs">
            <label>Offset X: <input type="number" value={model.gridOffsetX} on:input={(e) => dispatch({ type: 'SET_GRID_PARAM', key: 'gridOffsetX', value: Number(e.currentTarget.value) })} /></label>
            <label>Offset Y: <input type="number" value={model.gridOffsetY} on:input={(e) => dispatch({ type: 'SET_GRID_PARAM', key: 'gridOffsetY', value: Number(e.currentTarget.value) })} /></label>
          </div>
          <div class="row-inputs">
            <label>Space X: <input type="number" value={model.gridSpacingX} on:input={(e) => dispatch({ type: 'SET_GRID_PARAM', key: 'gridSpacingX', value: Number(e.currentTarget.value) })} /></label>
            <label>Space Y: <input type="number" value={model.gridSpacingY} on:input={(e) => dispatch({ type: 'SET_GRID_PARAM', key: 'gridSpacingY', value: Number(e.currentTarget.value) })} /></label>
          </div>
        </div>

        <button class="btn width-100" on:click={() => dispatch({ type: 'ASSIGN_GROUP_TO_ALL_CELLS' })}>
          Assign "{activeGroup.name}" to All
        </button>

        <div class="row gap-4">
          <button class="btn-sm danger flex-1" on:click={() => dispatch({ type: 'UNASSIGN_ALL_CELLS' })}>🚫 Unassign All</button>
          <button class="btn-sm primary flex-1" on:click={() => dispatch({ type: 'ENABLE_ALL_CELLS' })}>✅ Enable All</button>
        </div>
        <hr />
      {/if}

      <h3>Active Group Tag</h3>
      <div class="groups-list">
        {#each model.groups as g, idx}
          <button
            class="group-item-btn"
            class:active={idx === model.activeGroupIdx}
            on:click={() => dispatch({ type: 'SET_ACTIVE_GROUP', index: idx })}
          >
            <span class="color-badge" style="background: {g.color};"></span>
            <span class="truncate">{g.name}</span>
          </button>
        {/each}
      </div>

      <div class="row gap-4">
        <input
          type="text"
          value={activeGroup ? activeGroup.name : ''}
          on:input={(e) => dispatch({ type: 'RENAME_GROUP', name: e.currentTarget.value })}
        />
        <button class="btn-sm" on:click={() => dispatch({ type: 'ADD_GROUP' })}>+ Group</button>
        <button class="btn-sm danger" on:click={() => dispatch({ type: 'DELETE_GROUP', index: model.activeGroupIdx })}>🗑</button>
      </div>

      <hr />

      {#if model.mode === 'manual'}
        <h3>Manual Box Controls</h3>
        {#if activeSelection}
          <small>Box #{activeSelection.id}: ({activeSelection.x}, {activeSelection.y}) | {activeSelection.width}x{activeSelection.height} px</small>
          <div class="directional-btns">
            <button class="btn-sm" on:click={() => dispatch({ type: 'ADD_ADJACENT_BOX', direction: 'left' })}>← Left</button>
            <button class="btn-sm" on:click={() => dispatch({ type: 'ADD_ADJACENT_BOX', direction: 'right' })}>→ Right</button>
            <button class="btn-sm" on:click={() => dispatch({ type: 'ADD_ADJACENT_BOX', direction: 'up' })}>↑ Up</button>
            <button class="btn-sm" on:click={() => dispatch({ type: 'ADD_ADJACENT_BOX', direction: 'down' })}>↓ Down</button>
          </div>
          <div class="row gap-4 margin-top-4">
            <button class="btn-sm danger flex-1" on:click={() => dispatch({ type: 'DELETE_BOX', id: activeSelection.id })}>Delete Box</button>
            <button class="btn-sm flex-1" on:click={() => dispatch({ type: 'CLEAR_MANUAL_BOXES' })}>Clear All</button>
          </div>
        {:else}
          <small>Click & drag boxes over sprites on the sheet.</small>
        {/if}
        <hr />
      {/if}

      <button
        class="btn width-100"
        class:active={model.removeWhiteBg}
        on:click={() => dispatch({ type: 'TOGGLE_REMOVE_WHITE_BG' })}
      >
        Keyout Background: {model.removeWhiteBg ? 'WHITE (ON)' : 'OFF'}
      </button>
    </div>

    <div class="panel canvas-container">
      <div class="canvas-header">
        <span class="truncate">
          {model.mode === 'grid' ? 'Grid Mode: Click cells to assign group / toggle unassign' : 'Manual Mode: Drag to create boxes'}
        </span>
        <div class="canvas-view-controls">
          <small>Zoom: {Math.round(model.zoom * 100)}% (Ctrl+Scroll)</small>
          <button class="btn-xs" on:click={() => dispatch({ type: 'RESET_VIEW' })}>Reset View</button>
        </div>
      </div>

      <SlicerCanvas />
    </div>

    <div class="panel previews-panel scrollable-y">
      <div class="previews-header">
        <h3>Native Slices ({slices.filter(s => s.enabled).length}/{slices.length})</h3>
        <small>Real-Time Previews</small>
      </div>

      <div class="previews-list">
        {#each slices as slice, idx}
          {@const group = model.groups.find(g => g.name === slice.groupName)}
          <div
            class="slice-card"
            class:disabled={!slice.enabled}
            class:active={slice.id === model.manualActiveId}
            on:click={() => dispatch({ type: 'SET_MODAL', id: slice.id })}
          >
            <div class="slice-card-header">
              <span class="slice-badge" style="background: {group ? group.color : '#555'};">
                #{idx + 1} {slice.groupName}
              </span>
              <span class="slice-dims">{slice.width}x{slice.height}px</span>
            </div>

            <div class="slice-preview-wrapper">
              <PreviewCanvas frame={slice.frame} width={64} height={64} />
            </div>

            <div class="slice-card-footer">
              {#if slice.enabled}
                <button
                  class="btn-xs warning"
                  on:click|stopPropagation={() => dispatch({ type: 'TOGGLE_CELL_ENABLE', id: slice.id })}
                >
                  🚫 Unassign
                </button>
              {:else}
                <button
                  class="btn-xs primary"
                  on:click|stopPropagation={() => dispatch({ type: 'TOGGLE_CELL_ENABLE', id: slice.id })}
                >
                  ✅ Enable
                </button>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    </div>
  </div>

  {#if model.modalSelectionId !== null}
    {@const modalSlice = slices.find((s) => s.id === model.modalSelectionId)}
    {@const modalSel = selections.find((s) => s.id === model.modalSelectionId)}
    {#if modalSlice && modalSel}
      <div class="modal-backdrop" on:click={() => dispatch({ type: 'SET_MODAL', id: null })}>
        <div class="modal-card" on:click|stopPropagation>
          <div class="modal-header">
            <h3>Sprite Inspection Preview ({modalSlice.groupName})</h3>
            <button class="btn-sm" on:click={() => dispatch({ type: 'SET_MODAL', id: null })}>✕ Close</button>
          </div>

          <div class="modal-body">
            <PreviewCanvas frame={modalSlice.frame} width={200} height={200} />

            <div class="modal-info">
              <h4>Metadata & Dimensions</h4>
              <p>Status: <strong>{modalSlice.enabled ? 'ACTIVE' : 'UNASSIGNED'}</strong></p>
              <p>Group Tag: {modalSlice.groupName}</p>
              <p>Native Size: {modalSlice.width}x{modalSlice.height} px</p>
              <p>Source Bounds: X={modalSel.x}, Y={modalSel.y}, W={modalSel.width}, H={modalSel.height}</p>

              <button
                class="btn {modalSlice.enabled ? 'danger' : 'primary'}"
                on:click={() => {
                  dispatch({ type: 'TOGGLE_CELL_ENABLE', id: modalSlice.id });
                }}
              >
                {modalSlice.enabled ? '🚫 Unassign Cell' : '✅ Enable Cell'}
              </button>
            </div>
          </div>
        </div>
      </div>
    {/if}
  {/if}
</div>

<style>
  .slicer {
    display: flex;
    flex-direction: column;
    height: 100vh;
    color: #eee;
    background: var(--bg-app, #09090b);
    overflow: hidden;
  }

  .slicer-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 20px;
    background: var(--bg-panel, #18181b);
    border-bottom: 1px solid var(--border-color, #27272a);
    gap: 16px;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .mode-tabs {
    display: flex;
    gap: 4px;
    background: #09090b;
    padding: 3px;
    border-radius: 6px;
  }

  .tab-btn {
    padding: 6px 12px;
    font-size: 0.85rem;
    background: transparent;
    color: #aaa;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }

  .tab-btn.active {
    background: var(--border-focus, #0284c7);
    color: white;
  }

  .header-right-actions {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .primary-apply {
    background: #10b981 !important;
    color: white !important;
    font-weight: bold;
    font-size: 0.95rem !important;
    padding: 8px 16px !important;
    box-shadow: 0 0 12px rgba(16, 185, 129, 0.4);
  }

  .primary-apply:hover {
    background: #059669 !important;
  }

  .secondary-apply {
    background: #3b82f6 !important;
    color: white !important;
    font-weight: 600;
  }

  .slicer-body {
    display: grid;
    grid-template-columns: clamp(260px, 22vw, 300px) 1fr clamp(240px, 22vw, 280px);
    flex: 1;
    gap: 12px;
    padding: 12px;
    min-height: 0;
  }

  .panel {
    background: var(--bg-panel, #18181b);
    border: 1px solid var(--border-color, #27272a);
    border-radius: 8px;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-height: 0;
  }

  .canvas-container {
    display: flex;
    flex-direction: column;
    position: relative;
  }

  .canvas-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
    font-size: 0.85rem;
  }

  .canvas-view-controls {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .previews-panel {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .previews-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding-right: 4px;
  }

  .slice-card {
    background: #111115;
    border: 1px solid #27272a;
    border-radius: 6px;
    padding: 8px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    transition: border-color 0.15s ease;
  }

  .slice-card.active {
    border-color: #3b82f6;
    box-shadow: 0 0 6px rgba(59, 130, 246, 0.3);
  }

  .slice-card.disabled {
    opacity: 0.5;
    border-style: dashed;
  }

  .slice-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    font-size: 0.75rem;
  }

  .slice-badge {
    padding: 2px 6px;
    border-radius: 4px;
    font-weight: 600;
    color: white;
  }

  .slice-dims {
    color: #888;
  }

  .slice-preview-wrapper {
    background: #18181b;
    padding: 8px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
  }

  .slice-card-footer {
    display: flex;
    justify-content: flex-end;
    width: 100%;
  }

  .group-item-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 6px;
    background: #09090b;
    border: 1px solid #27272a;
    color: white;
    border-radius: 4px;
    cursor: pointer;
    text-align: left;
  }

  .group-item-btn.active {
    border-color: #0284c7;
    background: #18283b;
  }

  .color-badge {
    width: 12px;
    height: 12px;
    border-radius: 3px;
    flex-shrink: 0;
  }

  .directional-btns {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px;
  }

  .btn {
    padding: 6px 12px;
    background: #27272a;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.85rem;
  }

  .btn:hover { background: #3f3f46; }
  .btn-sm { padding: 4px 8px; font-size: 0.75rem; background: #27272a; color: white; border: none; border-radius: 4px; cursor: pointer; }
  .btn-xs { padding: 2px 6px; font-size: 0.7rem; background: #27272a; color: white; border: none; border-radius: 3px; cursor: pointer; }
  .btn-xs.warning { background: #d97706; color: white; }
  .btn-xs.primary { background: #0284c7; color: white; }

  .danger { background: #dc2626 !important; }
  .row { display: flex; align-items: center; }
  .gap-4 { gap: 6px; }
  .margin-top-4 { margin-top: 4px; }
  .flex-1 { flex: 1; }
  .width-100 { width: 100%; }

  .row-inputs { display: flex; gap: 8px; }
  .row-inputs label { font-size: 0.75rem; display: flex; align-items: center; gap: 4px; width: 50%; }

  input[type="text"], input[type="number"] {
    width: 100%;
    padding: 4px 6px;
    background: #09090b;
    border: 1px solid #3f3f46;
    color: white;
    border-radius: 4px;
  }

  hr { border: 0; border-top: 1px solid #27272a; margin: 4px 0; }

  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }

  .modal-card {
    background: #18181b;
    border: 1px solid #3f3f46;
    border-radius: 8px;
    padding: 20px;
    width: 500px;
    display: flex;
    flex-direction: column;
    gap: 15px;
  }

  .modal-header { display: flex; justify-content: space-between; align-items: center; }
  .modal-body { display: flex; gap: 20px; align-items: center; }
  .modal-info { display: flex; flex-direction: column; gap: 8px; font-size: 0.85rem; }
</style>
