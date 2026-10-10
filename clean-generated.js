// Normalize generated cutouts and remove fine alpha fringes before runtime use.
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const SIZE = 1254;
const inputDir = path.join(__dirname, 'assets', 'teams-generated');
const outputDir = path.join(__dirname, 'assets', 'teams-ready');

function tidyMask(alpha) {
  const count = SIZE * SIZE;
  const solid = new Uint8Array(count);
  const eroded = new Uint8Array(count);
  const opened = new Uint8Array(count);
  for (let p = 0; p < count; p++) solid[p] = alpha[p] >= 180 ? 1 : 0;
  for (let y = 1; y < SIZE - 1; y++) for (let x = 1; x < SIZE - 1; x++) {
    const p = y * SIZE + x;
    if (!solid[p]) continue;
    let all = true;
    for (let dy = -1; dy <= 1 && all; dy++) for (let dx = -1; dx <= 1; dx++) if (!solid[p + dy * SIZE + dx]) { all = false; break; }
    if (all) eroded[p] = 1;
  }
  for (let y = 1; y < SIZE - 1; y++) for (let x = 1; x < SIZE - 1; x++) {
    const p = y * SIZE + x;
    for (let dy = -1; dy <= 1 && !opened[p]; dy++) for (let dx = -1; dx <= 1; dx++) if (eroded[p + dy * SIZE + dx]) { opened[p] = 255; break; }
  }
  return opened;
}

async function clean(name) {
  const source = path.join(inputDir, name);
  const pixels = await sharp(source).resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).ensureAlpha().raw().toBuffer();
  const alpha = new Uint8Array(SIZE * SIZE);
  for (let p = 0; p < alpha.length; p++) alpha[p] = pixels[p * 4 + 3];
  const mask = tidyMask(alpha);
  const antialias = await sharp(mask, { raw: { width: SIZE, height: SIZE, channels: 1 } })
    .blur(0.55).extractChannel(0).raw().toBuffer();
  for (let p = 0; p < alpha.length; p++) {
    const i = p * 4;
    pixels[i + 3] = antialias[p];
    if (!antialias[p] || antialias[p] === 255) continue;
    const x = p % SIZE, y = Math.floor(p / SIZE);
    let nearest = -1, nearestD = Infinity;
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || nx >= SIZE || ny < 0 || ny >= SIZE) continue;
      const q = ny * SIZE + nx, d = dx * dx + dy * dy;
      if (antialias[q] === 255 && d < nearestD) { nearest = q; nearestD = d; }
    }
    if (nearest >= 0) for (let c = 0; c < 3; c++) pixels[i + c] = pixels[nearest * 4 + c];
  }
  await sharp(pixels, { raw: { width: SIZE, height: SIZE, channels: 4 } }).png({ compressionLevel: 9 }).toFile(path.join(outputDir, name));
}

async function main() {
  await fs.promises.mkdir(outputDir, { recursive: true });
  const files = (await fs.promises.readdir(inputDir)).filter(name => /^[A-Z]{2,3}\.png$/.test(name));
  for (const file of files) { await clean(file); console.log(`Cleaned ${file}`); }
  console.log(`${files.length} catalog cutouts ready.`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
