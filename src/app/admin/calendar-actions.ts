'use server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Toggle a 30-min availability slot on/off (teacher)
// Now accepts optional lesson_topic and key_points
export async function toggleSlot(
  teacherId: string,
  slotStart: string,
  lessonTopic?: string,
  keyPoints?: string
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const admin = getAdminClient()

  const { data: existing } = await admin
    .from('availability_slots')
    .select('id, is_booked')
    .eq('teacher_id', teacherId)
    .eq('slot_start', slotStart)
    .single()

  if (existing) {
    if (existing.is_booked) return { error: 'Slot is already booked — cannot remove' }
    const { error } = await admin.from('availability_slots').delete().eq('id', existing.id)
    if (error) return { error: error.message }
    return { success: true, action: 'removed' as const }
  } else {
    const { data: created, error } = await admin
      .from('availability_slots')
      .insert({
        teacher_id: teacherId,
        slot_start: slotStart,
        lesson_topic: lessonTopic || null,
        key_points: keyPoints || null,
      })
      .select('id, slot_start, is_booked, lesson_topic, key_points')
      .single()
    if (error) return { error: error.message }
    return { success: true, action: 'added' as const, slot: created }
  }
}

// Update lesson details on an existing slot (teacher edits after creation)
export async function updateSlotDetails(slotId: string, lessonTopic: string, keyPoints: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const admin = getAdminClient()
  const { error } = await admin
    .from('availability_slots')
    .update({ lesson_topic: lessonTopic, key_points: keyPoints })
    .eq('id', slotId)
  if (error) return { error: error.message }
  return { success: true }
}

// Student books a slot
export async function bookSlot(slotId: string) {
  const supabase = await createClient()
  const admin = getAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: student } = await supabase.from('students').select('id').eq('profile_id', user.id).single()
  if (!student) return { error: 'Student record not found' }

  const { data: credits } = await admin.from('class_credits').select('total_purchased, total_used').eq('student_id', student.id).single()
  const remaining = (credits?.total_purchased ?? 0) - (credits?.total_used ?? 0)
  if (remaining <= 0) return { error: 'No class credits remaining. Contact your admin to purchase more.' }

  const { data: slot } = await admin
    .from('availability_slots')
    .select('*, teacher:teachers(id, profile_id, rate_per_class, profile:profiles(full_name, email))')
    .eq('id', slotId).single()
  if (!slot) return { error: 'Slot not found' }
  if (slot.is_booked) return { error: 'Slot already booked' }

  const { data: studentProfile } = await admin.from('profiles').select('full_name, email').eq('id', user.id).single()

  const { data: session, error: sessionErr } = await admin
    .from('sessions')
    .insert({
      teacher_id: slot.teacher_id,
      student_id: student.id,
      title: slot.lesson_topic || 'Class Session',
      scheduled_at: slot.slot_start,
      duration_minutes: 30,
      status: 'open',
    })
    .select().single()
  if (sessionErr) return { error: sessionErr.message }

  await admin.from('bookings').insert({ slot_id: slotId, session_id: session.id, student_id: student.id })
  await admin.from('availability_slots').update({ is_booked: true }).eq('id', slotId)
  await admin.from('class_credits').update({ total_used: (credits?.total_used ?? 0) + 1, updated_at: new Date().toISOString() }).eq('student_id', student.id)

  try {
    const teacherEmail = (slot.teacher as any)?.profile?.email
    const teacherName = (slot.teacher as any)?.profile?.full_name
    const slotDate = new Date(slot.slot_start)
    const dateStr = slotDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Chicago' })
    const timeStr = slotDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago' })
    await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` },
      body: JSON.stringify({ type: 'booking_confirmation', sessionId: session.id, studentEmail: studentProfile?.email, studentName: studentProfile?.full_name, teacherEmail, teacherName, date: dateStr, time: timeStr, creditsRemaining: remaining - 1 }),
    }).catch(() => {})
  } catch {}

  return { success: true, sessionId: session.id, creditsRemaining: remaining - 1 }
}

// Admin assigns a student to an open slot (deducts 1 credit)
export async function adminBookSlot(slotId: string, studentId: string) {
  const supabase = await createClient()
  const admin = getAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { error: 'Not authorized' }

  const { data: credits } = await admin.from('class_credits').select('total_purchased, total_used').eq('student_id', studentId).single()
  const remaining = (credits?.total_purchased ?? 0) - (credits?.total_used ?? 0)
  if (remaining <= 0) return { error: 'Student has no class credits remaining.' }

  const { data: slot } = await admin
    .from('availability_slots')
    .select('*, teacher:teachers(id, profile:profiles(full_name, email))')
    .eq('id', slotId).single()
  if (!slot) return { error: 'Slot not found' }
  if (slot.is_booked) return { error: 'Slot already booked' }

  const { data: session, error: sessionErr } = await admin
    .from('sessions')
    .insert({
      teacher_id: slot.teacher_id,
      student_id: studentId,
      title: slot.lesson_topic || 'Class Session',
      scheduled_at: slot.slot_start,
      duration_minutes: 30,
      status: 'open',
    })
    .select().single()
  if (sessionErr) return { error: sessionErr.message }

  await admin.from('bookings').insert({ slot_id: slotId, session_id: session.id, student_id: studentId })
  await admin.from('availability_slots').update({ is_booked: true }).eq('id', slotId)
  await admin.from('class_credits').update({ total_used: (credits?.total_used ?? 0) + 1, updated_at: new Date().toISOString() }).eq('student_id', studentId)

  return { success: true, sessionId: session.id }
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
