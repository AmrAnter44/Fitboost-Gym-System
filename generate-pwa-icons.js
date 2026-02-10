const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// الأحجام المطلوبة للـ PWA
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

// Apple Touch Icon sizes
const appleSizes = [120, 152, 167, 180];

async function generateIcons() {
  try {
    console.log('🎨 Starting PWA icon generation...\n');

    // التحقق من وجود اللوجو الأساسي
    const logoPath = path.join(__dirname, 'public', 'icon.svg');
    if (!fs.existsSync(logoPath)) {
      console.error('❌ Logo file not found at:', logoPath);
      process.exit(1);
    }

    console.log('✅ Found logo at:', logoPath);
    console.log('📏 Logo size:', (fs.statSync(logoPath).size / 1024).toFixed(2), 'KB\n');

    // توليد PWA icons
    console.log('📱 Generating PWA icons...');
    for (const size of sizes) {
      const outputPath = path.join(__dirname, 'public', `icon-${size}x${size}.png`);

      await sharp(logoPath)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 } // شفاف
        })
        .png()
        .toFile(outputPath);

      const fileSize = (fs.statSync(outputPath).size / 1024).toFixed(2);
      console.log(`  ✓ ${size}x${size}.png (${fileSize} KB)`);
    }

    // توليد Apple Touch Icons
    console.log('\n🍎 Generating Apple Touch icons...');
    for (const size of appleSizes) {
      const outputPath = path.join(__dirname, 'public', `apple-touch-icon-${size}x${size}.png`);

      await sharp(logoPath)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 1 } // خلفية سوداء
        })
        .png()
        .toFile(outputPath);

      const fileSize = (fs.statSync(outputPath).size / 1024).toFixed(2);
      console.log(`  ✓ apple-touch-icon-${size}x${size}.png (${fileSize} KB)`);
    }

    // توليد apple-touch-icon.png الافتراضي (180x180)
    const defaultAppleIcon = path.join(__dirname, 'public', 'apple-touch-icon.png');
    await sharp(logoPath)
      .resize(180, 180, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 1 }
      })
      .png()
      .toFile(defaultAppleIcon);

    const defaultSize = (fs.statSync(defaultAppleIcon).size / 1024).toFixed(2);
    console.log(`  ✓ apple-touch-icon.png (${defaultSize} KB)`);

    // توليد favicon.ico
    console.log('\n🌐 Generating favicon...');
    const faviconPath = path.join(__dirname, 'public', 'favicon.ico');
    await sharp(logoPath)
      .resize(32, 32, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toFile(faviconPath);

    const faviconSize = (fs.statSync(faviconPath).size / 1024).toFixed(2);
    console.log(`  ✓ favicon.ico (${faviconSize} KB)`);

    console.log('\n✅ All PWA icons generated successfully!');
    console.log('\n📦 Generated files:');
    console.log(`  - ${sizes.length} PWA icons (72x72 to 512x512)`);
    console.log(`  - ${appleSizes.length + 1} Apple Touch icons`);
    console.log(`  - 1 favicon`);
    console.log(`\nTotal: ${sizes.length + appleSizes.length + 2} files`);

  } catch (error) {
    console.error('\n❌ Error generating icons:', error);
    process.exit(1);
  }
}

generateIcons();
