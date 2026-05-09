# Task 2-c: Frontend Page Updates

## Summary
Updated 4 existing components and the main page layout for the dental clinic AI chatbot dashboard. Also created 5 new page components and corresponding API routes.

## Files Updated

### 1. `/src/app/page.tsx` — Main Layout
- Sidebar now organized into 4 navigation groups: Main, Management, Leads & Requests, Configuration
- Added imports for 5 new page components
- Extended pageTitles map for all 11 pages
- Updated renderPage switch with all new pages

### 2. `/src/components/dashboard-page.tsx` — Dashboard
- Added 4 new stats: Pending Leads, Pending Appointment Requests, Active Services, Active Doctors
- Added Pending Leads table (fetches from /api/leads?status=new) with "View All" button
- Added Pending Appointment Requests table (fetches from /api/appointment-requests?status=pending) with "View All" button
- Both new tables only show when data exists

### 3. `/src/components/chat-page.tsx` — AI Chat (MAJOR UPDATE)
- Welcome screen with bot avatar, welcome message from settings, 6 quick reply buttons
- After-hours banner (auto-detects based on clinic hours setting)
- Structured message types: WhatsApp button, Location card (with Google Maps + Directions), After-Hours card, Staff Handoff (Call/WhatsApp/Leave Message)
- Quick Reply buttons bar above input: Book Appointment, Location, Hours, WhatsApp, Services
- Fetches clinic settings from /api/settings on mount
- New Chat button in conversations panel

### 4. `/src/components/settings-page.tsx` — Settings (MAJOR UPDATE)
- Tabbed layout with 4 tabs: General, Chatbot, Doctors, Services
- General tab: Clinic info + Scheduling + Responses settings tables
- Chatbot tab: Bot name, welcome message, primary color (color picker), after-hours message, auto-reply, FAQ enabled
- Doctors tab: Inline doctors table with add/edit/delete
- Services tab: Inline services table with add/edit/delete
- Supports color picker input, textarea for long text settings, boolean switches

## New Files Created

### Page Components
- `/src/components/services-page.tsx`
- `/src/components/doctors-page.tsx`
- `/src/components/leads-page.tsx`
- `/src/components/appointment-requests-page.tsx`
- `/src/components/faq-page.tsx`

### API Routes
- `/src/app/api/leads/route.ts` — GET (with status filter), POST
- `/src/app/api/leads/[id]/route.ts` — PATCH, DELETE
- `/src/app/api/appointment-requests/route.ts` — GET (with status filter), POST
- `/src/app/api/appointment-requests/[id]/route.ts` — PATCH, DELETE
- `/src/app/api/services/route.ts` — GET, POST
- `/src/app/api/services/[id]/route.ts` — PATCH, DELETE
- `/src/app/api/doctors/route.ts` — GET, POST
- `/src/app/api/doctors/[id]/route.ts` — PATCH, DELETE
- `/src/app/api/faq/route.ts` — GET (with ?all=true support), POST
- `/src/app/api/faq/[id]/route.ts` — PATCH, DELETE

### Seed Data
- Updated `/prisma/seed.ts` with new models: 8 services, 6 doctors, 5 leads, 4 appointment requests, 8 FAQs, 18 bot settings

## Design Decisions
- All pages use minimal classic UI with tables as primary display
- Emerald accent color (#059669) throughout
- Loading skeletons during data fetch
- Error handling with toast notifications from sonner
- Responsive design with hidden columns on mobile
- 'use client' on all components
