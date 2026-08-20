<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import type { Project, Color, Tool, PixelFrame, Group } from '../types';
  import PixelCanvas from './PixelCanvas.svelte';
  import PreviewCanvas from './PreviewCanvas.svelte';

  export let project: Project;
  export let onGoDashboard: () => void;
  export let onOpenOverview: () => void;
  export let onOpenSlicer: () => void;
  export let onImportFrame: () => void;
  export let onExportPNG: (frame: PixelFrame) => void;

  let tool: Tool = 'pencil';
  let red = 0.1, green = 0.6, blue = 0.9;
  let hexInput = '1999E6';

  let isPlaying = false;
  let previewFrameIdx = 0;
  let timer: any = null;

  let undoStack: (Color | null)[][] = [];
  let redoStack: (Color | null)[][] = [];
  const MAX_HISTORY = 30;

  let colorPalette: Color[] = [
    { r: 0, g: 0, b: 0, a: 1 },
    { r: 1, g: 1, b: 1, a: 1 },
    { r: 0.9, g: 0.2, b: 0.2, a: 1 },
    { r: 0.2, g: 0.8, b: 0.2, a: 1 },
    { r: 0.2, g: 0.4, b: 0.9, a: 1 },
    { r: 0.9, g: 0.8, b: 0.2, a: 1 }
  ];

  const defaultFolderColors = ['#e63946', '#2a9d8f', '#457b9d', '#e76f51', '#9c27b0', '#00bcd4'];

  $: currentColor = { r: red, g: green, b: blue, a: 1.0 };
  $: activeGroup = project.groups.find((g) => g.id === project.activeGroupId) || project.groups[0];
  $: activeGroupFrames = project.frames.filter((f) => f.groupId === activeGroup?.id);
  $: currentFrame = activeGroupFrames[project.currentFrameIndexInGroup] || activeGroupFrames[0] || null;
  $: previousFrame = project.currentFrameIndexInGroup > 0 ? activeGroupFrames[project.currentFrameIndexInGroup - 1] : null;

  function syncHex() {
    const r = Math.round(red * 255).toString(16).padStart(2, '0');
    const g = Math.round(green * 255).toString(16).padStart(2, '0');
    const b = Math.round(blue * 255).toString(16).padStart(2, '0');
    hexInput = `${r}${g}${b}`.toUpperCase();
  }

  function applyHex() {
    if (hexInput.length === 6) {
      red = parseInt(hexInput.slice(0, 2), 16) / 255;
      green = parseInt(hexInput.slice(2, 4), 16) / 255;
      blue = parseInt(hexInput.slice(4, 6), 16) / 255;
    }
  }

  function saveUndoState() {
    if (!currentFrame) return;
    undoStack = [...undoStack.slice(-MAX_HISTORY), [...currentFrame.pixels]];
    redoStack = [];
  }

  function undo() {
    if (undoStack.length === 0 || !currentFrame) return;
    const previousState = undoStack[undoStack.length - 1];
    undoStack = undoStack.slice(0, -1);
    redoStack = [...redoStack, [...currentFrame.pixels]];
    currentFrame.pixels = [...previousState];
    project = project;
  }

  function redo() {
    if (redoStack.length === 0 || !currentFrame) return;
    const nextState = redoStack[redoStack.length - 1];
    redoStack = redoStack.slice(0, -1);
    undoStack = [...undoStack, [...currentFrame.pixels]];
    currentFrame.pixels = [...nextState];
    project = project;
  }

  function handleDraw(x: number, y: number) {
    if (!currentFrame) return;
    const idx = y * project.width + x;
    currentFrame.pixels[idx] = tool === 'pencil' ? { ...currentColor } : null;
    project = project;
  }

  function handleSampleColor(color: Color) {
    red = color.r;
    green = color.g;
    blue = color.b;
    syncHex();
    tool = 'pencil';
  }

  function addCurrentColorToPalette() {
    const exists = colorPalette.some(
      (c) => Math.abs(c.r - red) < 0.01 && Math.abs(c.g - green) < 0.01 && Math.abs(c.b - blue) < 0.01
    );
    if (!exists) {
      colorPalette = [...colorPalette, { r: red, g: green, b: blue, a: 1.0 }];
    }
  }

  function handleCommitPixels(newPixels: (Color | null)[]) {
    if (!currentFrame) return;
    saveUndoState();
    currentFrame.pixels = newPixels;
    project = project;
  }

  function addGroupFolder() {
    const idx = project.groups.length + 1;
    const newGroup: Group = {
      id: `group-${Date.now()}`,
      name: `Animation ${idx}`,
      color: defaultFolderColors[(idx - 1) % defaultFolderColors.length]
    };
    project.groups.push(newGroup);
    project.activeGroupId = newGroup.id;
    project.currentFrameIndexInGroup = 0;

    project.frames.push({
      id: `frame-${Date.now()}`,
      width: project.width,
      height: project.height,
      pixels: new Array(project.width * project.height).fill(null),
      groupId: newGroup.id
    });
    project = project;
  }

  function addFrameToActiveGroup() {
    if (!activeGroup) return;
    saveUndoState();
    project.frames.push({
      id: `frame-${Date.now()}`,
      width: project.width,
      height: project.height,
      pixels: new Array(project.width * project.height).fill(null),
      groupId: activeGroup.id
    });
    project.currentFrameIndexInGroup = activeGroupFrames.length;
    project = project;
  }

  function duplicateFrameInGroup(frame: PixelFrame) {
    saveUndoState();
    const dup: PixelFrame = {
      id: `frame-${Date.now()}`,
      width: frame.width,
      height: frame.height,
      pixels: [...frame.pixels],
      groupId: frame.groupId
    };
    const idx = project.frames.findIndex((f) => f.id === frame.id);
    project.frames.splice(idx + 1, 0, dup);
    project.currentFrameIndexInGroup++;
    project = project;
  }

  function deleteCurrentFrame() {
    if (!currentFrame || activeGroupFrames.length <= 1) return;
    saveUndoState();
    project.frames = project.frames.filter((f) => f.id !== currentFrame.id);
    project.currentFrameIndexInGroup = Math.max(0, project.currentFrameIndexInGroup - 1);
    project = project;
  }

  function togglePlayAnimation() {
    isPlaying = !isPlaying;
    if (isPlaying) {
      timer = setInterval(() => {
        if (activeGroupFrames.length > 0) {
          previewFrameIdx = (previewFrameIdx + 1) % activeGroupFrames.length;
        }
      }, 1000 / project.fps);
    } else {
      clearInterval(timer);
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if ((e.target as HTMLElement)?.tagName === 'INPUT') return;

    if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
      if (e.shiftKey) {
        e.preventDefault();
        redo();
      } else {
        e.preventDefault();
        undo();
      }
    } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) {
      e.preventDefault();
      redo();
    }
  }

  onMount(() => {
    window.addEventListener('keydown', handleKeyDown);
  });

  onDestroy(() => {
    if (timer) clearInterval(timer);
    window.removeEventListener('keydown', handleKeyDown);
  });
</script>

<div class="editor-shell">
  <!-- Priority Header Bar -->
  <header class="app-header">
    <div class="header-left">
      <button class="btn" on:click={onGoDashboard}>← Dashboard</button>
      <h2 class="project-title truncate">
        {project.name} <small>({project.width}x{project.height} px)</small>
      </h2>
    </div>

    <!-- Center Undo / Redo -->
    <div class="header-center">
      <button class="btn" disabled={undoStack.length === 0} on:click={undo} title="Undo (Ctrl+Z)">
        ↩ Undo
      </button>
      <button class="btn" disabled={redoStack.length === 0} on:click={redo} title="Redo (Ctrl+Y)">
        ↪ Redo
      </button>
    </div>

    <div class="header-right">
      <button class="btn" on:click={onOpenOverview}>⣿ Overview</button>
      <button class="btn" on:click={onOpenSlicer}>✂ Slicer</button>
      <button class="btn" on:click={() => currentFrame && onExportPNG(currentFrame)}>💾 Export</button>
      <button class="btn primary" on:click={onImportFrame}>📁 Import Frame</button>
    </div>
  </header>

  <!-- Fluid Main Editor Grid -->
  <div class="editor-grid">
    <aside class="panel-sidebar scrollable-y">
      <div class="section-box">
        <div class="flex-between">
          <h3>📁 Group Folders</h3>
          <button class="btn-sm" on:click={addGroupFolder}>+ New</button>
        </div>

        <div class="folders-list">
          {#each project.groups as group}
            {@const count = project.frames.filter((f) => f.groupId === group.id).length}
            <div
              class="folder-card"
              class:active={group.id === project.activeGroupId}
              on:click={() => {
                project.activeGroupId = group.id;
                project.currentFrameIndexInGroup = 0;
              }}
            >
              <div class="folder-title">
                <input type="color" bind:value={group.color} />
                <input type="text" class="truncate" bind:value={group.name} />
              </div>
              <small>{count} Frames</small>
            </div>
          {/each}
        </div>
      </div>

      <hr />

      <div class="section-box">
        <h3>Tools</h3>
        <div class="tools-grid">
          <button class="btn" class:active={tool === 'pencil'} on:click={() => (tool = 'pencil')} title="Pencil">✏ Pencil</button>
          <button class="btn" class:active={tool === 'eraser'} on:click={() => (tool = 'eraser')} title="Eraser">🧹 Eraser</button>
          <button class="btn" class:active={tool === 'eyedropper'} on:click={() => (tool = 'eyedropper')} title="Eyedropper">🧪 Picker</button>
          <button class="btn" class:active={tool === 'select'} on:click={() => (tool = 'select')} title="Rectangle Select & Move">🔲 Select</button>
          <button class="btn" class:active={tool === 'lasso'} on:click={() => (tool = 'lasso')} title="Lasso Select & Move">🪢 Lasso</button>
        </div>

        <h3>Color Picker</h3>
        <div class="color-preview" style="background: rgba({currentColor.r * 255}, {currentColor.g * 255}, {currentColor.b * 255}, 1);"></div>

        <div class="hex-row">
          <span>#</span>
          <input type="text" bind:value={hexInput} on:input={applyHex} maxlength="6" />
        </div>

        <label class="slider-row">R <input type="range" min="0" max="1" step="0.01" bind:value={red} on:input={syncHex} /></label>
        <label class="slider-row">G <input type="range" min="0" max="1" step="0.01" bind:value={green} on:input={syncHex} /></label>
        <label class="slider-row">B <input type="range" min="0" max="1" step="0.01" bind:value={blue} on:input={syncHex} /></label>

        <div class="flex-between margin-top-4">
          <h3>Swatches</h3>
          <button class="btn-xs primary" on:click={addCurrentColorToPalette}>+ Add Color</button>
        </div>
        <div class="swatches-grid">
          {#each colorPalette as c}
            <button
              class="swatch-btn"
              style="background: rgba({c.r * 255}, {c.g * 255}, {c.b * 255}, 1);"
              on:click={() => { red = c.r; green = c.g; blue = c.b; syncHex(); tool = 'pencil'; }}
            ></button>
          {/each}
        </div>
      </div>
    </aside>

    <main class="panel-canvas">
      <div class="canvas-topbar">
        <span class="folder-badge truncate" style="background: {activeGroup?.color};">
          📁 {activeGroup?.name} (Frame {project.currentFrameIndexInGroup + 1} / {activeGroupFrames.length})
        </span>
        <small class="truncate">Ctrl + Scroll to Zoom ({Math.round(project.zoom * 100)}%)</small>
      </div>

      <div class="canvas-viewport">
        {#if currentFrame}
          <PixelCanvas
            frame={currentFrame}
            {previousFrame}
            onionSkinEnabled={project.onionSkinEnabled}
            zoom={project.zoom}
            {tool}
            {currentColor}
            onDrawStart={saveUndoState}
            onDraw={handleDraw}
            onSampleColor={handleSampleColor}
            onCommitPixels={handleCommitPixels}
            onZoomChange={(delta) => (project.zoom = Math.max(0.25, Math.min(5, project.zoom + delta)))}
          />
        {/if}
      </div>

      <section class="timeline-box">
        <div class="flex-between">
          <span class="truncate">Animation Strip ({activeGroupFrames.length} Frames)</span>
          <button class="btn-sm primary" on:click={addFrameToActiveGroup}>+ Add Frame</button>
        </div>

        <div class="timeline-scroll scrollable-x">
          {#each activeGroupFrames as frame, idx}
            <div
              class="frame-card"
              class:active={idx === project.currentFrameIndexInGroup}
              on:click={() => (project.currentFrameIndexInGroup = idx)}
            >
              <span class="frame-idx">#{idx + 1}</span>
              <PreviewCanvas {frame} width={42} height={42} />
              <button class="btn-xs" on:click|stopPropagation={() => duplicateFrameInGroup(frame)}>📋</button>
            </div>
          {/each}
        </div>
      </section>
    </main>

    <aside class="panel-preview scrollable-y">
      <h3>Animation Preview</h3>
      <small class="truncate">Folder: {activeGroup?.name}</small>

      {#if activeGroupFrames.length > 0}
        <div class="preview-wrapper">
          <PreviewCanvas
            frame={isPlaying ? activeGroupFrames[previewFrameIdx] || activeGroupFrames[0] : currentFrame}
            width={128}
            height={128}
          />
        </div>
      {/if}

      <button class="btn primary full-width" on:click={togglePlayAnimation}>
        {isPlaying ? '⏸ Pause' : '▶ Play Animation'}
      </button>

      <label class="slider-row">
        FPS: {project.fps}
        <input type="range" min="1" max="24" bind:value={project.fps} />
      </label>

      <hr />

      <button
        class="btn full-width"
        class:active={project.onionSkinEnabled}
        on:click={() => (project.onionSkinEnabled = !project.onionSkinEnabled)}
      >
        🧅 Onion Skin: {project.onionSkinEnabled ? 'ON' : 'OFF'}
      </button>

      <button class="btn danger full-width" on:click={deleteCurrentFrame}>
        🗑 Delete Current Frame
      </button>
    </aside>
  </div>
</div>

<style>
  .editor-shell {
    display: flex;
    flex-direction: column;
    width: 100vw;
    height: 100vh;
    overflow: hidden;
    background: var(--bg-app);
  }

  .app-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 16px;
    background: var(--bg-panel);
    border-bottom: 1px solid var(--border-color);
    gap: 12px;
  }

  .header-left, .header-right, .header-center {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .project-title {
    font-size: 1.1rem;
    font-weight: 600;
  }

  .editor-grid {
    display: grid;
    grid-template-columns: clamp(210px, 20vw, 270px) 1fr clamp(180px, 18vw, 240px);
    flex: 1;
    min-height: 0;
    gap: 12px;
    padding: 12px;
  }

  .panel-sidebar, .panel-canvas, .panel-preview {
    container-type: inline-size;
    background: var(--bg-panel);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-width: 0;
    min-height: 0;
  }

  .panel-canvas {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }

  .canvas-topbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
  }

  .canvas-viewport {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 0;
  }

  .tools-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 4px;
  }

  .timeline-box {
    background: var(--bg-app);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
  }

  .timeline-scroll {
    display: flex;
    gap: 8px;
    padding-bottom: 4px;
    min-width: 0;
  }

  .frame-card {
    flex: 0 0 auto;
    background: var(--bg-panel);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    padding: 4px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    cursor: pointer;
  }

  .frame-card.active {
    border-color: var(--border-focus);
  }

  .folders-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 6px;
  }

  .folder-card {
    background: var(--bg-app);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    padding: 6px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: pointer;
  }

  .folder-card.active {
    border-color: var(--border-focus);
  }

  .folder-title {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }

  .folder-title input[type="color"] {
    width: 18px;
    height: 18px;
    border: none;
    background: none;
    cursor: pointer;
  }

  .folder-title input[type="text"] {
    background: transparent;
    border: none;
    color: white;
    font-weight: 600;
  }

  .folder-badge {
    padding: 3px 8px;
    border-radius: 4px;
    font-size: 0.8rem;
    font-weight: 600;
  }

  .flex-between { display: flex; justify-content: space-between; align-items: center; }
  .btn { padding: 6px 10px; background: var(--bg-card); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.85rem; white-space: nowrap; }
  .btn:hover:not(:disabled) { background: #3f3f46; }
  .btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .btn.active { background: var(--border-focus); }
  .btn.primary { background: var(--border-focus); }
  .btn.danger { background: #dc2626; }
  .btn-sm { padding: 4px 8px; font-size: 0.75rem; background: var(--bg-card); color: white; border: none; border-radius: 4px; cursor: pointer; }
  .btn-xs { padding: 2px 4px; font-size: 0.7rem; background: var(--bg-card); color: white; border: none; border-radius: 2px; }
  .btn-xs.primary { background: var(--border-focus); }
  .full-width { width: 100%; }

  .color-preview { height: 26px; border-radius: 4px; border: 1px solid #555; }
  .hex-row { display: flex; align-items: center; gap: 6px; }
  .slider-row { display: flex; flex-direction: column; font-size: 0.8rem; gap: 2px; }
  input[type="text"], input[type="number"] { width: 100%; padding: 4px; background: var(--bg-app); border: 1px solid var(--border-color); color: white; border-radius: 4px; }
  .swatches-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(20px, 1fr)); gap: 4px; }
  .swatch-btn { width: 100%; aspect-ratio: 1; border-radius: 4px; border: 1px solid #444; cursor: pointer; }
  hr { border: 0; border-top: 1px solid var(--border-color); margin: 4px 0; }
  .margin-top-4 { margin-top: 4px; }

  @container (max-width: 210px) {
    .btn { font-size: 0.75rem; padding: 4px 6px; }
    .project-title { font-size: 0.95rem; }
  }
</style>
