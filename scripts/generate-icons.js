/**
 * Generates placeholder PWA icons using a minimal valid PNG approach.
 * Produces solid #FF4D00 squares at 192×192 and 512×512.
 *
 * Run: node scripts/generate-icons.js
 *
 * For production icons: use https://maskable.app or a design tool to
 * create proper icons from your logo, then replace files in public/icons/.
 */

import { createCanvas } from 'canvas';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '../public/icons');

function generateIcon(size, filename) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#FF4D00';
  ctx.fillRect(0, 0, size, size);

  // "RG" text
  const fontSize = Math.round(size * 0.38);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('RG', size / 2, size / 2);

  const buffer = canvas.toBuffer('image/png');
  writeFileSync(join(outDir, filename), buffer);
  console.log(`Generated: ${filename} (${size}×${size})`);
}

try {
  generateIcon(192, 'icon-192.png');
  generateIcon(512, 'icon-512.png');
  generateIcon(512, 'icon-512-maskable.png');
  console.log('\nDone! Replace these with real icons for production.');
} catch {
  console.error('canvas package not available. Install it: npm install canvas');
  console.error('Or manually create icons using https://maskable.app');
  process.exit(1);
}
