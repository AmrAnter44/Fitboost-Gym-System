const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

console.log('🔄 Checking Chromium installation...');

(async () => {
  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox']
    });

    const executablePath = browser.process()?.spawnfile;
    console.log('✅ Chromium is installed at:', executablePath);

    await browser.close();

    console.log('✅ Chromium is ready!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('💡 Try running: npx puppeteer browsers install chrome');
    process.exit(1);
  }
})();
