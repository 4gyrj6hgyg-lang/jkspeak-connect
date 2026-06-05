'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface Props {
  teacherId: string
  students: any[]
}

export default function CreateSessionModal({ teacherId, students }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    student_id: '',
    title: '',
    scheduled_at: '',
    duration_minutes: 60,
    notes: '',
  })
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()

    const { error } = await supabase.from('sessions').insert({
      teacher_id: teacherId,
      student_id: form.student_id,
      title: form.title,
      scheduled_at: new Date(form.scheduled_at).toISOString(),
      duration_minutes: form.duration_minutes,
      notes: form.notes || null,
      status: 'open',
    })

    if (!error) {
      setOpen(false)
      setForm({ student_id: '', title: '', scheduled_at: '', duration_minutes: 60, notes: '' })
      router.refresh()
    }
    setLoading(false)
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>
        + New Session
      </Button>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Create New Session</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Student</Label>
              <select
                className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.student_id}
                onChange={e => setForm({ ...form, student_id: e.target.value })}
                required
              >
                <option value="">Select a student…</option>
                {students.map((a: any) => (
                  <option key={a.student_id} value={a.student_id}>
                    {a.student?.profile?.full_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Session Title</Label>
              <Input
                placeholder="e.g. Lesson 5 – Business English"
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Date & Time</Label>
              <Input
                type="datetime-local"
                value={form.scheduled_at}
                onChange={e => setForm({ ...form, scheduled_at: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Duration (minutes)</Label>
              <Input
                type="number"
                min={15}
                max={180}
                step={15}
                value={form.duration_minutes}
                onChange={e => setForm({ ...form, duration_minutes: Number(e.target.value) })}
              />
            </div>

            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Input
                placeholder="Any notes for the student…"
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={loading}>
                {loading ? 'Creating…' : 'Create Session'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
