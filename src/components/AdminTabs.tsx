'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency, formatDateTime } from '@/lib/utils'

interface Props {
  teachers: any[]
  students: any[]
  assignments: any[]
  sessions: any[]
  payroll: any[]
  allProfiles: any[]
}

type Tab = 'teachers' | 'students' | 'assignments' | 'sessions' | 'payroll'

export default function AdminTabs({ teachers, students, assignments, sessions, payroll, allProfiles }: Props) {
  const [tab, setTab] = useState<Tab>('teachers')
  const router = useRouter()

  const tabs: { id: Tab; label: string }[] = [
    { id: 'teachers', label: 'Teachers' },
    { id: 'students', label: 'Students' },
    { id: 'assignments', label: 'Assignments' },
    { id: 'sessions', label: 'Sessions' },
    { id: 'payroll', label: '💰 Payroll' },
  ]

  return (
    <div>
      {/* Tab Nav */}
      <div className="flex border-b border-gray-200 mb-6 overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              tab === t.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'teachers' && <TeachersTab teachers={teachers} allProfiles={allProfiles} router={router} />}
      {tab === 'students' && <StudentsTab students={students} allProfiles={allProfiles} router={router} />}
      {tab === 'assignments' && <AssignmentsTab teachers={teachers} students={students} assignments={assignments} router={router} />}
      {tab === 'sessions' && <SessionsTab sessions={sessions} />}
      {tab === 'payroll' && <PayrollTab payroll={payroll} teachers={teachers} router={router} />}
    </div>
  )
}

// ── Teachers Tab ──────────────────────────────────────────────
function TeachersTab({ teachers, allProfiles, router }: any) {
  const [showAdd, setShowAdd] = useState(false)
  const [profileId, setProfileId] = useState('')
  const [rate, setRate] = useState('')
  const [loading, setLoading] = useState(false)

  const unassignedProfiles = allProfiles.filter(
    (p: any) => p.role === 'teacher' && !teachers.find((t: any) => t.profile_id === p.id)
  )

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    await supabase.from('teachers').insert({ profile_id: profileId, rate_per_class: Number(rate) })
    setShowAdd(false)
    setProfileId('')
    setRate('')
    router.refresh()
    setLoading(false)
  }

  const updateRate = async (teacherId: string, newRate: string) => {
    const supabase = createClient()
    await supabase.from('teachers').update({ rate_per_class: Number(newRate) }).eq('id', teacherId)
    router.refresh()
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-medium text-gray-800">All Teachers ({teachers.length})</h3>
        <Button size="sm" onClick={() => setShowAdd(!showAdd)}>+ Add Teacher</Button>
      </div>

      {showAdd && (
        <Card>
          <CardContent className="pt-4">
            <form onSubmit={handleAdd} className="flex gap-3 items-end flex-wrap">
              <div className="space-y-1 flex-1 min-w-48">
                <Label>Teacher Profile</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm"
                  value={profileId} onChange={e => setProfileId(e.target.value)} required
                >
                  <option value="">Select profile…</option>
                  {unassignedProfiles.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.full_name} ({p.email})</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1 w-36">
                <Label>Rate per Class ($)</Label>
                <Input type="number" min="0" step="0.01" value={rate} onChange={e => setRate(e.target.value)} required />
              </div>
              <Button type="submit" disabled={loading}>Add</Button>
              <Button type="button" variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {teachers.map((t: any) => (
          <Card key={t.id}>
            <CardContent className="py-3">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium text-gray-900">{t.profile.full_name}</p>
                  <p className="text-sm text-gray-500">{t.profile.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-gray-500">Rate/class:</Label>
                  <input
                    type="number"
                    className="w-24 h-8 rounded border border-gray-300 px-2 text-sm"
                    defaultValue={t.rate_per_class}
                    onBlur={e => updateRate(t.id, e.target.value)}
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
function StudentsTab({ students, allProfiles, router }: any) {
  const [showAdd, setShowAdd] = useState(false)
  const [profileId, setProfileId] = useState('')
  const [loading, setLoading] = useState(false)

  const unassigned = allProfiles.filter(
    (p: any) => p.role === 'student' && !students.find((s: any) => s.profile_id === p.id)
  )

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    await supabase.from('students').insert({ profile_id: profileId })
    setShowAdd(false)
    setProfileId('')
    router.refresh()
    setLoading(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-medium text-gray-800">All Students ({students.length})</h3>
        <Button size="sm" onClick={() => setShowAdd(!showAdd)}>+ Add Student</Button>
      </div>

      {showAdd && (
        <Card>
          <CardContent className="pt-4">
            <form onSubmit={handleAdd} className="flex gap-3 items-end">
              <div className="space-y-1 flex-1">
                <Label>Student Profile</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm"
                  value={profileId} onChange={e => setProfileId(e.target.value)} required
                >
                  <option value="">Select profile…</option>
                  {unassigned.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.full_name} ({p.email})</option>
                  ))}
                </select>
              </div>
              <Button type="submit" disabled={loading}>Add</Button>
              <Button type="button" variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
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
function AssignmentsTab({ teachers, students, assignments, router }: any) {
  const [teacherId, setTeacherId] = useState('')
  const [studentId, setStudentId] = useState('')
  const [loading, setLoading] = useState(false)

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    await supabase.from('teacher_students').insert({ teacher_id: teacherId, student_id: studentId })
    setTeacherId('')
    setStudentId('')
    router.refresh()
    setLoading(false)
  }

  const handleRemove = async (id: string) => {
    const supabase = createClient()
    await supabase.from('teacher_students').delete().eq('id', id)
    router.refresh()
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
          <form onSubmit={handleAssign} className="flex gap-3 items-end flex-wrap">
            <div className="space-y-1 flex-1 min-w-48">
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
            <div className="space-y-1 flex-1 min-w-48">
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
            <Button type="submit" disabled={loading}>Assign</Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {enriched.map((a: any) => (
          <Card key={a.id}>
            <CardContent className="py-3 flex items-center justify-between">
              <div>
                <span className="font-medium">{a.teacher?.profile?.full_name}</span>
                <span className="text-gray-400 mx-2">→</span>
                <span className="font-medium">{a.student?.profile?.full_name}</span>
              </div>
              <Button size="sm" variant="destructive" onClick={() => handleRemove(a.id)}>Remove</Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

// ── Sessions Tab ──────────────────────────────────────────────
function SessionsTab({ sessions }: any) {
  const statusVariant: Record<string, any> = {
    open: 'success', closed: 'warning', completed: 'secondary', cancelled: 'destructive'
  }

  return (
    <div className="space-y-3">
      <h3 className="font-medium text-gray-800">All Sessions ({sessions.length})</h3>
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
              <Badge variant={statusVariant[s.status]}>{s.status}</Badge>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// ── Payroll Tab ───────────────────────────────────────────────
function PayrollTab({ payroll, teachers, router }: any) {
  const total = payroll.reduce((sum: number, t: any) => sum + t.total_pay, 0)

  const exportCSV = () => {
    const rows = [
      ['Teacher', 'Rate per Class', 'Completed Sessions', 'Total Pay'],
      ...payroll.map((t: any) => [t.teacher_name, t.rate_per_class, t.completed_sessions, t.total_pay])
    ]
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
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
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left">
                <th className="pb-2 font-medium text-gray-600">Teacher</th>
                <th className="pb-2 font-medium text-gray-600 text-right">Rate/Class</th>
                <th className="pb-2 font-medium text-gray-600 text-right">Sessions</th>
                <th className="pb-2 font-medium text-gray-600 text-right">Total Pay</th>
              </tr>
            </thead>
            <tbody>
              {payroll.map((t: any) => (
                <tr key={t.teacher_id} className="border-b border-gray-100">
                  <td className="py-3 font-medium text-gray-900">{t.teacher_name}</td>
                  <td className="py-3 text-right text-gray-600">{formatCurrency(t.rate_per_class)}</td>
                  <td className="py-3 text-right text-gray-600">{t.completed_sessions}</td>
                  <td className="py-3 text-right font-semibold text-green-700">{formatCurrency(t.total_pay)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} className="pt-3 font-bold text-gray-800">Total Payroll</td>
                <td className="pt-3 text-right font-bold text-green-700 text-base">{formatCurrency(total)}</td>
              </tr>
            </tfoot>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
