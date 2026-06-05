-- JK Speak Connect — Database Schema
-- Run this in your Supabase SQL editor

-- Enable RLS

-- Profiles (extends Supabase auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  full_name text not null,
  role text not null check (role in ('student', 'teacher', 'admin')),
  created_at timestamptz default now()
);
alter table public.profiles enable row level security;

create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);
create policy "Admins can view all profiles" on public.profiles
  for select using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );
create policy "Admins can insert profiles" on public.profiles
  for insert with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Teachers
create table public.teachers (
  id uuid default gen_random_uuid() primary key,
  profile_id uuid references public.profiles on delete cascade not null unique,
  rate_per_class numeric(10,2) not null default 0,
  bio text,
  created_at timestamptz default now()
);
alter table public.teachers enable row level security;

create policy "Teachers can view own record" on public.teachers
  for select using (profile_id = auth.uid());
create policy "Admins full access to teachers" on public.teachers
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );
create policy "Students can view assigned teachers" on public.teachers
  for select using (
    exists (
      select 1 from public.teacher_students ts
      join public.students s on s.id = ts.student_id
      where ts.teacher_id = teachers.id and s.profile_id = auth.uid()
    )
  );

-- Students
create table public.students (
  id uuid default gen_random_uuid() primary key,
  profile_id uuid references public.profiles on delete cascade not null unique,
  created_at timestamptz default now()
);
alter table public.students enable row level security;

create policy "Students can view own record" on public.students
  for select using (profile_id = auth.uid());
create policy "Admins full access to students" on public.students
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Teacher ↔ Student assignments
create table public.teacher_students (
  id uuid default gen_random_uuid() primary key,
  teacher_id uuid references public.teachers on delete cascade not null,
  student_id uuid references public.students on delete cascade not null,
  created_at timestamptz default now(),
  unique(teacher_id, student_id)
);
alter table public.teacher_students enable row level security;

create policy "Admins full access to assignments" on public.teacher_students
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );
create policy "Teachers can view own assignments" on public.teacher_students
  for select using (
    exists (select 1 from public.teachers where id = teacher_id and profile_id = auth.uid())
  );
create policy "Students can view own assignments" on public.teacher_students
  for select using (
    exists (select 1 from public.students where id = student_id and profile_id = auth.uid())
  );

-- Sessions (1-on-1)
create table public.sessions (
  id uuid default gen_random_uuid() primary key,
  teacher_id uuid references public.teachers on delete cascade not null,
  student_id uuid references public.students on delete cascade not null,
  title text not null,
  scheduled_at timestamptz not null,
  duration_minutes int not null default 60,
  status text not null default 'open' check (status in ('open', 'closed', 'completed', 'cancelled')),
  notes text,
  created_at timestamptz default now()
);
alter table public.sessions enable row level security;

create policy "Teachers can manage own sessions" on public.sessions
  for all using (
    exists (select 1 from public.teachers where id = teacher_id and profile_id = auth.uid())
  );
create policy "Students can view own sessions" on public.sessions
  for select using (
    exists (select 1 from public.students where id = student_id and profile_id = auth.uid())
  );
create policy "Admins full access to sessions" on public.sessions
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', 'New User'),
    coalesce(new.raw_user_meta_data->>'role', 'student')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Indexes
create index sessions_teacher_id_idx on public.sessions(teacher_id);
create index sessions_student_id_idx on public.sessions(student_id);
create index sessions_scheduled_at_idx on public.sessions(scheduled_at);
create index sessions_status_idx on public.sessions(status);
create index teacher_students_teacher_id_idx on public.teacher_students(teacher_id);
create index teacher_students_student_id_idx on public.teacher_students(student_id);
