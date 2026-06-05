'use server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createAdminClient(url, serviceKey)
}

export async function createUser(formData: {
  email: string
  password: string
  full_name: string
  role: 'teacher' | 'student'
  rate_per_class?: number
}) {
  // Verify caller is admin
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || profile.role !== 'admin') return { error: 'Not authorized' }

  const admin = getAdminClient()

  // Create auth user
  const { data: newUser, error: createError } = await admin.auth.admin.createUser({
    email: formData.email,
    password: formData.password,
    email_confirm: true,
    user_metadata: { full_name: formData.full_name, role: formData.role },
  })

  if (createError || !newUser.user) return { error: createError?.message ?? 'Failed to create user' }

  const uid = newUser.user.id

  // Upsert profile (trigger may have already created it)
  const { error: profileError } = await admin
    .from('profiles')
    .upsert({ id: uid, email: formData.email, full_name: formData.full_name, role: formData.role })

  if (profileError) return { error: profileError.message }

  // Insert into teachers or students — ignore if already exists
  if (formData.role === 'teacher') {
    const { error: te } = await admin.from('teachers').upsert({ profile_id: uid, rate_per_class: formData.rate_per_class ?? 0 }, { onConflict: 'profile_id' })
    if (te) return { error: te.message }
  } else {
    const { error: se } = await admin.from('students').upsert({ profile_id: uid }, { onConflict: 'profile_id' })
    if (se) return { error: se.message }
  }

  return { success: true, userId: uid }
}

export async function assignTeacherStudent(teacherId: string, studentId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('teacher_students')
    .insert({ teacher_id: teacherId, student_id: studentId })

  if (error) return { error: error.message }
  return { success: true }
}

export async function removeAssignment(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('teacher_students').delete().eq('id', id)
  if (error) return { error: error.message }
  return { success: true }
}

export async function updateTeacherRate(teacherId: string, rate: number) {
  const supabase = await createClient()
  const { error } = await supabase.from('teachers').update({ rate_per_class: rate }).eq('id', teacherId)
  if (error) return { error: error.message }
  return { success: true }
}
