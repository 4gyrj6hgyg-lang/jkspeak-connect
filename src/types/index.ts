export type UserRole = 'student' | 'teacher' | 'admin'

export interface Profile {
  id: string
  email: string
  full_name: string
  role: UserRole
  created_at: string
}

export interface Teacher {
  id: string
  profile_id: string
  rate_per_class: number
  bio?: string
  profile?: Profile
}

export interface Student {
  id: string
  profile_id: string
  profile?: Profile
}

export interface TeacherStudent {
  id: string
  teacher_id: string
  student_id: string
  teacher?: Teacher
  student?: Student
}

export interface Session {
  id: string
  teacher_id: string
  student_id: string
  title: string
  scheduled_at: string
  duration_minutes: number
  status: 'open' | 'closed' | 'completed' | 'cancelled'
  notes?: string
  created_at: string
  teacher?: Teacher
  student?: Student
}

export interface PayrollEntry {
  teacher_id: string
  teacher_name: string
  rate_per_class: number
  completed_sessions: number
  total_pay: number
  period_start: string
  period_end: string
}
