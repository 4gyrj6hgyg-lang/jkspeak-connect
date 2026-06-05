import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'
import LogoutButton from '@/components/LogoutButton'
import AdminTabs from '@/components/AdminTabs'

export default async function AdminDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') redirect('/')

  // Load all data for admin
  const [
    { data: teachers },
    { data: students },
    { data: assignments },
    { data: sessions },
    { data: allProfiles },
  ] = await Promise.all([
    supabase.from('teachers').select('*, profile:profiles(full_name, email)'),
    supabase.from('students').select('*, profile:profiles(full_name, email)'),
    supabase.from('teacher_students').select('*'),
    supabase.from('sessions').select('*, teacher:teachers(profile:profiles(full_name)), student:students(profile:profiles(full_name))').order('scheduled_at', { ascending: false }),
    supabase.from('profiles').select('*').order('full_name'),
  ])

  // Payroll calculation
  const payroll = (teachers ?? []).map((teacher: any) => {
    const completed = (sessions ?? []).filter(
      (s: any) => s.teacher_id === teacher.id && s.status === 'completed'
    ).length
    return {
      teacher_id: teacher.id,
      teacher_name: teacher.profile.full_name,
      rate_per_class: teacher.rate_per_class,
      completed_sessions: completed,
      total_pay: completed * teacher.rate_per_class,
    }
  })

  const totalPayroll = payroll.reduce((sum: number, t: any) => sum + t.total_pay, 0)

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-blue-700">🗣️ JK Speak</h1>
          <p className="text-sm text-gray-500">Admin Dashboard</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">Welcome, <strong>{profile.full_name}</strong></span>
          <LogoutButton />
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Overview Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-3xl font-bold text-blue-600">{teachers?.length ?? 0}</p>
              <p className="text-sm text-gray-500 mt-1">Teachers</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-3xl font-bold text-green-600">{students?.length ?? 0}</p>
              <p className="text-sm text-gray-500 mt-1">Students</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-3xl font-bold text-purple-600">
                {sessions?.filter((s: any) => s.status === 'completed').length ?? 0}
              </p>
              <p className="text-sm text-gray-500 mt-1">Sessions Done</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-3xl font-bold text-orange-600">{formatCurrency(totalPayroll)}</p>
              <p className="text-sm text-gray-500 mt-1">Total Payroll</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabbed Admin Interface */}
        <AdminTabs
          teachers={teachers ?? []}
          students={students ?? []}
          assignments={assignments ?? []}
          sessions={sessions ?? []}
          payroll={payroll}
          allProfiles={allProfiles ?? []}
        />
      </main>
    </div>
  )
}
