import type { Variants } from 'framer-motion'
import {
  MessageSquare,
  Brain,
  FileText,
  Shield,
  Zap,
} from 'lucide-react'

/**
 * Animation variant for staggered fade-in-up effect used on the login page.
 */
export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: 'easeOut' },
  }),
}

/**
 * Feature highlights shown on the left panel of the login/signup page.
 * Static marketing content — truthful and verifiable.
 */
export const features = [
  {
    icon: MessageSquare,
    title: '24/7 Patient Communication',
    desc: 'Automated responses to patient inquiries',
  },
  {
    icon: Brain,
    title: 'AI-Powered Assistant',
    desc: 'Smart dental guidance and symptom triage',
  },
  {
    icon: FileText,
    title: 'Lead Management',
    desc: 'Track and convert patient leads',
  },
  {
    icon: Shield,
    title: 'HIPAA-Ready Security',
    desc: 'Enterprise-grade data protection',
  },
  {
    icon: Zap,
    title: 'Easy Widget Setup',
    desc: 'Add to your website in under 2 minutes',
  },
]

/**
 * URL query-param error codes mapped to user-facing messages.
 * Populated by API route redirects and read by the login form on mount.
 */
export const urlErrorMessages: Record<string, string> = {
  'auth-config-missing': 'Sign in is temporarily unavailable. Please try again later.',
  'auth-callback': 'We could not complete sign in. Please try again.',
  'oauth-denied': 'Google sign-in was cancelled or denied. Please try again or use email/password.',
  'oauth-error': 'Google sign-in encountered an error. Please try again or use email/password.',
}
