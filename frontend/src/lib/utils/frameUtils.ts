import type { PixelFrame, SpriteSelection, Color } from '../types';

export function extractSubFrame(
  source: PixelFrame,
  sel: SpriteSelection,
  removeWhiteBg: boolean
): PixelFrame {
  const result: PixelFrame = {
    id: `frame-slice-${Date.now()}-${sel.id}`,
    width: sel.width,
    height: sel.height,
    pixels: new Array(sel.width * sel.height).fill(null),
    groupId: '',
    tag: sel.groupName
  };

  const isBackground = (c: Color | null): boolean => {
    if (!c || c.a < 0.05) return true;
    if (removeWhiteBg && c.r > 0.92 && c.g > 0.92 && c.b > 0.92) return true;
    return false;
  };

  for (let y = 0; y < sel.height; y++) {
    for (let x = 0; x < sel.width; x++) {
      const srcX = sel.x + x;
      const srcY = sel.y + y;

      if (srcX >= 0 && srcX < source.width && srcY >= 0 && srcY < source.height) {
        const px = source.pixels[srcY * source.width + srcX];
        if (!isBackground(px)) {
          result.pixels[y * sel.width + x] = px;
        }
      }
    }
  }

  return result;
}
