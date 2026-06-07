'use client'
import { useState, useTransition } from 'react'
import { completeSession } from '@/app/admin/calendar-actions'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface Props {
  sessionId: string
  studentName?: string
  currentStatus: 'open' | 'closed' | 'completed' | 'cancelled'
}

export default function SessionControls({ sessionId, studentName, currentStatus }: Props) {
  const [status, setStatus] = useState(currentStatus)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [, startTransition] = useTransition()

  const handleComplete = () => {
    if (!confirm(`Mark this session with ${studentName ?? 'student'} as completed? This will deduct 1 class credit.`)) return
    setLoading(true)
    startTransition(async () => {
      const result = await completeSession(sessionId)
      if (result?.error) {
        setMsg('❌ ' + result.error)
      } else {
        setStatus('completed')
        setMsg('✅ Marked complete — 1 credit deducted')
      }
      setLoading(false)
    })
  }

  return (
    <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
      {msg && <span className={`text-xs ${msg.startsWith('✅') ? 'text-green-600' : 'text-red-500'}`}>{msg}</span>}

      {(status === 'open' || status === 'closed') && (
        <Button
          size="sm"
          variant="success"
          onClick={handleComplete}
          disabled={loading}
        >
          {loading ? 'Saving…' : '✅ Mark Complete'}
        </Button>
      )}

      {status === 'completed' && <Badge variant="secondary">✅ Completed</Badge>}
      {status === 'cancelled' && <Badge variant="destructive">❌ Cancelled</Badge>}
    </div>
  )
}
