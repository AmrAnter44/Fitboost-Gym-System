/**
 * بورتات الخدمات الداخلية — الجانب اللي بيقرا من Next.
 *
 * الافتراضي 4002 زي ما كان دايماً، فنسخة الديسكتوب مابتتأثرش خالص.
 * بنقراهم من الـ env عشان نقدر نشغّل أكتر من نسخة على نفس السيرفر
 * (كل جيم بمجموعة بورتات مختلفة).
 *
 * ⚠️ لازم تفضل قيم `WHATSAPP_PORT` متطابقة بين عملية Next وعملية
 *    الـ sidecar — deploy/ecosystem.gym.config.js بيقراها من .env
 *    ويمرّرها للاتنين.
 *
 * دي كود سيرفر بس (route handlers)، فـ Next بيقرا الـ env وقت التشغيل
 * مش وقت البناء — يعني تغيير البورت مايحتاجش إعادة بناء.
 */

export const WHATSAPP_PORT = Number(process.env.WHATSAPP_PORT) || 4002

export const WHATSAPP_SIDECAR = `http://127.0.0.1:${WHATSAPP_PORT}`
