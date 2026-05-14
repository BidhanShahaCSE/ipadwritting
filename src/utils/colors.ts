export const COLORS = {
  black: '#000000',
  darkGray: '#636366',
  red: '#FF3B30',
  orange: '#FF9500',
  yellow: '#FFCC00',
  green: '#34C759',
  teal: '#5AC8FA',
  blue: '#007AFF',
  indigo: '#5856D6',
  purple: '#AF52DE',
  pink: '#FF2D55',
  white: '#FFFFFF',
} as const;

export const PEN_SIZES = [1, 2, 3, 5, 8, 12, 18, 24];
export const HIGHLIGHTER_SIZES = [12, 16, 20, 28, 36];
export const FONT_SIZES = [8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 42, 48, 56, 64, 72];
export const FONT_FAMILIES = [
  'Inter',
  'Arial',
  'Helvetica',
  'Georgia',
  'Times New Roman',
  'Courier New',
  'Verdana',
  'Trebuchet MS',
];

/** Convert hex to RGBA */
export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Convert HSB to hex */
export function hsbToHex(h: number, s: number, b: number): string {
  const hn = h / 360;
  const sn = s / 100;
  const bn = b / 100;

  let r: number, g: number, bl: number;
  const i = Math.floor(hn * 6);
  const f = hn * 6 - i;
  const p = bn * (1 - sn);
  const q = bn * (1 - f * sn);
  const t = bn * (1 - (1 - f) * sn);

  switch (i % 6) {
    case 0: r = bn; g = t; bl = p; break;
    case 1: r = q; g = bn; bl = p; break;
    case 2: r = p; g = bn; bl = t; break;
    case 3: r = p; g = q; bl = bn; break;
    case 4: r = t; g = p; bl = bn; break;
    case 5: r = bn; g = p; bl = q; break;
    default: r = 0; g = 0; bl = 0;
  }

  const toHex = (v: number) => {
    const hex = Math.round(v * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(bl)}`;
}

/** Convert hex to HSB */
export function hexToHsb(hex: string): { h: number; s: number; b: number } {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const bl = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, bl);
  const min = Math.min(r, g, bl);
  const d = max - min;

  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const b = max;

  if (d !== 0) {
    switch (max) {
      case r: h = ((g - bl) / d + (g < bl ? 6 : 0)) / 6; break;
      case g: h = ((bl - r) / d + 2) / 6; break;
      case bl: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return { h: Math.round(h * 360), s: Math.round(s * 100), b: Math.round(b * 100) };
}
