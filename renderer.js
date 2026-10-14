const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const opentype = require('opentype.js');

const FONT = path.join(__dirname, 'assets', 'impact.ttf');
const font = opentype.parse(fs.readFileSync(FONT));
const SIZE = 1254;
const baseCache = new Map();
const surfaceCache = new Map();

function rgb(hex) {
  return [1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16));
}

function clamp(value, low, high) { return Math.max(low, Math.min(high, value)); }

function luma(data, i) { return data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722; }

function inkFor(team) {
  if (team.code === 'NYG') return { fill: '#174ea6', outline: '#c8102e' };
  if (team.code === 'DAL') return { fill: '#092954', outline: '#ffffff' };
  const outlines = { ARI: '#71101d', DET: '#0b2545', IND: '#0b2545', LV: '#a5acaf', NYJ: '#142d21', BUF: '#c8102e' };
  return { fill: '#ffffff', outline: outlines[team.code] || team.accent };
}

function numberSvg(number, withOutline) {
  const digits = String(number);
  const spacedOnes = digits === '11';
  const glyph = font.getPath(spacedOnes ? '1' : digits, 0, 0, 1000);
  const box = glyph.getBoundingBox();
  const secondOneOffset = spacedOnes ? font.getAdvanceWidth('1', 1000) + 65 : 0;
  const rightEdge = spacedOnes ? box.x2 + secondOneOffset : box.x2;
  const width = digits.length === 1 ? 195 : digits.length === 2 ? 376 : digits.length === 3 ? 458 : 533;
  const height = digits.length > 2 ? 307 : 364;
  const sx = width / (rightEdge - box.x1);
  const sy = height / (box.y2 - box.y1);
  // The wide left flags on "11" make its straight stems sit right of the
  // torso center when the glyph bounds are centered. Align the stems instead.
  const tx = SIZE / 2 - (box.x1 + rightEdge) / 2 * sx + (spacedOnes ? -36 : 0);
  const ty = (digits.length > 2 ? 473 : 439) - box.y1 * sy;
  const pathData = glyph.toPathData(2);
  const outline = withOutline ? 'stroke="white" stroke-width="27" stroke-linejoin="miter"' : '';
  const paths = `<path d="${pathData}"/>${spacedOnes ? `<path d="${pathData}" transform="translate(${secondOneOffset} 0)"/>` : ''}`;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}"><g transform="translate(${tx} ${ty}) scale(${sx} ${sy})" fill="white" ${outline}>${paths}</g></svg>`);
}

async function baseFor(team) {
  if (!baseCache.has(team.code)) {
    const generated = path.join(__dirname, 'assets', 'teams-ready', `${team.code}.png`);
    const enhanced = path.join(__dirname, 'assets', 'teams-hq', `${team.code}.png`);
    const original = path.join(__dirname, 'assets', 'teams', `${team.code}.png`);
    const filename = fs.existsSync(generated) ? generated : fs.existsSync(enhanced) ? enhanced : original;
    baseCache.set(team.code, filename !== original
      ? fs.promises.readFile(filename)
      : sharp(filename).resize(SIZE, SIZE, { fit: 'fill', kernel: sharp.kernel.cubic }).png().toBuffer());
  }
  return baseCache.get(team.code);
}

async function render(team, number) {
  if (!surfaceCache.has(team.code)) {
    surfaceCache.set(team.code, (async () => {
      const base = await baseFor(team);
      const [pixels, smooth] = await Promise.all([
        sharp(base).ensureAlpha().raw().toBuffer(),
        sharp(base).blur(12).ensureAlpha().raw().toBuffer()
      ]);
      const center = (615 * SIZE + 627) * 4;
      return { pixels, smooth, centerLight: luma(smooth, center) };
    })());
  }
  const { pixels, smooth, centerLight } = await surfaceCache.get(team.code);
  const [outer, inner] = await Promise.all([
    sharp(numberSvg(number, true)).blur(0.7).extractChannel(3).raw().toBuffer(),
    sharp(numberSvg(number, false)).blur(0.7).extractChannel(3).raw().toBuffer()
  ]);
  const result = Buffer.from(pixels);
  const { fill, outline } = inkFor(team);
  const fillRGB = rgb(fill), outlineRGB = rgb(outline);
  for (let p = 0; p < outer.length; p++) {
    if (!outer[p] || !pixels[p * 4 + 3]) continue;
    const i = p * 4;
    const fabric = luma(pixels, i);
    const soft = luma(smooth, i);
    // The number uses the same local fabric relief and light falloff as the garment.
    const detail = clamp((fabric - soft) * 1.1, -12, 10);
    const shade = clamp((soft - centerLight) * 0.22, -14, 10);
    const border = Math.max(0, outer[p] - inner[p]) / 255;
    const face = inner[p] / 255;
    for (let c = 0; c < 3; c++) {
      const under = pixels[i + c];
      const edgeInk = clamp(outlineRGB[c] * 0.98 + under * 0.02 + detail * 0.3 + shade * 0.5, 0, 255);
      const faceInk = clamp(fillRGB[c] * 0.96 + under * 0.04 + detail + shade, 0, 255);
      const withEdge = under * (1 - border) + edgeInk * border;
      result[i + c] = Math.round(withEdge * (1 - face) + faceInk * face);
    }
  }
  return sharp(result, { raw: { width: SIZE, height: SIZE, channels: 4 } }).png().toBuffer();
}

module.exports = { render };
