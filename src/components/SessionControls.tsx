'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface Props {
  sessionId: string
  currentStatus: 'open' | 'closed' | 'completed' | 'cancelled'
}

export default function SessionControls({ sessionId, currentStatus }: Props) {
  const [status, setStatus] = useState(currentStatus)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const updateStatus = async (newStatus: string) => {
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('sessions')
      .update({ status: newStatus })
      .eq('id', sessionId)

    if (!error) {
      setStatus(newStatus as any)
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <div className="flex items-center gap-2 flex-shrink-0">
      {status === 'open' && (
        <>
          <Badge variant="success">🟢 Open</Badge>
          <Button
            size="sm"
            variant="outline"
            onClick={() => updateStatus('closed')}
            disabled={loading}
          >
            Close Session
          </Button>
          <Button
            size="sm"
            variant="success"
            onClick={() => updateStatus('completed')}
            disabled={loading}
          >
            Complete
          </Button>
        </>
      )}
      {status === 'closed' && (
        <>
          <Badge variant="warning">🔴 Closed</Badge>
          <Button
            size="sm"
            variant="default"
            onClick={() => updateStatus('open')}
            disabled={loading}
          >
            Reopen
          </Button>
          <Button
            size="sm"
            variant="success"
            onClick={() => updateStatus('completed')}
            disabled={loading}
          >
            Complete
          </Button>
        </>
      )}
      {status === 'completed' && <Badge variant="secondary">✅ Completed</Badge>}
      {status === 'cancelled' && <Badge variant="destructive">❌ Cancelled</Badge>}
    </div>
  )
}
