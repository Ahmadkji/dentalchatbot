'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Stethoscope, User, Building2, Globe, Loader2, ArrowRight, MapPin, Phone, MessageCircle, Link2 } from 'lucide-react'

const timezones = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Toronto',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Karachi',
  'Asia/Kolkata',
  'Asia/Dubai',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Australia/Sydney',
  'Pacific/Auckland',
]

export default function OnboardingPage() {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [clinicName, setClinicName] = useState('')
  const [country, setCountry] = useState('')
  const [city, setCity] = useState('')
  const [timezone, setTimezone] = useState('Asia/Karachi')
  const [phone, setPhone] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/auth/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName,
          clinicName,
          country,
          city,
          timezone,
          phone,
          whatsapp,
          websiteUrl,
        }),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        setError(data.error ?? 'Failed to save profile. Please try again.')
        return
      }

      router.push('/dashboard')
      router.refresh()
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50/60 via-white to-white flex items-center justify-center p-4">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-20 -left-20 w-72 h-72 bg-emerald-100/30 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 -right-20 w-96 h-96 bg-emerald-50/40 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-2xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-200">
              <Stethoscope className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-emerald-600">DentaBot</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Set up your clinic</h1>
          <p className="text-gray-500 mt-2">Create your real workspace and default dental assistant settings.</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 p-6 md:p-8">
          {error && (
            <div className="mb-4 p-3 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="fullName" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <User className="w-4 h-4" />
                Full name
              </Label>
              <Input
                id="fullName"
                type="text"
                placeholder="Dr. Sarah Ahmed"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="h-11 border-gray-200 focus:border-emerald-500 focus:ring-emerald-500/20 rounded-lg"
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="clinicName" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Clinic name
              </Label>
              <Input
                id="clinicName"
                type="text"
                placeholder="Pearl Dental Clinic"
                value={clinicName}
                onChange={(e) => setClinicName(e.target.value)}
                className="h-11 border-gray-200 focus:border-emerald-500 focus:ring-emerald-500/20 rounded-lg"
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="country" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Globe className="w-4 h-4" />
                Country
              </Label>
              <Input
                id="country"
                type="text"
                placeholder="Pakistan"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="h-11 border-gray-200 focus:border-emerald-500 focus:ring-emerald-500/20 rounded-lg"
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="city" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                City
              </Label>
              <Input
                id="city"
                type="text"
                placeholder="Karachi"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="h-11 border-gray-200 focus:border-emerald-500 focus:ring-emerald-500/20 rounded-lg"
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Globe className="w-4 h-4" />
                Timezone
              </Label>
              <Select value={timezone} onValueChange={setTimezone} disabled={loading}>
                <SelectTrigger className="h-11 border-gray-200 focus:border-emerald-500 rounded-lg">
                  <SelectValue placeholder="Select your timezone" />
                </SelectTrigger>
                <SelectContent>
                  {timezones.map((tz) => (
                    <SelectItem key={tz} value={tz}>
                      {tz.replace(/_/g, ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-400">
                Used for displaying correct times.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Phone className="w-4 h-4" />
                Phone
              </Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+923001234567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="h-11 border-gray-200 focus:border-emerald-500 focus:ring-emerald-500/20 rounded-lg"
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="whatsapp" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <MessageCircle className="w-4 h-4" />
                WhatsApp
              </Label>
              <Input
                id="whatsapp"
                type="tel"
                placeholder="+923001234567"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                className="h-11 border-gray-200 focus:border-emerald-500 focus:ring-emerald-500/20 rounded-lg"
                disabled={loading}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="websiteUrl" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Link2 className="w-4 h-4" />
                Website URL
              </Label>
              <Input
                id="websiteUrl"
                type="url"
                placeholder="https://yourclinic.com"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                className="h-11 border-gray-200 focus:border-emerald-500 focus:ring-emerald-500/20 rounded-lg"
                disabled={loading}
              />
            </div>

            <Button
              type="submit"
              disabled={loading || !fullName || !clinicName || !country || !city || !timezone || !phone}
              className="md:col-span-2 w-full h-11 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-lg shadow-lg shadow-emerald-200 hover:shadow-emerald-300 transition-all duration-200 group"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Setting up...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  Get started
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </div>
              )}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          You can change these settings later in your account.
        </p>
      </div>
    </div>
  )
}
