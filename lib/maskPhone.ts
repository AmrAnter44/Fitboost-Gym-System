//  إخفاء الرقم: نسيب أول 3 وآخر 2 والباقي نقط
//  بيتستخدم مع قيود hideFollowUpNumbers / hideMemberNumbers (برّه في القوايم وجوّه في التفاصيل)
export function maskPhone(p?: string | null): string {
  const s = (p || '').replace(/\s/g, '')
  if (!s) return ''
  if (s.length <= 5) return '•'.repeat(s.length)
  return s.slice(0, 3) + '•'.repeat(Math.max(4, s.length - 5)) + s.slice(-2)
}

//  يعرض الرقم مشفّر لو القيد شغّال، وإلا يرجّعه زي ما هو
export function displayPhone(p: string | null | undefined, hide: boolean): string {
  return hide ? maskPhone(p) : (p || '')
}
