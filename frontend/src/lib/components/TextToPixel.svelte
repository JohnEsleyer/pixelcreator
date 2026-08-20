<script lang="ts">
  import { onMount } from 'svelte';
  import type { PixelFrame, Project } from '../types';
  import PreviewCanvas from './PreviewCanvas.svelte';
  import { parseTextMatrixToFrame, LLM_PROMPT_TEMPLATE } from '../utils/textToPixelParser';

  export let activeProject: Project | null;
  export let onBack: () => void;
  export let onCreateProjectFromFrame: (frame: PixelFrame, name: string) => void;
  export let onInsertFrameToProject: (frame: PixelFrame) => void;

  let inputText = `// Pixel Art Sprite Matrix
const _ = null;           // Transparent
const K = '#000000';     // Outline
const R1 = '#E53935';    // Red Base
const R2 = '#B71C1C';    // Red Shadow
const W = '#FFFFFF';     // White Highlight
const S1 = '#FFE0B2';    // Skin Base
const S2 = '#D7CCC8';    // Skin Shadow

const pixelData = [
  [_, _, _, _, _, K, K, K, K, K, K, _, _, _, _, _],
  [_, _, _, K, K, R1, R1, R1, R1, R2, R2, K, K, _, _, _],
  [_, _, K, R1, R1, W, W, R1, R1, W, W, R2, R2, K, _, _],
  [_, K, R1, R1, W, W, W, W, R1, W, W, W, R2, R2, K, _],
  [_, K, R1, R1, W, W, W, W, R1, W, W, W, R2, R2, K, _],
  [K, R1, R1, R1, R1, W, W, R1, R1, R1, W, W, R2, R2, R2, K],
  [K, R1, W, W, R1, R1, R1, R1, R1, R1, R1, R1, R2, W, W, K],
  [K, W, W, W, W, R1, R1, R1, R1, R1, R1, R2, W, W, W, K],
  [K, W, W, W, W, R1, R1, R1, R1, R1, R1, R2, W, W, W, K],
  [K, R2, W, W, R1, R1, K, K, K, K, R1, R1, R2, W, R2, K],
  [_, K, R2, R2, R1, K, S1, S1, S1, S1, K, R1, R2, R2, K, _],
  [_, _, K, K, K, S1, S1, S1, S1, S1, S2, K, K, K, _, _],
  [_, _, K, S1, S1, S1, K, S1, S1, K, S1, S2, S2, K, _, _],
  [_, _, K, S1, S1, S1, K, S1, S1, K, S1, S2, S2, K, _, _],
  [_, _, K, S1, S1, S1, S1, S1, S1, S1, S2, S2, S2, K, _, _],
  [_, _, _, K, K, K, K, K, K, K, K, K, K, _, _, _]
];`;

  let spriteName = 'AI Sprite';
  let previewFrame: PixelFrame | null = null;
  let errorMessage = '';
  let copiedPrompt = false;

  $: if (inputText) {
    parseInput();
  }

  function parseInput() {
    try {
      errorMessage = '';
      previewFrame = parseTextMatrixToFrame(inputText, `frame-ai-${Date.now()}`);
    } catch (e: any) {
      errorMessage = e.message || 'Error parsing matrix';
      previewFrame = null;
    }
  }

  function copyPromptToClipboard() {
    navigator.clipboard.writeText(LLM_PROMPT_TEMPLATE);
    copiedPrompt = true;
    setTimeout(() => (copiedPrompt = false), 2500);
  }

  function handleCreateNewProject() {
    if (!previewFrame) return;
    onCreateProjectFromFrame(previewFrame, spriteName);
  }

  function handleAddToCurrent() {
    if (!previewFrame || !activeProject) return;
    onInsertFrameToProject(previewFrame);
  }

  onMount(() => {
    parseInput();
  });
</script>

<div class="ttp-shell">
  <header class="ttp-header">
    <div class="header-left">
      <button class="btn" on:click={onBack}>← Back</button>
      <h2>✨ Text to Pixel Studio</h2>
      <span class="badge">LLM Sprite Engine</span>
    </div>

    <div class="header-right">
      <button class="btn highlight" on:click={copyPromptToClipboard}>
        {copiedPrompt ? '✅ LLM Prompt Copied!' : '📋 Copy LLM Prompt Template'}
      </button>
    </div>
  </header>

  <div class="ttp-body">
    <!-- Left: Code / Matrix Editor -->
    <div class="panel code-panel">
      <div class="panel-header">
        <h3>Paste Text / Matrix</h3>
        <small>Supports color legends, numbered shades (R1, R2, B1), hex codes & arrays</small>
      </div>

      <textarea
        class="code-editor scrollable-y"
        bind:value={inputText}
        placeholder="Paste your 2D pixel array or HTML/JS pixel art matrix..."
      ></textarea>

      {#if errorMessage}
        <div class="error-banner">⚠️ {errorMessage}</div>
      {/if}
    </div>

    <!-- Right: Live Preview & Project Actions -->
    <div class="panel preview-panel">
      <h3>Live Preview</h3>

      {#if previewFrame}
        <div class="preview-center">
          <div class="preview-box">
            <PreviewCanvas frame={previewFrame} width={256} height={256} />
          </div>
          <div class="dim-badge">{previewFrame.width} x {previewFrame.height} px</div>
        </div>

        <div class="actions-group">
          <label class="field-label">
            Sprite Name:
            <input type="text" bind:value={spriteName} />
          </label>

          <button class="btn primary full-width" on:click={handleCreateNewProject}>
            🚀 Create as New Project ({previewFrame.width}x{previewFrame.height})
          </button>

          {#if activeProject}
            <button class="btn secondary full-width" on:click={handleAddToCurrent}>
              ➕ Append Frame to Current Project ({activeProject.name})
            </button>
          {/if}
        </div>
      {:else}
        <div class="empty-state">
          <p>No valid matrix parsed yet.</p>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .ttp-shell {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background: #09090b;
    color: #eee;
    overflow: hidden;
  }

  .ttp-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 20px;
    background: #18181b;
    border-bottom: 1px solid #27272a;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .badge {
    background: #0369a1;
    color: #e0f2fe;
    font-size: 0.75rem;
    padding: 3px 8px;
    border-radius: 12px;
  }

  .highlight {
    background: #0284c7 !important;
    font-weight: 600;
  }

  .ttp-body {
    display: grid;
    grid-template-columns: 1fr 380px;
    gap: 16px;
    padding: 16px;
    flex: 1;
    min-height: 0;
  }

  .panel {
    background: #18181b;
    border: 1px solid #27272a;
    border-radius: 8px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-height: 0;
  }

  .panel-header {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .code-editor {
    flex: 1;
    background: #09090b;
    border: 1px solid #27272a;
    color: #38bdf8;
    font-family: 'Fira Code', monospace;
    font-size: 0.85rem;
    padding: 12px;
    border-radius: 6px;
    resize: none;
    line-height: 1.4;
    white-space: pre;
  }

  .preview-panel {
    align-items: center;
    justify-content: space-between;
  }

  .preview-center {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    margin: auto 0;
  }

  .preview-box {
    background: #09090b;
    padding: 12px;
    border-radius: 8px;
    border: 1px solid #27272a;
  }

  .dim-badge {
    font-size: 0.8rem;
    color: #888;
  }

  .actions-group {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .field-label {
    display: flex;
    flex-direction: column;
    font-size: 0.85rem;
    gap: 4px;
  }

  .error-banner {
    background: #450a0a;
    border: 1px solid #dc2626;
    color: #fca5a5;
    padding: 8px 12px;
    border-radius: 4px;
    font-size: 0.85rem;
  }

  .empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1;
    color: #666;
  }

  .btn {
    padding: 8px 14px;
    background: #27272a;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.85rem;
  }

  .btn:hover {
    background: #3f3f46;
  }

  .btn.primary {
    background: #10b981;
    font-weight: 600;
  }

  .btn.secondary {
    background: #0284c7;
    font-weight: 600;
  }

  .full-width {
    width: 100%;
  }

  input[type='text'] {
    padding: 8px;
    background: #09090b;
    border: 1px solid #27272a;
    color: white;
    border-radius: 4px;
  }
</style>