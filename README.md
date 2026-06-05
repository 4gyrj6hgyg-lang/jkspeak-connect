# JK Speak Connect

Language learning session management platform. Three-role system: students, teachers, and admins.

## Stack
- **Next.js 14** (App Router)
- **Supabase** (auth, postgres, RLS)
- **Tailwind CSS** + custom UI components
- **Vercel** (deploy)

## Roles
| Role | Access |
|------|--------|
| Student | View assigned teacher, see upcoming sessions & open/closed status |
| Teacher | Manage own sessions, open/close/complete sessions, create sessions for assigned students |
| Admin | Full access: manage teachers/students, assign teacher→student, view all sessions, payroll calculation & CSV export |

## Setup

### 1. Supabase
1. Create a new project at [supabase.com](https://supabase.com)
2. Go to SQL Editor → run `supabase/schema.sql`
3. Copy your Project URL and anon key

### 2. Environment
```bash
cp .env.local.example .env.local
# Fill in your Supabase URL and anon key
```

### 3. Create your first admin user
In Supabase Auth → Add user, then in SQL Editor:
```sql
UPDATE profiles SET role = 'admin' WHERE email = 'your@email.com';
```

### 4. Run locally
```bash
npm install
npm run dev
```

### 5. Deploy to Vercel
```bash
npx vercel --prod
# Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel dashboard
```

## Payroll
Admin → Payroll tab shows completed sessions × rate per teacher. Export to CSV with one click. Rates are set per teacher and editable inline.
