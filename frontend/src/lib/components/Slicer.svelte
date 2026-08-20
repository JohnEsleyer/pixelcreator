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

  let expandedGroupName: string | null = null;

  $: model = $slicerStore;
  $: selections = $currentSelections;
  $: slices = $extractedSlices;

  $: activeGroup = model.groups[model.activeGroupIdx] || model.groups[0];
  $: activeSelection = selections.find((s) => s.id === model.manualActiveId) || null;

  // Group slices by their group name for group list view
  $: groupedSlices = model.groups.map((grp) => {
    const groupItems = slices.filter((s) => s.groupName === grp.name);
    return {
      group: grp,
      items: groupItems,
      activeCount: groupItems.filter((i) => i.enabled).length,
      coverFrame: groupItems[0]?.frame || null
    };
  });

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
    <!-- Left Sidebar -->
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

    <!-- Center Interactive Canvas -->
    <div class="panel canvas-container">
      <div class="canvas-header">
        <span class="truncate">
          {model.mode === 'grid' ? 'Left click: assign group • Right click: unassign' : 'Manual Mode: Drag to create boxes'}
        </span>
        <div class="canvas-view-controls">
          <small>Zoom: {Math.round(model.zoom * 100)}%</small>
          <button class="btn-xs" on:click={() => dispatch({ type: 'RESET_VIEW' })}>Reset View</button>
        </div>
      </div>

      <SlicerCanvas />
    </div>

    <!-- Right Side Panel: Groups with Cover Slices -->
    <div class="panel previews-panel scrollable-y">
      <div class="previews-header">
        <h3>Group Folders ({groupedSlices.length})</h3>
        <small>Click a group to view all its slices in a full grid</small>
      </div>

      <div class="group-covers-list">
        {#each groupedSlices as entry}
          <div class="group-cover-card" on:click={() => (expandedGroupName = entry.group.name)}>
            <div class="group-cover-thumb">
              {#if entry.coverFrame}
                <PreviewCanvas frame={entry.coverFrame} width={64} height={64} />
              {:else}
                <div class="empty-cover">Empty</div>
              {/if}
            </div>

            <div class="group-cover-info">
              <div class="group-title-row">
                <span class="color-dot" style="background: {entry.group.color};"></span>
                <strong class="truncate">{entry.group.name}</strong>
              </div>
              <span class="group-count-badge">
                {entry.activeCount} / {entry.items.length} Slices
              </span>
              <button class="btn-xs expand-btn">🔍 View Grid</button>
            </div>
          </div>
        {/each}
      </div>
    </div>
  </div>

  <!-- Full-Screen / Modal Group Grid View -->
  {#if expandedGroupName !== null}
    {@const activeGroupEntry = groupedSlices.find((g) => g.group.name === expandedGroupName)}
    {#if activeGroupEntry}
      <div class="group-modal-backdrop" on:click={() => (expandedGroupName = null)}>
        <div class="group-modal-window" on:click|stopPropagation>
          <div class="group-modal-header">
            <div class="header-info">
              <span class="color-badge" style="background: {activeGroupEntry.group.color};"></span>
              <h2>{activeGroupEntry.group.name} — Full Slices Grid ({activeGroupEntry.items.length} Items)</h2>
            </div>
            <button class="btn-sm" on:click={() => (expandedGroupName = null)}>✕ Close Grid</button>
          </div>

          <div class="group-modal-grid scrollable-y">
            {#each activeGroupEntry.items as slice, idx}
              <div
                class="uniform-slice-card"
                class:disabled={!slice.enabled}
                on:click={() => dispatch({ type: 'SET_MODAL', id: slice.id })}
              >
                <div class="slice-card-top">
                  <span>#{idx + 1}</span>
                  <span class="dim-tag">{slice.width}x{slice.height}px</span>
                </div>

                <div class="slice-canvas-box">
                  <PreviewCanvas frame={slice.frame} width={80} height={80} />
                </div>

                <div class="slice-card-actions">
                  <button
                    class="btn-xs {slice.enabled ? 'warning' : 'primary'}"
                    on:click|stopPropagation={() => dispatch({ type: 'TOGGLE_CELL_ENABLE', id: slice.id })}
                  >
                    {slice.enabled ? '🚫 Unassign' : '✅ Enable'}
                  </button>
                </div>
              </div>
            {/each}
          </div>
        </div>
      </div>
    {/if}
  {/if}

  <!-- Single Slice Inspection Modal -->
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
                on:click={() => dispatch({ type: 'TOGGLE_CELL_ENABLE', id: modalSlice.id })}
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

  .secondary-apply {
    background: #3b82f6 !important;
    color: white !important;
    font-weight: 600;
  }

  .slicer-body {
    display: grid;
    grid-template-columns: clamp(260px, 22vw, 300px) 1fr clamp(240px, 22vw, 290px);
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

  /* Right Group Covers List */
  .group-covers-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding-right: 4px;
  }

  .group-cover-card {
    background: #111115;
    border: 1px solid #27272a;
    border-radius: 6px;
    padding: 10px;
    display: flex;
    align-items: center;
    gap: 12px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .group-cover-card:hover {
    border-color: #0284c7;
    background: #181822;
  }

  .group-cover-thumb {
    width: 64px;
    height: 64px;
    background: #18181b;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .empty-cover {
    font-size: 0.75rem;
    color: #666;
  }

  .group-cover-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
    min-width: 0;
  }

  .group-title-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .color-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }

  .group-count-badge {
    font-size: 0.75rem;
    color: #888;
  }

  .expand-btn {
    align-self: flex-start;
    margin-top: 2px;
  }

  /* Full Grid Modal Window */
  .group-modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.85);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 90;
    padding: 24px;
  }

  .group-modal-window {
    background: #18181b;
    border: 1px solid #3f3f46;
    border-radius: 8px;
    width: 90vw;
    max-width: 1000px;
    height: 85vh;
    display: flex;
    flex-direction: column;
    padding: 20px;
    gap: 16px;
  }

  .group-modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #27272a;
    padding-bottom: 12px;
  }

  .header-info {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .group-modal-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
    gap: 14px;
    padding-right: 6px;
    flex: 1;
    min-height: 0;
  }

  .uniform-slice-card {
    background: #111115;
    border: 1px solid #27272a;
    border-radius: 6px;
    padding: 8px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .uniform-slice-card:hover {
    border-color: #0284c7;
  }

  .uniform-slice-card.disabled {
    opacity: 0.45;
    border-style: dashed;
  }

  .slice-card-top {
    display: flex;
    justify-content: space-between;
    width: 100%;
    font-size: 0.75rem;
    color: #aaa;
  }

  .slice-canvas-box {
    background: #18181b;
    padding: 6px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .slice-card-actions {
    display: flex;
    justify-content: flex-end;
    width: 100%;
  }

  /* Single Slice Inspection Modal */
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

  /* Utility Styles */
  .group-item-btn { display: flex; align-items: center; gap: 8px; width: 100%; padding: 6px; background: #09090b; border: 1px solid #27272a; color: white; border-radius: 4px; cursor: pointer; text-align: left; }
  .group-item-btn.active { border-color: #0284c7; background: #18283b; }
  .color-badge { width: 12px; height: 12px; border-radius: 3px; }
  .directional-btns { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; }
  .btn { padding: 6px 12px; background: #27272a; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.85rem; }
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
  input[type="text"], input[type="number"] { width: 100%; padding: 4px 6px; background: #09090b; border: 1px solid #3f3f46; color: white; border-radius: 4px; }
  hr { border: 0; border-top: 1px solid #27272a; margin: 4px 0; }
</style>
