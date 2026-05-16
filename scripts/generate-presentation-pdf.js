const { chromium } = require('playwright')
const path = require('path')
const fs = require('fs')

;(async () => {
  const browser = await chromium.launch()
  const page = await browser.newPage()
  const htmlPath = path.resolve(__dirname, '..', 'CLIENT_PRESENTATION.html')
  const pdfPath = path.resolve(__dirname, '..', 'CLIENT_PRESENTATION.pdf')
  const fileUrl = 'file:///' + htmlPath.split(path.sep).join('/')

  await page.goto(fileUrl, { waitUntil: 'networkidle' })
  await page.emulateMedia({ media: 'print' })
  await page.pdf({
    path: pdfPath,
    width: '13.333in',
    height: '7.5in',
    printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
    preferCSSPageSize: true,
  })

  await browser.close()
  const size = (fs.statSync(pdfPath).size / 1024).toFixed(1)
  console.log(`✅ PDF saved: ${pdfPath} (${size} KB)`)
})().catch(e => {
  console.error('❌ Error:', e.message)
  process.exit(1)
})
