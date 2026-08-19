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
  <header>
    <button on:click={onBackToEditor}>← Editor</button>
    <h2>Sprite Sheet Slicer (Real-Time Native Extraction)</h2>

    <div class="mode-tabs">
      <button
        class:active={model.mode === 'manual'}
        on:click={() => dispatch({ type: 'SET_MODE', mode: 'manual' })}
      >
        ✏ Manual Selection Mode
      </button>
      <button
        class:active={model.mode === 'grid'}
        on:click={() => dispatch({ type: 'SET_MODE', mode: 'grid' })}
      >
        ▦ Full Grid Selection Mode
      </button>
    </div>

    <div class="header-actions">
      <button class="primary" on:click={onUploadSheet}>📁 Upload Sheet</button>
    </div>
  </header>

  <div class="slicer-body">
    <!-- Left Controls Sidebar -->
    <div class="panel sidebar">
      {#if model.mode === 'grid'}
        <h3>Full Grid Parameters</h3>
        <div class="grid-param-rows">
          <label>
            Rows: {model.gridRows}
            <div class="row">
              <button on:click={() => dispatch({ type: 'SET_GRID_PARAM', key: 'gridRows', value: model.gridRows - 1 })}>-</button>
              <input type="range" min="1" max="16" value={model.gridRows} on:input={(e) => dispatch({ type: 'SET_GRID_PARAM', key: 'gridRows', value: Number(e.currentTarget.value) })} />
              <button on:click={() => dispatch({ type: 'SET_GRID_PARAM', key: 'gridRows', value: model.gridRows + 1 })}>+</button>
            </div>
          </label>

          <label>
            Columns: {model.gridCols}
            <div class="row">
              <button on:click={() => dispatch({ type: 'SET_GRID_PARAM', key: 'gridCols', value: model.gridCols - 1 })}>-</button>
              <input type="range" min="1" max="16" value={model.gridCols} on:input={(e) => dispatch({ type: 'SET_GRID_PARAM', key: 'gridCols', value: Number(e.currentTarget.value) })} />
              <button on:click={() => dispatch({ type: 'SET_GRID_PARAM', key: 'gridCols', value: model.gridCols + 1 })}>+</button>
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

        <button on:click={() => dispatch({ type: 'ASSIGN_GROUP_TO_ALL_CELLS' })}>
          Assign "{activeGroup.name}" to All Cells
        </button>
        <hr />
      {/if}

      <h3>Active Group Tag</h3>
      <div class="groups-list">
        {#each model.groups as g, idx}
          <button
            class:active={idx === model.activeGroupIdx}
            on:click={() => dispatch({ type: 'SET_ACTIVE_GROUP', index: idx })}
          >
            <span class="color-badge" style="background: {g.color};"></span>
            {g.name}
          </button>
        {/each}
      </div>

      <div class="row">
        <input
          type="text"
          value={activeGroup ? activeGroup.name : ''}
          on:input={(e) => dispatch({ type: 'RENAME_GROUP', name: e.currentTarget.value })}
        />
        <button on:click={() => dispatch({ type: 'ADD_GROUP' })}>+ Group</button>
        <button class="danger" on:click={() => dispatch({ type: 'DELETE_GROUP', index: model.activeGroupIdx })}>🗑</button>
      </div>

      <hr />

      {#if model.mode === 'manual'}
        <h3>Manual Box Controls</h3>
        {#if activeSelection}
          <small>Box #{activeSelection.id}: ({activeSelection.x}, {activeSelection.y}) | {activeSelection.width}x{activeSelection.height} px</small>
          <div class="directional-btns">
            <button on:click={() => dispatch({ type: 'ADD_ADJACENT_BOX', direction: 'left' })}>← Left</button>
            <button on:click={() => dispatch({ type: 'ADD_ADJACENT_BOX', direction: 'right' })}>→ Right</button>
            <button on:click={() => dispatch({ type: 'ADD_ADJACENT_BOX', direction: 'up' })}>↑ Up</button>
            <button on:click={() => dispatch({ type: 'ADD_ADJACENT_BOX', direction: 'down' })}>↓ Down</button>
          </div>
          <div class="row">
            <button class="danger" on:click={() => dispatch({ type: 'DELETE_BOX', id: activeSelection.id })}>Delete Box</button>
            <button on:click={() => dispatch({ type: 'CLEAR_MANUAL_BOXES' })}>Clear All</button>
          </div>
        {:else}
          <small>Click & drag boxes over sprites on the sheet.</small>
        {/if}
        <hr />
      {/if}

      <button
        class:active={model.removeWhiteBg}
        on:click={() => dispatch({ type: 'TOGGLE_REMOVE_WHITE_BG' })}
      >
        Keyout Background: {model.removeWhiteBg ? 'WHITE (ON)' : 'OFF'}
      </button>

      <hr />

      <button class="primary" on:click={() => onApplySlices(slices.map(s => s.frame), true)}>
        Process & Replace Timeline
      </button>
      <button on:click={() => onApplySlices(slices.map(s => s.frame), false)}>
        + Process & Append Timeline
      </button>
      <button on:click={handlePackTimeline}>
        Pack Project Frames into Sheet
      </button>
    </div>

    <!-- Center Interactive Canvas -->
    <div class="panel canvas-container">
      <div class="canvas-header">
        <span>
          {model.mode === 'grid' ? 'Grid Mode: Click cell to assign active group tag' : 'Manual Mode: Click & drag to create selection boxes'}
        </span>
        <small>Ctrl + Scroll to Zoom ({Math.round(model.zoom * 100)}%)</small>
      </div>

      <SlicerCanvas />
    </div>

    <!-- Right Real-Time Previews -->
    <div class="panel previews-panel">
      <h3>Native Slices ({slices.length})</h3>
      <small>Actual Selection Sizes</small>

      <div class="previews-grid">
        {#each slices as slice, idx}
          <button
            class="preview-card"
            class:active={slice.id === model.manualActiveId}
            on:click={() => dispatch({ type: 'SET_MODAL', id: slice.id })}
          >
            <small>#{idx + 1} {slice.groupName}</small>
            <small>({slice.width}x{slice.height}px)</small>
            <PreviewCanvas frame={slice.frame} width={48} height={48} />
          </button>
        {/each}
      </div>
    </div>
  </div>

  <!-- Inspection Modal -->
  {#if model.modalSelectionId !== null}
    {@const modalSlice = slices.find((s) => s.id === model.modalSelectionId)}
    {@const modalSel = selections.find((s) => s.id === model.modalSelectionId)}
    {#if modalSlice && modalSel}
      <div class="modal-backdrop" on:click={() => dispatch({ type: 'SET_MODAL', id: null })}>
        <div class="modal-card" on:click|stopPropagation>
          <div class="modal-header">
            <h3>Sprite Inspection Preview ({modalSlice.groupName})</h3>
            <button on:click={() => dispatch({ type: 'SET_MODAL', id: null })}>✕ Close</button>
          </div>

          <div class="modal-body">
            <PreviewCanvas frame={modalSlice.frame} width={256} height={256} />

            <div class="modal-info">
              <h4>Metadata & Native Dimensions</h4>
              <p>Group Tag: {modalSlice.groupName}</p>
              <p>Native Size: {modalSlice.width}x{modalSlice.height} px</p>
              <p>Source Bounds: X={modalSel.x}, Y={modalSel.y}, W={modalSel.width}, H={modalSel.height}</p>

              <button class="danger" on:click={() => dispatch({ type: 'DELETE_BOX', id: modalSlice.id })}>
                {model.mode === 'manual' ? '🗑 Delete Selection' : '🚫 Toggle Cell Off'}
              </button>
            </div>
          </div>
        </div>
      </div>
    {/if}
  {/if}
</div>

<style>
  .slicer { display: flex; flex-direction: column; height: 100vh; color: #eee; font-family: sans-serif; background: #121214; }
  header { display: flex; align-items: center; justify-content: space-between; padding: 10px 20px; background: #18181b; border-bottom: 1px solid #333; }
  .mode-tabs { display: flex; gap: 6px; }
  .slicer-body { display: flex; flex: 1; gap: 15px; padding: 15px; overflow: hidden; }
  .panel { background: #18181b; border: 1px solid #27272a; border-radius: 8px; padding: 15px; display: flex; flex-direction: column; gap: 8px; }
  .sidebar { width: 290px; overflow-y: auto; }
  .canvas-container { flex: 1; align-items: center; justify-content: center; position: relative; }
  .canvas-header { position: absolute; top: 15px; left: 15px; right: 15px; display: flex; justify-content: space-between; }
  .previews-panel { width: 200px; overflow-y: auto; }
  .groups-list { display: flex; flex-direction: column; gap: 4px; }
  .color-badge { display: inline-block; width: 12px; height: 12px; border-radius: 3px; margin-right: 6px; }
  .directional-btns { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; }
  .row { display: flex; gap: 6px; align-items: center; }
  .row-inputs { display: flex; gap: 10px; }
  .row-inputs label { font-size: 11px; display: flex; align-items: center; gap: 4px; }
  .grid-param-rows { display: flex; flex-direction: column; gap: 6px; }
  button { padding: 6px 10px; background: #27272a; color: white; border: none; border-radius: 4px; cursor: pointer; }
  button:hover { background: #3f3f46; }
  button.active { background: #0284c7; }
  button.primary { background: #0284c7; }
  button.danger { background: #dc2626; }
  input[type="text"], input[type="number"] { width: 100%; padding: 4px; background: #09090b; border: 1px solid #3f3f46; color: white; border-radius: 4px; }
  hr { border: 0; border-top: 1px solid #27272a; width: 100%; margin: 4px 0; }
  .previews-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-top: 10px; }
  .preview-card { padding: 6px; display: flex; flex-direction: column; align-items: center; gap: 2px; background: #18181b; border: 1px solid #3f3f46; }
  .preview-card.active { border-color: #0284c7; }
  
  /* Modal */
  .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 100; }
  .modal-card { background: #18181b; border: 1px solid #3f3f46; border-radius: 8px; padding: 20px; width: 560px; display: flex; flex-direction: column; gap: 15px; }
  .modal-header { display: flex; justify-content: space-between; align-items: center; }
  .modal-body { display: flex; gap: 20px; align-items: center; }
  .modal-info { display: flex; flex-direction: column; gap: 8px; }
</style>
