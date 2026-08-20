<script lang="ts">
  import { onMount } from 'svelte';
  import { slicerStore, currentSelections } from '../stores/slicerStore';

  let containerEl: HTMLDivElement;
  let canvas: HTMLCanvasElement;

  let isPanning = false;
  let panStart = { x: 0, y: 0 };

  let isDraggingManualBox = false;
  let dragStart: { x: number; y: number } | null = null;
  let dragCurrent: { x: number; y: number } | null = null;

  $: model = $slicerStore;
  $: selections = $currentSelections;
  $: sourceFrame = model.sourceFrame;

  $: if (canvas && sourceFrame && selections) {
    draw();
  }

  function screenToImageCoords(e: MouseEvent): { x: number; y: number } | null {
    if (!sourceFrame || !canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const canvasX = clientX * scaleX;
    const canvasY = clientY * scaleY;

    const baseCellSize = Math.min(canvas.width / sourceFrame.width, canvas.height / sourceFrame.height);
    const effectiveScale = baseCellSize * model.zoom;

    const imgX = Math.floor((canvasX - model.panX) / effectiveScale);
    const imgY = Math.floor((canvasY - model.panY) / effectiveScale);

    if (imgX >= 0 && imgX < sourceFrame.width && imgY >= 0 && imgY < sourceFrame.height) {
      return { x: imgX, y: imgY };
    }
    return null;
  }

  function handleMouseDown(e: MouseEvent) {
    if (!sourceFrame) return;

    if (e.button === 1 || e.button === 2 || e.shiftKey) {
      e.preventDefault();
      isPanning = true;
      panStart = { x: e.clientX - model.panX, y: e.clientY - model.panY };
      return;
    }

    if (e.button !== 0) return;

    const coords = screenToImageCoords(e);
    if (!coords) return;

    if (model.mode === 'grid') {
      const clickedCell = selections.find(
        (sel) =>
          coords.x >= sel.x &&
          coords.x < sel.x + sel.width &&
          coords.y >= sel.y &&
          coords.y < sel.y + sel.height
      );

      if (clickedCell) {
        slicerStore.dispatch({ type: 'CLICK_GRID_CELL', id: clickedCell.id });
      }
    } else {
      let clickedId: number | null = null;
      for (let i = selections.length - 1; i >= 0; i--) {
        const sel = selections[i];
        if (
          coords.x >= sel.x &&
          coords.x < sel.x + sel.width &&
          coords.y >= sel.y &&
          coords.y < sel.y + sel.height
        ) {
          clickedId = sel.id;
          break;
        }
      }

      if (clickedId !== null) {
        slicerStore.dispatch({ type: 'SELECT_BOX', id: clickedId });
      } else {
        isDraggingManualBox = true;
        dragStart = coords;
        dragCurrent = coords;
      }
    }
  }

  function handleMouseMove(e: MouseEvent) {
    if (isPanning) {
      const newPanX = e.clientX - panStart.x;
      const newPanY = e.clientY - panStart.y;
      slicerStore.dispatch({ type: 'SET_PAN', panX: newPanX, panY: newPanY });
      return;
    }

    if (isDraggingManualBox && model.mode === 'manual') {
      const coords = screenToImageCoords(e);
      if (coords) {
        dragCurrent = coords;
        draw();
      }
    }
  }

  function handleMouseUp() {
    if (isPanning) {
      isPanning = false;
      return;
    }

    if (model.mode === 'manual' && isDraggingManualBox && dragStart && dragCurrent) {
      const minX = Math.min(dragStart.x, dragCurrent.x);
      const maxX = Math.max(dragStart.x, dragCurrent.x);
      const minY = Math.min(dragStart.y, dragCurrent.y);
      const maxY = Math.max(dragStart.y, dragCurrent.y);

      const w = maxX - minX + 1;
      const h = maxY - minY + 1;

      if (w >= 1 && h >= 1) {
        slicerStore.dispatch({ type: 'CREATE_MANUAL_BOX', x: minX, y: minY, w, h });
      }
    }

    isDraggingManualBox = false;
    dragStart = null;
    dragCurrent = null;
    draw();
  }

  function handleWheel(e: WheelEvent) {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.15 : -0.15;
    slicerStore.dispatch({ type: 'SET_ZOOM', delta });
  }

  function draw() {
    if (!sourceFrame || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const W = sourceFrame.width;
    const H = sourceFrame.height;

    const baseCellSize = Math.min(canvas.width / W, canvas.height / H);
    const scale = baseCellSize * model.zoom;

    ctx.translate(model.panX, model.panY);

    ctx.fillStyle = '#1e1e24';
    ctx.fillRect(0, 0, W * scale, H * scale);

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const px = sourceFrame.pixels[y * W + x];
        if (px) {
          ctx.fillStyle = `rgba(${px.r * 255}, ${px.g * 255}, ${px.b * 255}, ${px.a})`;
          ctx.fillRect(x * scale, y * scale, scale, scale);
        }
      }
    }

    selections.forEach((sel, idx) => {
      const group = model.groups.find((g) => g.name === sel.groupName);
      const groupColor = group ? group.color : '#e63946';

      const xPx = sel.x * scale;
      const yPx = sel.y * scale;
      const wPx = sel.width * scale;
      const hPx = sel.height * scale;

      const isActive = sel.id === model.manualActiveId;
      const isDisabled = !sel.enabled;

      if (isDisabled) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
        ctx.fillRect(xPx, yPx, wPx, hPx);

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1;
        ctx.strokeRect(xPx, yPx, wPx, hPx);

        ctx.beginPath();
        ctx.moveTo(xPx, yPx);
        ctx.lineTo(xPx + wPx, yPx + hPx);
        ctx.moveTo(xPx + wPx, yPx);
        ctx.lineTo(xPx, yPx + hPx);
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
        ctx.stroke();

        ctx.fillStyle = 'rgba(239, 68, 68, 0.85)';
        ctx.font = '10px sans-serif';
        ctx.fillText('UNASSIGNED', xPx + 4, yPx + 14);
      } else {
        ctx.fillStyle = groupColor + (isActive ? '55' : '25');
        ctx.fillRect(xPx, yPx, wPx, hPx);

        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.strokeRect(xPx, yPx, wPx, hPx);

        ctx.strokeStyle = groupColor;
        ctx.lineWidth = isActive ? 3 : 1.5;
        ctx.strokeRect(xPx, yPx, wPx, hPx);

        const label = `#${idx + 1} ${sel.groupName}`;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.fillRect(xPx, yPx, Math.max(60, label.length * 6.5), 14);
        ctx.fillStyle = '#ffffff';
        ctx.font = '10px monospace';
        ctx.fillText(label, xPx + 3, yPx + 10);
      }
    });

    if (model.mode === 'manual' && isDraggingManualBox && dragStart && dragCurrent) {
      const activeGroup = model.groups[model.activeGroupIdx] || model.groups[0];
      const minX = Math.min(dragStart.x, dragCurrent.x);
      const maxX = Math.max(dragStart.x, dragCurrent.x);
      const minY = Math.min(dragStart.y, dragCurrent.y);
      const maxY = Math.max(dragStart.y, dragCurrent.y);

      const w = maxX - minX + 1;
      const h = maxY - minY + 1;

      const xPx = minX * scale;
      const yPx = minY * scale;
      const wPx = w * scale;
      const hPx = h * scale;

      ctx.fillStyle = activeGroup.color + '44';
      ctx.fillRect(xPx, yPx, wPx, hPx);

      ctx.strokeStyle = activeGroup.color;
      ctx.lineWidth = 2;
      ctx.strokeRect(xPx, yPx, wPx, hPx);

      const label = `${w}x${h} px`;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
      ctx.fillRect(xPx, yPx - 18, 65, 16);
      ctx.fillStyle = '#ffffff';
      ctx.font = '10px sans-serif';
      ctx.fillText(label, xPx + 4, yPx - 6);
    }

    ctx.restore();
  }

  onMount(() => {
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  });
</script>

<div class="slicer-canvas-wrapper" bind:this={containerEl}>
  {#if sourceFrame}
    <canvas
      bind:this={canvas}
      width={600}
      height={600}
      on:mousedown={handleMouseDown}
      on:mousemove={handleMouseMove}
      on:wheel={handleWheel}
      on:contextmenu|preventDefault
    ></canvas>
  {:else}
    <div class="empty-placeholder">No Sprite Sheet Loaded</div>
  {/if}
</div>

<style>
  .slicer-canvas-wrapper {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    overflow: hidden;
    background: #0f0f12;
    border-radius: 6px;
  }

  canvas {
    width: 100%;
    height: 100%;
    object-fit: contain;
    cursor: crosshair;
    image-rendering: pixelated;
  }

  .empty-placeholder {
    color: #666;
    font-size: 0.9rem;
  }
</style>
