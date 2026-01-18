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
    // 1. إنشاء overlay للتحميل
    const overlay = document.createElement('div')
    overlay.style.position = 'fixed'
    overlay.style.inset = '0'
    overlay.style.backgroundColor = 'rgba(0,0,0,0.8)'
    overlay.style.zIndex = '999998'
    overlay.style.display = 'flex'
    overlay.style.alignItems = 'center'
    overlay.style.justifyContent = 'center'
    overlay.innerHTML = '<div style="color: white; font-size: 20px; font-family: Tahoma;">جاري تحويل الإيصال لـ PDF...</div>'
    document.body.appendChild(overlay)

    // 2. إنشاء عنصر مؤقت (مرئي لضمان الرندر الصحيح)
    const container = document.createElement('div')
    container.style.position = 'fixed'
    container.style.left = '50%'
    container.style.top = '50%'
    container.style.transform = 'translate(-50%, -50%)'
    container.style.width = '302px' // 80mm
    container.style.backgroundColor = 'white'
    container.style.zIndex = '999999'
    container.style.padding = '10px'
    container.style.boxShadow = '0 0 50px rgba(0,0,0,0.5)'
    container.style.borderRadius = '8px'
    container.innerHTML = htmlContent
    document.body.appendChild(container)

    // 2. انتظار تحميل الخطوط والصور
    await waitForFontsAndImages(container)

    // ✅ انتظار إضافي لضمان الرندر الكامل للحروف العربية
    await new Promise(resolve => setTimeout(resolve, 1000))

    // 3. تحويل إلى Canvas بجودة عالية
    const canvas = await html2canvas(container, {
      scale: 5, // ✅ دقة أعلى للحروف العربية المتصلة
      useCORS: true,
      allowTaint: true,
      logging: true, // ✅ تفعيل الـ logging للتشخيص
      windowWidth: 302,
      windowHeight: container.scrollHeight,
      backgroundColor: '#ffffff',
      imageTimeout: 5000,
      letterRendering: true, // ✅ مهم للعربي
      // ✅ ضبط إضافي للخطوط
      onclone: (clonedDoc) => {
        const body = clonedDoc.body
        // استخدام خط نظام واضح
        body.style.fontFamily = "Tahoma, 'Segoe UI', Arial, sans-serif"
        body.style.fontSize = '15px' // حجم أكبر قليلاً
        body.style.webkitFontSmoothing = 'antialiased'
        body.style.mozOsxFontSmoothing = 'grayscale'
        body.style.textRendering = 'optimizeLegibility'

        // التأكد من RTL
        const allDivs = body.querySelectorAll('div, p, span')
        allDivs.forEach(el => {
          (el as HTMLElement).style.direction = 'rtl'
          (el as HTMLElement).style.unicodeBidi = 'embed'
        })
      }
    })

    // 4. إزالة العنصر المؤقت والـ overlay
    document.body.removeChild(container)
    document.body.removeChild(overlay)

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
