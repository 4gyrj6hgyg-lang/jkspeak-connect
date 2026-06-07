'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { bookSlot } from '@/app/admin/calendar-actions'
import { Card, CardContent } from '@/components/ui/card'

interface Slot {
  id: string
  slot_start: string
  is_booked: boolean
  lesson_topic?: string | null
  key_points?: string | null
}

interface Props {
  teacherName: string
  slots: Slot[]
  creditsRemaining: number
  bookedSlotIds: string[]
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  return { firstDay, daysInMonth }
}

function toLocalDateStr(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export default function StudentBookingCalendar({ teacherName, slots, creditsRemaining, bookedSlotIds }: Props) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [message, setMessage] = useState('')
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const { firstDay, daysInMonth } = getMonthDays(year, month)
  const monthName = new Date(year, month).toLocaleString('default', { month: 'long' })
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const todayStr = toLocalDateStr(now)

  const availableSlots = slots.filter(s => !s.is_booked)
  const slotsByDate = new Map<string, Slot[]>()
  availableSlots.forEach(s => {
    const d = toLocalDateStr(new Date(s.slot_start))
    if (!slotsByDate.has(d)) slotsByDate.set(d, [])
    slotsByDate.get(d)!.push(s)
  })

  const prevMonth = () => { if (month === 0) { setYear(y => y - 1); setMonth(11) } else setMonth(m => m - 1); setSelectedDay(null) }
  const nextMonth = () => { if (month === 11) { setYear(y => y + 1); setMonth(0) } else setMonth(m => m + 1); setSelectedDay(null) }

  const handleBook = (slotId: string) => {
    setMessage('')
    startTransition(async () => {
      const result = await bookSlot(slotId)
      if (result.error) {
        setMessage('❌ ' + result.error)
      } else {
        setMessage(`✅ Booked! Credits remaining: ${result.creditsRemaining}`)
        router.refresh()
      }
    })
  }

  const selectedDateStr = selectedDay ? toLocalDateStr(new Date(year, month, selectedDay)) : null
  const selectedSlots = selectedDateStr ? (slotsByDate.get(selectedDateStr) ?? []) : []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={prevMonth} className="px-3 py-1 rounded hover:bg-gray-100 text-gray-600">← Prev</button>
        <h3 className="font-semibold text-gray-800 text-lg">{monthName} {year}</h3>
        <button onClick={nextMonth} className="px-3 py-1 rounded hover:bg-gray-100 text-gray-600">Next →</button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {DAYS.map(d => <div key={d} className="text-center text-xs font-semibold text-gray-400 py-1">{d}</div>)}
        {Array.from({ length: firstDay }).map((_, i) => <div key={'e' + i} />)}
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
          const dateStr = toLocalDateStr(new Date(year, month, day))
          const daySlots = slotsByDate.get(dateStr) ?? []
          const isPast = new Date(year, month, day) < todayMidnight
          const isSelected = selectedDay === day
          const isToday = dateStr === todayStr
          return (
            <button key={day} onClick={() => daySlots.length > 0 && !isPast && setSelectedDay(isSelected ? null : day)}
              disabled={isPast || daySlots.length === 0}
              className={`rounded-lg py-2 px-1 text-sm font-medium transition-colors
                ${isPast || daySlots.length === 0 ? 'text-gray-300 cursor-default' : 'hover:bg-blue-50 cursor-pointer'}
                ${isToday ? 'ring-2 ring-blue-400' : ''}
                ${isSelected ? 'bg-blue-100' : ''}`}>
              <span className="block text-center">{day}</span>
              {daySlots.length > 0 && !isPast && <span className="block text-center text-xs text-green-600 font-normal">{daySlots.length}</span>}
            </button>
          )
        })}
      </div>

      {message && (
        <div className={`p-3 rounded text-sm ${message.startsWith('✅') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>{message}</div>
      )}

      {selectedDay && (
        <Card className="border-blue-100">
          <CardContent className="pt-4">
            <p className="font-medium text-gray-700 mb-3">
              {new Date(year, month, selectedDay).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              {' — '}available with {teacherName}
            </p>
            {selectedSlots.length === 0 ? (
              <p className="text-sm text-gray-400">No available slots on this day.</p>
            ) : (
              <div className="space-y-2">
                {selectedSlots.map(slot => {
                  const d = new Date(slot.slot_start)
                  const timeLabel = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago' })
                  const alreadyBooked = bookedSlotIds.includes(slot.id)
                  const noCredits = creditsRemaining <= 0
                  return (
                    <div key={slot.id} className="border border-gray-200 rounded-lg p-3 flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 text-sm">{timeLabel}</p>
                        {slot.lesson_topic && (
                          <p className="text-sm text-blue-700 mt-0.5">📚 {slot.lesson_topic}</p>
                        )}
                        {slot.key_points && (
                          <p className="text-xs text-gray-500 mt-1 whitespace-pre-wrap">{slot.key_points}</p>
                        )}
                      </div>
                      <button
                        disabled={isPending || noCredits || alreadyBooked}
                        onClick={() => handleBook(slot.id)}
                        className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium border transition-colors
                          ${alreadyBooked ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-default' :
                            noCredits ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed' :
                            'bg-green-600 border-green-600 text-white hover:bg-green-700'}`}
                      >
                        {alreadyBooked ? 'Booked' : noCredits ? 'No credits' : 'Book'}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
