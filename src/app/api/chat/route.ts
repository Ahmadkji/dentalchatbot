import { db } from '@/lib/db';
import ZAI from 'z-ai-web-dev-sdk';
import { NextRequest, NextResponse } from 'next/server';

// Ensure a guest patient exists for chat sessions
async function getOrCreateGuestPatient() {
  let guest = await db.patient.findFirst({
    where: { email: 'guest@dentbot.ai' },
  });
  if (!guest) {
    guest = await db.patient.create({
      data: {
        name: 'Guest Patient',
        email: 'guest@dentbot.ai',
        phone: '',
        dob: '',
        status: 'active',
      },
    });
  }
  return guest;
}

// Build dynamic system prompt from database data
async function buildSystemPrompt() {
  // 1. Load all settings from DB
  const settings = await db.botSetting.findMany();
  const settingsMap = Object.fromEntries(settings.map(s => [s.key, s.value]));

  // 2. Load active FAQs
  const faqs = await db.fAQ.findMany({ where: { isActive: true }, orderBy: { order: 'asc' } });

  // 3. Load active services
  const services = await db.service.findMany({ where: { isActive: true } });

  // 4. Load active doctors
  const doctors = await db.doctor.findMany({ where: { isActive: true } });

  // 5. Build dynamic system prompt
  const systemPrompt = `You are the AI assistant for ${settingsMap.clinic_name || 'BrightSmile Dental Clinic'}.

CLINIC INFORMATION:
- Name: ${settingsMap.clinic_name || 'BrightSmile Dental Clinic'}
- Address: ${settingsMap.clinic_address || '123 Dental Street, Health City'}
- Phone: ${settingsMap.clinic_phone || '(555) 100-2000'}
- WhatsApp: ${settingsMap.whatsapp_number || ''}
- Working Hours: ${settingsMap.clinic_hours || 'Mon-Fri 8am-6pm, Sat 9am-2pm'}
- Emergency Line: ${settingsMap.emergency_phone || '(555) 100-2001'}

CURRENT TIME: ${new Date().toISOString()}
CURRENT DAY: ${new Date().toLocaleDateString('en-US', { weekday: 'long' })}

AFTER-HOURS DETECTION:
If the current time is outside working hours, begin your response by saying: "We're currently closed, but I can still help! Our hours are ${settingsMap.clinic_hours || 'Mon-Fri 8am-6pm, Sat 9am-2pm'}. You can leave your details and our staff will contact you when we open."

SERVICES OFFERED:
${services.map(s => `- ${s.name} (${s.department}): ${s.description}. Duration: ${s.duration}. ${s.requiresAppointment ? 'Appointment required.' : 'Walk-ins welcome.'} ${s.preparationInstructions ? 'Preparation: ' + s.preparationInstructions : ''} ${s.price ? 'Starting from: ' + s.price : ''}`).join('\n')}

OUR DOCTORS:
${doctors.map(d => `- Dr. ${d.name}: ${d.specialization}. Available: ${d.availableDays}`).join('\n')}

FREQUENTLY ASKED QUESTIONS:
${faqs.map(f => `Q: ${f.question}\nA: ${f.answer}`).join('\n\n')}

IMPORTANT RULES:
1. NEVER diagnose medical conditions. If a patient describes symptoms, guide them to the right department/service and suggest they consult a doctor. Use wording like: "I can't diagnose, but I can help you choose the right service or contact the clinic."
2. For appointment requests, collect: name, phone number, preferred date, preferred time, and reason for visit. You can also ask if they have a preferred doctor.
3. When you cannot confidently answer, say: "I'm not fully sure about that. I recommend contacting the clinic directly." Then suggest calling or WhatsApp.
4. If someone asks about location, provide the address and mention nearby landmarks.
5. If someone asks about WhatsApp, say they can continue the conversation on WhatsApp.
6. For emergency dental issues, always provide the emergency phone number and recommend immediate professional care.
7. Be warm, professional, and empathetic. Match the tone: ${settingsMap.ai_personality || 'friendly_professional'}.
8. When collecting information (appointments, leads), ask one piece of info at a time naturally in conversation.
9. If the patient seems to want human help, encourage them to call or use WhatsApp.
10. Always mention preparation instructions when discussing specific services.`;

  return { systemPrompt, settingsMap };
}

// Check if current time is after hours
function isAfterHours(settingsMap: Record<string, string>): boolean {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun, 6=Sat
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTimeInMinutes = currentHour * 60 + currentMinute;

  const hoursStr = settingsMap.clinic_hours || 'Mon-Fri 8am-6pm, Sat 9am-2pm';

  // Parse working hours
  // Sunday (0) - closed
  if (dayOfWeek === 0) return true;

  // Saturday (6) - check Saturday hours
  if (dayOfWeek === 6) {
    const satMatch = hoursStr.match(/Sat[^,]*?(\d+)(?::(\d+))?\s*(am|pm)\s*-\s*(\d+)(?::(\d+))?\s*(am|pm)/i);
    if (satMatch) {
      const closeHour = parseInt(satMatch[4]);
      const closeMin = satMatch[5] ? parseInt(satMatch[5]) : 0;
      const closePeriod = satMatch[6].toLowerCase();
      let closeTime = closeHour * 60 + closeMin;
      if (closePeriod === 'pm' && closeHour !== 12) closeTime += 12 * 60;
      return currentTimeInMinutes > closeTime;
    }
    return true; // If can't parse, assume closed on Saturday
  }

  // Weekdays (1-5) - check weekday hours
  const weekdayMatch = hoursStr.match(/Mon-Fri[^,]*?(\d+)(?::(\d+))?\s*(am|pm)\s*-\s*(\d+)(?::(\d+))?\s*(am|pm)/i);
  if (weekdayMatch) {
    const openHour = parseInt(weekdayMatch[1]);
    const openMin = weekdayMatch[2] ? parseInt(weekdayMatch[2]) : 0;
    const openPeriod = weekdayMatch[3].toLowerCase();
    const closeHour = parseInt(weekdayMatch[4]);
    const closeMin = weekdayMatch[5] ? parseInt(weekdayMatch[5]) : 0;
    const closePeriod = weekdayMatch[6].toLowerCase();

    let openTime = openHour * 60 + openMin;
    if (openPeriod === 'pm' && openHour !== 12) openTime += 12 * 60;
    if (openPeriod === 'am' && openHour === 12) openTime = openMin;

    let closeTime = closeHour * 60 + closeMin;
    if (closePeriod === 'pm' && closeHour !== 12) closeTime += 12 * 60;
    if (closePeriod === 'am' && closeHour === 12) closeTime = closeMin;

    return currentTimeInMinutes < openTime || currentTimeInMinutes > closeTime;
  }

  return false; // Default to not after hours if can't parse
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, conversationId, patientId } = body;

    if (!message) {
      return NextResponse.json(
        { error: 'message is required' },
        { status: 400 }
      );
    }

    // Build dynamic system prompt from DB
    const { systemPrompt, settingsMap } = await buildSystemPrompt();

    let conversation;

    if (conversationId) {
      // Load existing conversation
      conversation = await db.conversation.findUnique({
        where: { id: conversationId },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      if (!conversation) {
        return NextResponse.json(
          { error: 'Conversation not found' },
          { status: 404 }
        );
      }
    } else {
      // Create a new conversation - use provided patientId or create guest
      let resolvedPatientId = patientId;
      if (!resolvedPatientId) {
        const guest = await getOrCreateGuestPatient();
        resolvedPatientId = guest.id;
      }

      conversation = await db.conversation.create({
        data: {
          patientId: resolvedPatientId,
          channel: 'web',
          status: 'active',
          subject: message.slice(0, 100),
        },
        include: {
          messages: true,
        },
      });
    }

    // Save user message
    const userMessage = await db.message.create({
      data: {
        conversationId: conversation.id,
        role: 'user',
        content: message,
      },
    });

    // Build messages array for LLM
    const llmMessages: Array<{ role: string; content: string }> = [
      { role: 'system', content: systemPrompt },
    ];

    // Add conversation history
    const historyMessages = conversation.messages
      .filter((m) => m.id !== userMessage.id)
      .map((m) => ({
        role: m.role as string,
        content: m.content,
      }));

    llmMessages.push(...historyMessages);

    // Add current user message
    llmMessages.push({ role: 'user', content: message });

    // Call LLM
    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: llmMessages,
      thinking: { type: 'disabled' },
    });

    const aiResponse = completion.choices[0]?.message?.content || 'I apologize, I was unable to generate a response. Please try again.';

    // Save assistant message
    const assistantMessage = await db.message.create({
      data: {
        conversationId: conversation.id,
        role: 'assistant',
        content: aiResponse,
      },
    });

    // Update conversation metadata
    const messageCount = await db.message.count({
      where: { conversationId: conversation.id },
    });

    await db.conversation.update({
      where: { id: conversation.id },
      data: {
        messageCount,
        lastMessage: aiResponse.slice(0, 200),
      },
    });

    // Detect after hours
    const afterHours = isAfterHours(settingsMap);

    // Build clinic settings for frontend
    const clinicSettings = {
      clinic_name: settingsMap.clinic_name || 'BrightSmile Dental Clinic',
      clinic_address: settingsMap.clinic_address || '123 Dental Street, Health City',
      clinic_phone: settingsMap.clinic_phone || '(555) 100-2000',
      whatsapp_number: settingsMap.whatsapp_number || '',
      clinic_hours: settingsMap.clinic_hours || 'Mon-Fri 8am-6pm, Sat 9am-2pm',
      emergency_phone: settingsMap.emergency_phone || '(555) 100-2001',
      bot_primary_color: settingsMap.bot_primary_color || '#059669',
      welcome_message: settingsMap.bot_welcome_message || settingsMap.greeting_message || 'Hi, welcome to BrightSmile Dental Clinic. How can I help you today?',
    };

    return NextResponse.json({
      conversationId: conversation.id,
      messageId: assistantMessage.id,
      response: aiResponse,
      isAfterHours: afterHours,
      clinicSettings,
    });
  } catch (error) {
    console.error('Error in chat endpoint:', error);
    return NextResponse.json(
      { error: 'Failed to process chat message' },
      { status: 500 }
    );
  }
}
