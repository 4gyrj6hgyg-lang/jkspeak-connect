import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { Card, CardContent } from '@/components/ui/card'
import { formatDateTime } from '@/lib/utils'
import LogoutButton from '@/components/LogoutButton'
import StudentBookingCalendar from '@/components/StudentBookingCalendar'

function getServiceClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export default async function StudentDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile || profile.role !== 'student') redirect('/')

  const admin = getServiceClient()

  // Get student record
  const { data: student } = await admin.from('students').select('id').eq('profile_id', user.id).single()

  // Get assigned teachers
  const { data: assignments } = await admin
    .from('teacher_students')
    .select('teacher_id, teacher:teachers(id, profile:profiles(full_name, email))')
    .eq('student_id', student?.id ?? '')

  // Get credits
  const { data: credits } = await admin
    .from('class_credits')
    .select('total_purchased, total_used')
    .eq('student_id', student?.id ?? '')
    .single()

  const creditsRemaining = (credits?.total_purchased ?? 0) - (credits?.total_used ?? 0)

  // Get availability slots for all assigned teachers
  const teacherIds = (assignments ?? []).map((a: any) => a.teacher_id)
  const { data: slots } = teacherIds.length > 0
    ? await admin
        .from('availability_slots')
        .select('id, slot_start, is_booked, teacher_id, lesson_topic, key_points')
        .in('teacher_id', teacherIds)
        .gte('slot_start', new Date().toISOString())
        .order('slot_start', { ascending: true })
    : { data: [] }

  // Get student's own bookings
  const { data: bookings } = await admin
    .from('bookings')
    .select('slot_id, session:sessions(id, scheduled_at, status, teacher:teachers(profile:profiles(full_name)))')
    .eq('student_id', student?.id ?? '')
    .order('booked_at', { ascending: false })

  const bookedSlotIds = (bookings ?? []).map((b: any) => b.slot_id)

  // Upcoming booked sessions
  const now = new Date()
  const upcomingSessions = (bookings ?? [])
    .filter((b: any) => b.session && new Date(b.session.scheduled_at) >= now)
    .sort((a: any, b: any) => new Date(a.session.scheduled_at).getTime() - new Date(b.session.scheduled_at).getTime())

  const pastSessions = (bookings ?? [])
    .filter((b: any) => b.session && new Date(b.session.scheduled_at) < now)
    .sort((a: any, b: any) => new Date(b.session.scheduled_at).getTime() - new Date(a.session.scheduled_at).getTime())

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-blue-700">JK Speak</h1>
          <p className="text-sm text-gray-500">Student Dashboard</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">Welcome, <strong>{profile.full_name}</strong></span>
          <LogoutButton />
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Credits + stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card className={creditsRemaining === 0 ? 'border-red-200' : creditsRemaining <= 3 ? 'border-orange-200' : ''}>
            <CardContent className="pt-6 text-center">
              <p className={`text-3xl font-bold ${creditsRemaining === 0 ? 'text-red-500' : creditsRemaining <= 3 ? 'text-orange-500' : 'text-blue-600'}`}>
                {creditsRemaining}
              </p>
              <p className="text-sm text-gray-500 mt-1">Classes Left</p>
              {creditsRemaining === 0 && <p className="text-xs text-red-400 mt-1">Contact admin to purchase more</p>}
            </CardContent>
          </Card>
          <Card><CardContent className="pt-6 text-center">
            <p className="text-3xl font-bold text-green-600">{upcomingSessions.length}</p>
            <p className="text-sm text-gray-500 mt-1">Upcoming</p>
          </CardContent></Card>
          <Card><CardContent className="pt-6 text-center">
            <p className="text-3xl font-bold text-purple-600">{pastSessions.length}</p>
            <p className="text-sm text-gray-500 mt-1">Completed</p>
          </CardContent></Card>
        </div>

        {/* No teacher assigned yet */}
        {(!assignments || assignments.length === 0) && (
          <Card><CardContent className="py-8 text-center text-gray-400">
            No teacher assigned yet. Contact your admin.
          </CardContent></Card>
        )}

        {/* Per-teacher calendar */}
        {(assignments ?? []).map((a: any) => {
          const teacherSlots = (slots ?? []).filter((s: any) => s.teacher_id === a.teacher_id)
          return (
            <Card key={a.teacher_id}>
              <CardContent className="pt-4">
                <h2 className="text-lg font-semibold text-gray-800 mb-1">
                  Book a class with {a.teacher?.profile?.full_name}
                </h2>
                {creditsRemaining <= 0 && (
                  <div className="mb-3 p-2 bg-red-50 rounded text-sm text-red-600">
                    You have no class credits. Contact your admin to purchase more.
                  </div>
                )}
                <StudentBookingCalendar
                  teacherName={a.teacher?.profile?.full_name ?? 'Teacher'}
                  slots={teacherSlots}
                  creditsRemaining={creditsRemaining}
                  bookedSlotIds={bookedSlotIds}
                />
              </CardContent>
            </Card>
          )
        })}

        {/* Upcoming sessions */}
        {upcomingSessions.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-3">Upcoming Sessions</h2>
            <div className="space-y-2">
              {upcomingSessions.map((b: any) => (
                <Card key={b.slot_id}><CardContent className="py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{formatDateTime(b.session.scheduled_at)}</p>
                      <p className="text-sm text-gray-500">with {b.session.teacher?.profile?.full_name}</p>
                    </div>
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full capitalize">{b.session.status}</span>
                  </div>
                </CardContent></Card>
              ))}
            </div>
          </section>
        )}

        {/* Past sessions */}
        {pastSessions.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-3">Past Sessions</h2>
            <div className="space-y-2">
              {pastSessions.slice(0, 10).map((b: any) => (
                <Card key={b.slot_id} className="opacity-70"><CardContent className="py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{formatDateTime(b.session.scheduled_at)}</p>
                      <p className="text-xs text-gray-500">with {b.session.teacher?.profile?.full_name}</p>
                    </div>
                    <span className="text-xs text-gray-400 capitalize">{b.session.status}</span>
                  </div>
                </CardContent></Card>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
