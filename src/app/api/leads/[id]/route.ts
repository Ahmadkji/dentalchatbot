import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireOwnership } from '@/lib/auth-helpers';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error: authError } = await requireAuth();
  if (authError) return authError;

  try {
    const { id } = await params;
    const body = await request.json();
    const { status, name, phone, question, preferredContact, service, preferredDate, preferredTime, message, internalNote } = body;

    const existing = await db.lead.findUnique({ where: { id } });

    const ownershipError = requireOwnership(existing, user.id);
    if (ownershipError) return ownershipError;

    const data: Record<string, unknown> = {};
    if (status !== undefined) data.status = status;
    if (name !== undefined) data.name = name;
    if (phone !== undefined) data.phone = phone;
    if (question !== undefined) data.question = question;
    if (preferredContact !== undefined) data.preferredContact = preferredContact;
    if (service !== undefined) data.service = service;
    if (preferredDate !== undefined) data.preferredDate = preferredDate;
    if (preferredTime !== undefined) data.preferredTime = preferredTime;
    if (message !== undefined) data.message = message;
    if (internalNote !== undefined) data.internalNote = internalNote;

    const lead = await db.lead.update({
      where: { id },
      data,
    });

    return NextResponse.json(lead);
  } catch (error) {
    console.error('Error updating lead:', error);
    return NextResponse.json(
      { error: 'Failed to update lead' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error: authError } = await requireAuth();
  if (authError) return authError;

  try {
    const { id } = await params;

    const existing = await db.lead.findUnique({ where: { id } });

    const ownershipError = requireOwnership(existing, user.id);
    if (ownershipError) return ownershipError;

    await db.lead.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting lead:', error);
    return NextResponse.json(
      { error: 'Failed to delete lead' },
      { status: 500 }
    );
  }
}
