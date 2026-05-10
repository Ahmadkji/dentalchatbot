import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

const VALID_TYPES = ['text', 'textarea', 'select', 'number', 'email', 'tel'];

export async function GET() {
  try {
    const fields = await db.leadCustomField.findMany({
      orderBy: { order: 'asc' },
    });
    return NextResponse.json({ fields });
  } catch (error) {
    console.error('Error fetching custom fields:', error);
    return NextResponse.json(
      { error: 'Failed to fetch custom fields' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { label, fieldType, required, options, placeholder } = body;

    if (!label || typeof label !== 'string' || !label.trim()) {
      return NextResponse.json(
        { error: 'label is required' },
        { status: 400 }
      );
    }

    const type = VALID_TYPES.includes(fieldType) ? fieldType : 'text';

    const count = await db.leadCustomField.count();
    const order = count + 1;

    const field = await db.leadCustomField.create({
      data: {
        label: label.trim(),
        fieldType: type,
        required: required === true,
        options: options || null,
        placeholder: placeholder || null,
        order,
      },
    });

    return NextResponse.json(field, { status: 201 });
  } catch (error) {
    console.error('Error creating custom field:', error);
    return NextResponse.json(
      { error: 'Failed to create custom field' },
      { status: 500 }
    );
  }
}
