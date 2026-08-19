<script lang="ts">
  import type { Project, PixelFrame } from '../types';
  import PreviewCanvas from './PreviewCanvas.svelte';

  export let project: Project;
  export let onBackToEditor: () => void;

  let selectedGroupFilter = 'All';

  $: filteredFrames = project.frames
    .map((frame, index) => ({ frame, index }))
    .filter(({ frame }) => {
      if (selectedGroupFilter === 'All') return true;
      return frame.groupId === selectedGroupFilter;
    });

  function getGroupForFrame(frame: PixelFrame) {
    return project.groups.find((g) => g.id === frame.groupId);
  }

  function duplicateFrame(frame: PixelFrame) {
    const dup: PixelFrame = {
      id: `frame-${Date.now()}`,
      width: frame.width,
      height: frame.height,
      pixels: [...frame.pixels],
      groupId: frame.groupId
    };
    const globalIdx = project.frames.findIndex((f) => f.id === frame.id);
    project.frames.splice(globalIdx + 1, 0, dup);
    project = project;
  }

  function moveFrame(frameId: string, direction: 'left' | 'right') {
    const idx = project.frames.findIndex((f) => f.id === frameId);
    if (direction === 'left' && idx > 0) {
      const temp = project.frames[idx - 1];
      project.frames[idx - 1] = project.frames[idx];
      project.frames[idx] = temp;
    } else if (direction === 'right' && idx < project.frames.length - 1) {
      const temp = project.frames[idx + 1];
      project.frames[idx + 1] = project.frames[idx];
      project.frames[idx] = temp;
    }
    project = project;
  }

  function deleteFrame(frameId: string) {
    const groupId = project.frames.find((f) => f.id === frameId)?.groupId;
    const framesInGroup = project.frames.filter((f) => f.groupId === groupId);
    if (framesInGroup.length <= 1) return; // Keep at least 1 frame per group
    project.frames = project.frames.filter((f) => f.id !== frameId);
    project = project;
  }

  function openFrameInEditor(frame: PixelFrame) {
    const groupFrames = project.frames.filter((f) => f.groupId === frame.groupId);
    project.activeGroupId = frame.groupId;
    project.currentFrameIndexInGroup = groupFrames.findIndex((f) => f.id === frame.id);
    onBackToEditor();
  }
</script>

<div class="overview">
  <header>
    <button on:click={onBackToEditor}>← Back to Editor</button>
    <h2>Frames Overview — {project.name} ({project.frames.length} Frames)</h2>
  </header>

  <div class="filter-bar">
    <span>Filter by Group:</span>
    <button class:active={selectedGroupFilter === 'All'} on:click={() => (selectedGroupFilter = 'All')}>
      All
    </button>
    {#each project.groups as group}
      <button
        class:active={selectedGroupFilter === group.id}
        style="border-left: 3px solid {group.color};"
        on:click={() => (selectedGroupFilter = group.id)}
      >
        {group.name} ({project.frames.filter((f) => f.groupId === group.id).length})
      </button>
    {/each}
  </div>

  <div class="frames-grid">
    {#each filteredFrames as { frame, index }}
      {@const group = getGroupForFrame(frame)}
      <div class="frame-card" style="border-top: 3px solid {group?.color ?? '#444'};">
        <div class="card-header">
          <span>#{index + 1}</span>
          <span class="group-tag" style="color: {group?.color};">📁 {group?.name ?? '?'}</span>
          <button class="edit-btn" on:click={() => openFrameInEditor(frame)}>✏ Edit</button>
        </div>

        <PreviewCanvas {frame} width={90} height={90} />

        <div class="card-actions">
          <button title="Duplicate" on:click={() => duplicateFrame(frame)}>📋</button>
          <button title="Move left" on:click={() => moveFrame(frame.id, 'left')}>◀</button>
          <button title="Move right" on:click={() => moveFrame(frame.id, 'right')}>▶</button>
          <button class="danger" title="Delete" on:click={() => deleteFrame(frame.id)}>🗑</button>
        </div>
      </div>
    {/each}
  </div>
</div>

<style>
  .overview { padding: 20px; color: #eee; font-family: sans-serif; background: #121214; min-height: 100vh; }
  header { display: flex; align-items: center; gap: 15px; margin-bottom: 20px; }
  .filter-bar { display: flex; gap: 8px; align-items: center; margin-bottom: 20px; flex-wrap: wrap; }
  .frames-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 15px; }
  .frame-card { background: #18181b; border: 1px solid #3f3f46; border-radius: 6px; padding: 10px; display: flex; flex-direction: column; align-items: center; gap: 8px; }
  .card-header { display: flex; justify-content: space-between; align-items: center; width: 100%; font-size: 11px; }
  .group-tag { font-size: 10px; font-weight: bold; }
  .edit-btn { font-size: 10px; padding: 2px 6px; }
  .card-actions { display: flex; gap: 4px; width: 100%; justify-content: center; }
  button { padding: 4px 8px; background: #27272a; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; }
  button:hover { background: #3f3f46; }
  button.active { background: #0284c7; }
  button.danger { background: #dc2626; }
</style>
