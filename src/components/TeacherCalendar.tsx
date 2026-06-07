'use client'
import { useState, useTransition } from 'react'
import { toggleSlot, updateSlotDetails } from '@/app/admin/calendar-actions'
import { Card, CardContent } from '@/components/ui/card'

interface SlotRow {
  id: string
  slot_start: string
  is_booked: boolean
  lesson_topic?: string | null
  key_points?: string | null
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

  // Slot detail modal state
  const [modalSlot, setModalSlot] = useState<{ utcISO: string; existing?: SlotRow } | null>(null)
  const [modalTopic, setModalTopic] = useState('')
  const [modalPoints, setModalPoints] = useState('')
  const [modalSaving, setModalSaving] = useState(false)
  const [modalError, setModalError] = useState('')

  const slotMap = new Map(localSlots.map(s => [normKey(s.slot_start), s]))
  const { firstDay, daysInMonth } = getMonthDays(year, month)
  const monthName = new Date(year, month).toLocaleString('default', { month: 'long' })
  const todayStr = toLocalDateStr(now)
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  const prevMonth = () => { if (month === 0) { setYear(y => y - 1); setMonth(11) } else setMonth(m => m - 1); setSelectedDay(null) }
  const nextMonth = () => { if (month === 11) { setYear(y => y + 1); setMonth(0) } else setMonth(m => m + 1); setSelectedDay(null) }

  const openModal = (utcISO: string, existing?: SlotRow) => {
    setModalSlot({ utcISO, existing })
    setModalTopic(existing?.lesson_topic ?? '')
    setModalPoints(existing?.key_points ?? '')
    setModalError('')
  }

  const closeModal = () => { setModalSlot(null); setModalError('') }

  // Open a new slot (with optional topic/points)
  const handleOpen = async () => {
    if (!modalSlot) return
    const { utcISO } = modalSlot
    const key = normKey(utcISO)
    setModalSaving(true)
    setModalError('')
    setLocalSlots(prev => [...prev, { id: 'opt-' + key, slot_start: utcISO, is_booked: false, lesson_topic: modalTopic || null, key_points: modalPoints || null }])
    setPendingKeys(prev => new Set(prev).add(key))
    startTransition(async () => {
      try {
        const result = await toggleSlot(teacherId, utcISO, modalTopic || undefined, modalPoints || undefined)
        if (result?.error) {
          setLocalSlots(prev => prev.filter(s => normKey(s.slot_start) !== key))
          setModalError(result.error)
          setModalSaving(false)
          return
        }
        if (result?.action === 'added' && result.slot) {
          setLocalSlots(prev => [...prev.filter(s => normKey(s.slot_start) !== key), result.slot!])
        }
        closeModal()
      } finally {
        setPendingKeys(prev => { const s = new Set(prev); s.delete(key); return s })
        setModalSaving(false)
      }
    })
  }

  // Remove an open slot
  const handleRemove = async () => {
    if (!modalSlot?.existing) return
    const key = normKey(modalSlot.utcISO)
    setModalSaving(true)
    setLocalSlots(prev => prev.filter(s => normKey(s.slot_start) !== key))
    setPendingKeys(prev => new Set(prev).add(key))
    startTransition(async () => {
      try {
        const result = await toggleSlot(teacherId, modalSlot.utcISO)
        if (result?.error) {
          setLocalSlots(prev => [...prev, modalSlot.existing!])
          setModalError(result.error)
          setModalSaving(false)
          return
        }
        closeModal()
      } finally {
        setPendingKeys(prev => { const s = new Set(prev); s.delete(key); return s })
        setModalSaving(false)
      }
    })
  }

  // Update details on an already-open slot
  const handleUpdateDetails = async () => {
    if (!modalSlot?.existing) return
    setModalSaving(true)
    setModalError('')
    startTransition(async () => {
      try {
        const result = await updateSlotDetails(modalSlot.existing!.id, modalTopic, modalPoints)
        if (result?.error) { setModalError(result.error); setModalSaving(false); return }
        setLocalSlots(prev => prev.map(s => s.id === modalSlot.existing!.id ? { ...s, lesson_topic: modalTopic, key_points: modalPoints } : s))
        closeModal()
      } finally { setModalSaving(false) }
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
              <span className="text-sm text-gray-400 ml-2">— tap a slot to open/edit</span>
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
                  <button key={key} disabled={isBooked || isPendingThis}
                    onClick={() => !isBooked && !isPendingThis && openModal(utcISO, slot)}
                    className={`rounded py-2 px-1 text-xs font-medium border transition-colors
                      ${isPendingThis ? 'opacity-50 cursor-wait bg-gray-100 border-gray-300' :
                        isBooked ? 'bg-orange-100 border-orange-300 text-orange-600 cursor-default' :
                        isOpen ? 'bg-green-100 border-green-400 text-green-700 hover:bg-green-200' :
                        'bg-white border-gray-200 text-gray-500 hover:bg-blue-50 hover:border-blue-300'}`}>
                    {slotLabel(hour, half)}
                    {isBooked && <span className="block text-xs">booked</span>}
                    {isOpen && <span className="block text-xs">✓ open</span>}
                    {isOpen && slot?.lesson_topic && <span className="block text-xs truncate w-full" title={slot.lesson_topic}>📚</span>}
                  </button>
                )
              }))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Slot modal */}
      {modalSlot && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-800">
                {modalSlot.existing ? 'Edit Slot' : 'Open Slot'}
                <span className="text-sm font-normal text-gray-500 ml-2">
                  {new Date(modalSlot.utcISO).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago' })}
                </span>
              </h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Lesson Topic <span className="text-gray-400 font-normal">(optional)</span></label>
                <input
                  type="text"
                  value={modalTopic}
                  onChange={e => setModalTopic(e.target.value)}
                  placeholder="e.g. Present tense verbs"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Key Points <span className="text-gray-400 font-normal">(optional)</span></label>
                <textarea
                  value={modalPoints}
                  onChange={e => setModalPoints(e.target.value)}
                  placeholder="e.g. Review homework, practice conjugation, introduce irregular verbs"
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                />
              </div>
            </div>

            {modalError && <p className="text-sm text-red-600">{modalError}</p>}

            <div className="flex gap-2 pt-1">
              {modalSlot.existing ? (
                <>
                  <button onClick={handleUpdateDetails} disabled={modalSaving}
                    className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                    {modalSaving ? 'Saving…' : 'Save Changes'}
                  </button>
                  <button onClick={handleRemove} disabled={modalSaving}
                    className="px-4 bg-red-50 text-red-600 border border-red-200 rounded-lg py-2 text-sm font-medium hover:bg-red-100 disabled:opacity-50">
                    Remove
                  </button>
                </>
              ) : (
                <button onClick={handleOpen} disabled={modalSaving}
                  className="flex-1 bg-green-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                  {modalSaving ? 'Opening…' : 'Open This Slot'}
                </button>
              )}
              <button onClick={closeModal} className="px-4 border border-gray-200 rounded-lg py-2 text-sm text-gray-500 hover:bg-gray-50">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
