'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toggleSlot } from '@/app/admin/calendar-actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface Props {
  teacherId: string
  slots: { id: string; slot_start: string; is_booked: boolean }[]
}

const HOURS = Array.from({ length: 14 }, (_, i) => i + 7) // 7am–8pm
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  return { firstDay, daysInMonth }
}

function toLocalDateStr(date: Date) {
  return date.toISOString().slice(0, 10)
}

function slotKey(date: Date, hour: number, half: number) {
  const d = new Date(date)
  d.setHours(hour, half * 30, 0, 0)
  return d.toISOString()
}

export default function TeacherCalendar({ teacherId, slots }: Props) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const slotMap = new Map(slots.map(s => [s.slot_start, s]))
  const { firstDay, daysInMonth } = getMonthDays(year, month)

  const monthName = new Date(year, month).toLocaleString('default', { month: 'long' })

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11) } else setMonth(m => m - 1)
    setSelectedDay(null)
  }
  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0) } else setMonth(m => m + 1)
    setSelectedDay(null)
  }

  const handleToggle = (isoStr: string) => {
    startTransition(async () => {
      await toggleSlot(teacherId, isoStr)
      router.refresh()
    })
  }

  const selectedDate = selectedDay ? new Date(year, month, selectedDay) : null

  return (
    <div className="space-y-4">
      {/* Month nav */}
      <div className="flex items-center justify-between">
        <button onClick={prevMonth} className="px-3 py-1 rounded hover:bg-gray-100 text-gray-600">← Prev</button>
        <h3 className="font-semibold text-gray-800 text-lg">{monthName} {year}</h3>
        <button onClick={nextMonth} className="px-3 py-1 rounded hover:bg-gray-100 text-gray-600">Next →</button>
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {DAYS.map(d => (
          <div key={d} className="text-center text-xs font-semibold text-gray-400 py-1">{d}</div>
        ))}
        {Array.from({ length: firstDay }).map((_, i) => <div key={'e' + i} />)}
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
          const date = new Date(year, month, day)
          const dateStr = toLocalDateStr(date)
          const daySlots = slots.filter(s => s.slot_start.startsWith(dateStr))
          const openCount = daySlots.filter(s => !s.is_booked).length
          const bookedCount = daySlots.filter(s => s.is_booked).length
          const isToday = toLocalDateStr(now) === dateStr
          const isPast = date < new Date(now.getFullYear(), now.getMonth(), now.getDate())
          const isSelected = selectedDay === day

          return (
            <button
              key={day}
              onClick={() => setSelectedDay(isSelected ? null : day)}
              disabled={isPast}
              className={`relative rounded-lg py-2 px-1 text-sm font-medium transition-colors
                ${isPast ? 'text-gray-300 cursor-default' : 'hover:bg-blue-50 cursor-pointer'}
                ${isToday ? 'ring-2 ring-blue-400' : ''}
                ${isSelected ? 'bg-blue-100' : ''}
              `}
            >
              <span className="block text-center">{day}</span>
              {openCount > 0 && <span className="block text-center text-xs text-green-600 font-normal">{openCount} open</span>}
              {bookedCount > 0 && <span className="block text-center text-xs text-orange-500 font-normal">{bookedCount} booked</span>}
            </button>
          )
        })}
      </div>

      {/* Day slot editor */}
      {selectedDay && selectedDate && (
        <Card className="border-blue-100">
          <CardContent className="pt-4">
            <p className="font-medium text-gray-700 mb-3">
              {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              <span className="text-sm text-gray-400 ml-2">— click slots to toggle open/unavailable</span>
            </p>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
              {HOURS.flatMap(hour => [0, 1].map(half => {
                const iso = slotKey(selectedDate, hour, half)
                const slot = slotMap.get(iso)
                const isOpen = !!slot && !slot.is_booked
                const isBooked = !!slot && slot.is_booked
                const label = `${hour % 12 || 12}:${half === 0 ? '00' : '30'} ${hour < 12 ? 'am' : 'pm'}`
                return (
                  <button
                    key={iso}
                    disabled={isPending || isBooked}
                    onClick={() => handleToggle(iso)}
                    className={`rounded py-2 px-1 text-xs font-medium border transition-colors
                      ${isBooked ? 'bg-orange-100 border-orange-300 text-orange-600 cursor-default' :
                        isOpen ? 'bg-green-100 border-green-400 text-green-700 hover:bg-green-200' :
                        'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}
                    `}
                  >
                    {label}
                    {isBooked && <span className="block text-xs">booked</span>}
                    {isOpen && <span className="block text-xs">open</span>}
                  </button>
                )
              }))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
