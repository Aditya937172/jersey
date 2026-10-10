const path = require('path');
const sharp = require('sharp');
const { teams } = require('./teams');

const width = 1760, height = 1000, cellW = 220, cellH = 250;
async function main() {
  const layers = [];
  for (let n = 0; n < teams.length; n++) {
    const code = teams[n].code;
    const image = await sharp(path.join(__dirname, 'assets', 'teams-ready', `${code}.png`))
      .resize(210, 210, { fit: 'contain', background: '#ffffff' }).png().toBuffer();
    const x = n % 8 * cellW, y = Math.floor(n / 8) * cellH;
    layers.push({ input: image, left: x + 5, top: y + 5 });
    layers.push({ input: Buffer.from(`<svg width="220" height="30"><text x="110" y="21" text-anchor="middle" font-family="Arial" font-size="16" font-weight="bold" fill="#243024">${code}</text></svg>`), left: x, top: y + 216 });
  }
  await sharp({ create: { width, height, channels: 4, background: '#ffffff' } })
    .composite(layers).png().toFile(path.join(__dirname, 'assets', 'catalog-preview.png'));
  console.log('Saved assets/catalog-preview.png');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
