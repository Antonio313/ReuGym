import sharp from 'sharp';
import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '../public/icons');

const ACCENT = '#FF4D00';
const BG     = '#0A0A0A';

// Standard icon SVG (512×512, full bleed)
const standardSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <!-- Background -->
  <rect width="512" height="512" fill="${BG}"/>

  <!-- Dumbbell — all parts share the same vertical centre at y=210 -->

  <!-- Left plate -->
  <rect x="52"  y="126" width="88"  height="168" rx="16" fill="${ACCENT}"/>
  <!-- Left collar -->
  <rect x="140" y="160" width="34"  height="100" rx="8"  fill="${ACCENT}"/>
  <!-- Bar -->
  <rect x="174" y="194" width="164" height="32"  rx="6"  fill="${ACCENT}"/>
  <!-- Right collar -->
  <rect x="338" y="160" width="34"  height="100" rx="8"  fill="${ACCENT}"/>
  <!-- Right plate -->
  <rect x="372" y="126" width="88"  height="168" rx="16" fill="${ACCENT}"/>

  <!-- "RG" initials -->
  <text
    x="256" y="432"
    font-family="Impact, 'Arial Black', Arial, sans-serif"
    font-weight="900"
    font-size="156"
    letter-spacing="8"
    fill="${ACCENT}"
    text-anchor="middle"
  >RG</text>
</svg>`;

// Maskable icon — content scaled to 80 % safe zone, extra bg padding
const maskableSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" fill="${BG}"/>
  <g transform="translate(51,51) scale(0.8)">
    <!-- Left plate -->
    <rect x="52"  y="126" width="88"  height="168" rx="16" fill="${ACCENT}"/>
    <!-- Left collar -->
    <rect x="140" y="160" width="34"  height="100" rx="8"  fill="${ACCENT}"/>
    <!-- Bar -->
    <rect x="174" y="194" width="164" height="32"  rx="6"  fill="${ACCENT}"/>
    <!-- Right collar -->
    <rect x="338" y="160" width="34"  height="100" rx="8"  fill="${ACCENT}"/>
    <!-- Right plate -->
    <rect x="372" y="126" width="88"  height="168" rx="16" fill="${ACCENT}"/>
    <!-- "RG" initials -->
    <text
      x="256" y="432"
      font-family="Impact, 'Arial Black', Arial, sans-serif"
      font-weight="900"
      font-size="156"
      letter-spacing="8"
      fill="${ACCENT}"
      text-anchor="middle"
    >RG</text>
  </g>
</svg>`;

// Also write a clean favicon.svg
const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="6" fill="${BG}"/>
  <!-- Mini dumbbell -->
  <rect x="3"  y="8"  width="5" height="16" rx="1.5" fill="${ACCENT}"/>
  <rect x="8"  y="10" width="3" height="12" rx="1"   fill="${ACCENT}"/>
  <rect x="11" y="13" width="10" height="6" rx="1"   fill="${ACCENT}"/>
  <rect x="21" y="10" width="3" height="12" rx="1"   fill="${ACCENT}"/>
  <rect x="24" y="8"  width="5" height="16" rx="1.5" fill="${ACCENT}"/>
</svg>`;

async function run() {
  const buf192  = Buffer.from(standardSvg);
  const buf512  = Buffer.from(standardSvg);
  const bufMask = Buffer.from(maskableSvg);

  await sharp(buf192 ).resize(192, 192).png().toFile(`${OUT}/icon-192.png`);
  await sharp(buf512 ).resize(512, 512).png().toFile(`${OUT}/icon-512.png`);
  await sharp(bufMask).resize(512, 512).png().toFile(`${OUT}/icon-512-maskable.png`);

  // Apple touch icon (180×180, same design as standard)
  await sharp(buf512).resize(180, 180).png().toFile(`${OUT}/apple-touch-icon.png`);

  writeFileSync(resolve(__dirname, '../public/favicon.svg'), faviconSvg);

  console.log('Icons generated:');
  console.log('  public/icons/icon-192.png');
  console.log('  public/icons/icon-512.png');
  console.log('  public/icons/icon-512-maskable.png');
  console.log('  public/icons/apple-touch-icon.png');
  console.log('  public/favicon.svg');
}

run().catch((err) => { console.error(err); process.exit(1); });
