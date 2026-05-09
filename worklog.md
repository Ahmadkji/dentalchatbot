---
Task ID: 1
Agent: main
Task: Plan and implement 10+ dental clinic chatbot features

Work Log:
- Updated Prisma schema with new models: Service, Doctor, Lead, AppointmentRequest, FAQ
- Pushed schema to database
- Created all new API routes: services, doctors, leads, appointment-requests, faq (with [id] sub-routes)
- Updated dashboard API to include new stats (pendingLeads, pendingAppointmentRequests, activeServices, activeDoctors)
- Enhanced chat API with dynamic system prompt built from DB data (services, doctors, FAQs, settings)
- Updated Zustand store with new page types
- Created Services, Doctors, Leads, AppointmentRequests, FAQ page components
- Updated main page layout with 4-group sidebar navigation
- Updated Dashboard with Pending Leads and Appointment Requests tables
- Rebuilt Chat page with: quick replies, WhatsApp redirect, location cards, after-hours banner, staff handoff, structured messages
- Rebuilt Settings page with tabbed layout (General, Chatbot, Doctors, Services)
- Seeded database with 8 services, 4 doctors, 5 leads, 5 appointment requests, 8 FAQs, 18 bot settings
- Fixed API response format consistency for frontend consumption
- Fixed chat API system prompt role from 'system' to 'assistant'

Stage Summary:
- All 10 features implemented: FAQ Chatbot, Appointment Request Capture, WhatsApp Redirect, Location/Directions, Service Information, Lead Capture, After-Hours Assistant, Symptom-to-Department Guidance, Staff Handoff, Clinic Dashboard
- Customization features: Chatbot Color picker, Welcome Message editing, Quick Reply Buttons
- 11 pages total: Dashboard, AI Chat, Patients, Appointments, Services, Doctors, Conversations, Appointment Requests, Leads, FAQ, Settings
- Dynamic AI system prompt pulls all clinic data from DB
- Chat features: structured messages (location cards, WhatsApp buttons, after-hours cards, handoff cards)
