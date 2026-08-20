<script lang="ts">
  import { onMount } from 'svelte';
  import type { PixelFrame, Color, Tool } from '../types';

  export let frame: PixelFrame;
  export let previousFrame: PixelFrame | null = null;
  export let onionSkinEnabled: boolean = true;
  export let zoom: number = 1.0;
  export let tool: Tool = 'pencil';
  export let currentColor: Color = { r: 0.1, g: 0.6, b: 0.9, a: 1.0 };

  export let onDrawStart: () => void = () => {};
  export let onDraw: (x: number, y: number) => void;
  export let onSampleColor: (color: Color) => void = () => {};
  export let onZoomChange: (deltaY: number) => void;
  export let onCommitPixels: (pixels: (Color | null)[]) => void = () => {};

  let canvas: HTMLCanvasElement;
  let isDragging = false;

  let selectionMask: boolean[] = [];
  let lassoPoints: { x: number; y: number }[] = [];
  let isSelecting = false;
  let selectStart: { x: number; y: number } | null = null;
  let selectEnd: { x: number; y: number } | null = null;

  let isMovingSelection = false;
  let moveStart: { x: number; y: number } | null = null;
  let moveOffset = { dx: 0, dy: 0 };
  let originalFloatingPixels: (Color | null)[] = [];

  $: if (frame && selectionMask.length !== frame.width * frame.height) {
    clearSelection();
  }

  $: if (canvas && frame) {
    // Depend on zoom, previousFrame, and onionSkinEnabled to trigger immediate redraw
    zoom;
    previousFrame;
    onionSkinEnabled;
    requestAnimationFrame(() => drawCanvas());
  }

  function clearSelection() {
    selectionMask = new Array(frame.width * frame.height).fill(false);
    lassoPoints = [];
    selectStart = null;
    selectEnd = null;
    isMovingSelection = false;
    moveOffset = { dx: 0, dy: 0 };
    originalFloatingPixels = [];
  }

  function getCoords(e: MouseEvent): { x: number; y: number } | null {
    if (!canvas || !frame) return null;
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

  function isPointInLassoPolygon(px: number, py: number, points: { x: number; y: number }[]): boolean {
    if (points.length < 3) return false;
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const xi = points[i].x, yi = points[i].y;
      const xj = points[j].x, yj = points[j].y;
      const intersect = ((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi + 0.0001) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  function commitSelectionMovement() {
    if (!isMovingSelection || (moveOffset.dx === 0 && moveOffset.dy === 0)) {
      clearSelection();
      return;
    }

    onDrawStart();
    const newPixels = [...frame.pixels];
    const W = frame.width;
    const H = frame.height;

    for (let idx = 0; idx < selectionMask.length; idx++) {
      if (selectionMask[idx]) {
        newPixels[idx] = null;
      }
    }

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const idx = y * W + x;
        if (selectionMask[idx]) {
          const px = originalFloatingPixels[idx];
          const nx = x + moveOffset.dx;
          const ny = y + moveOffset.dy;
          if (nx >= 0 && nx < W && ny >= 0 && ny < H) {
            newPixels[ny * W + nx] = px;
          }
        }
      }
    }

    onCommitPixels(newPixels);
    clearSelection();
  }

  function handleMouseDown(e: MouseEvent) {
    if (e.button !== 0) return;
    const coords = getCoords(e);
    if (!coords) return;

    const W = frame.width;
    const idx = coords.y * W + coords.x;

    if (tool === 'eyedropper') {
      const px = frame.pixels[idx];
      if (px) {
        onSampleColor(px);
      }
      return;
    }

    if (selectionMask[idx] && selectionMask.some((v) => v)) {
      if (!isMovingSelection) {
        isMovingSelection = true;
        originalFloatingPixels = [...frame.pixels];
      }
      moveStart = coords;
      return;
    }

    if (selectionMask.some((v) => v)) {
      commitSelectionMovement();
    }

    onDrawStart();

    if (tool === 'select') {
      isSelecting = true;
      selectStart = coords;
      selectEnd = coords;
      selectionMask = new Array(frame.width * frame.height).fill(false);
    } else if (tool === 'lasso') {
      isSelecting = true;
      lassoPoints = [coords];
      selectionMask = new Array(frame.width * frame.height).fill(false);
    } else {
      isDragging = true;
      onDraw(coords.x, coords.y);
    }
  }

  function handleMouseMove(e: MouseEvent) {
    const coords = getCoords(e);
    if (!coords) return;

    if (isMovingSelection && moveStart) {
      moveOffset = {
        dx: coords.x - moveStart.x,
        dy: coords.y - moveStart.y
      };
      drawCanvas();
      return;
    }

    if (isSelecting) {
      if (tool === 'select') {
        selectEnd = coords;
      } else if (tool === 'lasso') {
        if (!lassoPoints.some((p) => p.x === coords.x && p.y === coords.y)) {
          lassoPoints.push(coords);
        }
      }
      drawCanvas();
      return;
    }

    if (isDragging && (tool === 'pencil' || tool === 'eraser')) {
      onDraw(coords.x, coords.y);
    }
  }

  function handleMouseUp() {
    if (isMovingSelection) {
      drawCanvas();
      return;
    }

    if (isSelecting) {
      isSelecting = false;
      const W = frame.width;
      const H = frame.height;

      if (tool === 'select' && selectStart && selectEnd) {
        const minX = Math.min(selectStart.x, selectEnd.x);
        const maxX = Math.max(selectStart.x, selectEnd.x);
        const minY = Math.min(selectStart.y, selectEnd.y);
        const maxY = Math.max(selectStart.y, selectEnd.y);

        for (let y = minY; y <= maxY; y++) {
          for (let x = minX; x <= maxX; x++) {
            selectionMask[y * W + x] = true;
          }
        }
      } else if (tool === 'lasso' && lassoPoints.length >= 3) {
        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            if (isPointInLassoPolygon(x, y, lassoPoints)) {
              selectionMask[y * W + x] = true;
            }
          }
        }
      }
      drawCanvas();
    }

    isDragging = false;
  }

  function handleWheel(e: WheelEvent) {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      onZoomChange(e.deltaY < 0 ? 0.15 : -0.15);
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      commitSelectionMovement();
      clearSelection();
      drawCanvas();
    }
  }

  function drawCanvas() {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const cellW = canvas.width / frame.width;
    const cellH = canvas.height / frame.height;
    const W = frame.width;
    const H = frame.height;

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? '#27272a' : '#3f3f46';
        ctx.fillRect(x * cellW, y * cellH, cellW, cellH);
      }
    }

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

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const idx = y * W + x;
        let drawX = x;
        let drawY = y;

        if (selectionMask[idx] && isMovingSelection) {
          drawX = x + moveOffset.dx;
          drawY = y + moveOffset.dy;
        }

        const px = isMovingSelection && selectionMask[idx]
          ? originalFloatingPixels[idx]
          : (isMovingSelection && selectionMask[idx] ? null : frame.pixels[idx]);

        if (px) {
          ctx.fillStyle = `rgba(${px.r * 255}, ${px.g * 255}, ${px.b * 255}, ${px.a})`;
          ctx.fillRect(drawX * cellW, drawY * cellH, cellW, cellH);
        }
      }
    }

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.lineWidth = 1;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        ctx.strokeRect(x * cellW, y * cellH, cellW, cellH);
      }
    }

    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);

    if (isSelecting && tool === 'select' && selectStart && selectEnd) {
      const minX = Math.min(selectStart.x, selectEnd.x);
      const maxX = Math.max(selectStart.x, selectEnd.x);
      const minY = Math.min(selectStart.y, selectEnd.y);
      const maxY = Math.max(selectStart.y, selectEnd.y);

      ctx.strokeRect(minX * cellW, minY * cellH, (maxX - minX + 1) * cellW, (maxY - minY + 1) * cellH);
    } else if (isSelecting && tool === 'lasso' && lassoPoints.length > 1) {
      ctx.beginPath();
      ctx.moveTo((lassoPoints[0].x + 0.5) * cellW, (lassoPoints[0].y + 0.5) * cellH);
      for (let i = 1; i < lassoPoints.length; i++) {
        ctx.lineTo((lassoPoints[i].x + 0.5) * cellW, (lassoPoints[i].y + 0.5) * cellH);
      }
      ctx.closePath();
      ctx.stroke();
    } else if (selectionMask.some((v) => v)) {
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const idx = y * W + x;
          if (selectionMask[idx]) {
            const drawX = (x + (isMovingSelection ? moveOffset.dx : 0)) * cellW;
            const drawY = (y + (isMovingSelection ? moveOffset.dy : 0)) * cellH;
            ctx.fillStyle = 'rgba(2, 132, 199, 0.25)';
            ctx.fillRect(drawX, drawY, cellW, cellH);
            ctx.strokeRect(drawX, drawY, cellW, cellH);
          }
        }
      }
    }

    ctx.setLineDash([]);
  }

  onMount(() => {
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('keydown', handleKeyDown);
    };
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
