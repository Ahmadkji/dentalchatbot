'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Stethoscope, ArrowRight } from 'lucide-react'
import dynamic from 'next/dynamic'

const SmileWellWidget = dynamic(() => import('@/components/smilewell-widget'), {
  ssr: false,
})

export function ClientNav() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 0)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  return (
    <>
      {/* Sticky Nav */}
      <nav
        aria-label="Main navigation"
        className={`fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md border-b border-slate-100 transition-shadow ${
          scrolled ? 'shadow-sm' : ''
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2" aria-label="DentalGPT Studio Home">
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

      {/* Floating chatbot */}
      <SmileWellWidget />
    </>
  )
}
