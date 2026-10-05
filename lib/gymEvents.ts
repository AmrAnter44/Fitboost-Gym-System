// 📣 تحقق بيانات الإيفنت (مشترك بين POST و PATCH)
export function parseEventBody(b: any) {
  const title = typeof b?.title === 'string' ? b.title.trim().slice(0, 120) : ''
  const description = typeof b?.description === 'string' ? b.description.trim().slice(0, 1000) || null : null
  const startsAt = b?.startsAt ? new Date(b.startsAt) : null
  const endsAt = b?.endsAt ? new Date(b.endsAt) : null
  if (!title) return { error: 'اسم الإيفنت مطلوب' }
  if (!startsAt || isNaN(startsAt.getTime())) return { error: 'ميعاد الإيفنت مطلوب' }
  if (endsAt && (isNaN(endsAt.getTime()) || endsAt <= startsAt)) return { error: 'ميعاد النهاية لازم يكون بعد البداية' }
  return { data: { title, description, startsAt, endsAt, isActive: b?.isActive !== false } }
}
