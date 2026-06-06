'use client'
import { useState, useTransition } from 'react'
import { toggleSlot } from '@/app/admin/calendar-actions'
import { Card, CardContent } from '@/components/ui/card'

interface SlotRow {
  id: string
  slot_start: string
  is_booked: boolean
}

interface Props {
  teacherId: string
  slots: SlotRow[]
}

const HOURS = Array.from({ length: 17 }, (_, i) => i + 5) // 5am–9pm
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

function slotUTC(year: number, month: number, day: number, hour: number, half: number) {
  return new Date(year, month, day, hour, half * 30, 0, 0).toISOString()
}

function normKey(iso: string) {
  return new Date(iso).toISOString()
}

function slotLabel(hour: number, half: number) {
  const ampm = hour < 12 ? 'am' : 'pm'
  const h = hour % 12 || 12
  return `${h}:${half === 0 ? '00' : '30'}${ampm}`
}

export default function TeacherCalendar({ teacherId, slots: initialSlots }: Props) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [localSlots, setLocalSlots] = useState<SlotRow[]>(initialSlots)
  const [pendingKeys, setPendingKeys] = useState<Set<string>>(new Set())
  const [, startTransition] = useTransition()

  const slotMap = new Map(localSlots.map(s => [normKey(s.slot_start), s]))

  const { firstDay, daysInMonth } = getMonthDays(year, month)
  const monthName = new Date(year, month).toLocaleString('default', { month: 'long' })
  const todayStr = toLocalDateStr(now)
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  const prevMonth = () => { if (month === 0) { setYear(y => y - 1); setMonth(11) } else setMonth(m => m - 1); setSelectedDay(null) }
  const nextMonth = () => { if (month === 11) { setYear(y => y + 1); setMonth(0) } else setMonth(m => m + 1); setSelectedDay(null) }

  const handleToggle = (utcISO: string) => {
    const key = normKey(utcISO)
    if (pendingKeys.has(key)) return
    const existing = slotMap.get(key)
    if (existing?.is_booked) return

    // Optimistic update immediately
    if (existing) {
      setLocalSlots(prev => prev.filter(s => normKey(s.slot_start) !== key))
    } else {
      setLocalSlots(prev => [...prev, { id: 'opt-' + key, slot_start: utcISO, is_booked: false }])
    }
    setPendingKeys(prev => new Set(prev).add(key))

    startTransition(async () => {
      try {
        const result = await toggleSlot(teacherId, utcISO)
        if (result?.error) {
          // Revert on server error
          if (existing) setLocalSlots(prev => [...prev, existing])
          else setLocalSlots(prev => prev.filter(s => normKey(s.slot_start) !== key))
        } else if (result?.action === 'added' && result.slot) {
          // Replace optimistic row with real DB row (has correct id + slot_start from server)
          setLocalSlots(prev => [
            ...prev.filter(s => normKey(s.slot_start) !== key),
            result.slot!
          ])
        }
        // For 'removed', optimistic already handled it — nothing more to do
      } finally {
        setPendingKeys(prev => { const s = new Set(prev); s.delete(key); return s })
      }
    })
  }

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
          const isPast = new Date(year, month, day) < todayMidnight
          const isToday = dateStr === todayStr
          const isSelected = selectedDay === day
          const daySlots = localSlots.filter(s => toLocalDateStr(new Date(s.slot_start)) === dateStr)
          const openCount = daySlots.filter(s => !s.is_booked).length
          const bookedCount = daySlots.filter(s => s.is_booked).length

          return (
            <button key={day} onClick={() => !isPast && setSelectedDay(isSelected ? null : day)} disabled={isPast}
              className={`relative rounded-lg py-2 px-1 text-sm font-medium transition-colors
                ${isPast ? 'text-gray-300 cursor-default' : 'hover:bg-blue-50 cursor-pointer'}
                ${isToday ? 'ring-2 ring-blue-400' : ''}
                ${isSelected ? 'bg-blue-100' : ''}`}>
              <span className="block text-center">{day}</span>
              {openCount > 0 && <span className="block text-center text-xs text-green-600 font-normal">{openCount} open</span>}
              {bookedCount > 0 && <span className="block text-center text-xs text-orange-500 font-normal">{bookedCount} bkd</span>}
            </button>
          )
        })}
      </div>

      {selectedDay && (
        <Card className="border-blue-100">
          <CardContent className="pt-4">
            <p className="font-medium text-gray-700 mb-3">
              {new Date(year, month, selectedDay).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              <span className="text-sm text-gray-400 ml-2">— tap to open/close</span>
            </p>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
              {HOURS.flatMap(hour => [0, 1].map(half => {
                const utcISO = slotUTC(year, month, selectedDay, hour, half)
                const key = normKey(utcISO)
                const slot = slotMap.get(key)
                const isOpen = !!slot && !slot.is_booked
                const isBooked = !!slot && slot.is_booked
                const isPendingThis = pendingKeys.has(key)

                return (
                  <button key={key} disabled={isBooked || isPendingThis} onClick={() => handleToggle(utcISO)}
                    className={`rounded py-2 px-1 text-xs font-medium border transition-colors
                      ${isPendingThis ? 'opacity-50 cursor-wait bg-gray-100 border-gray-300' :
                        isBooked ? 'bg-orange-100 border-orange-300 text-orange-600 cursor-default' :
                        isOpen ? 'bg-green-100 border-green-400 text-green-700 hover:bg-green-200' :
                        'bg-white border-gray-200 text-gray-500 hover:bg-blue-50 hover:border-blue-300'}`}>
                    {slotLabel(hour, half)}
                    {isBooked && <span className="block text-xs">booked</span>}
                    {isOpen && <span className="block text-xs">✓ open</span>}
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
