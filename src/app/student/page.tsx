import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDateTime } from '@/lib/utils'
import LogoutButton from '@/components/LogoutButton'

export default async function StudentDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'student') redirect('/')

  const { data: student } = await supabase
    .from('students')
    .select('id')
    .eq('profile_id', user.id)
    .single()

  // Get assigned teachers
  const { data: assignments } = await supabase
    .from('teacher_students')
    .select(`
      teacher_id,
      teacher:teachers(
        id, rate_per_class,
        profile:profiles(full_name, email)
      )
    `)
    .eq('student_id', student?.id)

  // Get upcoming sessions
  const { data: sessions } = await supabase
    .from('sessions')
    .select(`
      *,
      teacher:teachers(profile:profiles(full_name))
    `)
    .eq('student_id', student?.id)
    .in('status', ['open', 'closed'])
    .gte('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true })

  const statusColor = (status: string) => {
    if (status === 'open') return 'success'
    if (status === 'closed') return 'warning'
    if (status === 'completed') return 'secondary'
    return 'destructive'
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-blue-700">🗣️ JK Speak</h1>
          <p className="text-sm text-gray-500">Student Dashboard</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">Welcome, <strong>{profile.full_name}</strong></span>
          <LogoutButton />
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6 space-y-6">
        {/* My Teachers */}
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-3">My Teachers</h2>
          {!assignments?.length ? (
            <Card>
              <CardContent className="py-8 text-center text-gray-500">
                No teachers assigned yet. Contact your administrator.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {assignments.map((a: any) => (
                <Card key={a.teacher_id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{a.teacher.profile.full_name}</CardTitle>
                    <CardDescription>{a.teacher.profile.email}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* Upcoming Sessions */}
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Upcoming Sessions</h2>
          {!sessions?.length ? (
            <Card>
              <CardContent className="py-8 text-center text-gray-500">
                No upcoming sessions scheduled.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {sessions.map((session: any) => (
                <Card key={session.id}>
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{session.title}</p>
                        <p className="text-sm text-gray-500 mt-1">
                          with {session.teacher?.profile?.full_name}
                        </p>
                        <p className="text-sm text-gray-500">
                          {formatDateTime(session.scheduled_at)} · {session.duration_minutes} min
                        </p>
                        {session.notes && (
                          <p className="text-sm text-gray-600 mt-2 italic">"{session.notes}"</p>
                        )}
                      </div>
                      <Badge variant={statusColor(session.status) as any}>
                        {session.status === 'open' ? '🟢 Open' : '🔴 Closed'}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
