let _counter = 0;
function cuid(): string {
  _counter++;
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `c${ts}${rand}${_counter}`;
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// --------------- Types ---------------
export interface Patient {
  id: string;
  name: string;
  email: string;
  phone: string;
  dob: string;
  lastVisit: string | null;
  status: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Conversation {
  id: string;
  patientId: string;
  channel: string;
  status: string;
  subject: string | null;
  messageCount: number;
  lastMessage: string | null;
  sourcePage: string | null;
  helpfulStatus: 'helpful' | 'not_helpful' | 'unreviewed';
  needsImprovement: boolean;
  leadCaptured: boolean;
  appointmentRequested: boolean;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Message {
  id: string;
  conversationId: string;
  role: string;
  content: string;
  metadata: string | null;
  createdAt: Date;
}

export interface Appointment {
  id: string;
  patientId: string;
  date: string;
  time: string;
  duration: number;
  type: string;
  status: string;
  notes: string | null;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Service {
  id: string;
  name: string;
  description: string;
  duration: string;
  requiresAppointment: boolean;
  preparationInstructions: string | null;
  price: string | null;
  department: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Lead {
  id: string;
  name: string;
  phone: string;
  question: string;
  service: string | null;
  preferredDate: string | null;
  preferredTime: string | null;
  message: string | null;
  internalNote: string | null;
  preferredContact: string;
  status: string;
  source: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AppointmentRequest {
  id: string;
  name: string;
  phone: string;
  preferredDate: string;
  preferredTime: string;
  reason: string;
  preferredDoctor: string | null;
  status: string;
  source: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface FAQ {
  id: string;
  question: string;
  answer: string;
  order: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface BotSetting {
  id: string;
  key: string;
  value: string;
  category: string;
  description: string | null;
  updatedAt: Date;
}

export interface InteractionEvent {
  id: string;
  conversationId: string | null;
  eventType: 'whatsapp_click' | 'call_click' | 'location_click' | 'directions_click' | 'appointment_request';
  source: 'playground' | 'widget';
  service: string | null;
  metadata: string | null;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UnansweredQuestion {
  id: string;
  conversationId: string | null;
  question: string;
  sourcePage: string | null;
  status: 'open' | 'answered' | 'ignored';
  answer: string | null;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface LeadCustomField {
  id: string;
  label: string;
  fieldType: 'text' | 'textarea' | 'select' | 'number' | 'email' | 'tel';
  required: boolean;
  options: string | null;
  placeholder: string | null;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

// --------------- Query Helpers ---------------
type WhereClause = Record<string, unknown>;

type AnyRecord = Record<string, any>;

function matchesWhere<T extends AnyRecord>(item: T, where: WhereClause): boolean {
  for (const [key, val] of Object.entries(where)) {
    if (key === 'OR') {
      const ors = val as WhereClause[];
      if (!ors.some((or) => matchesWhere(item, or))) return false;
    } else if (key === 'patient') {
      // Nested relation filter - handled by callers
      continue;
    } else {
      if (item[key] !== val) return false;
    }
  }
  return true;
}

// --------------- Table Store ---------------
type OrderBy = Record<string, string> | Record<string, string>[];

interface Table<T extends AnyRecord> {
  data: T[];
  findMany(opts?: { where?: WhereClause; orderBy?: OrderBy; take?: number; skip?: number }): T[];
  findUnique(opts: { where: { id: string } }): T | null;
  findFirst(opts?: { where?: WhereClause; orderBy?: OrderBy }): T | null;
  create(opts: { data: Partial<T> }): T;
  update(opts: { where: { id?: string; key?: string }; data: Partial<T> }): T;
  delete(opts: { where: { id: string } }): T;
  count(opts?: { where?: WhereClause }): number;
}

function createTable<T extends AnyRecord>(): Table<T> {
  return {
    data: [] as T[],
    findMany(opts?: { where?: WhereClause; orderBy?: OrderBy; take?: number; skip?: number }) {
      let result = this.data;
      if (opts?.where) result = result.filter((item) => matchesWhere(item, opts.where!));
      if (opts?.orderBy) {
        let orderEntries: Array<[string, string]>;
        if (Array.isArray(opts.orderBy)) {
          orderEntries = opts.orderBy.flatMap((o) => Object.entries(o));
        } else {
          orderEntries = Object.entries(opts.orderBy);
        }
        for (const [key, dir] of orderEntries) {
          result = [...result].sort((a, b) => {
            const va = a[key], vb = b[key];
            if (va instanceof Date && vb instanceof Date) return dir === 'asc' ? va.getTime() - vb.getTime() : vb.getTime() - va.getTime();
            if (typeof va === 'string' && typeof vb === 'string') return dir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
            if (typeof va === 'number' && typeof vb === 'number') return dir === 'asc' ? va - vb : vb - va;
            return 0;
          });
        }
      }
      if (opts?.skip) result = result.slice(opts.skip);
      if (opts?.take) result = result.slice(0, opts.take);
      return result;
    },
    findUnique(opts: { where: { id: string } | { key: string } }) {
      const w = opts.where as Record<string, string>;
      if ('id' in w) {
        return this.data.find((item) => item.id === w.id) ?? null;
      } else if ('key' in w) {
        return this.data.find((item) => (item as AnyRecord).key === w.key) ?? null;
      }
      return null;
    },
    findFirst(opts?: { where?: WhereClause; orderBy?: OrderBy }) {
      let result = this.data;
      if (opts?.where) result = result.filter((item) => matchesWhere(item, opts.where!));
      if (opts?.orderBy) {
        let orderEntries: Array<[string, string]>;
        if (Array.isArray(opts.orderBy)) {
          orderEntries = opts.orderBy.flatMap((o) => Object.entries(o));
        } else {
          orderEntries = Object.entries(opts.orderBy);
        }
        for (const [key, dir] of orderEntries) {
          result = [...result].sort((a, b) => {
            const va = a[key], vb = b[key];
            if (va instanceof Date && vb instanceof Date) return dir === 'asc' ? va.getTime() - vb.getTime() : vb.getTime() - va.getTime();
            return 0;
          });
        }
      }
      return result[0] ?? null;
    },
    create(opts: { data: Partial<T> }) {
      const now = new Date();
      const item = {
        id: cuid(),
        createdAt: now,
        updatedAt: now,
        ...opts.data,
      } as unknown as T;
      this.data.push(item);
      return item;
    },
    update(opts: { where: { id?: string; key?: string }; data: Partial<T> }) {
      let idx = -1;
      if (opts.where.id) {
        idx = this.data.findIndex((item) => item.id === opts.where.id);
      } else if (opts.where.key !== undefined) {
        idx = this.data.findIndex((item) => (item as Record<string, unknown>).key === opts.where.key);
      }
      if (idx === -1) throw new Error('Record not found');
      this.data[idx] = { ...this.data[idx], ...opts.data, updatedAt: new Date() };
      return this.data[idx];
    },
    delete(opts: { where: { id: string } }) {
      const idx = this.data.findIndex((item) => item.id === opts.where.id);
      if (idx === -1) throw new Error('Record not found');
      const [removed] = this.data.splice(idx, 1);
      return removed;
    },
    count(opts?: { where?: WhereClause }) {
      if (!opts?.where) return this.data.length;
      return this.data.filter((item) => matchesWhere(item, opts.where!)).length;
    },
  };
}

// --------------- Database ---------------
const patients = createTable<Patient>();
const conversations = createTable<Conversation>();
const messages = createTable<Message>();
const appointments = createTable<Appointment>();
const services = createTable<Service>();
const leads = createTable<Lead>();
const appointmentRequests = createTable<AppointmentRequest>();
const faqs = createTable<FAQ>();
const botSettings = createTable<BotSetting>();
const interactionEvents = createTable<InteractionEvent>();
const unansweredQuestions = createTable<UnansweredQuestion>();
const leadCustomFields = createTable<LeadCustomField>();

// --------------- Seed Data ---------------
function seed() {
  const DEMO_USER = 'demo-user';
  // 12 Patients
  const p1 = patients.create({ data: { name: 'Sarah Mitchell', email: 'sarah.mitchell@email.com', phone: '(555) 234-5678', dob: '1988-03-15', lastVisit: '2025-01-10', status: 'active', userId: DEMO_USER } });
  const p2 = patients.create({ data: { name: 'James Rodriguez', email: 'james.rodriguez@email.com', phone: '(555) 345-6789', dob: '1975-07-22', lastVisit: '2024-11-05', status: 'active', userId: DEMO_USER } });
  const p3 = patients.create({ data: { name: 'Emily Chen', email: 'emily.chen@email.com', phone: '(555) 456-7890', dob: '1992-11-08', lastVisit: '2025-02-18', status: 'active', userId: DEMO_USER } });
  const p4 = patients.create({ data: { name: 'Michael Thompson', email: 'michael.thompson@email.com', phone: '(555) 567-8901', dob: '1965-05-30', lastVisit: '2024-09-12', status: 'inactive', userId: DEMO_USER } });
  const p5 = patients.create({ data: { name: 'Olivia Parker', email: 'olivia.parker@email.com', phone: '(555) 678-9012', dob: '1998-01-25', lastVisit: null, status: 'new', userId: DEMO_USER } });
  const p6 = patients.create({ data: { name: 'David Kim', email: 'david.kim@email.com', phone: '(555) 789-0123', dob: '1983-09-14', lastVisit: '2025-01-28', status: 'active', userId: DEMO_USER } });
  const p7 = patients.create({ data: { name: 'Rachel Green', email: 'rachel.green@email.com', phone: '(555) 890-1234', dob: '1990-12-03', lastVisit: '2024-08-20', status: 'inactive', userId: DEMO_USER } });
  const p8 = patients.create({ data: { name: 'Marcus Johnson', email: 'marcus.johnson@email.com', phone: '(555) 901-2345', dob: '1972-04-18', lastVisit: '2025-02-05', status: 'active', userId: DEMO_USER } });
  const p9 = patients.create({ data: { name: 'Sophia Williams', email: 'sophia.williams@email.com', phone: '(555) 012-3456', dob: '1995-06-27', lastVisit: null, status: 'new', userId: DEMO_USER } });
  const p10 = patients.create({ data: { name: 'Robert Davis', email: 'robert.davis@email.com', phone: '(555) 123-4567', dob: '1958-10-09', lastVisit: '2024-12-15', status: 'active', userId: DEMO_USER } });
  const p11 = patients.create({ data: { name: 'Isabella Martinez', email: 'isabella.martinez@email.com', phone: '(555) 234-9876', dob: '2001-02-14', lastVisit: null, status: 'new', userId: DEMO_USER } });
  const p12 = patients.create({ data: { name: 'Thomas Anderson', email: 'thomas.anderson@email.com', phone: '(555) 345-8765', dob: '1980-08-21', lastVisit: '2024-07-30', status: 'inactive', userId: DEMO_USER } });

  // 8 Services
  services.create({ data: { name: 'Dental Cleaning', description: 'Professional teeth cleaning including scaling and polishing to remove plaque and tartar buildup.', duration: '45 min', requiresAppointment: true, preparationInstructions: 'No special preparation needed. Avoid eating heavy meals before the appointment.', price: '$80', department: 'dental', isActive: true } });
  services.create({ data: { name: 'Root Canal Treatment', description: 'Endodontic treatment to remove infected pulp, clean the root canal, and seal the tooth to save it from extraction.', duration: '60-90 min', requiresAppointment: true, preparationInstructions: 'Take prescribed pain medication before the appointment if advised. Avoid chewing on the affected side.', price: '$500-$800', department: 'dental', isActive: true } });
  services.create({ data: { name: 'Braces & Orthodontics', description: 'Traditional braces and clear aligner therapy for teeth alignment, bite correction, and smile improvement.', duration: 'Varies', requiresAppointment: true, preparationInstructions: 'Initial consultation required. Bring any previous dental X-rays if available.', price: '$3000-$6000', department: 'dental', isActive: true } });
  services.create({ data: { name: 'Teeth Whitening', description: 'Professional in-office teeth whitening using advanced LED technology for a brighter, more confident smile.', duration: '60 min', requiresAppointment: true, preparationInstructions: 'Avoid coffee, tea, and dark foods for 24 hours before treatment. Brush teeth before the appointment.', price: '$250-$400', department: 'dental', isActive: true } });
  services.create({ data: { name: 'Dental Implants', description: 'Permanent tooth replacement using titanium implants surgically placed in the jawbone with natural-looking crowns.', duration: '60-90 min', requiresAppointment: true, preparationInstructions: 'Consultation and X-rays required. Inform doctor of any medications. Arrange for someone to drive you home.', price: '$1500-$3000', department: 'dental', isActive: true } });
  services.create({ data: { name: 'General Consultation', description: 'Comprehensive dental examination including oral health assessment, X-rays review, and personalized treatment plan.', duration: '30 min', requiresAppointment: false, preparationInstructions: 'Bring your insurance card and any previous dental records. Arrive 10 minutes early for paperwork.', price: '$50', department: 'general', isActive: true } });
  services.create({ data: { name: 'Skin Treatment', description: 'Cosmetic skin treatments including facial rejuvenation, acne scar treatment, and skin wellness consultations.', duration: '45 min', requiresAppointment: true, preparationInstructions: 'Avoid sun exposure and retinol products for 48 hours before treatment. Come with a clean face.', price: '$150-$300', department: 'cosmetic', isActive: true } });
  services.create({ data: { name: 'Physiotherapy', description: 'Rehabilitation and pain management for jaw disorders (TMJ), post-surgical recovery, and musculoskeletal issues.', duration: '45 min', requiresAppointment: true, preparationInstructions: 'Wear comfortable clothing. Bring any referral letters or imaging results.', price: '$100-$200', department: 'physiotherapy', isActive: true } });

  // 5 Leads
  leads.create({ data: { name: 'Amanda Foster', phone: '(555) 411-5001', question: 'I have a chipped front tooth. Can you fix it and how much would it cost?', service: 'Cosmetic repair consultation', preferredDate: daysFromNow(2), preferredTime: '10:00', message: 'Would prefer morning if possible.', internalNote: null, preferredContact: 'phone', status: 'new', source: 'chatbot', userId: DEMO_USER } });
  leads.create({ data: { name: 'Kevin Brooks', phone: '(555) 411-5002', question: 'Do you offer payment plans for dental implants? I need two implants.', service: 'Dental implants', preferredDate: daysFromNow(3), preferredTime: '14:00', message: 'Needs financing details.', internalNote: 'Potential high-value treatment.', preferredContact: 'whatsapp', status: 'contacted', source: 'chatbot', userId: DEMO_USER } });
  leads.create({ data: { name: 'Priya Sharma', phone: '(555) 411-5003', question: 'My son needs braces. What is the minimum age for orthodontic treatment?', service: 'Orthodontic consultation', preferredDate: daysFromNow(5), preferredTime: '18:00', message: 'Asking for child consultation.', internalNote: null, preferredContact: 'phone', status: 'booked', source: 'web', userId: DEMO_USER } });
  leads.create({ data: { name: 'Carlos Mendez', phone: '(555) 411-5004', question: 'I am looking for a dentist who accepts my insurance plan. Do you take Delta Dental?', service: 'Insurance verification', preferredDate: null, preferredTime: null, message: 'Wants confirmation before booking.', internalNote: null, preferredContact: 'phone', status: 'new', source: 'chatbot', userId: DEMO_USER } });
  leads.create({ data: { name: 'Linda Nguyen', phone: '(555) 411-5005', question: 'I had a tooth extracted last month at another clinic and want a second opinion on the healing.', service: 'Second opinion consultation', preferredDate: daysFromNow(1), preferredTime: '16:00', message: 'Patient wants callback first.', internalNote: null, preferredContact: 'whatsapp', status: 'contacted', source: 'chatbot', userId: DEMO_USER } });

  // 5 Appointment Requests
  appointmentRequests.create({ data: { name: 'Amanda Foster', phone: '(555) 411-5001', preferredDate: daysFromNow(2), preferredTime: '10:00', reason: 'Chipped front tooth - cosmetic repair consultation', preferredDoctor: 'Dr. James Wilson', status: 'pending', source: 'chatbot', userId: DEMO_USER } });
  appointmentRequests.create({ data: { name: 'Kevin Brooks', phone: '(555) 411-5002', preferredDate: daysFromNow(3), preferredTime: '14:00', reason: 'Dental implant consultation - needs two implants', preferredDoctor: null, status: 'pending', source: 'chatbot', userId: DEMO_USER } });
  appointmentRequests.create({ data: { name: 'Priya Sharma', phone: '(555) 411-5003', preferredDate: daysFromNow(5), preferredTime: '11:30', reason: 'Orthodontic consultation for son', preferredDoctor: 'Dr. Lisa Park', status: 'confirmed', source: 'web', userId: DEMO_USER } });
  appointmentRequests.create({ data: { name: 'Tom Richards', phone: '(555) 411-5006', preferredDate: daysFromNow(1), preferredTime: '09:00', reason: 'Regular dental cleaning', preferredDoctor: 'Dr. Sarah Ahmed', status: 'confirmed', source: 'chatbot', userId: DEMO_USER } });
  appointmentRequests.create({ data: { name: 'Helen Park', phone: '(555) 411-5007', preferredDate: daysFromNow(-2), preferredTime: '15:00', reason: 'Toothache - emergency consultation', preferredDoctor: null, status: 'cancelled', source: 'chatbot', userId: DEMO_USER } });

  // 8 FAQs
  faqs.create({ data: { question: 'Are you open today?', answer: 'We are open Monday to Friday from 8am to 6pm, and Saturday from 9am to 2pm. We are closed on Sundays. For emergencies, call our emergency line at (555) 100-2001.', order: 1, isActive: true } });
  faqs.create({ data: { question: 'What services do you offer?', answer: 'We offer a wide range of dental services including general checkups, dental cleanings, root canal treatments, braces and orthodontics, teeth whitening, dental implants, and cosmetic dentistry. We also have skin treatment and physiotherapy departments.', order: 2, isActive: true } });
  faqs.create({ data: { question: 'Do you accept walk-ins?', answer: 'We accept walk-ins for general consultations, but we recommend booking an appointment for specific treatments to ensure availability and minimize wait times. You can book through our chatbot, by phone, or on WhatsApp.', order: 3, isActive: true } });
  faqs.create({ data: { question: 'What is the consultation fee?', answer: 'A general consultation costs $50. This includes a comprehensive oral health assessment and personalized treatment plan. The fee may be partially covered by insurance.', order: 4, isActive: true } });
  faqs.create({ data: { question: 'Do you treat children?', answer: 'Yes, we treat patients of all ages, including children. We recommend scheduling an orthodontic evaluation for children around age 7. Our team is experienced in making young patients feel comfortable.', order: 5, isActive: true } });
  faqs.create({ data: { question: 'Where is your clinic located?', answer: 'Our clinic is located at 123 Dental Street, Health City, HC 560001. We are near City Hospital, on the 2nd floor, opposite the pharmacy. Free parking is available behind the building.', order: 6, isActive: true } });
  faqs.create({ data: { question: 'Do you accept insurance?', answer: 'Yes, we accept most major dental insurance plans. Please bring your insurance card to your appointment and our billing team can verify your coverage. We also offer payment plans and financing options for treatments not covered by insurance.', order: 7, isActive: true } });
  faqs.create({ data: { question: 'How can I book an appointment?', answer: 'You can book an appointment through our website chatbot, by calling (555) 100-2000, or via WhatsApp at +15551002000. For emergencies, call our emergency line at (555) 100-2001.', order: 8, isActive: true } });

  // 22 Conversations
  const convData: Array<{ patientId: string; channel: string; status: string; subject: string | null; lastMessage: string | null; sourcePage?: string | null; helpfulStatus?: 'helpful' | 'not_helpful' | 'unreviewed'; needsImprovement?: boolean; leadCaptured?: boolean; appointmentRequested?: boolean }> = [
    { patientId: p1.id, channel: 'web', status: 'active', subject: 'Tooth pain consultation', lastMessage: 'I have a sharp pain in my lower molar.' },
    { patientId: p1.id, channel: 'phone', status: 'closed', subject: 'Appointment rescheduling', lastMessage: 'Thank you, the new time works perfectly.' },
    { patientId: p2.id, channel: 'whatsapp', status: 'active', subject: 'Root canal inquiry', lastMessage: 'What does the root canal procedure involve?' },
    { patientId: p2.id, channel: 'web', status: 'closed', subject: 'Dental cleaning appointment', lastMessage: 'Confirmed for next Tuesday at 10am.' },
    { patientId: p3.id, channel: 'web', status: 'pending', subject: 'Teeth whitening options', lastMessage: 'What whitening treatments do you offer?' },
    { patientId: p3.id, channel: 'phone', status: 'active', subject: 'Insurance coverage question', lastMessage: 'Does my plan cover cosmetic procedures?' },
    { patientId: p4.id, channel: 'web', status: 'closed', subject: 'Denture fitting inquiry', lastMessage: 'I will call to schedule the fitting.' },
    { patientId: p5.id, channel: 'whatsapp', status: 'active', subject: 'First visit preparation', lastMessage: 'What should I bring to my first appointment?' },
    { patientId: p6.id, channel: 'web', status: 'active', subject: 'Cavity filling appointment', lastMessage: 'How long does a filling usually take?' },
    { patientId: p6.id, channel: 'web', status: 'closed', subject: 'Post-procedure care', lastMessage: 'The sensitivity has gone down, thank you!' },
    { patientId: p7.id, channel: 'phone', status: 'closed', subject: 'Orthodontic consultation', lastMessage: 'I will think about the Invisalign option.' },
    { patientId: p8.id, channel: 'whatsapp', status: 'active', subject: 'Crown replacement query', lastMessage: 'My crown feels loose, should I come in?' },
    { patientId: p8.id, channel: 'web', status: 'pending', subject: 'Payment plan options', lastMessage: 'Do you offer installment payment plans?' },
    { patientId: p9.id, channel: 'web', status: 'active', subject: 'New patient registration', lastMessage: 'I just moved to the area and need a dentist.' },
    { patientId: p10.id, channel: 'phone', status: 'closed', subject: 'Gum disease treatment', lastMessage: 'The deep cleaning went well, thanks.' },
    { patientId: p10.id, channel: 'web', status: 'active', subject: 'Implant consultation', lastMessage: 'Am I a good candidate for dental implants?' },
    { patientId: p11.id, channel: 'whatsapp', status: 'pending', subject: 'Wisdom tooth extraction', lastMessage: 'How much does wisdom tooth removal cost?' },
    { patientId: p11.id, channel: 'web', status: 'active', subject: 'Braces vs Invisalign', lastMessage: 'Which is better for gap closure?' },
    { patientId: p12.id, channel: 'web', status: 'closed', subject: 'Emergency toothache', lastMessage: 'The pain has subsided after the medication.' },
    { patientId: p4.id, channel: 'web', status: 'pending', subject: 'Dental bridge cost', lastMessage: 'Can you give me an estimate for a 3-unit bridge?' },
    { patientId: p7.id, channel: 'whatsapp', status: 'active', subject: 'Night guard fitting', lastMessage: 'I grind my teeth at night, can you help?' },
    { patientId: p2.id, channel: 'web', status: 'active', subject: 'Follow-up after root canal', lastMessage: 'Is some sensitivity normal after a week?' },
  ];

  const convs: Conversation[] = [];
  for (const c of convData) {
    convs.push(conversations.create({
      data: {
        ...c,
        messageCount: 0,
        sourcePage: c.sourcePage || '/',
        helpfulStatus: c.helpfulStatus || 'unreviewed',
        needsImprovement: c.needsImprovement || false,
        leadCaptured: c.leadCaptured || false,
        appointmentRequested: c.appointmentRequested || false,
        userId: DEMO_USER,
      },
    }));
  }

  // 50 Messages
  const msgPairs: Array<{ convIdx: number; role: string; content: string }> = [
    { convIdx: 0, role: 'user', content: 'Hi, I have a sharp pain in my lower molar when I eat something cold.' },
    { convIdx: 0, role: 'assistant', content: "I'm sorry to hear about your pain, Sarah. Sensitivity to cold can indicate a cavity or nerve issue. I'd recommend scheduling an examination as soon as possible. Would you like me to help you book an appointment?" },
    { convIdx: 1, role: 'user', content: 'I need to reschedule my appointment on Friday.' },
    { convIdx: 1, role: 'assistant', content: "Of course! I'd be happy to help you reschedule. What day and time would work better for you?" },
    { convIdx: 1, role: 'user', content: 'How about next Monday at 2pm?' },
    { convIdx: 1, role: 'assistant', content: "Monday at 2pm is available. I've updated your appointment. Is there anything else I can help you with?" },
    { convIdx: 2, role: 'user', content: 'My dentist mentioned I might need a root canal. What does the procedure involve?' },
    { convIdx: 2, role: 'assistant', content: "A root canal treatment involves removing the infected or damaged pulp from inside the tooth, cleaning and disinfecting the area, then filling and sealing it. The procedure is typically done under local anesthesia, so you shouldn't feel pain during it. It usually takes 1-2 visits. Would you like to schedule a consultation with our endodontist?" },
    { convIdx: 3, role: 'user', content: "I'd like to book a dental cleaning." },
    { convIdx: 3, role: 'assistant', content: 'Great choice! Regular cleanings are essential for maintaining oral health. We have availability next Tuesday at 10am or Thursday at 3pm. Which works better for you?' },
    { convIdx: 3, role: 'user', content: 'Tuesday at 10am please.' },
    { convIdx: 3, role: 'assistant', content: 'Confirmed! Your dental cleaning is scheduled for next Tuesday at 10am. Please arrive 10 minutes early to complete any paperwork. See you then!' },
    { convIdx: 4, role: 'user', content: "I'm interested in teeth whitening. What options do you offer?" },
    { convIdx: 4, role: 'assistant', content: 'We offer two main whitening options: in-office professional whitening using Zoom technology, which takes about an hour and can lighten teeth up to 8 shades, and custom take-home trays with professional-grade whitening gel.' },
    { convIdx: 5, role: 'user', content: 'Does my insurance plan cover cosmetic procedures?' },
    { convIdx: 5, role: 'assistant', content: "Most dental insurance plans don't cover purely cosmetic procedures like whitening or veneers. However, some procedures that have both cosmetic and functional benefits, like crowns or bonding, may be partially covered." },
    { convIdx: 6, role: 'user', content: 'I need to get dentures. How does the process work?' },
    { convIdx: 6, role: 'assistant', content: 'The denture process typically involves several appointments: first, we take impressions and measurements, then we create a wax model for you to try, and finally we fabricate and fit the final dentures.' },
    { convIdx: 7, role: 'user', content: 'This will be my first visit. What should I bring?' },
    { convIdx: 7, role: 'assistant', content: 'Welcome to BrightSmile Dental! For your first visit, please bring: a valid photo ID, your insurance card, any previous dental records or X-rays if available, and a list of current medications.' },
    { convIdx: 8, role: 'user', content: 'How long does a cavity filling usually take?' },
    { convIdx: 8, role: 'assistant', content: "A standard cavity filling typically takes about 30-60 minutes depending on the size and location of the cavity." },
    { convIdx: 9, role: 'user', content: 'I had a filling done yesterday and it still feels sensitive. Is that normal?' },
    { convIdx: 9, role: 'assistant', content: 'Yes, some sensitivity after a filling is completely normal and can last for a few days to a couple of weeks.' },
    { convIdx: 9, role: 'user', content: 'The sensitivity has gone down, thank you!' },
    { convIdx: 9, role: 'assistant', content: "That's great to hear! If you experience any further issues, don't hesitate to reach out." },
    { convIdx: 10, role: 'user', content: "I'm considering Invisalign. How does it compare to traditional braces?" },
    { convIdx: 10, role: 'assistant', content: "Invisalign uses clear, removable aligners that are virtually invisible. Compared to traditional braces: they're more aesthetically pleasing, you can remove them to eat and clean, and they typically require fewer office visits." },
    { convIdx: 11, role: 'user', content: 'My crown feels loose. Should I come in?' },
    { convIdx: 11, role: 'assistant', content: "Yes, a loose crown should be addressed promptly. If it comes off completely, keep it safe and avoid chewing on that side." },
    { convIdx: 12, role: 'user', content: 'Do you offer payment plans for expensive procedures?' },
    { convIdx: 12, role: 'assistant', content: 'Yes, we do offer payment options! We accept CareCredit financing which allows you to pay over time with promotional no-interest periods.' },
    { convIdx: 13, role: 'user', content: "Hi, I just moved to the area and I'm looking for a new dentist." },
    { convIdx: 13, role: 'assistant', content: "Welcome to the neighborhood! We'd love to be your dental home. At BrightSmile Dental, we offer comprehensive dental care." },
    { convIdx: 14, role: 'user', content: 'My gums have been bleeding when I brush. What should I do?' },
    { convIdx: 14, role: 'assistant', content: "Bleeding gums are often a sign of gingivitis or gum disease. It's important not to ignore this symptom." },
    { convIdx: 15, role: 'user', content: 'Am I a good candidate for dental implants?' },
    { convIdx: 15, role: 'assistant', content: 'Good candidates for dental implants generally have healthy gums, adequate bone density to support the implant, and good overall health.' },
    { convIdx: 16, role: 'user', content: 'How much does wisdom tooth removal cost?' },
    { convIdx: 16, role: 'assistant', content: 'The cost of wisdom tooth extraction varies based on complexity: a simple extraction ranges from $200-$400 per tooth, while impacted wisdom teeth requiring surgical removal can range from $400-$800 per tooth.' },
    { convIdx: 17, role: 'user', content: 'Which is better for closing gaps: braces or Invisalign?' },
    { convIdx: 17, role: 'assistant', content: 'Both traditional braces and Invisalign can effectively close gaps. Traditional braces may be slightly more efficient for larger gaps or complex spacing issues.' },
    { convIdx: 18, role: 'user', content: 'I have a terrible toothache that started suddenly. This is an emergency!' },
    { convIdx: 18, role: 'assistant', content: "I'm sorry you're in pain! A sudden severe toothache can indicate an infection or abscess, which needs prompt attention." },
    { convIdx: 19, role: 'user', content: 'Can you give me an estimate for a 3-unit dental bridge?' },
    { convIdx: 19, role: 'assistant', content: 'A 3-unit dental bridge typically costs between $2,000-$5,000 depending on the materials used.' },
    { convIdx: 20, role: 'user', content: 'I grind my teeth at night. Can you help?' },
    { convIdx: 20, role: 'assistant', content: 'Absolutely! Teeth grinding (bruxism) is very common and can cause tooth wear, jaw pain, and headaches. We can create a custom-fit night guard.' },
    { convIdx: 21, role: 'user', content: 'I had a root canal a week ago and the tooth still feels a bit sensitive. Is that normal?' },
    { convIdx: 21, role: 'assistant', content: "It's normal to experience some sensitivity for 1-2 weeks after a root canal, especially when chewing or applying pressure." },
  ];

  for (const m of msgPairs) {
    messages.create({ data: { conversationId: convs[m.convIdx].id, role: m.role, content: m.content, metadata: null } });
  }

  // Update message counts
  for (const conv of convs) {
    const cnt = messages.count({ where: { conversationId: conv.id } });
    conversations.update({ where: { id: conv.id }, data: { messageCount: cnt } });
  }

  // 16 Appointments
  appointments.create({ data: { patientId: p1.id, date: todayISO(), time: '09:00', duration: 30, type: 'checkup', status: 'scheduled', notes: 'Follow-up on tooth pain complaint', userId: DEMO_USER } });
  appointments.create({ data: { patientId: p2.id, date: todayISO(), time: '10:30', duration: 60, type: 'root-canal', status: 'scheduled', notes: 'Root canal treatment - lower molar', userId: DEMO_USER } });
  appointments.create({ data: { patientId: p3.id, date: todayISO(), time: '14:00', duration: 30, type: 'consultation', status: 'scheduled', notes: 'Whitening consultation', userId: DEMO_USER } });
  appointments.create({ data: { patientId: p6.id, date: todayISO(), time: '15:30', duration: 45, type: 'extraction', status: 'scheduled', notes: 'Cavity filling - upper premolar', userId: DEMO_USER } });
  appointments.create({ data: { patientId: p8.id, date: todayISO(), time: '16:30', duration: 30, type: 'checkup', status: 'completed', notes: 'Crown assessment completed', userId: DEMO_USER } });
  appointments.create({ data: { patientId: p10.id, date: todayISO(), time: '11:00', duration: 60, type: 'consultation', status: 'completed', notes: 'Implant consultation - good candidate', userId: DEMO_USER } });
  appointments.create({ data: { patientId: p5.id, date: daysFromNow(1), time: '09:30', duration: 30, type: 'checkup', status: 'scheduled', notes: 'New patient initial exam', userId: DEMO_USER } });
  appointments.create({ data: { patientId: p9.id, date: daysFromNow(1), time: '11:00', duration: 30, type: 'checkup', status: 'scheduled', notes: 'New patient registration and exam', userId: DEMO_USER } });
  appointments.create({ data: { patientId: p11.id, date: daysFromNow(1), time: '13:00', duration: 60, type: 'extraction', status: 'scheduled', notes: 'Wisdom tooth evaluation', userId: DEMO_USER } });
  appointments.create({ data: { patientId: p4.id, date: daysFromNow(2), time: '10:00', duration: 45, type: 'cleaning', status: 'scheduled', notes: 'Dental cleaning', userId: DEMO_USER } });
  appointments.create({ data: { patientId: p7.id, date: daysFromNow(2), time: '14:30', duration: 30, type: 'consultation', status: 'scheduled', notes: 'Night guard fitting', userId: DEMO_USER } });
  appointments.create({ data: { patientId: p1.id, date: daysFromNow(-7), time: '09:00', duration: 30, type: 'cleaning', status: 'completed', notes: 'Routine cleaning completed', userId: DEMO_USER } });
  appointments.create({ data: { patientId: p2.id, date: daysFromNow(-5), time: '10:00', duration: 30, type: 'cleaning', status: 'completed', notes: 'Regular cleaning done', userId: DEMO_USER } });
  appointments.create({ data: { patientId: p6.id, date: daysFromNow(-3), time: '14:00', duration: 45, type: 'whitening', status: 'completed', notes: 'Zoom whitening - 6 shades lighter', userId: DEMO_USER } });
  appointments.create({ data: { patientId: p12.id, date: daysFromNow(-2), time: '09:30', duration: 60, type: 'root-canal', status: 'cancelled', notes: 'Patient cancelled due to feeling better', userId: DEMO_USER } });
  appointments.create({ data: { patientId: p10.id, date: daysFromNow(-10), time: '11:00', duration: 45, type: 'extraction', status: 'completed', notes: 'Tooth extraction - healed well', userId: DEMO_USER } });

  // 18 Bot Settings
  botSettings.create({ data: { key: 'clinic_name', value: 'BrightSmile Dental Clinic', category: 'general', description: 'The display name of the dental clinic' } });
  botSettings.create({ data: { key: 'clinic_hours', value: 'Mon-Fri: 8am-6pm, Sat: 9am-2pm', category: 'general', description: 'Operating hours of the clinic' } });
  botSettings.create({ data: { key: 'clinic_phone', value: '(555) 100-2000', category: 'general', description: 'Main clinic phone number' } });
  botSettings.create({ data: { key: 'appointment_buffer', value: '15', category: 'scheduling', description: 'Buffer time in minutes between appointments' } });
  botSettings.create({ data: { key: 'max_advance_booking', value: '90', category: 'scheduling', description: 'Maximum days in advance for booking' } });
  botSettings.create({ data: { key: 'cancellation_policy', value: 'Appointments must be cancelled at least 24 hours in advance to avoid a $50 cancellation fee.', category: 'scheduling', description: 'Cancellation policy text' } });
  botSettings.create({ data: { key: 'greeting_message', value: 'Hello! Welcome to BrightSmile Dental Clinic. How can I assist you today?', category: 'responses', description: 'Default greeting message for new conversations' } });
  botSettings.create({ data: { key: 'closing_message', value: 'Thank you for contacting BrightSmile Dental! If you have any more questions, feel free to reach out. Have a great day!', category: 'responses', description: 'Default closing message for conversations' } });
  botSettings.create({ data: { key: 'emergency_response', value: 'If you are experiencing a dental emergency, please call our emergency line at (555) 100-2001 immediately.', category: 'responses', description: 'Response for dental emergencies' } });
  botSettings.create({ data: { key: 'ai_personality', value: 'friendly_professional', category: 'general', description: 'AI assistant personality style' } });
  botSettings.create({ data: { key: 'clinic_address', value: '123 Dental Street, Health City, HC 560001', category: 'general', description: 'Clinic physical address' } });
  botSettings.create({ data: { key: 'whatsapp_number', value: '+15551002000', category: 'general', description: 'WhatsApp business number for patient communication' } });
  botSettings.create({ data: { key: 'emergency_phone', value: '(555) 100-2001', category: 'general', description: 'Emergency phone line for after-hours dental emergencies' } });
  botSettings.create({ data: { key: 'bot_primary_color', value: '#059669', category: 'appearance', description: 'Primary color for the chatbot widget (emerald-600)' } });
  botSettings.create({ data: { key: 'bot_welcome_message', value: 'Hi, welcome to BrightSmile Dental Clinic. How can I help you today?', category: 'responses', description: 'Welcome message shown when chatbot first opens' } });
  botSettings.create({ data: { key: 'after_hours_message', value: "We're currently closed, but you can leave your details and our staff will contact you when we open.", category: 'responses', description: 'Message shown when patient contacts outside working hours' } });
  botSettings.create({ data: { key: 'parking_info', value: 'Free parking available behind the building. Clinic is near City Hospital, 2nd floor, opposite pharmacy.', category: 'general', description: 'Parking and landmark information for patients' } });
  botSettings.create({ data: { key: 'google_maps_url', value: 'https://maps.google.com/?q=123+Dental+Street+Health+City', category: 'general', description: 'Google Maps link to clinic location' } });

  // Lead Collection Settings
  botSettings.create({ data: { key: 'lead_collection_enabled', value: 'true', category: 'lead-collection', description: 'Master toggle for lead collection' } });
  botSettings.create({ data: { key: 'lead_collect_email', value: 'true', category: 'lead-collection', description: 'Whether to collect email (always true)' } });
  botSettings.create({ data: { key: 'lead_collect_name', value: 'true', category: 'lead-collection', description: 'Whether to collect visitor\'s full name' } });
  botSettings.create({ data: { key: 'lead_collect_phone', value: 'true', category: 'lead-collection', description: 'Whether to collect phone number' } });
  botSettings.create({ data: { key: 'lead_trigger_mode', value: 'interest', category: 'lead-collection', description: 'Trigger mode: interest, unable_to_answer, after_messages' } });
  botSettings.create({ data: { key: 'lead_trigger_message_count', value: '1', category: 'lead-collection', description: 'Number of messages before static form' } });
  botSettings.create({ data: { key: 'lead_trigger_keywords', value: 'pricing, demo, consultation, quote, appointment, contact, schedule, buy, purchase', category: 'lead-collection', description: 'Comma-separated trigger keywords' } });
  botSettings.create({ data: { key: 'lead_notifications_enabled', value: 'true', category: 'lead-collection', description: 'Toggle for sending email notifications on new leads' } });
  botSettings.create({ data: { key: 'lead_notification_emails', value: 'pintexlab@gmail.com', category: 'lead-collection', description: 'Comma-separated email recipients for lead notifications' } });
  botSettings.create({ data: { key: 'lead_auto_escalation', value: 'false', category: 'lead-collection', description: 'Auto-escalate to human agent when lead is captured' } });

  interactionEvents.create({ data: { conversationId: convs[0].id, eventType: 'whatsapp_click', source: 'playground', service: null, metadata: null, userId: DEMO_USER } });
  interactionEvents.create({ data: { conversationId: convs[2].id, eventType: 'appointment_request', source: 'playground', service: 'Root Canal Treatment', metadata: null, userId: DEMO_USER } });
  interactionEvents.create({ data: { conversationId: convs[4].id, eventType: 'location_click', source: 'widget', service: null, metadata: null, userId: DEMO_USER } });
  interactionEvents.create({ data: { conversationId: convs[4].id, eventType: 'directions_click', source: 'widget', service: null, metadata: null, userId: DEMO_USER } });
  interactionEvents.create({ data: { conversationId: convs[8].id, eventType: 'call_click', source: 'playground', service: null, metadata: null, userId: DEMO_USER } });

  unansweredQuestions.create({
    data: {
      conversationId: convs[12].id,
      question: 'Do you offer installment plans for braces?',
      sourcePage: '/pricing',
      status: 'open',
      answer: null,
      userId: DEMO_USER,
    },
  });
  unansweredQuestions.create({
    data: {
      conversationId: convs[17].id,
      question: 'Is scaling painful and how long does recovery take?',
      sourcePage: '/services/scaling',
      status: 'open',
      answer: null,
      userId: DEMO_USER,
    },
  });
}

seed();

// --------------- Export DB (async-compatible) ---------------
export const db = {
  patient: {
    findMany: (opts?: Parameters<Table<Patient>['findMany']>[0]) => Promise.resolve(patients.findMany(opts)),
    findUnique: (opts: Parameters<Table<Patient>['findUnique']>[0]) => Promise.resolve(patients.findUnique(opts)),
    findFirst: (opts?: Parameters<Table<Patient>['findFirst']>[0]) => Promise.resolve(patients.findFirst(opts)),
    create: (opts: Parameters<Table<Patient>['create']>[0]) => Promise.resolve(patients.create(opts)),
    update: (opts: Parameters<Table<Patient>['update']>[0]) => Promise.resolve(patients.update(opts)),
    delete: (opts: Parameters<Table<Patient>['delete']>[0]) => Promise.resolve(patients.delete(opts)),
    count: (opts?: Parameters<Table<Patient>['count']>[0]) => Promise.resolve(patients.count(opts)),
  },
  conversation: {
    findMany: (opts?: Parameters<Table<Conversation>['findMany']>[0]) => Promise.resolve(conversations.findMany(opts)),
    findUnique: (opts: Parameters<Table<Conversation>['findUnique']>[0]) => Promise.resolve(conversations.findUnique(opts)),
    findFirst: (opts?: Parameters<Table<Conversation>['findFirst']>[0]) => Promise.resolve(conversations.findFirst(opts)),
    create: (opts: Parameters<Table<Conversation>['create']>[0]) => Promise.resolve(conversations.create(opts)),
    update: (opts: Parameters<Table<Conversation>['update']>[0]) => Promise.resolve(conversations.update(opts)),
    delete: (opts: Parameters<Table<Conversation>['delete']>[0]) => Promise.resolve(conversations.delete(opts)),
    count: (opts?: Parameters<Table<Conversation>['count']>[0]) => Promise.resolve(conversations.count(opts)),
  },
  message: {
    findMany: (opts?: Parameters<Table<Message>['findMany']>[0]) => Promise.resolve(messages.findMany(opts)),
    findUnique: (opts: Parameters<Table<Message>['findUnique']>[0]) => Promise.resolve(messages.findUnique(opts)),
    findFirst: (opts?: Parameters<Table<Message>['findFirst']>[0]) => Promise.resolve(messages.findFirst(opts)),
    create: (opts: Parameters<Table<Message>['create']>[0]) => Promise.resolve(messages.create(opts)),
    update: (opts: Parameters<Table<Message>['update']>[0]) => Promise.resolve(messages.update(opts)),
    delete: (opts: Parameters<Table<Message>['delete']>[0]) => Promise.resolve(messages.delete(opts)),
    count: (opts?: Parameters<Table<Message>['count']>[0]) => Promise.resolve(messages.count(opts)),
  },
  appointment: {
    findMany: (opts?: Parameters<Table<Appointment>['findMany']>[0]) => Promise.resolve(appointments.findMany(opts)),
    findUnique: (opts: Parameters<Table<Appointment>['findUnique']>[0]) => Promise.resolve(appointments.findUnique(opts)),
    findFirst: (opts?: Parameters<Table<Appointment>['findFirst']>[0]) => Promise.resolve(appointments.findFirst(opts)),
    create: (opts: Parameters<Table<Appointment>['create']>[0]) => Promise.resolve(appointments.create(opts)),
    update: (opts: Parameters<Table<Appointment>['update']>[0]) => Promise.resolve(appointments.update(opts)),
    delete: (opts: Parameters<Table<Appointment>['delete']>[0]) => Promise.resolve(appointments.delete(opts)),
    count: (opts?: Parameters<Table<Appointment>['count']>[0]) => Promise.resolve(appointments.count(opts)),
  },
  service: {
    findMany: (opts?: Parameters<Table<Service>['findMany']>[0]) => Promise.resolve(services.findMany(opts)),
    findUnique: (opts: Parameters<Table<Service>['findUnique']>[0]) => Promise.resolve(services.findUnique(opts)),
    findFirst: (opts?: Parameters<Table<Service>['findFirst']>[0]) => Promise.resolve(services.findFirst(opts)),
    create: (opts: Parameters<Table<Service>['create']>[0]) => Promise.resolve(services.create(opts)),
    update: (opts: Parameters<Table<Service>['update']>[0]) => Promise.resolve(services.update(opts)),
    delete: (opts: Parameters<Table<Service>['delete']>[0]) => Promise.resolve(services.delete(opts)),
    count: (opts?: Parameters<Table<Service>['count']>[0]) => Promise.resolve(services.count(opts)),
  },
  lead: {
    findMany: (opts?: Parameters<Table<Lead>['findMany']>[0]) => Promise.resolve(leads.findMany(opts)),
    findUnique: (opts: Parameters<Table<Lead>['findUnique']>[0]) => Promise.resolve(leads.findUnique(opts)),
    findFirst: (opts?: Parameters<Table<Lead>['findFirst']>[0]) => Promise.resolve(leads.findFirst(opts)),
    create: (opts: Parameters<Table<Lead>['create']>[0]) => Promise.resolve(leads.create(opts)),
    update: (opts: Parameters<Table<Lead>['update']>[0]) => Promise.resolve(leads.update(opts)),
    delete: (opts: Parameters<Table<Lead>['delete']>[0]) => Promise.resolve(leads.delete(opts)),
    count: (opts?: Parameters<Table<Lead>['count']>[0]) => Promise.resolve(leads.count(opts)),
  },
  appointmentRequest: {
    findMany: (opts?: Parameters<Table<AppointmentRequest>['findMany']>[0]) => Promise.resolve(appointmentRequests.findMany(opts)),
    findUnique: (opts: Parameters<Table<AppointmentRequest>['findUnique']>[0]) => Promise.resolve(appointmentRequests.findUnique(opts)),
    findFirst: (opts?: Parameters<Table<AppointmentRequest>['findFirst']>[0]) => Promise.resolve(appointmentRequests.findFirst(opts)),
    create: (opts: Parameters<Table<AppointmentRequest>['create']>[0]) => Promise.resolve(appointmentRequests.create(opts)),
    update: (opts: Parameters<Table<AppointmentRequest>['update']>[0]) => Promise.resolve(appointmentRequests.update(opts)),
    delete: (opts: Parameters<Table<AppointmentRequest>['delete']>[0]) => Promise.resolve(appointmentRequests.delete(opts)),
    count: (opts?: Parameters<Table<AppointmentRequest>['count']>[0]) => Promise.resolve(appointmentRequests.count(opts)),
  },
  fAQ: {
    findMany: (opts?: Parameters<Table<FAQ>['findMany']>[0]) => Promise.resolve(faqs.findMany(opts)),
    findUnique: (opts: Parameters<Table<FAQ>['findUnique']>[0]) => Promise.resolve(faqs.findUnique(opts)),
    findFirst: (opts?: Parameters<Table<FAQ>['findFirst']>[0]) => Promise.resolve(faqs.findFirst(opts)),
    create: (opts: Parameters<Table<FAQ>['create']>[0]) => Promise.resolve(faqs.create(opts)),
    update: (opts: Parameters<Table<FAQ>['update']>[0]) => Promise.resolve(faqs.update(opts)),
    delete: (opts: Parameters<Table<FAQ>['delete']>[0]) => Promise.resolve(faqs.delete(opts)),
    count: (opts?: Parameters<Table<FAQ>['count']>[0]) => Promise.resolve(faqs.count(opts)),
  },
  botSetting: {
    findMany: (opts?: Parameters<Table<BotSetting>['findMany']>[0]) => Promise.resolve(botSettings.findMany(opts)),
    findUnique: (opts: Parameters<Table<BotSetting>['findUnique']>[0]) => Promise.resolve(botSettings.findUnique(opts)),
    findFirst: (opts?: Parameters<Table<BotSetting>['findFirst']>[0]) => Promise.resolve(botSettings.findFirst(opts)),
    create: (opts: Parameters<Table<BotSetting>['create']>[0]) => Promise.resolve(botSettings.create(opts)),
    update: (opts: Parameters<Table<BotSetting>['update']>[0]) => Promise.resolve(botSettings.update(opts)),
    delete: (opts: Parameters<Table<BotSetting>['delete']>[0]) => Promise.resolve(botSettings.delete(opts)),
    count: (opts?: Parameters<Table<BotSetting>['count']>[0]) => Promise.resolve(botSettings.count(opts)),
  },
  interactionEvent: {
    findMany: (opts?: Parameters<Table<InteractionEvent>['findMany']>[0]) => Promise.resolve(interactionEvents.findMany(opts)),
    findUnique: (opts: Parameters<Table<InteractionEvent>['findUnique']>[0]) => Promise.resolve(interactionEvents.findUnique(opts)),
    findFirst: (opts?: Parameters<Table<InteractionEvent>['findFirst']>[0]) => Promise.resolve(interactionEvents.findFirst(opts)),
    create: (opts: Parameters<Table<InteractionEvent>['create']>[0]) => Promise.resolve(interactionEvents.create(opts)),
    update: (opts: Parameters<Table<InteractionEvent>['update']>[0]) => Promise.resolve(interactionEvents.update(opts)),
    delete: (opts: Parameters<Table<InteractionEvent>['delete']>[0]) => Promise.resolve(interactionEvents.delete(opts)),
    count: (opts?: Parameters<Table<InteractionEvent>['count']>[0]) => Promise.resolve(interactionEvents.count(opts)),
  },
  unansweredQuestion: {
    findMany: (opts?: Parameters<Table<UnansweredQuestion>['findMany']>[0]) => Promise.resolve(unansweredQuestions.findMany(opts)),
    findUnique: (opts: Parameters<Table<UnansweredQuestion>['findUnique']>[0]) => Promise.resolve(unansweredQuestions.findUnique(opts)),
    findFirst: (opts?: Parameters<Table<UnansweredQuestion>['findFirst']>[0]) => Promise.resolve(unansweredQuestions.findFirst(opts)),
    create: (opts: Parameters<Table<UnansweredQuestion>['create']>[0]) => Promise.resolve(unansweredQuestions.create(opts)),
    update: (opts: Parameters<Table<UnansweredQuestion>['update']>[0]) => Promise.resolve(unansweredQuestions.update(opts)),
    delete: (opts: Parameters<Table<UnansweredQuestion>['delete']>[0]) => Promise.resolve(unansweredQuestions.delete(opts)),
    count: (opts?: Parameters<Table<UnansweredQuestion>['count']>[0]) => Promise.resolve(unansweredQuestions.count(opts)),
  },
  leadCustomField: {
    findMany: (opts?: Parameters<Table<LeadCustomField>['findMany']>[0]) => Promise.resolve(leadCustomFields.findMany(opts)),
    findUnique: (opts: Parameters<Table<LeadCustomField>['findUnique']>[0]) => Promise.resolve(leadCustomFields.findUnique(opts)),
    findFirst: (opts?: Parameters<Table<LeadCustomField>['findFirst']>[0]) => Promise.resolve(leadCustomFields.findFirst(opts)),
    create: (opts: Parameters<Table<LeadCustomField>['create']>[0]) => Promise.resolve(leadCustomFields.create(opts)),
    update: (opts: Parameters<Table<LeadCustomField>['update']>[0]) => Promise.resolve(leadCustomFields.update(opts)),
    delete: (opts: Parameters<Table<LeadCustomField>['delete']>[0]) => Promise.resolve(leadCustomFields.delete(opts)),
    count: (opts?: Parameters<Table<LeadCustomField>['count']>[0]) => Promise.resolve(leadCustomFields.count(opts)),
  },
};
