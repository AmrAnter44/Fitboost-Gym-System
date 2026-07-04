import path from 'path'
import { existsSync } from 'fs'

/**
 * يحدّد المسار الفعلي لملف قاعدة البيانات (gym.db).
 *
 * المشكلة اللي بيحلّها: في نسخة Electron الـ DB الحقيقي بيكون في
 * userData/database/gym.db (بيتمرّر عبر DATABASE_URL كمسار مطلق)، مش في
 * process.cwd()/prisma/gym.db. الكود القديم كان بيفترض cwd فبيفشل في الإنتاج.
 *
 * بنشتق المسار من DATABASE_URL الأول، وبعدين fallback على أماكن معروفة.
 */
export function resolveDbPath(): string {
  const url = process.env.DATABASE_URL || ''
  const candidates: string[] = []

  if (url.startsWith('file:')) {
    // شيل البادئة file: وأي query params (?connection_limit=1 …)
    let p = url.slice('file:'.length).split('?')[0]
    if (path.isAbsolute(p)) {
      candidates.push(p)
    } else {
      // Prisma بيحلّ المسارات النسبية لـ SQLite نسبةً لمجلد الـ schema (prisma/)
      candidates.push(path.resolve(process.cwd(), 'prisma', p))
      candidates.push(path.resolve(process.cwd(), p))
    }
  }

  // Fallbacks معروفة
  candidates.push(path.join(process.cwd(), 'prisma', 'gym.db'))
  candidates.push(path.join(process.cwd(), 'prisma', 'prisma', 'gym.db'))

  for (const c of candidates) {
    if (existsSync(c)) return c
  }
  // أفضل تخمين حتى لو مش موجود (المستدعي بيتعامل مع الغياب)
  return candidates[0]
}
