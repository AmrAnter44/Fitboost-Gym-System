const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Main system PWA icon sizes
const iconSizes = [
  { size: 72, name: 'icon-72x72.png' },
  { size: 96, name: 'icon-96x96.png' },
  { size: 128, name: 'icon-128x128.png' },
  { size: 144, name: 'icon-144x144.png' },
  { size: 152, name: 'icon-152x152.png' },
  { size: 192, name: 'icon-192x192.png' },
  { size: 384, name: 'icon-384x384.png' },
  { size: 512, name: 'icon-512x512.png' },
];

// إعدادات
const backgroundColor = '#000000'; // خلفية سوداء
const logoPath = path.join(__dirname, 'build', 'icon.png');
const outputDir = path.join(__dirname, 'public');

async function generateMainSystemIcons() {
  console.log('🎨 Starting main system PWA icon generation with black background...\n');

  if (!fs.existsSync(logoPath)) {
    console.error('❌ Error: build/icon.png not found!');
    console.error('   Please make sure the logo file exists at:', logoPath);
    process.exit(1);
  }

  for (const { size, name } of iconSizes) {
    try {
      const outputPath = path.join(outputDir, name);

      // حساب حجم اللوجو (70% من حجم الأيقونة لترك مساحة حول اللوجو)
      const logoSize = Math.floor(size * 0.7);
      const padding = Math.floor((size - logoSize) / 2);

      // قراءة وتعديل اللوجو
      const logoBuffer = await sharp(logoPath)
        .resize(logoSize, logoSize, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 } // شفاف
        })
        .png()
        .toBuffer();

      // إنشاء الأيقونة بخلفية سوداء
      await sharp({
        create: {
          width: size,
          height: size,
          channels: 4,
          background: backgroundColor
        }
      })
        .composite([
          {
            input: logoBuffer,
            top: padding,
            left: padding
          }
        ])
        .png()
        .toFile(outputPath);

      console.log(`✅ Generated: ${name} (${size}x${size})`);
    } catch (error) {
      console.error(`❌ Error generating ${name}:`, error.message);
    }
  }

  console.log('\n🎉 Main system PWA icon generation complete!');
  console.log(`📂 Icons saved to: ${outputDir}`);
  console.log('\n📋 Next steps:');
  console.log('   1. Run: npm run build');
  console.log('   2. Check icons in /public/');
  console.log('   3. Test PWA installation\n');
}

generateMainSystemIcons().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
