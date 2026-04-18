import { useLanguage } from '../contexts/LanguageContext'

/**
 * Hook مساعد لجلب direction بسهولة
 * يستخدم في المكونات التي تحتاج فقط dir attribute
 */
export function useDirection() {
  const { direction } = useLanguage()
  return direction
}
