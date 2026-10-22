export type Rgb = { r: number; g: number; b: number };

type Oklch = { l: number; c: number; h: number };

export function parseOklch(s: string): Oklch {
  const m = s.trim().match(/^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)(?:deg)?\s*\)$/i);
  if (!m) throw new Error(`Not an oklch() color: ${s}`);
  const l = m[2] ? parseFloat(m[1]) / 100 : parseFloat(m[1]);
  return { l, c: parseFloat(m[3]), h: parseFloat(m[4]) };
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

function encode(linear: number): number {
  const v = clamp01(linear);
  return v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
}

function decode(channel: number): number {
  return channel <= 0.04045 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
}

/** OKLCH to gamut-clamped sRGB, channels 0..1. */
export function oklchToSrgb({ l, c, h }: Oklch): Rgb {
  const hr = (h * Math.PI) / 180;
  const a = c * Math.cos(hr);
  const b = c * Math.sin(hr);
  const l_ = Math.pow(l + 0.3963377774 * a + 0.2158037573 * b, 3);
  const m_ = Math.pow(l - 0.1055613458 * a - 0.0638541728 * b, 3);
  const s_ = Math.pow(l - 0.0894841775 * a - 1.291485548 * b, 3);
  return {
    r: encode(4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_),
    g: encode(-1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_),
    b: encode(-0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_),
  };
}

/** "#rgb" or "#rrggbb" to sRGB, channels 0..1. */
export function parseHex(s: string): Rgb {
  let h = s.trim().replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((ch) => ch + ch).join("");
  if (!/^[0-9a-f]{6}$/i.test(h)) throw new Error(`Not a hex color: ${s}`);
  return {
    r: parseInt(h.slice(0, 2), 16) / 255,
    g: parseInt(h.slice(2, 4), 16) / 255,
    b: parseInt(h.slice(4, 6), 16) / 255,
  };
}

/** WCAG relative luminance of an sRGB color (channels 0..1). */
export function relativeLuminance({ r, g, b }: Rgb): number {
  return 0.2126 * decode(r) + 0.7152 * decode(g) + 0.0722 * decode(b);
}

export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Pulls `--color-*` declarations out of the `@theme { … }` block, keyed without the `--color-` prefix. */
export function readThemeColors(css: string): Record<string, string> {
  const block = css.match(/@theme\s*\{([\s\S]*?)\n\}/);
  const out: Record<string, string> = {};
  if (!block) return out;
  for (const m of block[1].matchAll(/--color-([\w-]+)\s*:\s*([^;]+);/g)) {
    out[m[1]] = m[2].trim();
  }
  return out;
}
