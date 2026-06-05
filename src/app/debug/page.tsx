'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function DebugPage() {
  const [info, setInfo] = useState<any>(null)

  useEffect(() => {
    async function run() {
      const supabase = createClient()
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      
      if (!user) {
        setInfo({ error: 'Not logged in', userError })
        return
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      setInfo({
        user_id: user.id,
        user_email: user.email,
        profile,
        profileError,
      })
    }
    run()
  }, [])

  return (
    <div style={{ padding: 32, fontFamily: 'monospace', fontSize: 14 }}>
      <h2 style={{ marginBottom: 16 }}>Debug Info</h2>
      <pre style={{ background: '#f1f5f9', padding: 16, borderRadius: 8, whiteSpace: 'pre-wrap' }}>
        {JSON.stringify(info, null, 2)}
      </pre>
    </div>
  )
}
