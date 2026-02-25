import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

// ✅ دالة لإنشاء fresh client في كل مرة (no singleton caching)
export function createFreshSupabaseClient() {
  return createClient(supabaseUrl, supabaseAnonKey, {
    db: {
      schema: 'public',
    },
    auth: {
      persistSession: false,
    },
    global: {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    },
  })
}

// ⚠️ Deprecated: استخدم createFreshSupabaseClient() بدلاً من هذا
// هذا موجود للتوافق مع الكود القديم فقط
export const supabase = createFreshSupabaseClient()
