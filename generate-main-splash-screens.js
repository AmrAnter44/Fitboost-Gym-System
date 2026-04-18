const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// iOS splash screen sizes for main system
const splashSizes = [
  { width: 2048, height: 2732, name: 'apple-splash-2048-2732.png' }, // iPad Pro 12.9"
  { width: 1668, height: 2388, name: 'apple-splash-1668-2388.png' }, // iPad Pro 11"
  { width: 1536, height: 2048, name: 'apple-splash-1536-2048.png' }, // iPad 9.7"
  { width: 1668, height: 2224, name: 'apple-splash-1668-2224.png' }, // iPad 10.5"
  { width: 1620, height: 2160, name: 'apple-splash-1620-2160.png' }, // iPad 10.2"
  { width: 1290, height: 2796, name: 'apple-splash-1290-2796.png' }, // iPhone 14 Pro Max
  { width: 1179, height: 2556, name: 'apple-splash-1179-2556.png' }, // iPhone 14 Pro
  { width: 1284, height: 2778, name: 'apple-splash-1284-2778.png' }, // iPhone 13/12 Pro Max
  { width: 1170, height: 2532, name: 'apple-splash-1170-2532.png' }, // iPhone 13/12 Pro
  { width: 1125, height: 2436, name: 'apple-splash-1125-2436.png' }, // iPhone X/XS/11 Pro
  { width: 1242, height: 2688, name: 'apple-splash-1242-2688.png' }, // iPhone XS Max/11 Pro Max
  { width: 828, height: 1792, name: 'apple-splash-828-1792.png' },   // iPhone XR/11
  { width: 1242, height: 2208, name: 'apple-splash-1242-2208.png' }, // iPhone 8 Plus/7 Plus/6s Plus
  { width: 750, height: 1334, name: 'apple-splash-750-1334.png' },   // iPhone 8/7/6s/6
  { width: 640, height: 1136, name: 'apple-splash-640-1136.png' },   // iPhone SE
];

const splashDir = path.join(__dirname, 'public', 'splash');

// Create splash directory if it doesn't exist
if (!fs.existsSync(splashDir)) {
  fs.mkdirSync(splashDir, { recursive: true });
}

async function generateMainSplashScreens() {

  const backgroundColor = '#000000'; // خلفية سوداء
  const logoPath = path.join(__dirname, 'build', 'icon.png');

  // التحقق من وجود اللوجو
  if (!fs.existsSync(logoPath)) {
    console.error('❌ Error: build/icon.png not found!');
    console.error('   Please make sure the logo file exists at:', logoPath);
    process.exit(1);
  }

  for (const size of splashSizes) {
    try {
      const { width, height, name } = size;

      // حساب حجم اللوجو (20% من أصغر بُعد)
      const logoSize = Math.floor(Math.min(width, height) * 0.2);

      // قراءة وتعديل اللوجو
      const logoBuffer = await sharp(logoPath)
        .resize(logoSize, logoSize, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png()
        .toBuffer();

      const outputPath = path.join(splashDir, name);

      // إنشاء الخلفية السوداء مع اللوجو في المنتصف
      await sharp({
        create: {
          width: width,
          height: height,
          channels: 4,
          background: backgroundColor
        }
      })
        .composite([
          // وضع اللوجو في المنتصف
          {
            input: logoBuffer,
            top: Math.floor((height / 2) - (logoSize / 2)),
            left: Math.floor((width / 2) - (logoSize / 2))
          }
        ])
        .png()
        .toFile(outputPath);

    } catch (error) {
      console.error(`❌ Error generating ${name}:`, error.message);
    }
  }

}

generateMainSplashScreens().catch(console.error);
