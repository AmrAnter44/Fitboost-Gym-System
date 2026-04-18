const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// الأحجام المطلوبة للـ PWA
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

// Apple Touch Icon sizes
const appleSizes = [120, 152, 167, 180];

async function generateIcons() {
  try {

    // التحقق من وجود اللوجو الأساسي
    const logoPath = path.join(__dirname, 'public', 'icon.svg');
    if (!fs.existsSync(logoPath)) {
      console.error('❌ Logo file not found at:', logoPath);
      process.exit(1);
    }


    // توليد PWA icons
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
    }

    // توليد Apple Touch Icons
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

    // توليد favicon.ico
    const faviconPath = path.join(__dirname, 'public', 'favicon.ico');
    await sharp(logoPath)
      .resize(32, 32, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toFile(faviconPath);

    const faviconSize = (fs.statSync(faviconPath).size / 1024).toFixed(2);


  } catch (error) {
    console.error('\n❌ Error generating icons:', error);
    process.exit(1);
  }
}

generateIcons();
