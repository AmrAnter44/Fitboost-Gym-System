// Test Supabase Connection
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://nsuhkppuwqdiabvabgij.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5zdWhrcHB1d3FkaWFidmFiZ2lqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTA1NzQwMCwiZXhwIjoyMDg0NjMzNDAwfQ.6krAHtpEyV8nNTJAzZP0u1GtDGtj3FeAK2MlRZYqETI'

const supabase = createClient(supabaseUrl, supabaseKey)

async function testConnection() {
  console.log('Testing Supabase connection...')

  try {
    // Test insert
    const { data, error } = await supabase
      .from('error_logs')
      .insert({
        error_type: 'TEST',
        message: 'Test from Node.js script',
        severity: 'LOW'
      })
      .select()

    if (error) {
      console.error('❌ Error:', error)
    } else {
      console.log('✅ Success! Data:', data)
    }
  } catch (err) {
    console.error('❌ Exception:', err)
  }
}

testConnection()
