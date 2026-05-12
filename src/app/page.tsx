'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Stethoscope, ArrowRight } from 'lucide-react'
import { DentalHero } from '@/components/landing/hero'
import { StatsTicker } from '@/components/landing/stats-ticker'
import { PainPulseGrid } from '@/components/landing/pain-points'
import { HowItWorksSection } from '@/components/landing/how-it-works'
import { TrustTimeline } from '@/components/landing/trust-timeline'
import { ConversationShowcase } from '@/components/landing/conversation-showcase'
import { DayInTheLifeSection } from '@/components/landing/day-in-the-life'
import { FeaturesGrid } from '@/components/landing/features'
import { StickyStackerSection } from '@/components/landing/sticky-stacker'
import { WorkflowStrip } from '@/components/landing/workflow-strip'
import { PricingSection } from '@/components/landing/pricing'
import { LandingFooter } from '@/components/landing/footer'

import dynamic from 'next/dynamic'

const SmileWellWidget = dynamic(() => import('@/components/smilewell-widget'), {
  ssr: false,
})

export default function HomePage() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 0)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  return (
    <>
      {/* Sticky Nav */}
      <nav className={`fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md border-b border-slate-100 transition-shadow ${scrolled ? 'shadow-sm' : ''}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
              <Stethoscope className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-slate-900">DentalGPT Studio</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-slate-600 hover:text-slate-900 font-medium">
              Sign In
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 bg-emerald-600 text-white text-sm px-4 py-2 rounded-lg font-semibold hover:bg-emerald-700 transition-colors"
            >
              Get Started
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </nav>

      {/* Landing sections */}
      <main className="min-h-screen pt-14">
        <DentalHero />
        <StatsTicker />
        <PainPulseGrid />
        <HowItWorksSection />
        <TrustTimeline />
        <ConversationShowcase />
        <DayInTheLifeSection />
        <FeaturesGrid />
        <StickyStackerSection />
        <WorkflowStrip />
        <PricingSection />
        <LandingFooter />
      </main>

      {/* Floating chatbot */}
      <SmileWellWidget />
    </>
  )
}
