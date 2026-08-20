import type { PixelFrame, Color } from '../types';

export function parseHexColor(hex: string): Color | null {
  hex = hex.replace('#', '').trim();
  if (hex.length === 3) {
    hex = hex.split('').map((c) => c + c).join('');
  }
  if (hex.length !== 6 && hex.length !== 8) return null;

  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;
  const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1.0;

  return { r, g, b, a };
}

export function parseTextMatrixToFrame(rawText: string, frameId = 'frame-text'): PixelFrame {
  const lines = rawText.split('\n');
  const paletteMap: Record<string, Color | null> = {
    _: null,
    null: null,
    '0': null,
    trans: null,
    transparent: null
  };

  // 1. Extract color definitions (e.g., const R = '#E53935' or R1 = #ff0000 or "R2": "#f00")
  const colorDefRegex = /(?:const|let|var)?\s*([a-zA-Z0-9_]+)\s*[:=]\s*['"]?([#a-zA-Z0-9]+|null)['"]?/gi;
  for (const line of lines) {
    let match;
    while ((match = colorDefRegex.exec(line)) !== null) {
      const token = match[1].trim();
      const val = match[2].trim();

      if (val === 'null' || val === '_') {
        paletteMap[token] = null;
      } else if (val.startsWith('#') || /^[0-9a-fA-F]{6}$/.test(val) || /^[0-9a-fA-F]{3}$/.test(val)) {
        paletteMap[token] = parseHexColor(val);
      }
    }
  }

  // 2. Extract 2D matrix from code or raw text
  // Match arrays of rows like [_, K, R, ...] or comma-separated tokens
  const rows: (string | null)[][] = [];
  const arrayRowRegex = /\[\s*([\w#_,\s'"]+)\s*\]/g;

  let textToParse = rawText;
  let rowMatch;

  while ((rowMatch = arrayRowRegex.exec(textToParse)) !== null) {
    const inner = rowMatch[1];
    // Split by comma
    const tokens = inner
      .split(',')
      .map((t) => t.trim().replace(/['"]/g, ''))
      .filter((t) => t.length > 0);

    if (tokens.length > 0) {
      rows.push(tokens);
    }
  }

  // Fallback: If no bracketed rows found, parse space/comma delimited lines
  if (rows.length === 0) {
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('<')) continue;
      const tokens = trimmed.split(/[\s,]+/).filter((t) => t.length > 0);
      if (tokens.length >= 2) {
        rows.push(tokens);
      }
    }
  }

  if (rows.length === 0) {
    throw new Error('No pixel matrix rows detected in input text.');
  }

  const height = rows.length;
  const width = Math.max(...rows.map((r) => r.length));
  const pixels: (Color | null)[] = new Array(width * height).fill(null);

  for (let y = 0; y < height; y++) {
    const row = rows[y];
    for (let x = 0; x < width; x++) {
      if (x < row.length) {
        const token = row[x];
        if (!token || token === '_' || token === 'null' || token === '0') {
          pixels[y * width + x] = null;
        } else if (paletteMap[token] !== undefined) {
          pixels[y * width + x] = paletteMap[token] ? { ...paletteMap[token]! } : null;
        } else if (token.startsWith('#') || /^[0-9a-fA-F]{6}$/.test(token)) {
          pixels[y * width + x] = parseHexColor(token);
        } else {
          // Dynamic fallback mapping for unknown tokens like R1, B2, etc.
          pixels[y * width + x] = null;
        }
      }
    }
  }

  return {
    id: frameId,
    width,
    height,
    pixels
  };
}

export const LLM_PROMPT_TEMPLATE = `You are a Pixel Art Generator for PixelCreator Studio.
When asked to draw a sprite, output a standalone matrix and color legend in standard JavaScript / 2D array format.

RULES:
1. Define a color palette legend first where:
   - _ = null (for transparent pixels)
   - K = '#000000' (outline or darks)
   - You can define custom shades with numbers, e.g. R1, R2, R3 for reds, S1, S2 for skin, etc.
2. Provide a 2D array named 'pixelData' representing the sprite pixel by pixel.
3. Keep the grid square and symmetric where appropriate (e.g. 16x16, 24x24, or 32x32).

EXAMPLE:
const _ = null;
const K = '#000000';
const R1 = '#E53935';
const R2 = '#B71C1C';
const W = '#FFFFFF';

const pixelData = [
  [_, _, K, K, K, K, _, _],
  [_, K, R1, R1, W, R2, K, _],
  [K, R1, W, W, R1, R2, R2, K],
  [K, R1, W, W, R1, R2, R2, K],
  [K, R1, R1, R1, R1, R2, R2, K],
  [K, R2, R2, R2, R2, R2, R2, K],
  [_, K, K, K, K, K, K, _],
  [_, _, K, _, _, K, _, _]
];
`;