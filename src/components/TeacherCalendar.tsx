'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
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

// 5am – 9pm (17 hours × 2 = 34 slots per day)
const HOURS = Array.from({ length: 17 }, (_, i) => i + 5)
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

// Build an ISO string that matches what the server will store
// Uses local midnight + hours offset so it's timezone-consistent
function slotISO(year: number, month: number, day: number, hour: number, half: number): string {
  const d = new Date(year, month, day, hour, half * 30, 0, 0)
  // Format as local ISO (no UTC conversion) to match DB values
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`
}

// Also handle UTC-stored ISO strings by normalising to local format
function normaliseISO(iso: string): string {
  if (!iso) return iso
  // If it ends in Z or has +offset, convert to local
  if (iso.endsWith('Z') || iso.match(/[+-]\d{2}:\d{2}$/)) {
    const d = new Date(iso)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`
  }
  return iso.slice(0, 19)
}

export default function TeacherCalendar({ teacherId, slots }: Props) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [pendingSlots, setPendingSlots] = useState<Set<string>>(new Set())
  const [localSlots, setLocalSlots] = useState<SlotRow[]>(slots)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  // Normalise all slot_start values to local ISO for consistent matching
  const slotMap = new Map(localSlots.map(s => [normaliseISO(s.slot_start), s]))

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

  const handleToggle = (iso: string) => {
    if (pendingSlots.has(iso)) return
    
    // Optimistic update
    const existing = slotMap.get(iso)
    if (existing) {
      setLocalSlots(prev => prev.filter(s => normaliseISO(s.slot_start) !== iso))
    } else {
      setLocalSlots(prev => [...prev, { id: 'pending-' + iso, slot_start: iso, is_booked: false }])
    }
    
    setPendingSlots(prev => new Set(prev).add(iso))
    
    startTransition(async () => {
      try {
        await toggleSlot(teacherId, iso)
        router.refresh()
      } catch (e) {
        // Revert optimistic update on error
        if (existing) {
          setLocalSlots(prev => [...prev, existing])
        } else {
          setLocalSlots(prev => prev.filter(s => normaliseISO(s.slot_start) !== iso))
        }
      } finally {
        setPendingSlots(prev => { const s = new Set(prev); s.delete(iso); return s })
      }
    })
  }

  const todayStr = toLocalDateStr(now)
  const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())

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
          const dateStr = toLocalDateStr(new Date(year, month, day))
          const daySlots = localSlots.filter(s => normaliseISO(s.slot_start).startsWith(dateStr))
          const openCount = daySlots.filter(s => !s.is_booked).length
          const bookedCount = daySlots.filter(s => s.is_booked).length
          const isToday = todayStr === dateStr
          const isPast = new Date(year, month, day) < todayDate
          const isSelected = selectedDay === day

          return (
            <button
              key={day}
              onClick={() => !isPast && setSelectedDay(isSelected ? null : day)}
              disabled={isPast}
              className={`relative rounded-lg py-2 px-1 text-sm font-medium transition-colors
                ${isPast ? 'text-gray-300 cursor-default' : 'hover:bg-blue-50 cursor-pointer'}
                ${isToday ? 'ring-2 ring-blue-400' : ''}
                ${isSelected ? 'bg-blue-100' : ''}
              `}
            >
              <span className="block text-center">{day}</span>
              {openCount > 0 && <span className="block text-center text-xs text-green-600 font-normal">{openCount} open</span>}
              {bookedCount > 0 && <span className="block text-center text-xs text-orange-500 font-normal">{bookedCount} bkd</span>}
            </button>
          )
        })}
      </div>

      {/* Day slot editor */}
      {selectedDay && (
        <Card className="border-blue-100">
          <CardContent className="pt-4">
            <p className="font-medium text-gray-700 mb-3">
              {new Date(year, month, selectedDay).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              <span className="text-sm text-gray-400 ml-2">— tap to toggle open/closed</span>
            </p>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
              {HOURS.flatMap(hour => [0, 1].map(half => {
                const iso = slotISO(year, month, selectedDay, hour, half)
                const slot = slotMap.get(iso)
                const isOpen = !!slot && !slot.is_booked
                const isBooked = !!slot && slot.is_booked
                const isPendingThis = pendingSlots.has(iso)
                const ampm = hour < 12 ? 'am' : 'pm'
                const displayHour = hour % 12 || 12
                const label = `${displayHour}:${half === 0 ? '00' : '30'}${ampm}`

                return (
                  <button
                    key={iso}
                    disabled={isBooked || isPendingThis}
                    onClick={() => handleToggle(iso)}
                    className={`rounded py-2 px-1 text-xs font-medium border transition-colors
                      ${isPendingThis ? 'opacity-50 cursor-wait bg-gray-100 border-gray-300' :
                        isBooked ? 'bg-orange-100 border-orange-300 text-orange-600 cursor-default' :
                        isOpen ? 'bg-green-100 border-green-400 text-green-700 hover:bg-green-200' :
                        'bg-white border-gray-200 text-gray-500 hover:bg-blue-50 hover:border-blue-300'}
                    `}
                  >
                    {label}
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
