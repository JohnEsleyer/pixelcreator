<script lang="ts">
  import { onMount } from 'svelte';
  import type { Project, Screen, PixelFrame } from './lib/types';
  import Dashboard from './lib/components/Dashboard.svelte';
  import Editor from './lib/components/Editor.svelte';
  import FramesOverview from './lib/components/FramesOverview.svelte';
  import Slicer from './lib/components/Slicer.svelte';
  import { slicerStore } from './lib/stores/slicerStore';

  import {
    GetProjects,
    CreateProject,
    DeleteProject,
    ImportImageAsProject,
    ImportImageToFrame,
    ExportFrameAsPNG,
    LoadSpriteSheet,
    GenerateSampleSpriteSheet,
    PackFramesToSheet
  } from '../wailsjs/go/main/App';

  let currentScreen: Screen = 'dashboard';
  let projects: Project[] = [];
  let activeProject: Project | null = null;

  async function loadProjects() {
    projects = await GetProjects();
  }

  async function handleCreateProject(name: string, size: number) {
    const proj = await CreateProject(name, size);
    await loadProjects();
    activeProject = proj;
    currentScreen = 'editor';
  }

  async function handleDeleteProject(id: number) {
    await DeleteProject(id);
    await loadProjects();
    if (activeProject?.id === id) activeProject = null;
  }

  async function handleImportImageProject() {
    try {
      const proj = await ImportImageAsProject();
      if (proj) {
        await loadProjects();
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

  // --- SLICE APPLICATION HANDLER ---
  function handleApplySlices(slices: PixelFrame[], replace: boolean) {
    if (!slices.length) return;

    // 1. Collect unique groups from extracted slice frames
    const groupNames = Array.from(new Set(slices.map((s) => s.tag || 'Main')));
    const palette = ['#e63946', '#2a9d8f', '#457b9d', '#e76f51', '#9c27b0', '#00bcd4'];

    if (activeProject) {
      // Create missing Group Folders in Active Project
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

      // Map slice tag -> Group Folder ID
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
    loadProjects();
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
    />
  {:else if currentScreen === 'editor' && activeProject}
    <Editor
      bind:project={activeProject}
      onGoDashboard={() => (currentScreen = 'dashboard')}
      onOpenOverview={() => (currentScreen = 'overview')}
      onOpenSlicer={handleOpenEditorSlicer}
      onImportFrame={handleImportFrame}
      onExportPNG={handleExportPNG}
    />
  {:else if currentScreen === 'overview' && activeProject}
    <FramesOverview
      bind:project={activeProject}
      onBackToEditor={() => (currentScreen = 'editor')}
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
  {/if}
</main>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    background-color: #09090b;
    user-select: none;
  }
</style>
