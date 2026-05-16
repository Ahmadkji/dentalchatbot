import { describe, expect, it } from 'vitest'
import { detectClinicImportFields } from '@/lib/clinic-imports'

describe('clinic import detection', () => {
  it('extracts the main clinic profile fields from imported website text', () => {
    const content = `
      Smile Dental Clinic
      Phone: +92 300 1234567
      WhatsApp: +92 300 1234567
      Address: 12 Main Boulevard, Lahore 54000
      Hours: Mon-Fri 9am-6pm
      Consultation fee starts from Rs. 3,000
      Emergency? Call us immediately for urgent dental pain or swelling.
    `

    const fields = detectClinicImportFields(content)
    const byType = new Map(fields.map((field) => [field.fieldType, field]))

    expect(byType.get('name')?.value).toContain('Smile Dental Clinic')
    expect(byType.get('phone')?.value).toContain('+92 300 1234567')
    expect(byType.get('whatsapp')?.value).toContain('+92 300 1234567')
    expect(byType.get('address')?.value).toContain('Main Boulevard')
    expect(byType.get('opening_hours')?.value).toContain('Mon-Fri')
    expect(byType.get('pricing_notes')?.value).toContain('Rs. 3,000')
    expect(byType.get('emergency_instructions')?.value.toLowerCase()).toContain('emergency')
  })

  it('prefers a clinic-like heading over nearby contact labels when detecting the name', () => {
    const content = `
      Contact our clinic
      Prime Dental Care
      Phone: +1 555 123 4567
      Address: 44 King Street, London
    `

    const fields = detectClinicImportFields(content)
    const byType = new Map(fields.map((field) => [field.fieldType, field]))

    expect(byType.get('name')?.value).toBe('Prime Dental Care')
  })
})
