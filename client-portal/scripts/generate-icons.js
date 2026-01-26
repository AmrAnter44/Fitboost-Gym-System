const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

const iconsDir = path.join(__dirname, '../public/icons');

// Ensure icons directory exists
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Create SVG template for the icon
const createSVG = (size) => {
  const fontSize = Math.floor(size * 0.4);
  const subFontSize = Math.floor(size * 0.15);

  return `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#3b82f6;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#8b5cf6;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="${size}" height="${size}" rx="${size * 0.15}" fill="url(#grad)"/>
      <text x="50%" y="45%" text-anchor="middle" fill="white" font-size="${fontSize}" font-weight="bold" font-family="Arial, sans-serif">X</text>
      <text x="50%" y="70%" text-anchor="middle" fill="white" font-size="${subFontSize}" font-weight="600" font-family="Arial, sans-serif">GYM</text>
    </svg>
  `;
};

// Generate icons
async function generateIcons() {
  console.log('Generating PWA icons...\n');

  for (const size of sizes) {
    const svg = createSVG(size);
    const outputPath = path.join(iconsDir, `icon-${size}x${size}.png`);

    try {
      await sharp(Buffer.from(svg))
        .png()
        .toFile(outputPath);

      console.log(`✅ Generated: icon-${size}x${size}.png`);
    } catch (error) {
      console.error(`❌ Failed to generate icon-${size}x${size}.png:`, error.message);
    }
  }

  console.log('\n✨ All icons generated successfully!');
}

generateIcons().catch(console.error);
