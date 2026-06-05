import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { Card, CardContent } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'
import LogoutButton from '@/components/LogoutButton'
import AdminTabs from '@/components/AdminTabs'

function getServiceClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

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

  const admin = getServiceClient()

  const [
    { data: teachers },
    { data: students },
    { data: assignments },
    { data: sessions },
    { data: allProfiles },
  ] = await Promise.all([
    admin.from('teachers').select('*, profile:profiles(full_name, email)'),
    admin.from('students').select('*, profile:profiles(full_name, email)'),
    admin.from('teacher_students').select('*'),
    admin.from('sessions').select('*, teacher:teachers(profile:profiles(full_name)), student:students(profile:profiles(full_name))').order('scheduled_at', { ascending: false }),
    admin.from('profiles').select('*').order('full_name'),
  ])

  const payroll = (teachers ?? []).map((teacher: any) => {
    const completed = (sessions ?? []).filter(
      (s: any) => s.teacher_id === teacher.id && s.status === 'completed'
    ).length
    return {
      teacher_id: teacher.id,
      teacher_name: teacher.profile?.full_name ?? 'Unknown',
      rate_per_class: teacher.rate_per_class ?? 0,
      completed_sessions: completed,
      total_pay: completed * (teacher.rate_per_class ?? 0),
    }
  })

  const totalPayroll = payroll.reduce((sum: number, t: any) => sum + t.total_pay, 0)

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-blue-700">JK Speak</h1>
          <p className="text-sm text-gray-500">Admin Dashboard</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">Welcome, <strong>{profile.full_name}</strong></span>
          <LogoutButton />
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6 space-y-6">
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
