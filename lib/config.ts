/**
 * External Links Configuration
 * مركز تكوين الروابط الخارجية
 *
 * هذا الملف يحتوي على جميع الروابط الخارجية المستخدمة في التطبيق
 * يمكن تعديلها من خلال environment variables أو القيم الافتراضية
 *
 * Environment Variables:
 * - NEXT_PUBLIC_GITHUB_LICENSE_URL: رابط ملف الترخيص
 * - NEXT_PUBLIC_GITHUB_REPO_URL: رابط المستودع الرئيسي
 * - NEXT_PUBLIC_GITHUB_RELEASES_URL: رابط صفحة الإصدارات
 * - NEXT_PUBLIC_SUPPORT_WHATSAPP: رابط الدعم عبر واتساب
 * - NEXT_PUBLIC_SUPPORT_WEBSITE: رابط الموقع الرسمي
 */

export const EXTERNAL_LINKS = {
  github: {
    /**
     * رابط ملف الترخيص على GitHub
     * يُستخدم للتحقق من صلاحية التطبيق
     */
    license: process.env.NEXT_PUBLIC_GITHUB_LICENSE_URL || 'https://raw.githubusercontent.com/AmrAnter44/systems-lock/main/xgym.json',

    /**
     * رابط المستودع الرئيسي على GitHub
     * يُستخدم للوصول إلى الكود المصدري
     */
    repo: process.env.NEXT_PUBLIC_GITHUB_REPO_URL || 'https://github.com/AmrAnter44/sys-Xgym',

    /**
     * رابط صفحة الإصدارات على GitHub
     * يُستخدم للتحقق من التحديثات المتاحة
     */
    releases: process.env.NEXT_PUBLIC_GITHUB_RELEASES_URL || 'https://github.com/AmrAnter44/sys-Xgym/releases',
  },

  support: {
    /**
     * رابط الدعم الفني عبر واتساب
     * يُستخدم للتواصل مع فريق الدعم
     */
    whatsapp: process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || 'https://wa.me/201028518754',

    /**
     * رابط الموقع الرسمي للدعم
     * يُستخدم للوصول إلى الموارد والوثائق
     */
    website: process.env.NEXT_PUBLIC_SUPPORT_WEBSITE || 'https://fitboost.website'
  }
} as const

/**
 * Helper function to get GitHub API URL from repo URL
 * دالة مساعدة للحصول على رابط GitHub API من رابط المستودع
 */
export function getGitHubApiUrl(repoUrl: string = EXTERNAL_LINKS.github.repo): string {
  return `${repoUrl.replace('github.com', 'api.github.com/repos')}/releases/latest`
}
