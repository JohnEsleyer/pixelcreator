<script lang="ts">
  import { onMount } from 'svelte';
  import type { Project, Screen, PixelFrame, Group, WorldScene } from './lib/types';
  import Dashboard from './lib/components/Dashboard.svelte';
  import Editor from './lib/components/Editor.svelte';
  import FramesOverview from './lib/components/FramesOverview.svelte';
  import Slicer from './lib/components/Slicer.svelte';
  import WorldComposer from './lib/components/WorldComposer.svelte';
  import { slicerStore } from './lib/stores/slicerStore';

  import {
    GetProjects,
    CreateProject,
    DeleteProject,
    SaveProject,
    ImportImageAsProject,
    ImportImageToFrame,
    ExportFrameAsPNG,
    LoadSpriteSheet,
    GenerateSampleSpriteSheet,
    PackFramesToSheet,
    GetWorldScene,
    SaveWorldScene,
    GenerateWorldJSON,
    GenerateWorldRON,
    ExportWorldToFile
  } from '../wailsjs/go/main/App';

  let currentScreen: Screen = 'dashboard';
  let projects: Project[] = [];
  let activeProject: Project | null = null;
  let worldScene: WorldScene = {
    id: 'world-default',
    name: 'Prototype World',
    width: 960,
    height: 540,
    bgColor: '#18181b',
    entities: []
  };

  async function loadInitialData() {
    projects = await GetProjects();
    worldScene = await GetWorldScene();
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
      onOpenWorldComposer={() => (currentScreen = 'composer')}
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
  {:else if currentScreen === 'composer'}
    <WorldComposer
      bind:scene={worldScene}
      {projects}
      onBackToDashboard={() => (currentScreen = 'dashboard')}
      onEditProject={(projId) => {
        activeProject = projects.find((p) => p.id === projId) || null;
        if (activeProject) {
          currentScreen = 'editor';
        }
      }}
      onSaveScene={SaveWorldScene}
      onGenerateJSON={GenerateWorldJSON}
      onGenerateRON={GenerateWorldRON}
      onExportToFile={ExportWorldToFile}
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
</style>
