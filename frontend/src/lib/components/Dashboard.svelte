<script lang="ts">
  import type { Project } from '../types';

  export let projects: Project[];
  export let onCreateProject: (name: string, width: number, height: number) => void;
  export let onOpenProject: (id: number) => void;
  export let onDeleteProject: (id: number) => void;
  export let onImportImage: () => void;
  export let onImportSpriteData: (raw: string) => Promise<void>;
  export let onOpenTextToPixel: () => void;

  let newName = 'New Sprite';
  let isCustom = false;
  let customWidth = 32;
  let customHeight = 32;
  let chosenW = 16;
  let chosenH = 16;

  let isPasteModalOpen = false;
  let pasteRawText = '';

  const characterSizes = [
    { label: '8x8', w: 8, h: 8 },
    { label: '16x16', w: 16, h: 16 },
    { label: '24x24', w: 24, h: 24 },
    { label: '32x32', w: 32, h: 32 },
    { label: '48x48', w: 48, h: 48 },
    { label: '64x64', w: 64, h: 64 },
    { label: '128x128', w: 128, h: 128 }
  ];

  function setSize(w: number, h: number) {
    chosenW = w;
    chosenH = h;
    isCustom = false;
  }

  function handleCreate() {
    if (isCustom) {
      onCreateProject(newName, customWidth, customHeight);
    } else {
      onCreateProject(newName, chosenW, chosenH);
    }
  }

  async function handleConfirmPaste() {
    if (!pasteRawText.trim()) return;
    await onImportSpriteData(pasteRawText);
    isPasteModalOpen = false;
    pasteRawText = '';
  }
</script>

<div class="dashboard-container scrollable-y">
  <header class="dashboard-header">
    <div class="header-brand">
      <h1>PixelCreator Studio</h1>
      <span class="version-tag">Sprite Engine Edition</span>
    </div>

    <div class="header-nav">
      <button class="btn highlight" on:click={onOpenTextToPixel}>
        ✨ Text to Pixel
      </button>
      <button class="btn" on:click={() => (isPasteModalOpen = true)}>
        📥 Paste / Load Sprite Data
      </button>
    </div>
  </header>

  <main class="dashboard-grid">
    <section class="card create-card scrollable-y">
      <h2>Create Sprite</h2>
      <label class="field-label">
        Sprite Name
        <input type="text" bind:value={newName} placeholder="Hero Character" />
      </label>

      <div class="category-tabs">
        <button class="tab-btn" class:active={!isCustom} on:click={() => (isCustom = false)}>
          Presets
        </button>
        <button class="tab-btn" class:active={isCustom} on:click={() => (isCustom = true)}>
          Custom Size
        </button>
      </div>

      {#if !isCustom}
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
        Selected Canvas: <strong>{isCustom ? customWidth : chosenW} x {isCustom ? customHeight : chosenH} px</strong>
      </div>

      <button class="btn primary launch-btn" on:click={handleCreate}>
        🚀 Create & Open Canvas
      </button>

      <hr />
      <div class="row gap-6">
        <button class="btn secondary flex-1" on:click={onImportImage}>
          📁 Import Image
        </button>
        <button class="btn secondary flex-1" on:click={() => (isPasteModalOpen = true)}>
          📥 Load Data Format
        </button>
      </div>
    </section>

    <section class="card projects-card">
      <div class="flex-between">
        <h2>Existing Sprites ({projects.length})</h2>
      </div>
      
      <div class="projects-grid scrollable-y">
        {#each projects as proj}
          <article class="project-item">
            <div class="project-info min-w-0">
              <h3 class="truncate">{proj.name}</h3>
              <small>{proj.width}x{proj.height} px • {proj.frames.length} Frame(s)</small>
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

  <!-- Load / Paste Data Format Modal -->
  {#if isPasteModalOpen}
    <div class="modal-backdrop" on:click={() => (isPasteModalOpen = false)}>
      <div class="modal-card" on:click|stopPropagation>
        <div class="modal-header">
          <h3>📥 Load Sprite Data Format (JSON / RON)</h3>
          <button class="btn-sm" on:click={() => (isPasteModalOpen = false)}>✕ Close</button>
        </div>

        <p class="modal-sub">Paste custom sprite specification or engine data text below:</p>
        <textarea class="paste-textarea" bind:value={pasteRawText} placeholder="Paste sprite JSON data here..."></textarea>

        <div class="modal-footer">
          <button class="btn" on:click={() => (isPasteModalOpen = false)}>Cancel</button>
          <button class="btn primary" on:click={handleConfirmPaste}>🚀 Parse & Load Sprite</button>
        </div>
      </div>
    </div>
  {/if}
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

  /* Modal */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.85);
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
    width: 580px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .modal-sub {
    font-size: 0.85rem;
    color: #aaa;
    margin: 0;
  }

  .paste-textarea {
    width: 100%;
    height: 240px;
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

  .flex-between { display: flex; justify-content: space-between; align-items: center; }
  .btn { padding: 8px 12px; background: #27272a; color: white; border: none; border-radius: 4px; cursor: pointer; }
  .btn:hover { background: #3f3f46; }
  .btn.active, .btn.primary { background: #0284c7; }
  .btn.danger { background: #dc2626; }
  .btn.highlight { background: #0284c7; font-weight: 600; }
  .btn-sm { padding: 4px 8px; font-size: 0.8rem; background: #27272a; color: white; border: none; border-radius: 4px; cursor: pointer; }
  .row { display: flex; align-items: center; }
  .gap-6 { gap: 6px; }
  .flex-1 { flex: 1; }
  input[type="text"], input[type="number"] { padding: 8px; background: #09090b; border: 1px solid #27272a; color: white; border-radius: 4px; }
  hr { border: 0; border-top: 1px solid #27272a; margin: 4px 0; }
  .min-w-0 { min-width: 0; }
  .secondary { background: #1e3a5f !important; }
</style>
