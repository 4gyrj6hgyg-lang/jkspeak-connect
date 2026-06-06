import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { Card, CardContent } from '@/components/ui/card'
import { formatDateTime } from '@/lib/utils'
import LogoutButton from '@/components/LogoutButton'
import SessionControls from '@/components/SessionControls'
import TeacherCalendar from '@/components/TeacherCalendar'

function getServiceClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export default async function TeacherDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile || profile.role !== 'teacher') redirect('/')

  const { data: teacher } = await supabase.from('teachers').select('*').eq('profile_id', user.id).single()

  const admin = getServiceClient()

  const [{ data: assignments }, { data: sessions }, { data: slots }] = await Promise.all([
    admin.from('teacher_students').select('student_id, student:students(id, profile:profiles(full_name, email))').eq('teacher_id', teacher?.id ?? ''),
    admin.from('sessions').select('*, student:students(profile:profiles(full_name))').eq('teacher_id', teacher?.id ?? '').order('scheduled_at', { ascending: false }).limit(50),
    admin.from('availability_slots').select('id, slot_start, is_booked').eq('teacher_id', teacher?.id ?? '').gte('slot_start', new Date(Date.now() - 7 * 86400000).toISOString()),
  ])

  const now = new Date()
  const upcoming = sessions?.filter(s => ['open', 'closed'].includes(s.status) && new Date(s.scheduled_at) >= now) ?? []
  const past = sessions?.filter(s => s.status === 'completed' || new Date(s.scheduled_at) < now) ?? []
  const totalCompleted = sessions?.filter(s => s.status === 'completed').length ?? 0

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-blue-700">JK Speak</h1>
          <p className="text-sm text-gray-500">Teacher Dashboard</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">Welcome, <strong>{profile.full_name}</strong></span>
          <LogoutButton />
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card><CardContent className="pt-6 text-center">
            <p className="text-3xl font-bold text-blue-600">{assignments?.length ?? 0}</p>
            <p className="text-sm text-gray-500 mt-1">Students</p>
          </CardContent></Card>
          <Card><CardContent className="pt-6 text-center">
            <p className="text-3xl font-bold text-green-600">{upcoming.length}</p>
            <p className="text-sm text-gray-500 mt-1">Upcoming</p>
          </CardContent></Card>
          <Card><CardContent className="pt-6 text-center">
            <p className="text-3xl font-bold text-purple-600">{totalCompleted}</p>
            <p className="text-sm text-gray-500 mt-1">Completed</p>
          </CardContent></Card>
        </div>

        {/* Calendar */}
        <Card>
          <CardContent className="pt-4">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">My Availability</h2>
            <p className="text-sm text-gray-500 mb-4">Click a day, then click time slots to mark them open for students to book.</p>
            {teacher ? (
              <TeacherCalendar teacherId={teacher.id} slots={slots ?? []} />
            ) : (
              <p className="text-gray-400 text-sm">Teacher record not found.</p>
            )}
          </CardContent>
        </Card>

        {/* My Students */}
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-3">My Students</h2>
          {!assignments?.length ? (
            <Card><CardContent className="py-6 text-center text-gray-400 text-sm">No students assigned yet.</CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {assignments.map((a: any) => (
                <Card key={a.student_id}><CardContent className="py-3">
                  <p className="font-medium text-gray-900">{a.student?.profile?.full_name}</p>
                  <p className="text-sm text-gray-500">{a.student?.profile?.email}</p>
                </CardContent></Card>
              ))}
            </div>
          )}
        </section>

        {/* Upcoming Sessions */}
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Upcoming Sessions</h2>
          {!upcoming.length ? (
            <Card><CardContent className="py-8 text-center text-gray-500">No upcoming sessions. Students book from your calendar.</CardContent></Card>
          ) : (
            <div className="space-y-3">
              {upcoming.map((session: any) => (
                <Card key={session.id}><CardContent className="py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{session.title}</p>
                      <p className="text-sm text-gray-500 mt-1">with {session.student?.profile?.full_name}</p>
                      <p className="text-sm text-gray-500">{formatDateTime(session.scheduled_at)} · 30 min</p>
                    </div>
                    <SessionControls sessionId={session.id} currentStatus={session.status} />
                  </div>
                </CardContent></Card>
              ))}
            </div>
          )}
        </section>

        {/* Past Sessions */}
        {past.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-3">Past Sessions</h2>
            <div className="space-y-2">
              {past.slice(0, 10).map((session: any) => (
                <Card key={session.id} className="opacity-70"><CardContent className="py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-800 text-sm">{session.title}</p>
                      <p className="text-xs text-gray-500">{session.student?.profile?.full_name} · {formatDateTime(session.scheduled_at)}</p>
                    </div>
                    <span className="text-xs text-gray-400 capitalize">{session.status}</span>
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
