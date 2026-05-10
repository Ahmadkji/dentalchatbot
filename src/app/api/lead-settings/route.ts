import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    const allSettings = await db.botSetting.findMany({
      where: { category: 'lead-collection' },
    });

    const settings: Record<string, string> = {};
    for (const s of allSettings) {
      // Strip 'lead_' prefix for cleaner frontend keys
      const key = s.key.startsWith('lead_') ? s.key.slice(5) : s.key;
      settings[key] = s.value;
    }

    return NextResponse.json({ settings });
  } catch (error) {
    console.error('Error fetching lead settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch lead settings' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { settings } = await request.json();

    if (!settings || typeof settings !== 'object') {
      return NextResponse.json(
        { error: 'settings object is required' },
        { status: 400 }
      );
    }

    for (const [key, value] of Object.entries(settings)) {
      const fullKey = `lead_${key}`;
      try {
        await db.botSetting.update({
          where: { key: fullKey },
          data: { value: String(value) },
        });
      } catch {
        // Setting might not exist yet, try to find and skip if not found
        console.warn(`Setting ${fullKey} not found, skipping`);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating lead settings:', error);
    return NextResponse.json(
      { error: 'Failed to update lead settings' },
      { status: 500 }
    );
  }
}
