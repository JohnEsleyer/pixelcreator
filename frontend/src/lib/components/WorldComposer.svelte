<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { Project, WorldScene, WorldEntity, PixelFrame } from '../types';
  import PreviewCanvas from './PreviewCanvas.svelte';

  export let scene: WorldScene;
  export let projects: Project[];
  export let onBackToDashboard: () => void;
  export let onEditProject: (projectId: number) => void;
  export let onSaveScene: (scene: WorldScene) => void;
  export let onGenerateJSON: (scene: WorldScene) => Promise<string>;
  export let onGenerateRON: (scene: WorldScene) => Promise<string>;
  export let onExportToFile: (content: string, filename: string) => Promise<string>;

  let canvas: HTMLCanvasElement;
  let selectedEntityId: string | null = null;
  let isDraggingEntity = false;
  let dragOffset = { x: 0, y: 0 };
  let zoom = 1.0;
  let pan = { x: 40, y: 40 };
  let isPanningWorld = false;
  let panStart = { x: 0, y: 0 };

  // Animation ticker for world playback
  let animTimer: any = null;
  let frameTick = 0;

  // Export Modal state
  let exportFormat: 'JSON' | 'RON' | null = null;
  let exportContent = '';

  $: selectedEntity = scene.entities.find((e) => e.id === selectedEntityId) || null;
  $: selectedProject = selectedEntity ? projects.find((p) => p.id === selectedEntity!.projectId) || null : null;

  // Sort entities by Z-index for rendering
  $: sortedEntities = [...scene.entities].sort((a, b) => a.zIndex - b.zIndex);

  function autoSave() {
    onSaveScene(scene);
  }

  function addProjectToWorld(proj: Project) {
    const newZ = scene.entities.length > 0 ? Math.max(...scene.entities.map((e) => e.zIndex)) + 1 : 0;
    const newEntity: WorldEntity = {
      id: `entity-${proj.id}-${Date.now()}`,
      projectId: proj.id,
      name: proj.name,
      x: scene.width / 2,
      y: scene.height / 2,
      zIndex: newZ,
      activeGroupId: proj.groups[0]?.id || '',
      scale: proj.width > 64 ? 1.0 : 2.0,
      flipX: false,
      flipY: false,
      opacity: 1.0,
      playing: true
    };
    scene.entities = [...scene.entities, newEntity];
    selectedEntityId = newEntity.id;
    autoSave();
  }

  function removeSelectedEntity() {
    if (!selectedEntityId) return;
    scene.entities = scene.entities.filter((e) => e.id !== selectedEntityId);
    selectedEntityId = null;
    autoSave();
  }

  function moveZ(dir: 'up' | 'down' | 'top' | 'bottom') {
    if (!selectedEntity) return;
    if (dir === 'up') selectedEntity.zIndex++;
    if (dir === 'down') selectedEntity.zIndex = Math.max(0, selectedEntity.zIndex - 1);
    if (dir === 'top') {
      const maxZ = Math.max(...scene.entities.map((e) => e.zIndex), 0);
      selectedEntity.zIndex = maxZ + 1;
    }
    if (dir === 'bottom') {
      selectedEntity.zIndex = 0;
    }
    scene.entities = [...scene.entities];
    autoSave();
  }

  function handleEditSelectedProject() {
    if (!selectedEntity) return;
    autoSave();
    onEditProject(selectedEntity.projectId);
  }

  async function openExportModal(format: 'JSON' | 'RON') {
    exportFormat = format;
    if (format === 'JSON') {
      exportContent = await onGenerateJSON(scene);
    } else {
      exportContent = await onGenerateRON(scene);
    }
  }

  async function saveExportFile() {
    if (!exportFormat) return;
    const ext = exportFormat.toLowerCase();
    await onExportToFile(exportContent, `world_scene.${ext}`);
  }

  function screenToWorld(cx: number, cy: number): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = (cx - rect.left) * scaleX;
    const y = (cy - rect.top) * scaleY;

    return {
      x: (x - pan.x) / zoom,
      y: (y - pan.y) / zoom
    };
  }

  function handleMouseDown(e: MouseEvent) {
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
      isPanningWorld = true;
      panStart = { x: e.clientX - pan.x, y: e.clientY - pan.y };
      return;
    }

    if (e.button !== 0) return;

    const wPos = screenToWorld(e.clientX, e.clientY);

    // Hit test entities in reverse z-order
    for (let i = sortedEntities.length - 1; i >= 0; i--) {
      const ent = sortedEntities[i];
      const proj = projects.find((p) => p.id === ent.projectId);
      if (!proj) continue;

      const entW = proj.width * ent.scale;
      const entH = proj.height * ent.scale;
      const halfW = entW / 2;
      const halfH = entH / 2;

      if (
        wPos.x >= ent.x - halfW &&
        wPos.x <= ent.x + halfW &&
        wPos.y >= ent.y - halfH &&
        wPos.y <= ent.y + halfH
      ) {
        selectedEntityId = ent.id;
        isDraggingEntity = true;
        dragOffset = { x: wPos.x - ent.x, y: wPos.y - ent.y };
        return;
      }
    }

    selectedEntityId = null;
  }

  function handleMouseMove(e: MouseEvent) {
    if (isPanningWorld) {
      pan = { x: e.clientX - panStart.x, y: e.clientY - panStart.y };
      return;
    }

    if (isDraggingEntity && selectedEntity) {
      const wPos = screenToWorld(e.clientX, e.clientY);
      selectedEntity.x = Math.round(wPos.x - dragOffset.x);
      selectedEntity.y = Math.round(wPos.y - dragOffset.y);
      scene.entities = [...scene.entities];
    }
  }

  function handleMouseUp() {
    if (isDraggingEntity) {
      isDraggingEntity = false;
      autoSave();
    }
    isPanningWorld = false;
  }

  function handleWheel(e: WheelEvent) {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.1 : -0.1;
    zoom = Math.max(0.2, Math.min(4.0, zoom + delta));
  }

  function drawWorld() {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // World Boundary Backdrop
    ctx.fillStyle = scene.bgColor || '#18181b';
    ctx.fillRect(0, 0, scene.width, scene.height);

    // World Grid Lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= scene.width; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, scene.height);
      ctx.stroke();
    }
    for (let y = 0; y <= scene.height; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(scene.width, y);
      ctx.stroke();
    }

    // World Border Outline
    ctx.strokeStyle = '#3f3f46';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, scene.width, scene.height);

    // Render Entities
    sortedEntities.forEach((ent) => {
      const proj = projects.find((p) => p.id === ent.projectId);
      if (!proj) return;

      const groupFrames = proj.frames.filter((f) => f.groupId === ent.activeGroupId);
      const frames = groupFrames.length > 0 ? groupFrames : proj.frames;
      if (frames.length === 0) return;

      const curFrameIdx = ent.playing ? Math.floor(frameTick / Math.max(1, 10 / proj.fps)) % frames.length : 0;
      const frame = frames[curFrameIdx];

      const entW = proj.width * ent.scale;
      const entH = proj.height * ent.scale;
      const drawX = ent.x - entW / 2;
      const drawY = ent.y - entH / 2;

      ctx.save();
      ctx.globalAlpha = ent.opacity ?? 1.0;
      ctx.translate(ent.x, ent.y);
      if (ent.flipX) ctx.scale(-1, 1);
      if (ent.flipY) ctx.scale(1, -1);
      ctx.translate(-ent.x, -ent.y);

      const cellW = ent.scale;
      const cellH = ent.scale;

      for (let y = 0; y < frame.height; y++) {
        for (let x = 0; x < frame.width; x++) {
          const px = frame.pixels[y * frame.width + x];
          if (px) {
            ctx.fillStyle = `rgba(${px.r * 255}, ${px.g * 255}, ${px.b * 255}, ${px.a})`;
            ctx.fillRect(drawX + x * cellW, drawY + y * cellH, cellW, cellH);
          }
        }
      }

      ctx.restore();

      // Highlight Selected Entity Box
      if (ent.id === selectedEntityId) {
        ctx.strokeStyle = '#0284c7';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(drawX - 2, drawY - 2, entW + 4, entH + 4);
        ctx.setLineDash([]);

        ctx.fillStyle = '#0284c7';
        ctx.font = '10px sans-serif';
        ctx.fillText(`${ent.name} (Z: ${ent.zIndex})`, drawX, drawY - 6);
      }
    });

    ctx.restore();
  }

  onMount(() => {
    animTimer = setInterval(() => {
      frameTick++;
      drawWorld();
    }, 1000 / 30);

    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      if (animTimer) clearInterval(animTimer);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  });
</script>

<div class="composer-shell">
  <!-- Priority Header -->
  <header class="composer-header">
    <div class="header-left">
      <button class="btn" on:click={onBackToDashboard}>← Dashboard</button>
      <h2>🌍 World Composer <small>({scene.name} • {scene.width}x{scene.height} px)</small></h2>
    </div>

    <div class="header-actions">
      <button class="btn" on:click={() => openExportModal('JSON')}>📄 Export JSON</button>
      <button class="btn" on:click={() => openExportModal('RON')}>🦀 Export RON</button>
      <button class="btn-sm" on:click={() => { zoom = 1.0; pan = { x: 40, y: 40 }; }}>Reset View</button>
    </div>
  </header>

  <div class="composer-body">
    <!-- Left Project Palette -->
    <aside class="panel assets-panel scrollable-y">
      <h3>Project Assets ({projects.length})</h3>
      <small>Click to place instance into world</small>

      <div class="assets-list">
        {#each projects as proj}
          <div class="asset-card" on:click={() => addProjectToWorld(proj)}>
            <div class="asset-thumb">
              <PreviewCanvas frame={proj.frames[0]} width={48} height={48} />
            </div>
            <div class="asset-info min-w-0">
              <strong class="truncate">{proj.name}</strong>
              <small>{proj.width}x{proj.height} px • {proj.groups.length} anims</small>
            </div>
            <button class="btn-xs primary">+ Add</button>
          </div>
        {/each}
      </div>

      <hr />

      <h3>Z-Index Layers</h3>
      <div class="layers-list scrollable-y">
        {#each [...sortedEntities].reverse() as ent}
          <div
            class="layer-item"
            class:active={ent.id === selectedEntityId}
            on:click={() => (selectedEntityId = ent.id)}
          >
            <span class="z-badge">Z:{ent.zIndex}</span>
            <span class="truncate flex-1">{ent.name}</span>
          </div>
        {/each}
      </div>
    </aside>

    <!-- Center Canvas Context -->
    <main class="panel canvas-panel">
      <div class="canvas-tip">
        <span>Click & drag to move entities • Shift+Drag to pan • Ctrl+Scroll to zoom ({Math.round(zoom * 100)}%)</span>
      </div>

      <canvas
        bind:this={canvas}
        width={960}
        height={540}
        on:mousedown={handleMouseDown}
        on:mousemove={handleMouseMove}
        on:wheel={handleWheel}
      ></canvas>
    </main>

    <!-- Right Inspector Panel -->
    <aside class="panel inspector-panel scrollable-y">
      <h3>Entity Inspector</h3>

      {#if selectedEntity && selectedProject}
        <div class="inspector-content">
          <div class="inspector-card">
            <h4>{selectedEntity.name}</h4>
            <small>Source Project: #{selectedProject.id}</small>

            <button class="btn primary width-100 edit-proj-btn" on:click={handleEditSelectedProject}>
              ✏ Edit Sprite Project
            </button>
          </div>

          <div class="field-group">
            <label>
              Active Animation:
              <select
                bind:value={selectedEntity.activeGroupId}
                on:change={autoSave}
              >
                {#each selectedProject.groups as grp}
                  <option value={grp.id}>{grp.name}</option>
                {/each}
              </select>
            </label>
          </div>

          <div class="row gap-4">
            <button
              class="btn-sm flex-1"
              class:active={selectedEntity.playing}
              on:click={() => { if (selectedEntity) { selectedEntity.playing = !selectedEntity.playing; autoSave(); } }}
            >
              {selectedEntity.playing ? '⏸ Pause' : '▶ Play'}
            </button>
          </div>

          <div class="field-group">
            <label class="slider-row">
              Scale: {selectedEntity.scale.toFixed(1)}x
              <input type="range" min="0.5" max="8.0" step="0.5" bind:value={selectedEntity.scale} on:input={autoSave} />
            </label>
            <label class="slider-row">
              Opacity: {Math.round(selectedEntity.opacity * 100)}%
              <input type="range" min="0.1" max="1.0" step="0.05" bind:value={selectedEntity.opacity} on:input={autoSave} />
            </label>
          </div>

          <div class="row gap-6">
            <label class="checkbox-label">
              <input type="checkbox" bind:value={selectedEntity.flipX} on:change={autoSave} /> Flip X
            </label>
            <label class="checkbox-label">
              <input type="checkbox" bind:value={selectedEntity.flipY} on:change={autoSave} /> Flip Y
            </label>
          </div>

          <hr />

          <h4>Z-Layer Ordering</h4>
          <div class="z-controls-grid">
            <button class="btn-sm" on:click={() => moveZ('up')}>▲ Layer Up</button>
            <button class="btn-sm" on:click={() => moveZ('down')}>▼ Layer Down</button>
            <button class="btn-sm" on:click={() => moveZ('top')}>⇈ Bring to Front</button>
            <button class="btn-sm" on:click={() => moveZ('bottom')}>⇊ Send to Back</button>
          </div>

          <hr />

          <button class="btn danger width-100" on:click={removeSelectedEntity}>
            🗑 Delete Entity from World
          </button>
        </div>
      {:else}
        <div class="empty-inspector">
          <p>Select an entity on the canvas or from the layers list to inspect and adjust its properties.</p>
        </div>
      {/if}
    </aside>
  </div>

  <!-- Export Modal -->
  {#if exportFormat !== null}
    <div class="modal-backdrop" on:click={() => (exportFormat = null)}>
      <div class="modal-card" on:click|stopPropagation>
        <div class="modal-header">
          <h3>Generated {exportFormat} World Scene Data</h3>
          <button class="btn-sm" on:click={() => (exportFormat = null)}>✕ Close</button>
        </div>

        <textarea class="export-textarea" readonly value={exportContent}></textarea>

        <div class="modal-footer">
          <button class="btn secondary" on:click={() => navigator.clipboard.writeText(exportContent)}>📋 Copy to Clipboard</button>
          <button class="btn primary" on:click={saveExportFile}>💾 Save to File</button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .composer-shell {
    display: flex;
    flex-direction: column;
    width: 100vw;
    height: 100vh;
    background: var(--bg-app, #09090b);
    color: #eee;
    overflow: hidden;
  }

  .composer-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 20px;
    background: var(--bg-panel, #18181b);
    border-bottom: 1px solid var(--border-color, #27272a);
  }

  .header-left, .header-actions {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .composer-body {
    display: grid;
    grid-template-columns: clamp(240px, 20vw, 280px) 1fr clamp(240px, 20vw, 280px);
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

  .canvas-panel {
    align-items: center;
    justify-content: center;
    position: relative;
    overflow: hidden;
  }

  .canvas-tip {
    position: absolute;
    top: 12px;
    left: 12px;
    font-size: 0.75rem;
    color: #888;
    background: rgba(0, 0, 0, 0.6);
    padding: 4px 8px;
    border-radius: 4px;
  }

  canvas {
    width: 100%;
    height: 100%;
    object-fit: contain;
    cursor: grab;
  }

  canvas:active {
    cursor: grabbing;
  }

  /* Assets List */
  .assets-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .asset-card {
    background: #09090b;
    border: 1px solid #27272a;
    border-radius: 6px;
    padding: 6px;
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
  }

  .asset-card:hover {
    border-color: #0284c7;
  }

  .asset-thumb {
    width: 48px;
    height: 48px;
    background: #18181b;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    flex-shrink: 0;
  }

  .layers-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-height: 180px;
  }

  .layer-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px;
    background: #09090b;
    border: 1px solid #27272a;
    border-radius: 4px;
    font-size: 0.75rem;
    cursor: pointer;
  }

  .layer-item.active {
    border-color: #0284c7;
    background: #0c4a6e;
  }

  .z-badge {
    background: #27272a;
    padding: 2px 4px;
    border-radius: 3px;
    font-weight: bold;
  }

  /* Inspector */
  .inspector-card {
    background: #09090b;
    border: 1px solid #27272a;
    border-radius: 6px;
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .edit-proj-btn {
    margin-top: 6px;
    font-weight: 600;
  }

  .field-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 0.8rem;
  }

  .slider-row {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .z-controls-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px;
  }

  .empty-inspector {
    color: #666;
    font-size: 0.85rem;
    text-align: center;
    margin-top: 40px;
  }

  /* Modal */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.8);
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
    width: 600px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .export-textarea {
    width: 100%;
    height: 300px;
    background: #09090b;
    border: 1px solid #27272a;
    color: #38bdf8;
    font-family: monospace;
    font-size: 0.8rem;
    padding: 10px;
    border-radius: 4px;
    resize: none;
    box-sizing: border-box;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  /* Utilities */
  .btn { padding: 6px 12px; background: #27272a; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.85rem; }
  .btn:hover { background: #3f3f46; }
  .btn.primary { background: #0284c7; }
  .btn.danger { background: #dc2626; }
  .btn-sm { padding: 4px 8px; font-size: 0.75rem; background: #27272a; color: white; border: none; border-radius: 4px; cursor: pointer; }
  .btn-xs { padding: 2px 6px; font-size: 0.7rem; background: #27272a; color: white; border: none; border-radius: 3px; cursor: pointer; }
  .btn-xs.primary { background: #0284c7; }
  .width-100 { width: 100%; }
  .row { display: flex; align-items: center; }
  .gap-4 { gap: 4px; }
  .gap-6 { gap: 6px; }
  .flex-1 { flex: 1; }
  .min-w-0 { min-width: 0; }
  select { width: 100%; padding: 6px; background: #09090b; border: 1px solid #27272a; color: white; border-radius: 4px; }
  hr { border: 0; border-top: 1px solid #27272a; margin: 4px 0; }
</style>
