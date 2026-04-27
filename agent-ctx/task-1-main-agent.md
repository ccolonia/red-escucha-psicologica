# Task: Build AP - Red Asistencial de Salud Mental MVP

## Summary

Built a comprehensive mental health network management platform as a single-page application within Next.js 16. All UI is in Spanish (Argentina) with a calming teal/emerald color scheme.

## Architecture

- **Single-page app**: All views managed by Zustand state (`useAppStore`) within the `/` route
- **Database**: Prisma + SQLite with models: User, Professional, Patient, Appointment, ContactRequest
- **Auth**: next-auth v4 with CredentialsProvider (JWT strategy)
- **State**: Zustand for navigation, TanStack Query available, React state for component-level state
- **UI**: shadcn/ui components, framer-motion animations, Lucide icons
- **Theme**: Custom teal/emerald color palette (no blue/indigo)

## File Structure

### Database & Auth
- `prisma/schema.prisma` - Full schema with 5 models
- `src/lib/auth.ts` - NextAuth configuration
- `src/lib/db.ts` - Prisma client singleton
- `src/lib/store.ts` - Zustand store (AppView navigation)
- `src/lib/seed.ts` - Seed script with sample data

### API Routes
- `src/app/api/auth/[...nextauth]/route.ts` - NextAuth handler
- `src/app/api/auth/register/route.ts` - User registration (creates User + Patient)
- `src/app/api/professionals/route.ts` - List professionals (with specialty filter)
- `src/app/api/professionals/[id]/slots/route.ts` - Available time slots for a date
- `src/app/api/appointments/route.ts` - Create & list appointments
- `src/app/api/appointments/[id]/route.ts` - Update appointment status
- `src/app/api/admin/stats/route.ts` - Admin dashboard statistics
- `src/app/api/contact/route.ts` - Contact form (POST) + admin list (GET)
- `src/app/api/patients/route.ts` - List patients (admin/professional only)

### Components
- `src/components/providers.tsx` - SessionProvider, QueryClientProvider, ThemeProvider, Toaster
- `src/components/landing-page.tsx` - Full landing page with hero, stats, services, CTA, contact form, footer
- `src/components/auth-login.tsx` - Login form
- `src/components/auth-register.tsx` - Registration form (patient role)
- `src/components/patient-dashboard.tsx` - Dashboard, booking flow (4 steps), appointments, profile
- `src/components/professional-dashboard.tsx` - Dashboard, schedule, patients list
- `src/components/admin-dashboard.tsx` - Dashboard with recharts, appointments, professionals, patients, contacts
- `src/components/navigation.tsx` - Sidebar (desktop) + bottom nav (mobile) with role-based items

### Entry Points
- `src/app/layout.tsx` - Root layout (fonts, metadata, CSS)
- `src/app/page.tsx` - Main page with Providers wrapper and view routing
- `src/app/globals.css` - Custom teal/emerald theme CSS variables

## Seed Data Credentials
- **Admin**: admin@ap.com.ar / admin123
- **Professional**: maria.gonzalez@ap.com.ar / prof123
- **Patient**: ana.lopez@email.com / patient123

## Key Design Decisions
1. All navigation is client-side via Zustand state (no URL routing)
2. Password comparison is plain text (noted: should use bcrypt in production)
3. Admin stats include recharts BarChart for last 7 days
4. Professional slots: weekdays 9:00-19:30, Saturday morning only, Sunday closed
5. Booking flow: 4-step wizard (specialty → professional → date/time → confirm)

## Issues Fixed
- Replaced `PeopleRound` icon with `HeartHandshake` (not in lucide-react)
- Added ThemeProvider from next-themes (required by Sonner Toaster)
- Moved Providers wrapper into page.tsx as client component
