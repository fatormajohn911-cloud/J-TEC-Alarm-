import sharp from 'sharp';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const assetsDir = path.resolve(__dirname, '../assets');
const publicIconsDir = path.resolve(__dirname, '../public/icons');

const nativeJobs = [
  { input: 'logo.svg', output: 'icon-only.png', size: 1024 },
  { input: 'icon-foreground.svg', output: 'icon-foreground.png', size: 1024 },
  { input: 'icon-background.svg', output: 'icon-background.png', size: 1024 },
  { input: 'splash.svg', output: 'splash.png', size: 1024 },
];

async function run() {
  fs.mkdirSync(publicIconsDir, { recursive: true });

  // 1. Native Capacitor Android assets in /assets
  for (const job of nativeJobs) {
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
    console.log(`Generated assets/${job.output} (${job.size}x${job.size})`);
  }

  const logoSvg = path.join(assetsDir, 'logo.svg');
  const bgSvg = path.join(assetsDir, 'icon-background.svg');

  // 2. PWA standard icons (192x192 and 512x512)
  for (const size of [192, 512]) {
    const dest = path.join(publicIconsDir, `icon-${size}.png`);
    await sharp(logoSvg, { density: 300 })
      .resize(size, size, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toFile(dest);
    console.log(`Generated public/icons/icon-${size}.png (${size}x${size})`);
  }

  // 3. PWA maskable 512x512 icon: full-bleed indigo gradient with 20% safe padding around logo
  const maskableSize = 512;
  const paddedLogoSize = Math.round(maskableSize * 0.6); // 20% margin on every side
  const maskableBgBuffer = await sharp(bgSvg, { density: 300 })
    .resize(maskableSize, maskableSize, { fit: 'cover' })
    .png()
    .toBuffer();
  const paddedLogoBuffer = await sharp(logoSvg, { density: 300 })
    .resize(paddedLogoSize, paddedLogoSize, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  await sharp(maskableBgBuffer)
    .composite([{ input: paddedLogoBuffer, gravity: 'center' }])
    .png()
    .toFile(path.join(publicIconsDir, 'icon-maskable-512.png'));
  console.log('Generated public/icons/icon-maskable-512.png (512x512, 20% safe padding)');

  // 4. Apple Touch Icon (180x180 opaque indigo background + centered logo)
  const appleSize = 180;
  const appleLogoSize = 152;
  const appleBgBuffer = await sharp(bgSvg, { density: 300 })
    .resize(appleSize, appleSize, { fit: 'cover' })
    .png()
    .toBuffer();
  const appleLogoBuffer = await sharp(logoSvg, { density: 300 })
    .resize(appleLogoSize, appleLogoSize, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  await sharp(appleBgBuffer)
    .composite([{ input: appleLogoBuffer, gravity: 'center' }])
    .png()
    .toFile(path.join(publicIconsDir, 'apple-touch-icon.png'));
  console.log('Generated public/icons/apple-touch-icon.png (180x180)');
}

run().catch((err) => {
  console.error('Asset conversion failed:', err);
  process.exit(1);
});
