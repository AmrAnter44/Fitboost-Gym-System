// تحميل الإيصال PDF بنفس شكل الطباعة: نفس الـ HTML على عرض صفحة A4 وبنفس هوامشها.
// المتصفح نفسه هو اللي بيرسم الصفحة، فالعربي والخطوط والصور بيطلعوا زي المطبوع.

const PAGE_W_MM = 210
const PAGE_H_MM = 297
const MARGIN_MM = 8
const CONTENT_W_MM = PAGE_W_MM - MARGIN_MM * 2
const CONTENT_H_MM = PAGE_H_MM - MARGIN_MM * 2
const CONTENT_W_PX = 733 // 194mm على 96dpi
const SCALE = 3

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

async function urlToDataUrl(url: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) throw new Error('asset ' + res.status)
  return blobToDataUrl(await res.blob())
}

async function buildFontCss(): Promise<string> {
  const [regular, bold] = await Promise.all([
    urlToDataUrl('/fonts/Almarai-Regular.ttf'),
    urlToDataUrl('/fonts/Almarai-Bold.ttf'),
  ])
  return `@font-face{font-family:'Almarai';font-weight:400;src:url(${regular}) format('truetype');}
@font-face{font-family:'Almarai';font-weight:700;src:url(${bold}) format('truetype');}`
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('render failed'))
    img.src = src
  })
}

async function waitForImages(doc: Document): Promise<void> {
  await Promise.all(Array.from(doc.images).map(img => img.complete ? null : new Promise(resolve => {
    img.addEventListener('load', resolve, { once: true })
    img.addEventListener('error', resolve, { once: true })
    setTimeout(resolve, 4000)
  })))
}

//  الصور لازم تبقى جوه الملف، واللي مش متاحة بتتشال بدل ما تبوّظ الرسم
async function inlineImages(doc: Document): Promise<void> {
  await Promise.all(Array.from(doc.images).map(async img => {
    const src = img.getAttribute('src') || ''
    if (src.startsWith('data:')) return
    try { img.setAttribute('src', await urlToDataUrl(img.src)) }
    catch { img.remove() }
  }))
}

async function renderToCanvas(html: string): Promise<HTMLCanvasElement> {
  const fontCss = await buildFontCss()
  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.tabIndex = -1
  iframe.style.cssText = `position:fixed;left:-10000px;top:0;width:${CONTENT_W_PX}px;height:1200px;border:0;background:#fff;`
  document.body.appendChild(iframe)
  try {
    const doc = iframe.contentDocument
    if (!doc) throw new Error('no document')
    doc.open()
    doc.write(html.replace('<link href="/fonts/almarai.css" rel="stylesheet">', `<style>${fontCss}</style>`))
    doc.close()

    await Promise.all([doc.fonts.load("400 13px Almarai", 'ا'), doc.fonts.load("700 13px Almarai", 'ا')])
    await doc.fonts.ready
    await waitForImages(doc)
    await inlineImages(doc)
    await waitForImages(doc)

    const height = Math.ceil(Math.max(doc.body.getBoundingClientRect().bottom, doc.body.scrollHeight))
    const css = Array.from(doc.querySelectorAll('style')).map(s => s.textContent || '').join('\n')
    const style = doc.createElement('style')
    style.textContent = css
    doc.body.insertBefore(style, doc.body.firstChild)
    const body = new XMLSerializer().serializeToString(doc.body)

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${CONTENT_W_PX}" height="${height}"><foreignObject width="100%" height="100%">${body}</foreignObject></svg>`
    const img = await loadImage('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg))

    const canvas = document.createElement('canvas')
    canvas.width = CONTENT_W_PX * SCALE
    canvas.height = height * SCALE
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('no canvas')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas
  } finally {
    iframe.remove()
  }
}

export async function saveReceiptPDF(html: string, receiptNumber: number): Promise<{ filePath?: string }> {
  const [{ default: jsPDF }, canvas] = await Promise.all([import('jspdf'), renderToCanvas(html)])
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true })

  //  لو الإيصال أطول من صفحة بيكمل في صفحة تانية زي الطباعة
  const pagePx = Math.floor(canvas.width * (CONTENT_H_MM / CONTENT_W_MM))
  for (let y = 0, page = 0; y < canvas.height; y += pagePx, page++) {
    const sliceH = Math.min(pagePx, canvas.height - y)
    const slice = document.createElement('canvas')
    slice.width = canvas.width
    slice.height = sliceH
    slice.getContext('2d')!.drawImage(canvas, 0, y, canvas.width, sliceH, 0, 0, canvas.width, sliceH)
    if (page > 0) pdf.addPage()
    pdf.addImage(slice.toDataURL('image/png'), 'PNG', MARGIN_MM, MARGIN_MM, CONTENT_W_MM, (sliceH * CONTENT_W_MM) / canvas.width, undefined, 'FAST')
  }

  const fileName = `Receipt_${receiptNumber}.pdf`
  const electron = typeof window !== 'undefined' ? (window as any).electron : null
  if (electron?.savePDFToDocuments) {
    try {
      const bytes = Array.from(new Uint8Array(pdf.output('arraybuffer')))
      const result = await electron.savePDFToDocuments(fileName, bytes)
      if (result?.success) return { filePath: result.filePath }
    } catch { /* نكمّل بالتحميل العادي */ }
  }
  pdf.save(fileName)
  return {}
}
