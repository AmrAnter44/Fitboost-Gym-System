/**
 * بورتات ومسارات خدمة الواتساب — الجانب اللي بيقرا من الـ sidecar.
 *
 * كل القيم ليها نفس الافتراضي القديم، فنسخة الديسكتوب شغالة زي ما هي
 * من غير أي متغير بيئة. الـ env بيتستخدم بس لما نشغّل أكتر من جيم على
 * نفس السيرفر.
 *
 *   WHATSAPP_PORT      البورت اللي الـ sidecar بيسمع عليه   (4002)
 *   APP_PORT / PORT    بورت تطبيق Next اللي بيرجع يكلّمه     (4001)
 *   WHATSAPP_AUTH_DIR  مجلد جلسات Baileys                   (~/.fitboost-whatsapp)
 *
 * ⚠️ مجلد الجلسات لازم يكون مختلف لكل جيم — لو اتنين شاركوا نفس
 *    المجلد هيدوسوا على جلسة بعض والرقمين هيتفصلوا.
 */

const os = require('os');
const path = require('path');

const WA_PORT = Number(process.env.WHATSAPP_PORT) || 4002;
const APP_PORT = Number(process.env.APP_PORT || process.env.PORT) || 4001;

module.exports = {
  WA_PORT,
  APP_PORT,
  API_BASE: `http://127.0.0.1:${APP_PORT}`,
  AUTH_BASE: process.env.WHATSAPP_AUTH_DIR || path.join(os.homedir(), '.fitboost-whatsapp'),
};
