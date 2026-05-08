import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    const settings = await db.botSetting.findMany({
      orderBy: [{ category: 'asc' }, { key: 'asc' }],
    });

    // Group settings by category
    const grouped = settings.reduce(
      (acc, setting) => {
        if (!acc[setting.category]) {
          acc[setting.category] = [];
        }
        acc[setting.category].push(setting);
        return acc;
      },
      {} as Record<string, typeof settings>
    );

    return NextResponse.json({
      settings,
      grouped,
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { key, id, value } = body;

    // Support both key and id for finding the setting
    let settingKey = key;

    if (!settingKey && id) {
      // Try to find by id
      const byId = await db.botSetting.findUnique({
        where: { id: String(id) },
      });
      if (byId) {
        settingKey = byId.key;
      }
    }

    if (!settingKey || value === undefined) {
      return NextResponse.json(
        { error: 'key (or id) and value are required' },
        { status: 400 }
      );
    }

    const existing = await db.botSetting.findUnique({
      where: { key: settingKey },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Setting not found' },
        { status: 404 }
      );
    }

    const setting = await db.botSetting.update({
      where: { key: settingKey },
      data: { value: String(value) },
    });

    return NextResponse.json(setting);
  } catch (error) {
    console.error('Error updating setting:', error);
    return NextResponse.json(
      { error: 'Failed to update setting' },
      { status: 500 }
    );
  }
}
