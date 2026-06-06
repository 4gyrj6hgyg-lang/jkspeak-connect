-- ── Migration: Calendar, Credits, Booking ────────────────────
-- Run this in Supabase SQL Editor

-- 1. Availability slots (teacher marks open 30-min windows)
create table if not exists public.availability_slots (
  id uuid default gen_random_uuid() primary key,
  teacher_id uuid references public.teachers on delete cascade not null,
  slot_start timestamptz not null,
  is_booked boolean not null default false,
  created_at timestamptz default now(),
  unique(teacher_id, slot_start)
);
alter table public.availability_slots enable row level security;

create policy "Teachers manage own slots" on public.availability_slots
  for all using (
    exists (select 1 from public.teachers where id = teacher_id and profile_id = auth.uid())
  );
create policy "Students can view slots for assigned teachers" on public.availability_slots
  for select using (
    exists (
      select 1 from public.teacher_students ts
      join public.students s on s.id = ts.student_id
      where ts.teacher_id = availability_slots.teacher_id and s.profile_id = auth.uid()
    )
  );
create policy "Admins full access to slots" on public.availability_slots
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- 2. Class credits (admin sets student balance)
create table if not exists public.class_credits (
  id uuid default gen_random_uuid() primary key,
  student_id uuid references public.students on delete cascade not null unique,
  total_purchased int not null default 0,
  total_used int not null default 0,
  updated_at timestamptz default now()
);
alter table public.class_credits enable row level security;

create policy "Students view own credits" on public.class_credits
  for select using (
    exists (select 1 from public.students where id = student_id and profile_id = auth.uid())
  );
create policy "Admins full access to credits" on public.class_credits
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- 3. Bookings (student books a slot — links slot to session)
create table if not exists public.bookings (
  id uuid default gen_random_uuid() primary key,
  slot_id uuid references public.availability_slots on delete cascade not null unique,
  session_id uuid references public.sessions on delete cascade not null unique,
  student_id uuid references public.students on delete cascade not null,
  booked_at timestamptz default now(),
  reminder_sent boolean not null default false
);
alter table public.bookings enable row level security;

create policy "Students view own bookings" on public.bookings
  for select using (
    exists (select 1 from public.students where id = student_id and profile_id = auth.uid())
  );
create policy "Students insert own bookings" on public.bookings
  for insert with check (
    exists (select 1 from public.students where id = student_id and profile_id = auth.uid())
  );
create policy "Teachers view bookings for their sessions" on public.bookings
  for select using (
    exists (
      select 1 from public.sessions s
      join public.teachers t on t.id = s.teacher_id
      where s.id = session_id and t.profile_id = auth.uid()
    )
  );
create policy "Admins full access to bookings" on public.bookings
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- 4. Ensure sessions has student_id nullable (student books, so teacher creates session on booking)
-- sessions table already exists — just confirm duration default is 30
alter table public.sessions alter column duration_minutes set default 30;
