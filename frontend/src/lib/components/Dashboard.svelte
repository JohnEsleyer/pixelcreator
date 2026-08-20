<script lang="ts">
  import type { Project } from '../types';

  export let projects: Project[];
  export let onCreateProject: (name: string, width: number, height: number) => void;
  export let onOpenProject: (id: number) => void;
  export let onDeleteProject: (id: number) => void;
  export let onImportImage: () => void;
  export let onOpenWorldComposer: () => void;

  let newName = 'New Asset';
  let selectedCategory: 'character' | 'world' | 'custom' = 'character';
  let customWidth = 320;
  let customHeight = 180;
  let chosenW = 16;
  let chosenH = 16;

  const characterSizes = [
    { label: '8x8', w: 8, h: 8 },
    { label: '16x16', w: 16, h: 16 },
    { label: '24x24', w: 24, h: 24 },
    { label: '32x32', w: 32, h: 32 },
    { label: '48x48', w: 48, h: 48 },
    { label: '64x64', w: 64, h: 64 }
  ];

  const worldSizes = [
    { label: '128x128 Tilemap/Prop', w: 128, h: 128 },
    { label: '256x256 Large Asset', w: 256, h: 256 },
    { label: '320x180 (16:9 Retro BG)', w: 320, h: 180 },
    { label: '512x512 Environment', w: 512, h: 512 },
    { label: '640x360 Full HD Pixel BG', w: 640, h: 360 }
  ];

  function setSize(w: number, h: number) {
    chosenW = w;
    chosenH = h;
  }

  function handleCreate() {
    if (selectedCategory === 'custom') {
      onCreateProject(newName, customWidth, customHeight);
    } else {
      onCreateProject(newName, chosenW, chosenH);
    }
  }
</script>

<div class="dashboard-container scrollable-y">
  <header class="dashboard-header">
    <div class="header-brand">
      <h1>PixelCreator Studio</h1>
      <span class="version-tag">v2.0 • Slicer & World Composer</span>
    </div>

    <div class="header-nav">
      <button class="btn composer-btn" on:click={onOpenWorldComposer}>
        🌍 Open World Composer
      </button>
    </div>
  </header>

  <main class="dashboard-grid">
    <section class="card create-card scrollable-y">
      <h2>Create Asset</h2>
      <label class="field-label">
        Project Name
        <input type="text" bind:value={newName} placeholder="Hero / Grassland BG" />
      </label>

      <div class="category-tabs">
        <button class="tab-btn" class:active={selectedCategory === 'character'} on:click={() => { selectedCategory = 'character'; setSize(16, 16); }}>
          Sprites & Characters
        </button>
        <button class="tab-btn" class:active={selectedCategory === 'world'} on:click={() => { selectedCategory = 'world'; setSize(320, 180); }}>
          World & Backgrounds
        </button>
        <button class="tab-btn" class:active={selectedCategory === 'custom'} on:click={() => (selectedCategory = 'custom')}>
          Custom
        </button>
      </div>

      {#if selectedCategory === 'character'}
        <div class="preset-grid">
          {#each characterSizes as sz}
            <button
              class="preset-btn"
              class:active={chosenW === sz.w && chosenH === sz.h}
              on:click={() => setSize(sz.w, sz.h)}
            >
              {sz.label}
            </button>
          {/each}
        </div>
      {:else if selectedCategory === 'world'}
        <div class="preset-grid-vertical">
          {#each worldSizes as sz}
            <button
              class="preset-btn text-left"
              class:active={chosenW === sz.w && chosenH === sz.h}
              on:click={() => setSize(sz.w, sz.h)}
            >
              {sz.label}
            </button>
          {/each}
        </div>
      {:else}
        <div class="custom-dims-row">
          <label>
            Width (px)
            <input type="number" min="4" max="1024" bind:value={customWidth} />
          </label>
          <label>
            Height (px)
            <input type="number" min="4" max="1024" bind:value={customHeight} />
          </label>
        </div>
      {/if}

      <div class="size-indicator">
        Selected Canvas: <strong>{selectedCategory === 'custom' ? customWidth : chosenW} x {selectedCategory === 'custom' ? customHeight : chosenH} px</strong>
      </div>

      <button class="btn primary launch-btn" on:click={handleCreate}>
        🚀 Create & Open Canvas
      </button>

      <hr />
      <button class="btn secondary" on:click={onImportImage}>
        📁 Import Image as New Project
      </button>
    </section>

    <section class="card projects-card">
      <div class="flex-between">
        <h2>Existing Projects ({projects.length})</h2>
        <button class="btn-sm" on:click={onOpenWorldComposer}>🌍 World View</button>
      </div>
      
      <div class="projects-grid scrollable-y">
        {#each projects as proj}
          <article class="project-item">
            <div class="project-info min-w-0">
              <h3 class="truncate">{proj.name}</h3>
              <small>Dimensions: {proj.width}x{proj.height} px • {proj.frames.length} Frame(s)</small>
            </div>
            <div class="project-actions">
              <button class="btn primary" on:click={() => onOpenProject(proj.id)}>Open</button>
              <button class="btn danger" on:click={() => onDeleteProject(proj.id)}>Delete</button>
            </div>
          </article>
        {/each}
      </div>
    </section>
  </main>
</div>

<style>
  .dashboard-container {
    width: 100vw;
    height: 100vh;
    padding: 24px;
    background: var(--bg-app, #09090b);
    box-sizing: border-box;
  }

  .dashboard-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
  }

  .header-brand {
    display: flex;
    align-items: baseline;
    gap: 12px;
  }

  .version-tag {
    font-size: 0.8rem;
    color: #0284c7;
    background: #0c4a6e;
    padding: 2px 8px;
    border-radius: 12px;
  }

  .composer-btn {
    background: #0284c7 !important;
    font-weight: 600;
    padding: 8px 16px;
  }

  .dashboard-grid {
    display: grid;
    grid-template-columns: clamp(320px, 32vw, 420px) 1fr;
    gap: 20px;
    height: calc(100vh - 110px);
    min-height: 0;
  }

  .card {
    background: var(--bg-panel, #18181b);
    border: 1px solid var(--border-color, #27272a);
    border-radius: 8px;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-height: 0;
  }

  .category-tabs {
    display: flex;
    gap: 4px;
    background: #09090b;
    padding: 3px;
    border-radius: 6px;
  }

  .tab-btn {
    flex: 1;
    font-size: 0.75rem;
    padding: 6px;
    background: transparent;
    border: none;
    color: #888;
    cursor: pointer;
    border-radius: 4px;
  }

  .tab-btn.active {
    background: #27272a;
    color: white;
    font-weight: 600;
  }

  .preset-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
  }

  .preset-grid-vertical {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .preset-btn {
    padding: 8px;
    font-size: 0.8rem;
    background: #09090b;
    border: 1px solid #27272a;
    color: #eee;
    border-radius: 4px;
    cursor: pointer;
  }

  .preset-btn.active {
    border-color: #0284c7;
    background: #0c4a6e;
    color: white;
  }

  .text-left {
    text-align: left;
  }

  .custom-dims-row {
    display: flex;
    gap: 10px;
  }

  .custom-dims-row label {
    flex: 1;
    font-size: 0.8rem;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .size-indicator {
    font-size: 0.85rem;
    background: #111;
    padding: 8px;
    border-radius: 4px;
    border: 1px dashed #333;
    text-align: center;
  }

  .field-label {
    display: flex;
    flex-direction: column;
    font-size: 0.85rem;
    gap: 4px;
  }

  .launch-btn {
    font-weight: 600;
    padding: 10px;
  }

  .projects-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr));
    gap: 12px;
    padding-right: 4px;
  }

  .project-item {
    background: var(--bg-app, #09090b);
    border: 1px solid var(--border-color, #27272a);
    border-radius: 6px;
    padding: 12px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
  }

  .project-actions {
    display: flex;
    gap: 6px;
  }

  .flex-between { display: flex; justify-content: space-between; align-items: center; }
  .btn { padding: 8px 12px; background: #27272a; color: white; border: none; border-radius: 4px; cursor: pointer; }
  .btn:hover { background: #3f3f46; }
  .btn.active, .btn.primary { background: #0284c7; }
  .btn.danger { background: #dc2626; }
  .btn-sm { padding: 4px 8px; font-size: 0.8rem; background: #27272a; color: white; border: none; border-radius: 4px; cursor: pointer; }
  input[type="text"], input[type="number"] { padding: 8px; background: #09090b; border: 1px solid #27272a; color: white; border-radius: 4px; }
  hr { border: 0; border-top: 1px solid #27272a; margin: 4px 0; }
  .min-w-0 { min-width: 0; }
</style>
