import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'edge'

export async function GET(req: Request) {
  const authHeader = req.headers.get('Authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const now = new Date()
  const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000)
  const windowStart = new Date(now.getTime() + 55 * 60 * 1000).toISOString()
  const windowEnd = new Date(now.getTime() + 65 * 60 * 1000).toISOString()

  // Find bookings with sessions starting in ~1 hour, reminder not yet sent
  const { data: bookings, error } = await admin
    .from('bookings')
    .select(`
      id, slot_id, student_id,
      session:sessions(id, scheduled_at, teacher:teachers(profile:profiles(full_name, email))),
      student:students(profile:profiles(full_name, email))
    `)
    .eq('reminder_sent', false)
    .gte('session.scheduled_at', windowStart)
    .lte('session.scheduled_at', windowEnd)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!bookings || bookings.length === 0) return NextResponse.json({ sent: 0 })

  let sent = 0
  for (const booking of bookings) {
    const session = (booking as any).session
    const student = (booking as any).student
    if (!session || !student) continue

    const scheduledAt = new Date(session.scheduled_at)
    const dateStr = scheduledAt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'America/Chicago' })
    const timeStr = scheduledAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago' })

    // Send reminder emails
    try {
      await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          type: 'session_reminder',
          sessionId: session.id,
          studentEmail: student.profile?.email,
          studentName: student.profile?.full_name,
          teacherEmail: session.teacher?.profile?.email,
          teacherName: session.teacher?.profile?.full_name,
          date: dateStr,
          time: timeStr,
        }),
      })

      await admin.from('bookings').update({ reminder_sent: true }).eq('id', booking.id)
      sent++
    } catch {}
  }

  return NextResponse.json({ sent })
}
