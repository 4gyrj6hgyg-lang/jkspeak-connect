'use client'
import { useState, useTransition } from 'react'
import { adminBookSlot } from '@/app/admin/calendar-actions'
import { Card, CardContent } from '@/components/ui/card'

interface Slot {
  id: string
  slot_start: string
  is_booked: boolean
  lesson_topic?: string | null
  key_points?: string | null
}

interface Student {
  id: string
  name: string
  creditsRemaining: number
}

interface Teacher {
  id: string
  name: string
  slots: Slot[]
}

interface Props {
  teachers: Teacher[]
  students: Student[]
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const HOURS = Array.from({ length: 17 }, (_, i) => i + 5)

function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  return { firstDay, daysInMonth }
}

function toLocalDateStr(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return y + '-' + m + '-' + d
}

function normKey(iso: string) { return new Date(iso).toISOString() }

function slotLabel(hour: number, half: number) {
  const ampm = hour < 12 ? 'am' : 'pm'
  return (hour % 12 || 12) + ':' + (half === 0 ? '00' : '30') + ampm
}

function slotUTC(year: number, month: number, day: number, hour: number, half: number) {
  return new Date(year, month, day, hour, half * 30, 0, 0).toISOString()
}

function DaySlots({ year, month, day, slots, teacherName, onAssign }: {
  year: number; month: number; day: number
  slots: Slot[]; teacherName: string
  onAssign: (slot: Slot) => void
}) {
  const slotMap = new Map(slots.map(s => [normKey(s.slot_start), s]))
  const visibleSlots: { hour: number; half: number; slot: Slot }[] = []
  HOURS.forEach(hour => [0, 1].forEach(half => {
    const key = normKey(slotUTC(year, month, day, hour, half))
    const slot = slotMap.get(key)
    if (slot) visibleSlots.push({ hour, half, slot })
  }))

  if (visibleSlots.length === 0) {
    return <p className="text-sm text-gray-400 py-2 text-center">No slots open on this day.</p>
  }

  return (
    <div className="space-y-2">
      {visibleSlots.map(({ hour, half, slot }) => (
        <div key={slot.id} className={'border rounded-lg p-3 flex items-start justify-between gap-3 ' + (slot.is_booked ? 'border-orange-200 bg-orange-50' : 'border-green-200 bg-green-50')}>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm text-gray-900">{slotLabel(hour, half)}</p>
            {slot.lesson_topic && <p className="text-sm text-blue-700 mt-0.5">📚 {slot.lesson_topic}</p>}
            {slot.key_points && <p className="text-xs text-gray-500 mt-1">{slot.key_points}</p>}
            {slot.is_booked && <p className="text-xs text-orange-600 mt-0.5 font-medium">Already booked</p>}
          </div>
          {!slot.is_booked && (
            <button onClick={() => onAssign(slot)} className="shrink-0 bg-blue-600 text-white rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-blue-700">
              Assign Student
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

export default function AdminCalendar({ teachers, students }: Props) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>(teachers[0]?.id ?? '')
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [assignModal, setAssignModal] = useState<{ slot: Slot; teacherName: string } | null>(null)
  const [assignStudentId, setAssignStudentId] = useState(students[0]?.id ?? '')
  const [assigning, setAssigning] = useState(false)
  const [assignMsg, setAssignMsg] = useState('')
  const [localSlots, setLocalSlots] = useState<Record<string, Slot[]>>(
    Object.fromEntries(teachers.map(t => [t.id, t.slots]))
  )
  const [, startTransition] = useTransition()

  const teacher = teachers.find(t => t.id === selectedTeacherId)
  const slots = localSlots[selectedTeacherId] ?? []

  const { firstDay, daysInMonth } = getMonthDays(year, month)
  const monthName = new Date(year, month).toLocaleString('default', { month: 'long' })
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const todayStr = toLocalDateStr(now)

  const openAssign = (slot: Slot) => {
    setAssignModal({ slot, teacherName: teacher?.name ?? '' })
    setAssignStudentId(students[0]?.id ?? '')
    setAssignMsg('')
  }

  const handleAssign = () => {
    if (!assignModal || !assignStudentId) return
    setAssigning(true)
    startTransition(async () => {
      try {
        const result = await adminBookSlot(assignModal.slot.id, assignStudentId)
        if (result?.error) { setAssignMsg('❌ ' + result.error); return }
        setLocalSlots(prev => ({
          ...prev,
          [selectedTeacherId]: (prev[selectedTeacherId] ?? []).map(s =>
            s.id === assignModal.slot.id ? { ...s, is_booked: true } : s
          )
        }))
        setAssignMsg('✅ Booked!')
        setTimeout(() => setAssignModal(null), 1000)
      } finally { setAssigning(false) }
    })
  }

  return (
    <div className="space-y-4">
      {teachers.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {teachers.map(t => (
            <button key={t.id} onClick={() => { setSelectedTeacherId(t.id); setSelectedDay(null) }}
              className={'px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ' + (selectedTeacherId === t.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400')}>
              {t.name}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <button onClick={() => { if (month === 0) { setYear(y => y - 1); setMonth(11) } else setMonth(m => m - 1); setSelectedDay(null) }} className="px-3 py-1 rounded hover:bg-gray-100 text-gray-600">← Prev</button>
        <h3 className="font-semibold text-gray-800 text-lg">{monthName} {year}</h3>
        <button onClick={() => { if (month === 11) { setYear(y => y + 1); setMonth(0) } else setMonth(m => m + 1); setSelectedDay(null) }} className="px-3 py-1 rounded hover:bg-gray-100 text-gray-600">Next →</button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {DAYS.map(d => <div key={d} className="text-center text-xs font-semibold text-gray-400 py-1">{d}</div>)}
        {Array.from({ length: firstDay }).map((_, i) => <div key={'e' + i} />)}
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
          const dateStr = toLocalDateStr(new Date(year, month, day))
          const isPast = new Date(year, month, day) < todayMidnight
          const isToday = dateStr === todayStr
          const isSelected = selectedDay === day
          const daySlots = slots.filter(s => toLocalDateStr(new Date(s.slot_start)) === dateStr)
          const openCount = daySlots.filter(s => !s.is_booked).length
          const bookedCount = daySlots.filter(s => s.is_booked).length
          return (
            <button key={day} onClick={() => !isPast && setSelectedDay(isSelected ? null : day)} disabled={isPast}
              className={'relative rounded-lg py-2 px-1 text-sm font-medium transition-colors ' + (isPast ? 'text-gray-300 cursor-default' : 'hover:bg-blue-50 cursor-pointer') + (isToday ? ' ring-2 ring-blue-400' : '') + (isSelected ? ' bg-blue-100' : '')}>
              <span className="block text-center">{day}</span>
              {openCount > 0 && <span className="block text-center text-xs text-green-600 font-normal">{openCount} open</span>}
              {bookedCount > 0 && <span className="block text-center text-xs text-orange-500 font-normal">{bookedCount} bkd</span>}
            </button>
          )
        })}
      </div>

      {selectedDay !== null && (
        <Card className="border-blue-100">
          <CardContent className="pt-4">
            <p className="font-medium text-gray-700 mb-3">
              {new Date(year, month, selectedDay).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              <span className="text-sm text-gray-400 ml-2">— {teacher?.name}</span>
            </p>
            <DaySlots year={year} month={month} day={selectedDay} slots={slots} teacherName={teacher?.name ?? ''} onAssign={openAssign} />
          </CardContent>
        </Card>
      )}

      {assignModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={e => e.target === e.currentTarget && setAssignModal(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-800">Assign Student</h3>
              <button onClick={() => setAssignModal(null)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-sm">
              <p className="font-medium text-gray-800">
                {new Date(assignModal.slot.slot_start).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago' })}
              </p>
              {assignModal.slot.lesson_topic && <p className="text-blue-700 mt-0.5">📚 {assignModal.slot.lesson_topic}</p>}
              <p className="text-gray-500 mt-0.5">with {assignModal.teacherName}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Select Student</label>
              <select value={assignStudentId} onChange={e => setAssignStudentId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                {students.map(s => (
                  <option key={s.id} value={s.id}>{s.name} — {s.creditsRemaining} credit{s.creditsRemaining !== 1 ? 's' : ''} left</option>
                ))}
              </select>
            </div>
            {assignMsg && <p className={'text-sm ' + (assignMsg.startsWith('✅') ? 'text-green-600' : 'text-red-600')}>{assignMsg}</p>}
            <div className="flex gap-2">
              <button onClick={handleAssign} disabled={assigning || !assignStudentId}
                className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {assigning ? 'Booking…' : 'Confirm Assignment'}
              </button>
              <button onClick={() => setAssignModal(null)} className="px-4 border border-gray-200 rounded-lg py-2 text-sm text-gray-500 hover:bg-gray-50">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
