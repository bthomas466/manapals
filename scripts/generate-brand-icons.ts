// One-off generator for the committed raster brand assets.
// Run: npx tsx scripts/generate-brand-icons.ts
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(__dirname, "..");
const svg = readFileSync(path.join(root, "docs/brand/concept-3.svg"));
const BG = "#0c1015";

function render(size: number) {
  return sharp(svg, { density: (72 * size) / 64 }).resize(size, size);
}

async function flattened(size: number, out: string) {
  const buf = await render(size).flatten({ background: BG }).png().toBuffer();
  writeFileSync(path.join(root, out), buf);
}

function buildIco(images: { size: number; png: Buffer }[]) {
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, png }, i) => {
    const e = 6 + 16 * i;
    header.writeUInt8(size >= 256 ? 0 : size, e);
    header.writeUInt8(size >= 256 ? 0 : size, e + 1);
    header.writeUInt8(0, e + 2);
    header.writeUInt8(0, e + 3);
    header.writeUInt16LE(1, e + 4);
    header.writeUInt16LE(32, e + 6);
    header.writeUInt32LE(png.length, e + 8);
    header.writeUInt32LE(offset, e + 12);
    offset += png.length;
  });
  return Buffer.concat([header, ...images.map((i) => i.png)]);
}

async function main() {
  await flattened(180, "src/app/apple-icon.png");
  await flattened(192, "public/icons/manapals-192.png");
  await flattened(512, "public/icons/manapals-512.png");
  const images = await Promise.all(
    [16, 32, 48].map(async (size) => ({
      size,
      png: await render(size).png().toBuffer(),
    })),
  );
  writeFileSync(path.join(root, "src/app/favicon.ico"), buildIco(images));
}

main();
