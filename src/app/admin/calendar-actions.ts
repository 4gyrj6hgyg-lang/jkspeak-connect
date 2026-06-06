'use server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createUser, assignTeacherStudent, removeAssignment, updateTeacherRate } from './actions'
export { createUser, assignTeacherStudent, removeAssignment, updateTeacherRate }

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Toggle a 30-min availability slot on/off
export async function toggleSlot(teacherId: string, slotStart: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Check if slot exists
  const { data: existing } = await supabase
    .from('availability_slots')
    .select('id, is_booked')
    .eq('teacher_id', teacherId)
    .eq('slot_start', slotStart)
    .single()

  if (existing) {
    if (existing.is_booked) return { error: 'Slot is already booked — cannot remove' }
    const { error } = await supabase
      .from('availability_slots')
      .delete()
      .eq('id', existing.id)
    if (error) return { error: error.message }
    return { success: true, action: 'removed' }
  } else {
    const { error } = await supabase
      .from('availability_slots')
      .insert({ teacher_id: teacherId, slot_start: slotStart })
    if (error) return { error: error.message }
    return { success: true, action: 'added' }
  }
}

// Student books a slot
export async function bookSlot(slotId: string) {
  const supabase = await createClient()
  const admin = getAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Get student record
  const { data: student } = await supabase
    .from('students')
    .select('id')
    .eq('profile_id', user.id)
    .single()
  if (!student) return { error: 'Student record not found' }

  // Check credits
  const { data: credits } = await admin
    .from('class_credits')
    .select('total_purchased, total_used')
    .eq('student_id', student.id)
    .single()

  const remaining = (credits?.total_purchased ?? 0) - (credits?.total_used ?? 0)
  if (remaining <= 0) return { error: 'No class credits remaining. Contact your admin to purchase more.' }

  // Get slot details
  const { data: slot } = await admin
    .from('availability_slots')
    .select('*, teacher:teachers(id, profile_id, rate_per_class, profile:profiles(full_name, email))')
    .eq('id', slotId)
    .single()
  if (!slot) return { error: 'Slot not found' }
  if (slot.is_booked) return { error: 'Slot already booked' }

  // Get student profile for email
  const { data: studentProfile } = await admin
    .from('profiles')
    .select('full_name, email')
    .eq('id', user.id)
    .single()

  // Create session
  const { data: session, error: sessionErr } = await admin
    .from('sessions')
    .insert({
      teacher_id: slot.teacher_id,
      student_id: student.id,
      title: 'Class Session',
      scheduled_at: slot.slot_start,
      duration_minutes: 30,
      status: 'open',
    })
    .select()
    .single()
  if (sessionErr) return { error: sessionErr.message }

  // Create booking
  const { error: bookingErr } = await admin
    .from('bookings')
    .insert({ slot_id: slotId, session_id: session.id, student_id: student.id })
  if (bookingErr) return { error: bookingErr.message }

  // Mark slot as booked
  await admin.from('availability_slots').update({ is_booked: true }).eq('id', slotId)

  // Deduct credit
  await admin
    .from('class_credits')
    .update({ total_used: (credits?.total_used ?? 0) + 1, updated_at: new Date().toISOString() })
    .eq('student_id', student.id)

  // Send confirmation emails via Supabase Edge Function or just log for now
  // We'll handle email via a simple fetch to an API route
  try {
    const teacherEmail = (slot.teacher as any)?.profile?.email
    const teacherName = (slot.teacher as any)?.profile?.full_name
    const slotDate = new Date(slot.slot_start)
    const dateStr = slotDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Chicago' })
    const timeStr = slotDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago' })

    await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        type: 'booking_confirmation',
        sessionId: session.id,
        studentEmail: studentProfile?.email,
        studentName: studentProfile?.full_name,
        teacherEmail,
        teacherName,
        date: dateStr,
        time: timeStr,
        creditsRemaining: remaining - 1,
      }),
    }).catch(() => {}) // don't fail booking if email fails
  } catch {}

  return { success: true, sessionId: session.id, creditsRemaining: remaining - 1 }
}

// Admin: set student credits
export async function setStudentCredits(studentId: string, totalPurchased: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { error: 'Not authorized' }

  const admin = getAdminClient()
  const { error } = await admin
    .from('class_credits')
    .upsert({ student_id: studentId, total_purchased: totalPurchased, updated_at: new Date().toISOString() }, { onConflict: 'student_id' })
  if (error) return { error: error.message }
  return { success: true }
}
