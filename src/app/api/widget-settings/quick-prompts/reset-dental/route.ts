import { clinicData, getDefaultClinic } from '@/lib/clinic-data'
import { NextResponse } from 'next/server'

const dentalPrompts = [
  { label: 'Book Appointment', message: "I'd like to book an appointment", actionType: 'appointment', actionValue: null },
  { label: 'Tooth Pain', message: 'I have tooth pain. What should I do?', actionType: 'message', actionValue: null },
  { label: 'Braces', message: 'Tell me about braces and aligners.', actionType: 'message', actionValue: null },
  { label: 'Root Canal', message: 'Tell me about root canal treatment.', actionType: 'message', actionValue: null },
  { label: 'Teeth Cleaning', message: 'What is included in dental cleaning?', actionType: 'message', actionValue: null },
  { label: 'Clinic Location', message: 'Where is the clinic located?', actionType: 'message', actionValue: null },
  { label: 'WhatsApp Clinic', message: 'How can I contact you on WhatsApp?', actionType: 'link', actionValue: 'https://wa.me/15551002000' },
  { label: 'Consultation Fee', message: 'What is the consultation fee?', actionType: 'message', actionValue: null },
]

export async function POST() {
  try {
    const clinic = await getDefaultClinic()
    if (!clinic) {
      return NextResponse.json({ error: 'Clinic not found' }, { status: 404 })
    }

    const existing = await clinicData.quickPrompt.findMany({ where: { clinicId: clinic.id } })
    await Promise.all(existing.map((prompt) => clinicData.quickPrompt.delete({ where: { id: prompt.id } })))

    const created = await Promise.all(
      dentalPrompts.map((prompt, index) =>
        clinicData.quickPrompt.create({
          data: {
            clinicId: clinic.id,
            label: prompt.label,
            message: prompt.message,
            actionType: prompt.actionType as 'message' | 'appointment' | 'link',
            actionValue: prompt.actionValue,
            sortOrder: index + 1,
            isActive: true,
          },
        })
      )
    )

    return NextResponse.json(created)
  } catch (error) {
    console.error('Error resetting dental prompts:', error)
    return NextResponse.json({ error: 'Failed to reset prompts' }, { status: 500 })
  }
}
