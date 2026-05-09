---
Task ID: 1
Agent: Main Agent
Task: Read all codebase and find/fix issues

Work Log:
- Read all 11 component page files (dashboard, conversations, patients, appointments, chat, settings, services, doctors, leads, appointment-requests, faq)
- Read all 14 API route files (dashboard, patients, patients/[id], appointments, appointments/[id], conversations, conversations/[id], chat, services, services/[id], doctors, doctors/[id], leads, leads/[id], appointment-requests, appointment-requests/[id], faq, faq/[id], settings)
- Read Prisma schema, store, db.ts, layout.tsx, page.tsx
- Ran comprehensive API audit via subagent, identified 20 issues across critical/high/medium/low severity
- Fixed all Critical and High issues, most Medium issues

Stage Summary:
- **Fixed #1 (Critical)**: Chat route system prompt was using `role: 'assistant'` instead of `role: 'system'` - entire chatbot behavior was degraded
- **Fixed #2 (Critical)**: Patient PATCH returned raw Prisma object with `dob` instead of mapped `dateOfBirth`
- **Fixed #3 (High)**: Patient POST default status was `'new'` contradicting schema default `'active'`
- **Fixed #4 (High)**: Patient PATCH now accepts `dob`/`dateOfBirth` and `lastVisit` fields
- **Fixed #5 (High)**: Appointment PATCH now returns flattened response (patientName instead of nested patient object)
- **Fixed #6 (High)**: Conversation PATCH now returns flattened response
- **Fixed #7 (High)**: Conversation GET by ID now returns flattened conversation with messages
- **Fixed #9 (Medium)**: Conversations API now supports `search` query parameter (previously ignored)
- **Fixed #13 (Medium)**: Dashboard and Appointments APIs now use local timezone instead of UTC for "today" date
- **Fixed SelectTrigger**: Removed invalid `size="sm"` prop from SelectTrigger in conversations-page.tsx and patients-page.tsx
- **Fixed #11 (Medium)**: Added DELETE endpoints for leads/[id] and appointment-requests/[id]
- **Fixed #14 (Medium)**: Appointment PATCH now accepts date, time, duration, type fields (rescheduling support)
- **Fixed**: Guest patient in chat route now uses `status: 'active'` instead of `'new'`
- **Fixed**: Auto-created patients in appointments route now use `status: 'active'`
- **Seeded database**: 12 patients, 8 services, 4 doctors, 5 leads, 5 appointment requests, 8 FAQs, 22 conversations, 50 messages, 16 appointments, 18 bot settings
- **Verified**: All API endpoints return correct data with proper field mapping
- **Server running**: Dev server on port 3000, all pages and APIs accessible
