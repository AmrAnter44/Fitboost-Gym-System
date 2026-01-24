// نظام تحويل الإيصالات إلى PDF
// ⚠️ استخدام dynamic imports لتجنب مشاكل SSR
// import jsPDF from 'jspdf'
// import html2canvas from 'html2canvas'

interface ReceiptData {
  receiptNumber: number
  type: string
  amount: number
  details: any
  date: Date
}

/**
 * تحويل HTML إلى PDF وحفظه
 */
export async function generateReceiptPDF(
  htmlContent: string,
  receiptNumber: number,
  options?: {
    autoDownload?: boolean
    returnBlob?: boolean
    fileName?: string
  }
): Promise<{ blob: Blob | null; url: string | null }> {
  try {
    // ✅ Dynamic imports للمكتبات اللي بتستخدم DOM APIs
    const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
      import('jspdf'),
      import('html2canvas')
    ])

    // إنشاء عنصر مؤقت للـ HTML
    const container = document.createElement('div')
    container.style.position = 'absolute'
    container.style.left = '-9999px'
    container.style.width = '302px' // 80mm
    container.innerHTML = htmlContent
    document.body.appendChild(container)

    // ✅ إضافة تأخير لضمان تحميل الخطوط
    await new Promise(resolve => setTimeout(resolve, 300))

    // تحويل HTML إلى Canvas مع دعم العربي
    const canvas = await html2canvas(container, {
      scale: 3, // جودة أعلى للعربي
      useCORS: true,
      allowTaint: true,
      logging: false,
      windowWidth: 302,
      windowHeight: container.scrollHeight,
      imageTimeout: 0,
      // ✅ ضبط الخطوط
      onclone: (clonedDoc: Document) => {
        const clonedContainer = clonedDoc.querySelector('body > div') as HTMLElement | null
        if (clonedContainer) {
          // التأكد من تطبيق الخطوط العربية
          clonedContainer.style.fontFamily = "'Segoe UI', Tahoma, Arial, sans-serif"
          clonedContainer.style.direction = 'rtl'
        }
      }
    })

    // إزالة العنصر المؤقت
    document.body.removeChild(container)

    // إنشاء PDF
    const imgData = canvas.toDataURL('image/png')
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [80, (canvas.height * 80) / canvas.width], // 80mm width, auto height
    })

    pdf.addImage(imgData, 'PNG', 0, 0, 80, (canvas.height * 80) / canvas.width)

    // اسم الملف
    const fileName = options?.fileName || `receipt_${receiptNumber}_${Date.now()}.pdf`

    // تحميل تلقائي إذا مطلوب
    if (options?.autoDownload !== false) {
      pdf.save(fileName)
    }

    // إرجاع Blob إذا مطلوب (للإرسال على WhatsApp مثلاً)
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
 * طباعة الإيصال + تحويله إلى PDF
 */
export async function printAndSavePDF(
  htmlContent: string,
  receiptNumber: number,
  options?: {
    skipPrint?: boolean
    autoDownload?: boolean
  }
): Promise<{ success: boolean; pdfUrl?: string }> {
  try {
    // 1. الطباعة التقليدية (إذا لم يتم تعطيلها)
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

    // 2. تحويل إلى PDF
    const { url } = await generateReceiptPDF(htmlContent, receiptNumber, {
      autoDownload: options?.autoDownload !== false,
      returnBlob: true,
    })

    return { success: true, pdfUrl: url || undefined }
  } catch (error) {
    console.error('❌ خطأ في طباعة/حفظ الإيصال:', error)
    return { success: false }
  }
}

/**
 * حفظ PDF في مجلد محلي (Electron)
 */
export async function savePDFLocally(
  htmlContent: string,
  receiptNumber: number,
  folderPath?: string
): Promise<{ success: boolean; filePath?: string }> {
  try {
    const { blob } = await generateReceiptPDF(htmlContent, receiptNumber, {
      autoDownload: false,
      returnBlob: true,
    })

    if (!blob) {
      throw new Error('فشل إنشاء PDF')
    }

    // في Electron، يمكن حفظ الملف في مجلد محدد
    if (window.electron?.savePDF) {
      const fileName = `receipt_${receiptNumber}_${Date.now()}.pdf`
      const buffer = await blob.arrayBuffer()
      const result = await window.electron.savePDF(
        Buffer.from(buffer),
        fileName,
        folderPath || 'receipts'
      )

      return { success: true, filePath: result.filePath }
    }

    // في المتصفح، حفظ عادي
    const fileName = `receipt_${receiptNumber}.pdf`
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    link.click()
    URL.revokeObjectURL(url)

    return { success: true, filePath: fileName }
  } catch (error) {
    console.error('❌ خطأ في حفظ PDF محلياً:', error)
    return { success: false }
  }
}

/**
 * مشاركة PDF عبر WhatsApp Web
 */
export async function sharePDFWhatsApp(
  htmlContent: string,
  receiptNumber: number,
  phoneNumber: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // تحويل إلى PDF
    const { blob } = await generateReceiptPDF(htmlContent, receiptNumber, {
      autoDownload: false,
      returnBlob: true,
    })

    if (!blob) {
      throw new Error('فشل إنشاء PDF')
    }

    // في Electron، استخدام الـ API الخاص
    if (window.electron?.shareWhatsApp) {
      const buffer = await blob.arrayBuffer()
      await window.electron.shareWhatsApp(phoneNumber, Buffer.from(buffer), `receipt_${receiptNumber}.pdf`)
      return { success: true }
    }

    // في المتصفح، فتح WhatsApp Web مع رسالة
    const message = encodeURIComponent(
      `إيصال رقم ${receiptNumber}\n\nتم إرسال الإيصال كملف PDF. يرجى تحميله من الرابط أدناه.`
    )
    window.open(`https://wa.me/${phoneNumber}?text=${message}`, '_blank')

    // تحميل PDF بشكل منفصل (لأن WhatsApp Web لا يدعم إرفاق ملفات مباشرة)
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `receipt_${receiptNumber}.pdf`
    link.click()
    URL.revokeObjectURL(url)

    return { success: true }
  } catch (error) {
    console.error('❌ خطأ في مشاركة PDF عبر WhatsApp:', error)
    return { success: false, error: (error as Error).message }
  }
}
