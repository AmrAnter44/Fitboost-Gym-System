// lib/fetchUserSettings.ts
// كان DarkModeContext و LanguageContext كل واحد بيطلب /api/user/settings لوحده
// مع كل تحميل — طلب واحد مشترك على مستوى النافذة يكفي الاتنين
let settingsPromise: Promise<any | null> | null = null

export function fetchUserSettingsOnce(): Promise<any | null> {
  if (!settingsPromise) {
    settingsPromise = fetch('/api/user/settings')
      .then(res => (res.ok ? res.json() : null))
      .catch(() => null)
  }
  return settingsPromise
}
