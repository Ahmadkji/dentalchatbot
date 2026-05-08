import { db } from '@/lib/db';
import ZAI from 'z-ai-web-dev-sdk';
import { NextRequest, NextResponse } from 'next/server';

const SYSTEM_PROMPT =
  'You are a friendly and professional AI dental assistant for BrightSmile Dental Clinic. Help patients with appointment scheduling, answer questions about dental procedures, provide general dental health advice, and assist with billing inquiries. Always be empathetic and professional. If unsure about medical advice, recommend consulting with a dentist. Keep responses concise and helpful.';

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
        status: 'new',
      },
    });
  }
  return guest;
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
      { role: 'assistant', content: SYSTEM_PROMPT },
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

    return NextResponse.json({
      conversationId: conversation.id,
      messageId: assistantMessage.id,
      response: aiResponse,
    });
  } catch (error) {
    console.error('Error in chat endpoint:', error);
    return NextResponse.json(
      { error: 'Failed to process chat message' },
      { status: 500 }
    );
  }
}
