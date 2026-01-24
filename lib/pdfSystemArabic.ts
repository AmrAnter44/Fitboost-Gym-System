// نظام PDF محسّن للعربي - استخدام dom-to-image-more
// ⚠️ استخدام dynamic imports لتجنب مشاكل SSR
// import jsPDF from 'jspdf'
// import domtoimage from 'dom-to-image-more'

/**
 * ✅ الحل الأمثل: استخدام html2canvas + دقة عالية
 * html2canvas يحول HTML لصورة، والصورة تحتوي على الخطوط العربية
 */

interface PDFOptions {
  autoDownload?: boolean
  returnBlob?: boolean
  fileName?: string
}

/**
 * تحويل HTML إلى PDF مع دعم كامل للعربي
 */
export async function generateArabicPDF(
  htmlContent: string,
  receiptNumber: number,
  options?: PDFOptions
): Promise<{ blob: Blob | null; url: string | null; filePath: string | null }> {
  console.log('🚀 generateArabicPDF started - NEW VERSION')
  try {
    // ✅ Dynamic imports للمكتبات اللي بتستخدم DOM APIs
    const [{ default: jsPDF }, { default: domtoimage }] = await Promise.all([
      import('jspdf'),
      import('dom-to-image-more')
    ])

    // ✅ إخفاء overflow على الـ body مؤقتاً
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    // ✅ إنشاء container مخفي خارج الشاشة (مش opacity عشان الألوان تطلع صح)
    const container = document.createElement('div')
    container.style.position = 'fixed'
    container.style.left = '-9999px'
    container.style.top = '-9999px'
    container.style.width = '302px'
    container.style.height = 'auto'
    container.style.opacity = '1'
    container.style.pointerEvents = 'none'
    container.style.zIndex = '-9999'
    container.style.background = '#ffffff'
    container.style.padding = '0'
    container.style.margin = '0'
    container.style.overflow = 'hidden'
    container.innerHTML = htmlContent
    document.body.appendChild(container)

    // 2. انتظار تحميل الخطوط والصور
    await waitForFontsAndImages(container)

    // ✅ انتظار إضافي لضمان تحميل خط Cairo من Google Fonts
    await new Promise(resolve => setTimeout(resolve, 2000))

    // 3. تحويل إلى PNG بجودة عالية باستخدام dom-to-image-more
    const dataUrl = await domtoimage.toPng(container, {
      quality: 1,
      width: 302,
      height: container.scrollHeight,
      bgcolor: '#ffffff',
      pixelRatio: 48,  // ✅ جودة عالية جداً
      style: {
        margin: '0',
        padding: '0',
        background: '#ffffff',
        border: 'none'
      }
    })

    // تحويل data URL لـ Image
    const img = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = reject
      img.src = dataUrl
    })

    // إنشاء canvas من الصورة
    const canvas = document.createElement('canvas')
    canvas.width = img.width
    canvas.height = img.height
    const ctx = canvas.getContext('2d')
    if (ctx) {
      // ملء الخلفية بالأبيض أولاً
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // رسم الصورة فوق الخلفية البيضا
      ctx.drawImage(img, 0, 0)

      // تحويل الرمادي الفاتح لأبيض
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const data = imageData.data

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i]
        const g = data[i + 1]
        const b = data[i + 2]

        // إذا كان اللون رمادي فاتح (قريب من الأبيض)، خليه أبيض نقي
        // لكن خلي الرمادي المتوسط (staff-info background) زي ما هو
        if (r > 240 && g > 240 && b > 240) {
          data[i] = 255     // R
          data[i + 1] = 255 // G
          data[i + 2] = 255 // B
        }
      }

      ctx.putImageData(imageData, 0, 0)
    }

    // 4. إزالة العنصر المؤقت فوراً واستعادة overflow
    document.body.removeChild(container)
    document.body.style.overflow = originalOverflow

    // 5. حساب الأبعاد
    const imgWidth = 80 // 80mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width

    // 6. إنشاء PDF
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [imgWidth, imgHeight],
      compress: true
    })

    // 7. إضافة الصورة (PNG أفضل للنصوص)
    const imgData = canvas.toDataURL('image/png') // ✅ PNG أفضل للنصوص العربية
    pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight, undefined, 'FAST')

    // 8. اسم الملف
    const fileName = options?.fileName || `receipt_${receiptNumber}_${Date.now()}.pdf`

    // 9. تحميل أو إرجاع
    let savedFilePath: string | null = null
    console.log('📥 autoDownload check:', options?.autoDownload !== false)
    if (options?.autoDownload !== false) {
      console.log('✅ Electron API available:', !!(window as any).electron?.savePDFToDocuments)
      // ✅ التحقق من Electron
      if (typeof window !== 'undefined' && (window as any).electron?.savePDFToDocuments) {
        try {
          // ✅ استخدام arraybuffer مباشرة
          const arrayBuffer = pdf.output('arraybuffer')
          console.log('📊 ArrayBuffer size:', arrayBuffer.byteLength)

          // تحويل ArrayBuffer إلى Array من الأرقام (أكثر موثوقية عبر IPC)
          const bytes = new Uint8Array(arrayBuffer)
          const byteArray = Array.from(bytes)
          console.log('📏 ByteArray length:', byteArray.length)
          console.log('🔍 First 10 bytes:', byteArray.slice(0, 10))

          console.log('📤 Calling Electron savePDFToDocuments...')
          const result = await (window as any).electron.savePDFToDocuments(fileName, byteArray)
          console.log('📥 Result:', result)

          if (result.success) {
            savedFilePath = result.filePath
            console.log('✅ PDF saved to:', savedFilePath)
          } else {
            console.error('❌ Electron save failed:', result.error)
            // Fallback للتحميل العادي
            pdf.save(fileName)
          }
        } catch (error) {
          console.error('❌ Exception while saving PDF:', error)
          pdf.save(fileName)
        }
      } else {
        // Fallback للمتصفح العادي
        pdf.save(fileName)
      }
    }

    if (options?.returnBlob) {
      const blob = pdf.output('blob')
      const url = URL.createObjectURL(blob)
      return { blob, url, filePath: savedFilePath }
    }

    return { blob: null, url: null, filePath: savedFilePath }
  } catch (error) {
    console.error('❌ خطأ في تحويل الإيصال إلى PDF:', error)
    throw error
  }
}

/**
 * انتظار تحميل الخطوط والصور
 */
async function waitForFontsAndImages(container: HTMLElement): Promise<void> {
  // انتظار الخطوط
  if (document.fonts && document.fonts.ready) {
    await document.fonts.ready
  }

  // انتظار الصور
  const images = container.querySelectorAll('img')
  const imagePromises = Array.from(images).map(img => {
    if (img.complete) return Promise.resolve()
    return new Promise((resolve) => {
      img.onload = () => resolve(null)
      img.onerror = () => resolve(null) // تجاهل أخطاء الصور
      setTimeout(() => resolve(null), 3000) // timeout بعد 3 ثواني
    })
  })

  await Promise.all(imagePromises)

  // انتظار إضافي لضمان الرندر
  await new Promise(resolve => setTimeout(resolve, 500))
}

/**
 * طباعة + حفظ PDF
 */
export async function printAndSaveArabicPDF(
  htmlContent: string,
  receiptNumber: number,
  options?: {
    skipPrint?: boolean
    autoDownload?: boolean
  }
): Promise<{ success: boolean; pdfUrl?: string; filePath?: string }> {
  try {
    // 1. الطباعة التقليدية
    if (!options?.skipPrint) {
      const printWindow = window.open('', '_blank', 'width=302,height=600,scrollbars=no')

      if (printWindow) {
        printWindow.document.open()
        printWindow.document.write(htmlContent)
        printWindow.document.close()

        printWindow.onload = function () {
          setTimeout(() => {
            printWindow.focus()
            printWindow.print()

            printWindow.onafterprint = function () {
              printWindow.close()
            }

            setTimeout(() => {
              if (!printWindow.closed) {
                printWindow.close()
              }
            }, 1000)
          }, 500)
        }
      }
    }

    // 2. تحويل PDF مع دعم العربي
    const { url, filePath } = await generateArabicPDF(htmlContent, receiptNumber, {
      autoDownload: options?.autoDownload !== false,
      returnBlob: true,
    })

    return { success: true, pdfUrl: url || undefined, filePath: filePath || undefined }
  } catch (error) {
    console.error('❌ خطأ في طباعة/حفظ PDF:', error)
    return { success: false }
  }
}
