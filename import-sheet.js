const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const source = process.argv[2] || path.join(__dirname, 'assets', 'jersey-sheet.png');
const output = path.join(__dirname, 'assets', 'teams');
const order = [
  'ARI', 'ATL', 'BAL', 'BUF', 'CAR', 'CHI', 'CIN', 'CLE',
  'DAL', 'DEN', 'DET', 'GB', 'HOU', 'IND', 'JAX', 'KC',
  'LV', 'LAC', 'LAR', 'MIA', 'MIN', 'NE', 'NO', 'NYG',
  'NYJ', 'PHI', 'PIT', 'SF', 'SEA', 'TB', 'TEN', 'WAS'
];

function removeConnectedBackground(data, width, height) {
  const count = width * height;
  const visited = new Uint8Array(count);
  const queue = new Int32Array(count);
  let head = 0, tail = 0;
  const sample = [data[0], data[1], data[2]];
  function close(p) {
    const i = p * 4;
    return Math.abs(data[i] - sample[0]) < 55 && Math.abs(data[i + 1] - sample[1]) < 55 && Math.abs(data[i + 2] - sample[2]) < 55;
  }
  function push(p) {
    if (p < 0 || p >= count || visited[p] || !close(p)) return;
    visited[p] = 1;
    queue[tail++] = p;
  }
  for (let x = 0; x < width; x++) { push(x); push((height - 1) * width + x); }
  for (let y = 0; y < height; y++) { push(y * width); push(y * width + width - 1); }
  while (head < tail) {
    const p = queue[head++], x = p % width;
    if (x) push(p - 1);
    if (x < width - 1) push(p + 1);
    if (p >= width) push(p - width);
    if (p < count - width) push(p + width);
  }
  const distance = new Uint8Array(count);
  const edgeQueue = new Int32Array(count);
  let edgeHead = 0, edgeTail = 0;
  for (let p = 0; p < count; p++) {
    if (visited[p]) { data[p * 4 + 3] = 0; edgeQueue[edgeTail++] = p; }
  }
  while (edgeHead < edgeTail) {
    const p = edgeQueue[edgeHead++], d = distance[p], x = p % width;
    if (d >= 3) continue;
    const neighbors = [x ? p - 1 : -1, x < width - 1 ? p + 1 : -1, p >= width ? p - width : -1, p < count - width ? p + width : -1];
    for (const q of neighbors) if (q >= 0 && !visited[q] && !distance[q]) {
      distance[q] = d + 1;
      edgeQueue[edgeTail++] = q;
    }
  }
  for (let p = 0; p < count; p++) {
    if (visited[p] || !distance[p] || distance[p] > 2) continue;
    const x = p % width, y = Math.floor(p / width), i = p * 4;
    let best = -1, bestScore = -1;
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const q = ny * width + nx;
      if (visited[q] || distance[q] < 3) continue;
      const j = q * 4;
      const score = Math.abs(data[j] - sample[0]) + Math.abs(data[j + 1] - sample[1]) + Math.abs(data[j + 2] - sample[2]);
      if (score > bestScore) { best = q; bestScore = score; }
    }
    if (best < 0) continue;
    const j = best * 4;
    let numerator = 0, denominator = 0;
    for (let c = 0; c < 3; c++) {
      const v = data[j + c] - sample[c];
      numerator += (data[i + c] - sample[c]) * v;
      denominator += v * v;
    }
    const alpha = Math.max(0, Math.min(1, denominator ? numerator / denominator : 1));
    if (alpha < .12) { data[i + 3] = 0; continue; }
    for (let c = 0; c < 3; c++) data[i + c] = Math.max(0, Math.min(255, Math.round((data[i + c] - (1 - alpha) * sample[c]) / alpha)));
    data[i + 3] = Math.round(alpha * 255);
  }
  return data;
}

async function main() {
  const metadata = await sharp(source).metadata();
  if (metadata.width !== 2090 || metadata.height !== 1173) throw new Error(`Expected the 2090 × 1173 reference sheet, got ${metadata.width} × ${metadata.height}`);
  fs.mkdirSync(output, { recursive: true });
  for (let n = 0; n < order.length; n++) {
    const row = Math.floor(n / 8), col = n % 8;
    const left = Math.round(87 + col * 242.3);
    const top = [88, 350, 620, 880][row];
    const width = 236, height = 250;
    const { data } = await sharp(source).extract({ left, top, width, height }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    removeConnectedBackground(data, width, height);
    await sharp(data, { raw: { width, height, channels: 4 } }).png().toFile(path.join(output, `${order[n]}.png`));
  }
  console.log(`Imported ${order.length} original jersey crops from ${source}`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
