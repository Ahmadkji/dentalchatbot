import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';

export async function GET(request: NextRequest) {
  const { error: authError } = await requireAuth();
  if (authError) return authError;
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');

    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    const leads = await db.lead.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(leads);
  } catch (error) {
    console.error('Error fetching leads:', error);
    return NextResponse.json(
      { error: 'Failed to fetch leads' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const { user, error: authError } = await requireAuth();
  if (authError) return authError;
  try {
    const body = await request.json();
    const { name, phone, question, preferredContact, source, service, preferredDate, preferredTime, message, internalNote, status } = body;

    if (!name || !phone) {
      return NextResponse.json(
        { error: 'name and phone are required' },
        { status: 400 }
      );
    }

    const lead = await db.lead.create({
      data: {
        name,
        phone,
        question: question || '',
        service: service || null,
        preferredDate: preferredDate || null,
        preferredTime: preferredTime || null,
        message: message || null,
        internalNote: internalNote || null,
        preferredContact: preferredContact || 'phone',
        status: status || 'new',
        source: source || 'chatbot',
      },
    });

    return NextResponse.json(lead, { status: 201 });
  } catch (error) {
    console.error('Error creating lead:', error);
    return NextResponse.json(
      { error: 'Failed to create lead' },
      { status: 500 }
    );
  }
}
