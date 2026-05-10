import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const data: Record<string, unknown> = {};
    if (body.label !== undefined) data.label = body.label;
    if (body.fieldType !== undefined) data.fieldType = body.fieldType;
    if (body.required !== undefined) data.required = body.required;
    if (body.options !== undefined) data.options = body.options;
    if (body.placeholder !== undefined) data.placeholder = body.placeholder;
    if (body.order !== undefined) data.order = body.order;

    const field = await db.leadCustomField.update({
      where: { id },
      data,
    });

    return NextResponse.json(field);
  } catch (error) {
    console.error('Error updating custom field:', error);
    return NextResponse.json(
      { error: 'Failed to update custom field' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await db.leadCustomField.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting custom field:', error);
    return NextResponse.json(
      { error: 'Failed to delete custom field' },
      { status: 500 }
    );
  }
}
