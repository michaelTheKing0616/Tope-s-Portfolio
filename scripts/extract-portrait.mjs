// One-off build utility. The legacy HTML inlined a ~2.2MB base64 portrait into
// every page. This pulls it out once and produces optimized, responsive image
// assets (AVIF/WebP/JPG) plus a social share (OG) cover.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const SOURCE = resolve(root, "files (1)", "index.html");
const OUT_DIR = resolve(root, "public", "images");

const html = await readFile(SOURCE, "utf8");
const match = html.match(/data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=]+)/);
if (!match) {
  console.error("No base64 image found in", SOURCE);
  process.exit(1);
}

const buffer = Buffer.from(match[2], "base64");
await mkdir(OUT_DIR, { recursive: true });
console.log(`Source portrait: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);

// Responsive portrait variants (square, sharpened, slightly warmed to suit palette).
const base = sharp(buffer).resize(900, 900, { fit: "cover", position: "top" });
await base.clone().avif({ quality: 62 }).toFile(resolve(OUT_DIR, "portrait.avif"));
await base.clone().webp({ quality: 78 }).toFile(resolve(OUT_DIR, "portrait.webp"));
await base.clone().jpeg({ quality: 82, mozjpeg: true }).toFile(resolve(OUT_DIR, "portrait.jpg"));
console.log("Wrote portrait.avif / .webp / .jpg (900x900)");

// Smaller variant for cards / avatars.
const sm = sharp(buffer).resize(420, 420, { fit: "cover", position: "top" });
await sm.clone().avif({ quality: 60 }).toFile(resolve(OUT_DIR, "portrait-sm.avif"));
await sm.clone().webp({ quality: 76 }).toFile(resolve(OUT_DIR, "portrait-sm.webp"));
console.log("Wrote portrait-sm.avif / .webp (420x420)");

// Social share cover (1200x630).
const W = 1200;
const H = 630;
const ogBg = Buffer.from(`
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0d0d0d"/>
      <stop offset="1" stop-color="#15120c"/>
    </linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#e8d9b5"/>
      <stop offset="1" stop-color="#b8954a"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect x="80" y="96" width="48" height="2" fill="#b8954a"/>
  <text x="80" y="92" font-family="Inter, sans-serif" font-size="20"
        letter-spacing="6" fill="#b8954a">SOFTWARE ENGINEER &amp; AI BUILDER</text>
  <text x="78" y="270" font-family="Georgia, 'Cormorant Garamond', serif" font-weight="700"
        font-size="120" fill="url(#gold)">Temitope</text>
  <text x="78" y="390" font-family="Georgia, 'Cormorant Garamond', serif" font-weight="700"
        font-size="120" fill="#f5f4f1">Olaitan</text>
  <text x="80" y="470" font-family="Inter, sans-serif" font-size="24" fill="#9a9488">
    Web &#183; Mobile &#183; Desktop &#183; AI &#183; Games
  </text>
  <text x="80" y="520" font-family="Inter, sans-serif" font-size="20" fill="#6b6b6b">
    Lagos, Nigeria
  </text>
</svg>`);

const portraitForOg = await sharp(buffer)
  .resize(380, 380, { fit: "cover", position: "top" })
  .composite([
    {
      input: Buffer.from(
        `<svg width="380" height="380"><rect width="380" height="380" rx="190" ry="190"/></svg>`,
      ),
      blend: "dest-in",
    },
  ])
  .png()
  .toBuffer();

await sharp(ogBg)
  .composite([
    { input: portraitForOg, left: W - 380 - 90, top: (H - 380) / 2 },
    {
      input: Buffer.from(
        `<svg width="400" height="400"><circle cx="200" cy="200" r="191" fill="none" stroke="#b8954a" stroke-width="2"/></svg>`,
      ),
      left: W - 400 - 80,
      top: (H - 400) / 2,
    },
  ])
  .png()
  .toFile(resolve(OUT_DIR, "og-cover.png"));
console.log("Wrote og-cover.png (1200x630)");
console.log("Done.");
