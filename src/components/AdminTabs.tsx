'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { createUser, assignTeacherStudent, removeAssignment, updateTeacherRate } from '@/app/admin/actions'

interface Props {
  teachers: any[]
  students: any[]
  assignments: any[]
  sessions: any[]
  payroll: any[]
  allProfiles: any[]
}

type Tab = 'teachers' | 'students' | 'assignments' | 'sessions' | 'payroll'

export default function AdminTabs({ teachers, students, assignments, sessions, payroll }: Props) {
  const [tab, setTab] = useState<Tab>('teachers')

  const tabs: { id: Tab; label: string }[] = [
    { id: 'teachers', label: '👩‍🏫 Teachers' },
    { id: 'students', label: '🎓 Students' },
    { id: 'assignments', label: '🔗 Assignments' },
    { id: 'sessions', label: '📅 Sessions' },
    { id: 'payroll', label: '💰 Payroll' },
  ]

  return (
    <div>
      <div className="flex border-b border-gray-200 mb-6 overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              tab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'teachers' && <TeachersTab teachers={teachers} />}
      {tab === 'students' && <StudentsTab students={students} />}
      {tab === 'assignments' && <AssignmentsTab teachers={teachers} students={students} assignments={assignments} />}
      {tab === 'sessions' && <SessionsTab sessions={sessions} />}
      {tab === 'payroll' && <PayrollTab payroll={payroll} />}
    </div>
  )
}

// ── Create User Form (shared) ──────────────────────────────────
function CreateUserForm({ role, onSuccess }: { role: 'teacher' | 'student'; onSuccess: () => void }) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rate, setRate] = useState('')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    startTransition(async () => {
      const result = await createUser({
        email, password, full_name: fullName, role,
        rate_per_class: role === 'teacher' ? Number(rate) : undefined,
      })
      if (result.error) { setError(result.error); return }
      setFullName(''); setEmail(''); setPassword(''); setRate('')
      onSuccess()
    })
  }

  return (
    <Card className="border-blue-100 bg-blue-50">
      <CardContent className="pt-4">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Full Name</Label>
              <Input placeholder="Jane Smith" value={fullName} onChange={e => setFullName(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input type="email" placeholder="jane@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label>Password</Label>
              <Input type="password" placeholder="Temporary password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
            </div>
            {role === 'teacher' && (
              <div className="space-y-1">
                <Label>Rate per Class ($)</Label>
                <Input type="number" min="0" step="0.01" placeholder="25.00" value={rate} onChange={e => setRate(e.target.value)} required />
              </div>
            )}
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" disabled={isPending} size="sm">
              {isPending ? 'Creating…' : `Create ${role === 'teacher' ? 'Teacher' : 'Student'}`}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

// ── Teachers Tab ──────────────────────────────────────────────
function TeachersTab({ teachers }: { teachers: any[] }) {
  const [showForm, setShowForm] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-medium text-gray-800">Teachers ({teachers.length})</h3>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ Add Teacher'}
        </Button>
      </div>

      {showForm && (
        <CreateUserForm role="teacher" onSuccess={() => { setShowForm(false); router.refresh() }} />
      )}

      <div className="space-y-2">
        {teachers.length === 0 && (
          <p className="text-gray-400 text-sm text-center py-8">No teachers yet. Add one above.</p>
        )}
        {teachers.map((t: any) => (
          <Card key={t.id}>
            <CardContent className="py-3">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium text-gray-900">{t.profile.full_name}</p>
                  <p className="text-sm text-gray-500">{t.profile.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Rate/class:</span>
                  <input
                    type="number"
                    className="w-24 h-8 rounded border border-gray-300 px-2 text-sm"
                    defaultValue={t.rate_per_class}
                    onBlur={e => {
                      startTransition(async () => {
                        await updateTeacherRate(t.id, Number(e.target.value))
                        router.refresh()
                      })
                    }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

// ── Students Tab ──────────────────────────────────────────────
function StudentsTab({ students }: { students: any[] }) {
  const [showForm, setShowForm] = useState(false)
  const router = useRouter()

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-medium text-gray-800">Students ({students.length})</h3>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ Add Student'}
        </Button>
      </div>

      {showForm && (
        <CreateUserForm role="student" onSuccess={() => { setShowForm(false); router.refresh() }} />
      )}

      <div className="space-y-2">
        {students.length === 0 && (
          <p className="text-gray-400 text-sm text-center py-8">No students yet. Add one above.</p>
        )}
        {students.map((s: any) => (
          <Card key={s.id}>
            <CardContent className="py-3">
              <p className="font-medium text-gray-900">{s.profile.full_name}</p>
              <p className="text-sm text-gray-500">{s.profile.email}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

// ── Assignments Tab ───────────────────────────────────────────
function AssignmentsTab({ teachers, students, assignments }: any) {
  const [teacherId, setTeacherId] = useState('')
  const [studentId, setStudentId] = useState('')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const handleAssign = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    startTransition(async () => {
      const result = await assignTeacherStudent(teacherId, studentId)
      if (result.error) { setError(result.error); return }
      setTeacherId(''); setStudentId('')
      router.refresh()
    })
  }

  const handleRemove = (id: string) => {
    startTransition(async () => {
      await removeAssignment(id)
      router.refresh()
    })
  }

  const enriched = assignments.map((a: any) => ({
    ...a,
    teacher: teachers.find((t: any) => t.id === a.teacher_id),
    student: students.find((s: any) => s.id === a.student_id),
  }))

  return (
    <div className="space-y-4">
      <h3 className="font-medium text-gray-800">Assign Teacher → Student</h3>
      <Card>
        <CardContent className="pt-4">
          <form onSubmit={handleAssign} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Teacher</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm"
                  value={teacherId} onChange={e => setTeacherId(e.target.value)} required
                >
                  <option value="">Select teacher…</option>
                  {teachers.map((t: any) => (
                    <option key={t.id} value={t.id}>{t.profile.full_name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Student</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm"
                  value={studentId} onChange={e => setStudentId(e.target.value)} required
                >
                  <option value="">Select student…</option>
                  {students.map((s: any) => (
                    <option key={s.id} value={s.id}>{s.profile.full_name}</option>
                  ))}
                </select>
              </div>
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>}
            <Button type="submit" disabled={isPending} size="sm">
              {isPending ? 'Assigning…' : 'Assign'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {enriched.length === 0 && (
          <p className="text-gray-400 text-sm text-center py-8">No assignments yet.</p>
        )}
        {enriched.map((a: any) => (
          <Card key={a.id}>
            <CardContent className="py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900">{a.teacher?.profile?.full_name}</span>
                <span className="text-gray-400">→</span>
                <span className="font-medium text-gray-900">{a.student?.profile?.full_name}</span>
              </div>
              <Button size="sm" variant="destructive" disabled={isPending} onClick={() => handleRemove(a.id)}>
                Remove
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

// ── Sessions Tab ──────────────────────────────────────────────
function SessionsTab({ sessions }: any) {
  const statusColor: Record<string, string> = {
    open: 'bg-green-100 text-green-700',
    closed: 'bg-yellow-100 text-yellow-700',
    completed: 'bg-blue-100 text-blue-700',
    cancelled: 'bg-red-100 text-red-700',
  }

  return (
    <div className="space-y-3">
      <h3 className="font-medium text-gray-800">All Sessions ({sessions.length})</h3>
      {sessions.length === 0 && (
        <p className="text-gray-400 text-sm text-center py-8">No sessions yet. Teachers create sessions from their dashboard.</p>
      )}
      {sessions.map((s: any) => (
        <Card key={s.id}>
          <CardContent className="py-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium text-gray-900">{s.title}</p>
                <p className="text-sm text-gray-500">
                  {s.teacher?.profile?.full_name} → {s.student?.profile?.full_name}
                </p>
                <p className="text-xs text-gray-400">{formatDateTime(s.scheduled_at)} · {s.duration_minutes} min</p>
              </div>
              <span className={`text-xs font-semibold px-2 py-1 rounded-full ${statusColor[s.status]}`}>
                {s.status}
              </span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// ── Payroll Tab ───────────────────────────────────────────────
function PayrollTab({ payroll }: { payroll: any[] }) {
  const total = payroll.reduce((sum: number, t: any) => sum + t.total_pay, 0)

  const exportCSV = () => {
    const rows = [
      ['Teacher', 'Rate per Class', 'Completed Sessions', 'Total Pay'],
      ...payroll.map((t: any) => [t.teacher_name, t.rate_per_class, t.completed_sessions, t.total_pay]),
    ]
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `jkspeak-payroll-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-gray-800">Payroll Summary</h3>
        <Button size="sm" variant="outline" onClick={exportCSV}>⬇ Export CSV</Button>
      </div>
      <Card>
        <CardContent className="pt-4">
          {payroll.length === 0 && (
            <p className="text-gray-400 text-sm text-center py-4">No completed sessions yet.</p>
          )}
          {payroll.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left">
                  <th className="pb-2 font-medium text-gray-600">Teacher</th>
                  <th className="pb-2 font-medium text-gray-600 text-right">Rate</th>
                  <th className="pb-2 font-medium text-gray-600 text-right">Sessions</th>
                  <th className="pb-2 font-medium text-gray-600 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {payroll.map((t: any) => (
                  <tr key={t.teacher_id} className="border-b border-gray-100">
                    <td className="py-3 font-medium">{t.teacher_name}</td>
                    <td className="py-3 text-right text-gray-600">{formatCurrency(t.rate_per_class)}</td>
                    <td className="py-3 text-right text-gray-600">{t.completed_sessions}</td>
                    <td className="py-3 text-right font-semibold text-green-700">{formatCurrency(t.total_pay)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} className="pt-3 font-bold">Total Payroll</td>
                  <td className="pt-3 text-right font-bold text-green-700 text-lg">{formatCurrency(total)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
