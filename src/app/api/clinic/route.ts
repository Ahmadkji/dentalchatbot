import { clinicData, getDefaultClinic } from '@/lib/clinic-data'
import { NextRequest, NextResponse } from 'next/server'

const editableFields = [
  'name',
  'slug',
  'address',
  'city',
  'country',
  'primaryPhone',
  'whatsappNumber',
  'openingHours',
  'appointmentRules',
  'pricingNotes',
  'emergencyInstructions',
  'timezone',
  'isActive',
] as const

export async function GET() {
  try {
    const clinic = await getDefaultClinic()

    if (!clinic) {
      return NextResponse.json({ error: 'Clinic not found' }, { status: 404 })
    }

    return NextResponse.json(clinic)
  } catch (error) {
    console.error('Error fetching clinic profile:', error)
    return NextResponse.json({ error: 'Failed to fetch clinic profile' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const clinic = await getDefaultClinic()
    if (!clinic) {
      return NextResponse.json({ error: 'Clinic not found' }, { status: 404 })
    }

    const body = await request.json()
    const data: Record<string, unknown> = {}

    for (const field of editableFields) {
      if (body[field] !== undefined) {
        data[field] = body[field]
      }
    }

    const updated = await clinicData.clinic.update({
      where: { id: clinic.id },
      data,
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating clinic profile:', error)
    return NextResponse.json({ error: 'Failed to update clinic profile' }, { status: 500 })
  }
}
