// نظام PDF محسّن للعربي - استخدام Cairo font
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

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
): Promise<{ blob: Blob | null; url: string | null }> {
  try {
    // 1. إنشاء عنصر مؤقت
    const container = document.createElement('div')
    container.style.position = 'fixed'
    container.style.left = '-9999px'
    container.style.top = '0'
    container.style.width = '302px' // 80mm
    container.style.backgroundColor = 'white'
    container.innerHTML = htmlContent
    document.body.appendChild(container)

    // 2. انتظار تحميل الخطوط والصور
    await waitForFontsAndImages(container)

    // 3. تحويل إلى Canvas بجودة عالية
    const canvas = await html2canvas(container, {
      scale: 4, // ✅ دقة عالية جداً للعربي
      useCORS: true,
      allowTaint: true,
      logging: false,
      windowWidth: 302,
      windowHeight: container.scrollHeight,
      backgroundColor: '#ffffff',
      imageTimeout: 0,
      // ✅ ضبط إضافي للخطوط
      onclone: (clonedDoc) => {
        const body = clonedDoc.body
        body.style.fontFamily = "'Segoe UI', 'Tahoma', 'Arial', 'DejaVu Sans', sans-serif"
        body.style.webkitFontSmoothing = 'antialiased'
        body.style.mozOsxFontSmoothing = 'grayscale'
      }
    })

    // 4. إزالة العنصر المؤقت
    document.body.removeChild(container)

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

    // 7. إضافة الصورة
    const imgData = canvas.toDataURL('image/jpeg', 0.95) // JPEG بجودة 95%
    pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight)

    // 8. اسم الملف
    const fileName = options?.fileName || `receipt_${receiptNumber}_${Date.now()}.pdf`

    // 9. تحميل أو إرجاع
    if (options?.autoDownload !== false) {
      pdf.save(fileName)
    }

    if (options?.returnBlob) {
      const blob = pdf.output('blob')
      const url = URL.createObjectURL(blob)
      return { blob, url }
    }

    return { blob: null, url: null }
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
    return new Promise((resolve, reject) => {
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
): Promise<{ success: boolean; pdfUrl?: string }> {
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
    const { url } = await generateArabicPDF(htmlContent, receiptNumber, {
      autoDownload: options?.autoDownload !== false,
      returnBlob: true,
    })

    return { success: true, pdfUrl: url || undefined }
  } catch (error) {
    console.error('❌ خطأ في طباعة/حفظ PDF:', error)
    return { success: false }
  }
}
