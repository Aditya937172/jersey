// One-time optional GPU preparation. The running server only reads the finished PNGs.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const sharp = require('sharp');

const root = __dirname;
const source = path.join(root, 'assets', 'teams');
const output = path.join(root, 'assets', 'teams-hq');
const temporary = path.join(root, 'tools', 'gpu-output');
const binary = path.join(root, 'tools', 'realesrgan', 'realesrgan-ncnn-vulkan.exe');
const models = path.join(root, 'tools', 'realesrgan', 'models');
const SIZE = 1254;

function cleanEdge(rgb, alpha) {
  const count = SIZE * SIZE;
  const distance = new Uint8Array(count);
  const queue = new Int32Array(count);
  let head = 0, tail = 0;
  for (let p = 0; p < count; p++) {
    if (alpha[p] < 20) { distance[p] = 1; queue[tail++] = p; alpha[p] = 0; }
  }
  while (head < tail) {
    const p = queue[head++], d = distance[p], x = p % SIZE;
    if (d >= 16) continue;
    const neighbors = [x ? p - 1 : -1, x < SIZE - 1 ? p + 1 : -1, p >= SIZE ? p - SIZE : -1, p < count - SIZE ? p + SIZE : -1];
    for (const q of neighbors) if (q >= 0 && !distance[q]) {
      distance[q] = d + 1; queue[tail++] = q;
    }
  }
  for (let p = 0; p < count; p++) {
    const d = distance[p];
    if (!alpha[p] || !d || d > 7) continue;
    const x = p % SIZE, y = Math.floor(p / SIZE);
    let best = -1, bestD = Infinity;
    for (let dy = -13; dy <= 13; dy++) for (let dx = -13; dx <= 13; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || nx >= SIZE || ny < 0 || ny >= SIZE) continue;
      const q = ny * SIZE + nx, score = dx * dx + dy * dy;
      if (distance[q] >= 10 && alpha[q] > 245 && score < bestD) { best = q; bestD = score; }
    }
    if (best < 0) { alpha[p] = 0; continue; }
    const i = p * 4, j = best * 4;
    rgb[i] = rgb[j]; rgb[i + 1] = rgb[j + 1]; rgb[i + 2] = rgb[j + 2];
  }
  for (let p = 0; p < count; p++) rgb[p * 4 + 3] = alpha[p];
}

async function main() {
  if (!fs.existsSync(binary)) throw new Error('Real-ESRGAN executable not found in tools/realesrgan');
  await fs.promises.mkdir(temporary, { recursive: true });
  await fs.promises.mkdir(output, { recursive: true });
  const files = (await fs.promises.readdir(source)).filter(name => /^[A-Z]{2,3}\.png$/.test(name));
  const reuse = process.argv.includes('--reuse');
  for (const name of files) {
    const input = path.join(source, name);
    const gpu = path.join(temporary, name);
    if (!reuse || !fs.existsSync(gpu)) execFileSync(binary, ['-i', input, '-o', gpu, '-m', models, '-n', 'realesrgan-x4plus', '-s', '4', '-g', '0', '-f', 'png'], { stdio: 'ignore' });
    // Retain the precise silhouette from the user's sheet instead of an AI-generated alpha edge.
    const [enhanced, original] = await Promise.all([
      sharp(gpu).resize(SIZE, SIZE, { fit: 'fill', kernel: sharp.kernel.cubic }).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
      sharp(input).resize(SIZE, SIZE, { fit: 'fill', kernel: sharp.kernel.cubic }).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    ]);
    const alpha = new Uint8Array(SIZE * SIZE);
    for (let p = 0; p < alpha.length; p++) alpha[p] = original.data[p * 4 + 3];
    cleanEdge(enhanced.data, alpha);
    await sharp(enhanced.data, { raw: { width: SIZE, height: SIZE, channels: 4 } })
      .png({ compressionLevel: 9 }).toFile(path.join(output, name));
    console.log(`Prepared ${name}`);
  }
  console.log(`Saved ${files.length} GPU-enhanced bases; the server needs no GPU.`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
