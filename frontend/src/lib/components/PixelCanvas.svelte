<script lang="ts">
  import { onMount } from 'svelte';
  import type { PixelFrame, Color, Tool } from '../types';

  export let frame: PixelFrame;
  export let previousFrame: PixelFrame | null = null;
  export let onionSkinEnabled: boolean = true;
  export let zoom: number = 1.0;
  export let tool: Tool = 'pencil';
  export let currentColor: Color = { r: 0.1, g: 0.6, b: 0.9, a: 1.0 };
  export let onDraw: (x: number, y: number) => void;
  export let onZoomChange: (deltaY: number) => void;

  let canvas: HTMLCanvasElement;
  let isDragging = false;

  $: if (canvas && frame) {
    drawCanvas();
  }

  function getCoords(e: MouseEvent): { x: number; y: number } | null {
    const rect = canvas.getBoundingClientRect();
    const cellW = rect.width / frame.width;
    const cellH = rect.height / frame.height;

    const relX = e.clientX - rect.left;
    const relY = e.clientY - rect.top;

    const x = Math.floor(relX / cellW);
    const y = Math.floor(relY / cellH);

    if (x >= 0 && x < frame.width && y >= 0 && y < frame.height) {
      return { x, y };
    }
    return null;
  }

  function handleMouseDown(e: MouseEvent) {
    if (e.button !== 0) return;
    isDragging = true;
    const coords = getCoords(e);
    if (coords) onDraw(coords.x, coords.y);
  }

  function handleMouseMove(e: MouseEvent) {
    if (!isDragging) return;
    const coords = getCoords(e);
    if (coords) onDraw(coords.x, coords.y);
  }

  function handleMouseUp() {
    isDragging = false;
  }

  function handleWheel(e: WheelEvent) {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      onZoomChange(e.deltaY < 0 ? 0.15 : -0.15);
    }
  }

  function drawCanvas() {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const cellW = canvas.width / frame.width;
    const cellH = canvas.height / frame.height;

    // Checkerboard
    for (let y = 0; y < frame.height; y++) {
      for (let x = 0; x < frame.width; x++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? '#27272a' : '#3f3f46';
        ctx.fillRect(x * cellW, y * cellH, cellW, cellH);
      }
    }

    // Onion Skinning
    if (onionSkinEnabled && previousFrame) {
      for (let y = 0; y < previousFrame.height; y++) {
        for (let x = 0; x < previousFrame.width; x++) {
          const px = previousFrame.pixels[y * previousFrame.width + x];
          if (px) {
            ctx.fillStyle = `rgba(${px.r * 255}, ${px.g * 255}, ${px.b * 255}, 0.35)`;
            ctx.fillRect(x * cellW, y * cellH, cellW, cellH);
          }
        }
      }
    }

    // Pixels & Grid Outlines
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.lineWidth = 1;

    for (let y = 0; y < frame.height; y++) {
      for (let x = 0; x < frame.width; x++) {
        const px = frame.pixels[y * frame.width + x];
        if (px) {
          ctx.fillStyle = `rgba(${px.r * 255}, ${px.g * 255}, ${px.b * 255}, ${px.a})`;
          ctx.fillRect(x * cellW, y * cellH, cellW, cellH);
        }
        ctx.strokeRect(x * cellW, y * cellH, cellW, cellH);
      }
    }
  }

  onMount(() => {
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  });
</script>

<div class="canvas-wrapper">
  <canvas
    bind:this={canvas}
    width={420 * zoom}
    height={420 * zoom}
    on:mousedown={handleMouseDown}
    on:mousemove={handleMouseMove}
    on:wheel={handleWheel}
  ></canvas>
</div>

<style>
  .canvas-wrapper {
    container-type: inline-size;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    min-width: 0;
    min-height: 0;
  }

  canvas {
    max-inline-size: 100%;
    max-block-size: 100%;
    aspect-ratio: 1 / 1;
    cursor: crosshair;
    image-rendering: pixelated;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
    border-radius: 6px;
  }
</style>
