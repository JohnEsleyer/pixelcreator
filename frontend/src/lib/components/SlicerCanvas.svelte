<script lang="ts">
  import { onMount } from 'svelte';
  import { slicerStore, currentSelections } from '../stores/slicerStore';

  let canvas: HTMLCanvasElement;
  let isDragging = false;
  let dragStart: { x: number; y: number } | null = null;
  let dragCurrent: { x: number; y: number } | null = null;

  $: model = $slicerStore;
  $: selections = $currentSelections;
  $: sourceFrame = model.sourceFrame;

  $: if (canvas && sourceFrame && selections) {
    draw();
  }

  function getCoords(e: MouseEvent): { x: number; y: number } | null {
    if (!sourceFrame) return null;
    const rect = canvas.getBoundingClientRect();
    const cellW = rect.width / sourceFrame.width;
    const cellH = rect.height / sourceFrame.height;

    const relX = e.clientX - rect.left;
    const relY = e.clientY - rect.top;

    const x = Math.floor(relX / cellW);
    const y = Math.floor(relY / cellH);

    if (x >= 0 && x < sourceFrame.width && y >= 0 && y < sourceFrame.height) {
      return { x, y };
    }
    return null;
  }

  function handleMouseDown(e: MouseEvent) {
    if (e.button !== 0 || !sourceFrame) return;
    const coords = getCoords(e);
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
        isDragging = true;
        dragStart = coords;
        dragCurrent = coords;
      }
    }
  }

  function handleMouseMove(e: MouseEvent) {
    if (!isDragging || model.mode === 'grid') return;
    const coords = getCoords(e);
    if (coords) {
      dragCurrent = coords;
      draw();
    }
  }

  function handleMouseUp() {
    if (model.mode === 'manual' && isDragging && dragStart && dragCurrent) {
      const minX = Math.min(dragStart.x, dragCurrent.x);
      const maxX = Math.max(dragStart.x, dragCurrent.x);
      const minY = Math.min(dragStart.y, dragCurrent.y);
      const maxY = Math.max(dragStart.y, dragCurrent.y);

      const w = maxX - minX + 1;
      const h = maxY - minY + 1;

      if (w >= 2 && h >= 2) {
        slicerStore.dispatch({ type: 'CREATE_MANUAL_BOX', x: minX, y: minY, w, h });
      }
    }

    isDragging = false;
    dragStart = null;
    dragCurrent = null;
    draw();
  }

  function handleWheel(e: WheelEvent) {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      slicerStore.dispatch({ type: 'SET_ZOOM', delta: e.deltaY < 0 ? 0.15 : -0.15 });
    }
  }

  function draw() {
    if (!sourceFrame) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const cellW = canvas.width / sourceFrame.width;
    const cellH = canvas.height / sourceFrame.height;

    // Background sheet pixels
    for (let y = 0; y < sourceFrame.height; y++) {
      for (let x = 0; x < sourceFrame.width; x++) {
        const px = sourceFrame.pixels[y * sourceFrame.width + x];
        if (px) {
          ctx.fillStyle = `rgba(${px.r * 255}, ${px.g * 255}, ${px.b * 255}, ${px.a})`;
          ctx.fillRect(x * cellW, y * cellH, cellW, cellH);
        }
      }
    }

    // Selections / Grid Overlay
    selections.forEach((sel, idx) => {
      if (sel.enabled === false) return;

      const group = model.groups.find((g) => g.name === sel.groupName);
      const color = group ? group.color : '#e63946';

      const xPx = sel.x * cellW;
      const yPx = sel.y * cellH;
      const wPx = sel.width * cellW;
      const hPx = sel.height * cellH;

      const isActive = sel.id === model.manualActiveId;

      ctx.fillStyle = color + (isActive ? '55' : '22');
      ctx.fillRect(xPx, yPx, wPx, hPx);

      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.strokeRect(xPx, yPx, wPx, hPx);

      ctx.strokeStyle = color;
      ctx.lineWidth = isActive ? 2.5 : 1.5;
      ctx.strokeRect(xPx, yPx, wPx, hPx);

      ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.fillRect(xPx, yPx, 70, 14);
      ctx.fillStyle = '#ffffff';
      ctx.font = '9px monospace';
      ctx.fillText(`#${idx + 1} ${sel.groupName}`, xPx + 2, yPx + 10);
    });

    // Active Drag Box
    if (model.mode === 'manual' && isDragging && dragStart && dragCurrent) {
      const activeGroup = model.groups[model.activeGroupIdx] || model.groups[0];
      const minX = Math.min(dragStart.x, dragCurrent.x);
      const maxX = Math.max(dragStart.x, dragCurrent.x);
      const minY = Math.min(dragStart.y, dragCurrent.y);
      const maxY = Math.max(dragStart.y, dragCurrent.y);

      const w = maxX - minX + 1;
      const h = maxY - minY + 1;

      const xPx = minX * cellW;
      const yPx = minY * cellH;
      const wPx = w * cellW;
      const hPx = h * cellH;

      ctx.fillStyle = activeGroup.color + '44';
      ctx.fillRect(xPx, yPx, wPx, hPx);

      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      ctx.strokeRect(xPx, yPx, wPx, hPx);

      ctx.strokeStyle = activeGroup.color;
      ctx.lineWidth = 2;
      ctx.strokeRect(xPx, yPx, wPx, hPx);

      const label = `${w}x${h} px`;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
      ctx.fillRect(xPx, yPx - 18, 60, 16);
      ctx.fillStyle = '#ffffff';
      ctx.font = '10px sans-serif';
      ctx.fillText(label, xPx + 3, yPx - 6);
    }
  }

  onMount(() => {
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  });
</script>

{#if sourceFrame}
  <canvas
    bind:this={canvas}
    width={440 * model.zoom}
    height={440 * model.zoom}
    style="width: 440px; height: 440px; background: #1a1a1e; border: 1px solid #333; cursor: crosshair; image-rendering: pixelated;"
    on:mousedown={handleMouseDown}
    on:mousemove={handleMouseMove}
    on:wheel={handleWheel}
  ></canvas>
{/if}
