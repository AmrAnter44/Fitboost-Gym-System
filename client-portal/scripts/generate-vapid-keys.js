/**
 * Generate VAPID keys for Web Push Notifications
 *
 * Run this script once to generate VAPID keys:
 * node scripts/generate-vapid-keys.js
 *
 * Then add the keys to your .env.local file
 */

const webpush = require('web-push');

console.log('\n🔐 Generating VAPID keys for Web Push Notifications...\n');

const vapidKeys = webpush.generateVAPIDKeys();

console.log('✅ VAPID Keys Generated!\n');
console.log('Add these to your .env.local file:\n');
console.log('─'.repeat(60));
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`);
console.log('─'.repeat(60));
console.log('\n⚠️  Keep the PRIVATE key secret! Never commit it to git.\n');
console.log('📝 Also add your contact email:');
console.log('VAPID_SUBJECT=mailto:your-email@example.com\n');
