<script lang="ts">
  import { onMount } from 'svelte';
  import type { Project, Screen, PixelFrame, Group } from './lib/types';
  import Dashboard from './lib/components/Dashboard.svelte';
  import Editor from './lib/components/Editor.svelte';
  import FramesOverview from './lib/components/FramesOverview.svelte';
  import Slicer from './lib/components/Slicer.svelte';
  import TextToPixel from './lib/components/TextToPixel.svelte';
  import { slicerStore } from './lib/stores/slicerStore';

  import {
    GetProjects,
    CreateProject,
    DeleteProject,
    SaveProject,
    ImportImageAsProject,
    ImportImageToFrame,
    ExportFrameAsPNG,
    ImportSpriteData,
    LoadSpriteSheet,
    GenerateSampleSpriteSheet,
    PackFramesToSheet
  } from '../wailsjs/go/main/App';

  let currentScreen: Screen = 'dashboard';
  let projects: Project[] = [];
  let activeProject: Project | null = null;

  async function loadInitialData() {
    projects = await GetProjects();
  }

  async function handleCreateProject(name: string, width: number, height: number) {
    const proj = await CreateProject(name, width, height);
    await loadInitialData();
    activeProject = proj;
    currentScreen = 'editor';
  }

  async function handleDeleteProject(id: number) {
    await DeleteProject(id);
    await loadInitialData();
    if (activeProject?.id === id) activeProject = null;
  }

  async function handleSaveActiveProject() {
    if (activeProject) {
      await SaveProject(activeProject);
    }
  }

  async function handleImportImageProject() {
    try {
      const proj = await ImportImageAsProject();
      if (proj) {
        await loadInitialData();
        activeProject = proj;
        currentScreen = 'editor';
      }
    } catch (e) {
      console.warn(e);
    }
  }

  async function handleImportSpriteData(raw: string) {
    try {
      const proj = await ImportSpriteData(raw);
      if (proj) {
        await loadInitialData();
        activeProject = proj;
        currentScreen = 'editor';
      }
    } catch (e) {
      alert(`Could not parse sprite data: ${e}`);
    }
  }

  async function handleImportFrame() {
    if (!activeProject) return;
    try {
      const frame = await ImportImageToFrame(activeProject.id);
      if (frame) {
        frame.groupId = activeProject.activeGroupId || activeProject.groups[0]?.id || 'group-idle';
        activeProject.frames.push(frame);
        const groupFrames = activeProject.frames.filter((f) => f.groupId === activeProject!.activeGroupId);
        activeProject.currentFrameIndexInGroup = groupFrames.length - 1;
        activeProject = activeProject;
        await handleSaveActiveProject();
      }
    } catch (e) {
      console.warn(e);
    }
  }

  async function handleExportPNG(frame: PixelFrame) {
    try {
      await ExportFrameAsPNG(frame, 16);
    } catch (e) {
      console.warn(e);
    }
  }

  // --- Text to Pixel Handlers ---
  function handleCreateProjectFromFrame(frame: PixelFrame, name: string) {
    const palette = ['#e63946', '#2a9d8f', '#457b9d'];
    const group: Group = { id: `group-${Date.now()}`, name: 'Default', color: palette[0] };
    const newProj: Project = {
      id: Date.now(),
      name,
      width: frame.width,
      height: frame.height,
      groups: [group],
      frames: [{ ...frame, id: `frame-${Date.now()}`, groupId: group.id }],
      activeGroupId: group.id,
      currentFrameIndexInGroup: 0,
      fps: 8,
      onionSkinEnabled: true,
      zoom: 1.0
    };
    activeProject = newProj;
    projects = [...projects, newProj];
    currentScreen = 'editor';
    SaveProject(newProj).catch(console.warn);
  }

  function handleInsertFrameToProject(frame: PixelFrame) {
    if (!activeProject) return;
    const groupId = activeProject.activeGroupId || activeProject.groups[0]?.id;
    const newFrame: PixelFrame = {
      ...frame,
      id: `frame-${Date.now()}`,
      groupId
    };
    activeProject.frames.push(newFrame);
    const groupFrames = activeProject.frames.filter((f) => f.groupId === groupId);
    activeProject.currentFrameIndexInGroup = groupFrames.length - 1;
    activeProject = activeProject;
    currentScreen = 'editor';
    SaveProject(activeProject).catch(console.warn);
  }

  // --- Slicer Actions ---
  async function handleUploadSlicerSheet() {
    try {
      const sheet = await LoadSpriteSheet();
      if (sheet) {
        slicerStore.dispatch({ type: 'SET_SOURCE_FRAME', frame: sheet });
        currentScreen = 'slicer';
      }
    } catch (e) {
      console.warn(e);
    }
  }

  function handleApplySlices(slices: PixelFrame[], replace: boolean) {
    if (!slices.length) return;

    const groupNames = Array.from(new Set(slices.map((s) => s.tag || 'Main')));
    const palette = ['#e63946', '#2a9d8f', '#457b9d', '#e76f51', '#9c27b0', '#00bcd4'];

    if (activeProject) {
      groupNames.forEach((name, idx) => {
        let group = activeProject!.groups.find((g) => g.name === name);
        if (!group) {
          group = {
            id: `group-${Date.now()}-${idx}`,
            name,
            color: palette[idx % palette.length]
          };
          activeProject!.groups.push(group);
        }
      });

      const slicedFrames: PixelFrame[] = slices.map((s, idx) => {
        const group = activeProject!.groups.find((g) => g.name === (s.tag || 'Main'));
        return {
          id: `frame-sliced-${Date.now()}-${idx}`,
          width: s.width,
          height: s.height,
          pixels: s.pixels,
          groupId: group ? group.id : activeProject!.groups[0].id
        };
      });

      if (replace) {
        activeProject.frames = slicedFrames;
      } else {
        activeProject.frames.push(...slicedFrames);
      }

      activeProject.activeGroupId = activeProject.groups[0].id;
      activeProject.currentFrameIndexInGroup = 0;
      activeProject = activeProject;
      handleSaveActiveProject();
    } else {
      const groups: Group[] = groupNames.map((name, idx) => ({
        id: `group-${Date.now()}-${idx}`,
        name,
        color: palette[idx % palette.length]
      }));

      const slicedFrames: PixelFrame[] = slices.map((s, idx) => {
        const group = groups.find((g) => g.name === (s.tag || 'Main'));
        return {
          id: `frame-sliced-${Date.now()}-${idx}`,
          width: s.width,
          height: s.height,
          pixels: s.pixels,
          groupId: group ? group.id : groups[0].id
        };
      });

      activeProject = {
        id: Date.now(),
        name: 'Sliced Sprite Project',
        width: slices[0].width,
        height: slices[0].height,
        groups,
        frames: slicedFrames,
        activeGroupId: groups[0].id,
        currentFrameIndexInGroup: 0,
        fps: 8,
        onionSkinEnabled: true,
        zoom: 1.0
      };
      projects.push(activeProject);
    }

    currentScreen = 'editor';
  }

  function handleOpenEditorSlicer() {
    if (activeProject) {
      const groupFrames = activeProject.frames.filter((f) => f.groupId === activeProject?.activeGroupId);
      const curFrame = groupFrames[activeProject.currentFrameIndexInGroup] || activeProject.frames[0];
      slicerStore.dispatch({
        type: 'SET_SOURCE_FRAME',
        frame: curFrame
      });
    }
    currentScreen = 'slicer';
  }

  onMount(() => {
    loadInitialData();
  });
</script>

<main>
  {#if currentScreen === 'dashboard'}
    <Dashboard
      {projects}
      onCreateProject={handleCreateProject}
      onOpenProject={(id) => {
        activeProject = projects.find((p) => p.id === id) || null;
        currentScreen = 'editor';
      }}
      onDeleteProject={handleDeleteProject}
      onImportImage={handleImportImageProject}
      onImportSpriteData={handleImportSpriteData}
      onOpenTextToPixel={() => (currentScreen = 'text-to-pixel')}
    />
  {:else if currentScreen === 'editor' && activeProject}
    <Editor
      bind:project={activeProject}
      onGoDashboard={() => {
        handleSaveActiveProject();
        currentScreen = 'dashboard';
      }}
      onOpenOverview={() => (currentScreen = 'overview')}
      onOpenSlicer={handleOpenEditorSlicer}
      onOpenTextToPixel={() => (currentScreen = 'text-to-pixel')}
      onImportFrame={handleImportFrame}
      onExportPNG={handleExportPNG}
    />
  {:else if currentScreen === 'overview' && activeProject}
    <FramesOverview
      bind:project={activeProject}
      onBackToEditor={() => {
        handleSaveActiveProject();
        currentScreen = 'editor';
      }}
    />
  {:else if currentScreen === 'slicer'}
    <Slicer
      {activeProject}
      onBackToEditor={() => (currentScreen = activeProject ? 'editor' : 'dashboard')}
      onUploadSheet={handleUploadSlicerSheet}
      onLoadSampleSheet={GenerateSampleSpriteSheet}
      onApplySlices={handleApplySlices}
      onPackFramesToSheet={PackFramesToSheet}
    />
  {:else if currentScreen === 'text-to-pixel'}
    <TextToPixel
      {activeProject}
      onBack={() => (currentScreen = activeProject ? 'editor' : 'dashboard')}
      onCreateProjectFromFrame={handleCreateProjectFromFrame}
      onInsertFrameToProject={handleInsertFrameToProject}
    />
  {/if}
</main>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    background-color: #09090b;
    user-select: none;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  }

  :global(*) {
    box-sizing: border-box;
  }

  :global(.scrollable-y) {
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: #3f3f46 transparent;
  }

  :global(.scrollable-x) {
    overflow-x: auto;
    scrollbar-width: thin;
    scrollbar-color: #3f3f46 transparent;
  }

  :global(.truncate) {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
