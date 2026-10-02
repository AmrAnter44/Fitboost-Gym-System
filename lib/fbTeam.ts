'use client'
/**
 * 📱 جسر أبلكيشن FB Team (WebView) — الصفحات دي جوه السيستم عشان أي تعديل
 * يوصل للموظفين من غير ما نعمل أبديت للأبلكيشن.
 *
 * البروتوكول: الصفحة → postMessage({ fbteam: 1, id, type }) ؛ الأبلكيشن بيرد بـ
 * window.__fbteamResolve(id, result). الأبلكيشن بيضيف "FBTeam/x" للـ user agent.
 */

export type FBLocation = { lat: number; lng: number; accuracy: number; mocked: boolean }

declare global {
  interface Window {
    ReactNativeWebView?: { postMessage: (msg: string) => void }
    __fbteamResolve?: (id: string, result: any) => void
  }
}

export function inFBTeamApp(): boolean {
  return typeof window !== 'undefined' && !!window.ReactNativeWebView && /FBTeam\//.test(navigator.userAgent)
}

const pending = new Map<string, (r: any) => void>()

function ensureResolver() {
  if (typeof window === 'undefined' || window.__fbteamResolve) return
  window.__fbteamResolve = (id, result) => {
    const fn = pending.get(id)
    if (fn) { pending.delete(id); fn(result) }
  }
}

function ask<T>(type: string, timeoutMs = 25_000): Promise<T> {
  ensureResolver()
  return new Promise((resolve, reject) => {
    if (!inFBTeamApp()) return reject(new Error('not-in-app'))
    const id = Math.random().toString(36).slice(2)
    const t = setTimeout(() => { pending.delete(id); reject(new Error('timeout')) }, timeoutMs)
    pending.set(id, (r) => {
      clearTimeout(t)
      if (r && r.error) reject(new Error(String(r.error)))
      else resolve(r as T)
    })
    window.ReactNativeWebView!.postMessage(JSON.stringify({ fbteam: 1, id, type }))
  })
}

/** موقع الموبايل من الأبلكيشن (فيه كشف اللوكيشن المزيّف) */
export function getAppLocation(): Promise<FBLocation> {
  return ask<FBLocation>('location')
}
