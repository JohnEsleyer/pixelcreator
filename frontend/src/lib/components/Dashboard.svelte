<script lang="ts">
  import type { Project } from '../types';

  export let projects: Project[];
  export let onCreateProject: (name: string, size: number) => void;
  export let onOpenProject: (id: number) => void;
  export let onDeleteProject: (id: number) => void;
  export let onImportImage: () => void;

  let newName = 'New Animation';
  let newSize = 16;
</script>

<div class="dashboard-container scrollable-y">
  <header class="dashboard-header">
    <h1>PixelCreator Dashboard</h1>
  </header>

  <main class="dashboard-grid">
    <!-- Creation Card -->
    <section class="card create-card">
      <h2>Create Project</h2>
      <label class="field-label">
        Project Name
        <input type="text" bind:value={newName} placeholder="My Pixel Art" />
      </label>

      <p class="field-label">Canvas Dimensions</p>
      <div class="preset-group">
        {#each [8, 16, 32, 64] as size}
          <button class="btn" class:active={newSize === size} on:click={() => (newSize = size)}>
            {size}x{size}
          </button>
        {/each}
      </div>
      <small>Selected: {newSize}x{newSize} px</small>

      <button class="btn primary" on:click={() => onCreateProject(newName, newSize)}>
        🚀 Create & Open
      </button>

      <hr />
      <button class="btn secondary" on:click={onImportImage}>
        📁 Import Image as New Project
      </button>
    </section>

    <!-- Projects Grid Container -->
    <section class="card projects-card">
      <h2>Existing Projects ({projects.length})</h2>
      
      <div class="projects-grid scrollable-y">
        {#each projects as proj}
          <article class="project-item">
            <div class="project-info min-w-0">
              <h3 class="truncate">{proj.name}</h3>
              <small>Grid: {proj.width}x{proj.height} | Folders: {proj.groups.length}</small>
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
    background: var(--bg-app);
  }

  .dashboard-header {
    margin-bottom: 20px;
  }

  .dashboard-grid {
    display: grid;
    grid-template-columns: clamp(280px, 30vw, 360px) 1fr;
    gap: 20px;
    height: calc(100vh - 100px);
    min-height: 0;
  }

  .card {
    container-type: inline-size;
    background: var(--bg-panel);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-height: 0;
  }

  .field-label {
    display: flex;
    flex-direction: column;
    font-size: 0.85rem;
    gap: 4px;
  }

  .preset-group {
    display: flex;
    gap: 6px;
  }

  /* Projects Intrinsic Autosizing Grid */
  .projects-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr));
    gap: 12px;
    padding-right: 4px;
  }

  .project-item {
    background: var(--bg-app);
    border: 1px solid var(--border-color);
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

  .btn { padding: 8px 12px; background: var(--bg-card); color: white; border: none; border-radius: 4px; cursor: pointer; }
  .btn:hover { background: #3f3f46; }
  .btn.active, .btn.primary { background: var(--border-focus); }
  .btn.danger { background: #dc2626; }
  input[type="text"] { padding: 8px; background: var(--bg-app); border: 1px solid var(--border-color); color: white; border-radius: 4px; }
  hr { border: 0; border-top: 1px solid var(--border-color); margin: 4px 0; }
  .min-w-0 { min-width: 0; }

  @container (max-width: 400px) {
    .project-item { flex-direction: column; align-items: flex-start; }
    .project-actions { width: 100%; justify-content: flex-end; }
  }
</style>
