// Script to generate PWA icons from existing icon.png
const fs = require('fs');
const path = require('path');

// Check if sharp is available, if not, provide instructions
let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  console.error('❌ sharp module not found!');
  console.log('\n📦 Please install sharp first:');
  console.log('   npm install --save-dev sharp');
  console.log('\nThen run this script again:');
  console.log('   node generate-pwa-icons.js\n');
  process.exit(1);
}

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const inputIcon = path.join(__dirname, 'public', 'icon.png');
const outputDir = path.join(__dirname, 'public');

async function generateIcons() {
  try {
    // Check if input icon exists
    if (!fs.existsSync(inputIcon)) {
      console.error(`❌ Icon not found at: ${inputIcon}`);
      process.exit(1);
    }

    console.log('🎨 Generating PWA icons from:', inputIcon);
    console.log('');

    // Generate each size
    for (const size of sizes) {
      const outputPath = path.join(outputDir, `icon-${size}x${size}.png`);

      await sharp(inputIcon)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 0 }
        })
        .png()
        .toFile(outputPath);

      console.log(`✅ Generated: icon-${size}x${size}.png`);
    }

    console.log('');
    console.log('🎉 All PWA icons generated successfully!');
    console.log('📁 Icons saved to: public/');
    console.log('');
    console.log('✨ Next steps:');
    console.log('   1. Run: npm run build');
    console.log('   2. Run: npm run start');
    console.log('   3. Open app on mobile and add to home screen!');
    console.log('');

  } catch (error) {
    console.error('❌ Error generating icons:', error.message);
    process.exit(1);
  }
}

generateIcons();
