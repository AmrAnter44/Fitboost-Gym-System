// ==========================================
// ضغط الصور في المتصفح قبل الرفع — بدل ما صورة موبايل 3-5MB تتخزن زي ما هي
// على الجهاز، بننزّلها لـ ~1024px بجودة JPEG عالية (~80-150KB).
// ده بيقلل مساحة فولدر uploads بـ 20-30x وبيخلي الباك أب السحابي أسرع.
// بيشتغل في أي متصفح/Electron — مفيش native dependencies.
// ==========================================

const MIN_SIZE_TO_COMPRESS = 150 * 1024 // أصغر من كده مش مستاهل إعادة ضغط
const DEFAULT_MAX_DIM = 1024
const DEFAULT_QUALITY = 0.82

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  // createImageBitmap أسرع وبيظبط اتجاه الصورة من الـ EXIF
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions)
    } catch {
      // بعض الصيغ/المتصفحات — نكمل بالـ fallback
    }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image load failed')) }
    img.src = url
  })
}

/**
 * بتضغط صورة قبل الرفع. لو الصورة صغيرة أصلًا أو الضغط فشل لأي سبب،
 * بترجع الملف الأصلي زي ما هو — الرفع عمره ما يتعطل بسببها.
 */
export async function compressImage(
  file: File,
  maxDim: number = DEFAULT_MAX_DIM,
  quality: number = DEFAULT_QUALITY
): Promise<File> {
  try {
    if (!file.type.startsWith('image/') || file.size < MIN_SIZE_TO_COMPRESS) {
      return file
    }

    const bitmap = await loadBitmap(file)
    const srcW = 'naturalWidth' in bitmap ? bitmap.naturalWidth : bitmap.width
    const srcH = 'naturalHeight' in bitmap ? bitmap.naturalHeight : bitmap.height
    if (!srcW || !srcH) return file

    const scale = Math.min(1, maxDim / Math.max(srcW, srcH))
    const outW = Math.max(1, Math.round(srcW * scale))
    const outH = Math.max(1, Math.round(srcH * scale))

    const canvas = document.createElement('canvas')
    canvas.width = outW
    canvas.height = outH
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    // خلفية بيضا — الـ PNG الشفاف لما يتحول JPEG الشفافية بتبقى سودا من غيرها
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, outW, outH)
    ctx.drawImage(bitmap as CanvasImageSource, 0, 0, outW, outH)
    if ('close' in bitmap) bitmap.close()

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', quality)
    )
    if (!blob || blob.size >= file.size) return file

    const newName = file.name.replace(/\.[^.]+$/, '') + '.jpg'
    return new File([blob], newName, { type: 'image/jpeg' })
  } catch {
    return file
  }
}
