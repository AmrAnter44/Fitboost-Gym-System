import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * Test endpoint to check Supabase connection and gyms table
 */
export async function GET() {
  try {
    // Test 1: Check connection
    console.log('🧪 Testing Supabase connection...')
    console.log('📍 Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)

    // Test 2: Fetch from gyms table
    const { data: gyms, error: gymsError } = await supabaseAdmin
      .from('gyms')
      .select('*')
      .limit(10)

    if (gymsError) {
      console.error('❌ Gyms table error:', gymsError)
      return NextResponse.json({
        success: false,
        error: gymsError.message,
        details: gymsError,
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL
      }, { status: 500 })
    }

    console.log('✅ Gyms fetched:', gyms?.length || 0)

    // Test 3: Fetch from branches table
    const { data: branches, error: branchesError } = await supabaseAdmin
      .from('branches')
      .select('*')
      .limit(10)

    if (branchesError) {
      console.error('⚠️ Branches table error:', branchesError)
    }

    return NextResponse.json({
      success: true,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
      gyms: {
        count: gyms?.length || 0,
        data: gyms || []
      },
      branches: {
        count: branches?.length || 0,
        data: branches || []
      }
    })
  } catch (error: any) {
    console.error('❌ Test endpoint error:', error)
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 })
  }
}
