//  Smart Bulk Script — shared localStorage helpers & pure utilities
//  Extracted من app/followups/page.tsx عشان الصفحة والـ BulkSenderContext يستخدموا نفس المصدر

//  Daily counter — عدد الرسائل المرسلة النهاردة
export function getDailyCount(): number {
  try {
    const data = JSON.parse(localStorage.getItem('wa-bulk-daily') || '{}')
    const today = new Date().toISOString().split('T')[0]
    return data.date === today ? (data.count || 0) : 0
  } catch { return 0 }
}

export function incrementDailyCount(amount: number): void {
  const today = new Date().toISOString().split('T')[0]
  const current = getDailyCount()
  localStorage.setItem('wa-bulk-daily', JSON.stringify({ date: today, count: current + amount }))
}

//  Last session metadata
export function getLastSession(): { date: string, sent: number, filter: string } | null {
  try {
    return JSON.parse(localStorage.getItem('wa-bulk-last-session') || 'null')
  } catch { return null }
}

export function saveLastSession(sent: number, filter: string): void {
  localStorage.setItem('wa-bulk-last-session', JSON.stringify({
    //  احفظ ISO عشان نقدر نعرضه بالـ locale الحالي وقت العرض
    date: new Date().toISOString(),
    sent,
    filter
  }))
}

//  Text variation (anti-ban) — يضيف اختلاف بسيط على كل رسالة
export function addTextVariation(text: string): string {
  const variations = [
    () => text + ' ',
    () => text + '​', // zero-width space
    () => text + '‌', // zero-width non-joiner
    () => text.replace(/\./g, () => Math.random() > 0.5 ? '.' : '..'),
    () => text + (Math.random() > 0.5 ? ' .' : ''),
    () => text.replace(/!/, () => Math.random() > 0.5 ? '!' : '!!'),
    () => text + '\n',
  ]
  const variation = variations[Math.floor(Math.random() * variations.length)]
  return variation()
}

//  Presets
export function getBulkPresets(): { name: string, messages: string[] }[] {
  try {
    return JSON.parse(localStorage.getItem('wa-bulk-presets') || '[]')
  } catch { return [] }
}

export function saveBulkPreset(name: string, messages: string[]): void {
  const presets = getBulkPresets()
  const existing = presets.findIndex(p => p.name === name)
  if (existing >= 0) presets[existing].messages = messages
  else presets.push({ name, messages })
  localStorage.setItem('wa-bulk-presets', JSON.stringify(presets))
}

export function deleteBulkPreset(name: string): void {
  const presets = getBulkPresets().filter(p => p.name !== name)
  localStorage.setItem('wa-bulk-presets', JSON.stringify(presets))
}
