'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { bookSlot } from '@/app/admin/calendar-actions'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface Slot {
  id: string
  slot_start: string
  is_booked: boolean
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
  return date.toISOString().slice(0, 10)
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

  const availableSlots = slots.filter(s => !s.is_booked)
  const slotsByDate = new Map<string, Slot[]>()
  availableSlots.forEach(s => {
    const d = s.slot_start.slice(0, 10)
    if (!slotsByDate.has(d)) slotsByDate.set(d, [])
    slotsByDate.get(d)!.push(s)
  })

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11) } else setMonth(m => m - 1)
    setSelectedDay(null)
  }
  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0) } else setMonth(m => m + 1)
    setSelectedDay(null)
  }

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

  const selectedDate = selectedDay ? new Date(year, month, selectedDay) : null
  const selectedDateStr = selectedDate ? toLocalDateStr(selectedDate) : null
  const selectedSlots = selectedDateStr ? (slotsByDate.get(selectedDateStr) ?? []) : []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={prevMonth} className="px-3 py-1 rounded hover:bg-gray-100 text-gray-600">← Prev</button>
        <h3 className="font-semibold text-gray-800 text-lg">{monthName} {year}</h3>
        <button onClick={nextMonth} className="px-3 py-1 rounded hover:bg-gray-100 text-gray-600">Next →</button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {DAYS.map(d => (
          <div key={d} className="text-center text-xs font-semibold text-gray-400 py-1">{d}</div>
        ))}
        {Array.from({ length: firstDay }).map((_, i) => <div key={'e' + i} />)}
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
          const date = new Date(year, month, day)
          const dateStr = toLocalDateStr(date)
          const daySlots = slotsByDate.get(dateStr) ?? []
          const isPast = date < new Date(now.getFullYear(), now.getMonth(), now.getDate())
          const isSelected = selectedDay === day
          const isToday = toLocalDateStr(now) === dateStr

          return (
            <button
              key={day}
              onClick={() => daySlots.length > 0 ? setSelectedDay(isSelected ? null : day) : null}
              disabled={isPast || daySlots.length === 0}
              className={`rounded-lg py-2 px-1 text-sm font-medium transition-colors
                ${isPast || daySlots.length === 0 ? 'text-gray-300 cursor-default' : 'hover:bg-blue-50 cursor-pointer'}
                ${isToday ? 'ring-2 ring-blue-400' : ''}
                ${isSelected ? 'bg-blue-100' : ''}
              `}
            >
              <span className="block text-center">{day}</span>
              {daySlots.length > 0 && !isPast && (
                <span className="block text-center text-xs text-green-600 font-normal">{daySlots.length}</span>
              )}
            </button>
          )
        })}
      </div>

      {message && (
        <div className={`p-3 rounded text-sm ${message.startsWith('✅') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
          {message}
        </div>
      )}

      {selectedDay && selectedDate && (
        <Card className="border-blue-100">
          <CardContent className="pt-4">
            <p className="font-medium text-gray-700 mb-3">
              {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              {' — '}available slots with {teacherName}
            </p>
            {selectedSlots.length === 0 ? (
              <p className="text-sm text-gray-400">No available slots on this day.</p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {selectedSlots.map(slot => {
                  const d = new Date(slot.slot_start)
                  const label = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago' })
                  const alreadyBooked = bookedSlotIds.includes(slot.id)
                  return (
                    <button
                      key={slot.id}
                      disabled={isPending || creditsRemaining <= 0 || alreadyBooked}
                      onClick={() => handleBook(slot.id)}
                      className={`rounded py-2 px-2 text-sm font-medium border transition-colors
                        ${alreadyBooked ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-default' :
                          creditsRemaining <= 0 ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed' :
                          'bg-white border-green-300 text-green-700 hover:bg-green-50'}`}
                    >
                      {label}
                      {alreadyBooked && <span className="block text-xs text-gray-400">booked</span>}
                    </button>
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
