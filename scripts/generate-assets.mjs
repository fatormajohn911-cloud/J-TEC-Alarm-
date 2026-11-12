import sharp from 'sharp';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const assetsDir = path.resolve(__dirname, '../assets');

const jobs = [
  { input: 'logo.svg', output: 'icon-only.png', size: 1024 },
  { input: 'icon-foreground.svg', output: 'icon-foreground.png', size: 1024 },
  { input: 'icon-background.svg', output: 'icon-background.png', size: 1024 },
  { input: 'splash.svg', output: 'splash.png', size: 1024 },
];

async function run() {
  for (const job of jobs) {
    const srcPath = path.join(assetsDir, job.input);
    const destPath = path.join(assetsDir, job.output);
    if (!fs.existsSync(srcPath)) {
      throw new Error(`Missing source SVG: ${srcPath}`);
    }
    await sharp(srcPath, { density: 300 })
      .resize(job.size, job.size, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toFile(destPath);
    console.log(`Generated ${job.output} (${job.size}x${job.size})`);
  }
}

run().catch((err) => {
  console.error('Asset conversion failed:', err);
  process.exit(1);
});
