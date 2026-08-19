<script lang="ts">
  import type { PixelFrame } from '../types';

  export let frame: PixelFrame;
  export let width: number = 128;
  export let height: number = 128;

  let canvas: HTMLCanvasElement;

  $: if (canvas && frame) {
    draw();
  }

  function draw() {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const cellW = canvas.width / frame.width;
    const cellH = canvas.height / frame.height;

    for (let y = 0; y < frame.height; y++) {
      for (let x = 0; x < frame.width; x++) {
        const px = frame.pixels[y * frame.width + x];
        if (px) {
          ctx.fillStyle = `rgba(${px.r * 255}, ${px.g * 255}, ${px.b * 255}, ${px.a})`;
          ctx.fillRect(x * cellW, y * cellH, cellW, cellH);
        }
      }
    }
  }
</script>

<canvas
  bind:this={canvas}
  {width}
  {height}
  style="border: 1px solid #444; background: #222; image-rendering: pixelated;"
></canvas>
