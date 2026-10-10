// Prepare portable, CPU-rendered base images once. The original team PNGs remain untouched.
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const source = path.join(__dirname, 'assets', 'teams');
const output = path.join(__dirname, 'assets', 'teams-hq');
const size = 1254;

async function main() {
  await fs.promises.mkdir(output, { recursive: true });
  const files = (await fs.promises.readdir(source)).filter(name => /^[A-Z]{2,3}\.png$/.test(name));
  for (const name of files) {
    await sharp(path.join(source, name))
      .resize(size, size, { fit: 'fill', kernel: sharp.kernel.cubic })
      .sharpen({ sigma: 0.8, m1: 0.35, m2: 1.2 })
      .png({ compressionLevel: 9 })
      .toFile(path.join(output, name));
  }
  console.log(`Prepared ${files.length} jersey bases at ${size} x ${size} using CPU image processing.`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
