// app/api/serve-image/route.ts
// خدمة الصور من مسارات Electron userData / public/uploads
// حماية ضد path traversal عبر allowlist للجذور المسموح بها.
import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { existsSync, statSync } from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

const ALLOWED_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif'])
const TRANSPARENT_PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
)

function transparentResponse() {
  return new NextResponse(TRANSPARENT_PIXEL, {
    status: 200,
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-cache' }
  })
}

/** الجذور المسموح قراءة الصور منها */
function allowedRoots(): string[] {
  const roots: string[] = []
  if (process.env.UPLOADS_PATH) roots.push(path.resolve(process.env.UPLOADS_PATH))
  roots.push(path.resolve(process.cwd(), 'public', 'uploads'))
  roots.push(path.resolve(process.cwd(), 'public', 'photos'))
  roots.push(path.resolve(process.cwd(), 'uploads'))
  return roots
}

/** هل الـ resolved path داخل واحد من الجذور المسموحة */
function isInsideAllowedRoot(resolved: string): boolean {
  return allowedRoots().some((root) => {
    const withSep = root.endsWith(path.sep) ? root : root + path.sep
    return resolved === root || resolved.startsWith(withSep)
  })
}

/**
 * يتحقق أن الملف الناتج:
 *   1) داخل أحد الجذور المسموحة (مش path traversal خارج الـ uploads)
 *   2) موجود فعلاً
 *   3) له امتداد صورة مسموح
 */
function validateResolvedFile(resolved: string): string | null {
  if (!isInsideAllowedRoot(resolved)) return null
  if (!existsSync(resolved)) return null
  try { if (!statSync(resolved).isFile()) return null } catch { return null }
  const ext = path.extname(resolved).toLowerCase()
  if (!ALLOWED_EXTS.has(ext)) return null
  return resolved
}

/**
 * يقبل:
 *   - absolute path (جاي من upload-image في Electron) — ما دام داخل UPLOADS_PATH
 *   - relative path (مثل "uploads/members/xxx.jpg") — يحلّها داخل الجذور المسموحة
 */
function resolveSafeImagePath(imagePath: string): string | null {
  // absolute path → لازم يكون داخل جذر مسموح
  if (path.isAbsolute(imagePath)) {
    const resolved = path.resolve(imagePath)
    return validateResolvedFile(resolved)
  }

  // relative path
  const cleaned = imagePath.replace(/^\/+/, '')
  if (cleaned.includes('..')) return null // أي محاولة traversal → رفض

  for (const root of allowedRoots()) {
    const withoutUploadsPrefix = cleaned.replace(/^uploads[\/\\]/, '')
    const candidates = [
      path.resolve(root, cleaned),
      path.resolve(root, withoutUploadsPrefix),
      path.resolve(root, path.basename(path.dirname(cleaned)), path.basename(cleaned))
    ]
    for (const candidate of candidates) {
      const ok = validateResolvedFile(candidate)
      if (ok) return ok
    }
  }

  return null
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const imagePath = searchParams.get('path') || ''

    if (!imagePath || imagePath.length > 1024) {
      return NextResponse.json({ error: 'مسار الصورة مطلوب' }, { status: 400 })
    }

    const resolvedPath = resolveSafeImagePath(imagePath)
    if (!resolvedPath) {
      return transparentResponse()
    }

    const imageBuffer = await readFile(resolvedPath)
    const ext = path.extname(resolvedPath).toLowerCase()
    const contentTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.gif': 'image/gif'
    }

    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentTypes[ext] || 'application/octet-stream',
        'Cache-Control': 'public, max-age=31536000'
      }
    })
  } catch {
    return transparentResponse()
  }
}
