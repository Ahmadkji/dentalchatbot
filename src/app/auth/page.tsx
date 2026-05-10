'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Shield,
  MessageSquare,
  Brain,
  FileText,
  Stethoscope,
  CheckCircle2,
  Clock,
  AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: 'easeOut' },
  }),
}

const features = [
  {
    icon: MessageSquare,
    title: '24/7 Dental Guidance',
    desc: 'Instant answers to your dental questions',
  },
  {
    icon: Brain,
    title: 'AI Symptom Checker',
    desc: 'Smart assessment of dental concerns',
  },
  {
    icon: FileText,
    title: 'Treatment Summaries',
    desc: 'Detailed treatment plan explanations',
  },
]

const recentActivity = [
  {
    icon: CheckCircle2,
    title: 'Wisdom Tooth Consultation',
    time: '2 hours ago',
    status: 'Completed',
    statusColor: 'text-emerald-600',
    statusBg: 'bg-emerald-50',
  },
  {
    icon: Clock,
    title: 'Teeth Sensitivity Check',
    time: 'Yesterday',
    status: 'In Progress',
    statusColor: 'text-blue-600',
    statusBg: 'bg-blue-50',
  },
  {
    icon: AlertCircle,
    title: 'Gum Health Assessment',
    time: '2 days ago',
    status: 'Follow-up',
    statusColor: 'text-amber-600',
    statusBg: 'bg-amber-50',
  },
]

export default function AuthPage() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const isMountedRef = useRef(false)
  const submitTimerRef = useRef<number | null>(null)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      if (submitTimerRef.current !== null) {
        window.clearTimeout(submitTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    const hasSession = localStorage.getItem('dentbot-auth') === 'true'
    if (hasSession) {
      router.replace('/dashboard')
    }
  }, [router])

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)

    if (submitTimerRef.current !== null) {
      window.clearTimeout(submitTimerRef.current)
    }

    // Demo auth bridge for MVP routing.
    submitTimerRef.current = window.setTimeout(() => {
      if (!isMountedRef.current) {
        return
      }
      localStorage.setItem('dentbot-auth', 'true')
      if (rememberMe) {
        localStorage.setItem('dentbot-auth-email', email)
      }
      setIsLoading(false)
      router.push('/dashboard')
    }, 700)
  }

  const handleGoogleContinue = () => {
    localStorage.setItem('dentbot-auth', 'true')
    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50/60 via-white to-white flex items-center justify-center p-4 md:p-8">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-20 -left-20 w-72 h-72 bg-emerald-100/30 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 -right-20 w-96 h-96 bg-emerald-50/40 rounded-full blur-3xl" />
        <div className="absolute top-1/3 right-1/4 w-48 h-48 bg-teal-50/20 rounded-full blur-2xl" />
        <svg className="absolute top-8 left-8 opacity-[0.07]" width="120" height="120" aria-hidden="true">
          <pattern id="dots" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.5" fill="#22c55e" />
          </pattern>
          <rect width="120" height="120" fill="url(#dots)" />
        </svg>
      </div>

      <div className="relative w-full max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 lg:gap-12 items-center">
          <motion.div
            initial="hidden"
            animate="visible"
            className="lg:col-span-3 space-y-8"
          >
            <motion.div variants={fadeInUp} custom={0} className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-200">
                <Stethoscope className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="text-xl font-bold text-emerald-600">DentaBot</span>
                <span className="text-xs text-gray-400 ml-2">AI-Powered Dental Care</span>
              </div>
            </motion.div>

            <motion.div variants={fadeInUp} custom={1} className="space-y-4">
              <h1 className="text-4xl md:text-5xl lg:text-[3.25rem] font-bold text-gray-900 leading-tight tracking-tight">
                Sign in and keep your{' '}
                <span className="text-emerald-500 relative">
                  smile healthy
                  <svg
                    className="absolute -bottom-1 left-0 w-full"
                    viewBox="0 0 200 8"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                  >
                    <path
                      d="M1 5.5C47 1.5 153 1.5 199 5.5"
                      stroke="#22c55e"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      opacity="0.4"
                    />
                  </svg>
                </span>
              </h1>
              <p className="text-gray-500 text-lg max-w-lg leading-relaxed">
                Get instant AI-powered dental guidance, symptom assessments, and personalized treatment insights all in one place.
              </p>
            </motion.div>

            <motion.div variants={fadeInUp} custom={2} className="space-y-3">
              {features.map((feature, index) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + index * 0.15, duration: 0.4 }}
                  className="flex items-center gap-4 p-3 rounded-xl hover:bg-white/80 transition-all duration-200 group cursor-default"
                >
                  <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center group-hover:bg-emerald-100 transition-colors">
                    <feature.icon className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800 text-sm">{feature.title}</p>
                    <p className="text-gray-400 text-xs">{feature.desc}</p>
                  </div>
                </motion.div>
              ))}
            </motion.div>

            <motion.div variants={fadeInUp} custom={3} className="space-y-4">
              <h3 className="font-semibold text-gray-800 text-sm">Recent Activity</h3>
              <div className="space-y-2">
                {recentActivity.map((item, index) => (
                  <motion.div
                    key={item.title}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 + index * 0.1, duration: 0.3 }}
                    className="flex items-center justify-between p-3 bg-white/70 backdrop-blur-sm rounded-xl border border-gray-100/80 hover:border-emerald-100 hover:shadow-sm transition-all duration-200"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center">
                        <item.icon className="w-4 h-4 text-gray-500" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-700 text-sm">{item.title}</p>
                        <p className="text-gray-400 text-xs">{item.time}</p>
                      </div>
                    </div>
                    <span
                      className={`text-xs font-medium px-2.5 py-1 rounded-full ${item.statusColor} ${item.statusBg}`}
                    >
                      {item.status}
                    </span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="lg:col-span-2 w-full"
          >
            <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 p-6 md:p-8">
              <div className="flex justify-center mb-6">
                <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center">
                  <Shield className="w-6 h-6 text-emerald-600" />
                </div>
              </div>

              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Welcome back</h2>
                <p className="text-gray-400 text-sm mt-1">
                  Sign in to your DentaBot account to continue
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                    Email address
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 h-11 border-gray-200 focus:border-emerald-500 focus:ring-emerald-500/20 rounded-lg transition-all"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                    Password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 pr-10 h-11 border-gray-200 focus:border-emerald-500 focus:ring-emerald-500/20 rounded-lg transition-all"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="remember"
                      checked={rememberMe}
                      onCheckedChange={(checked) => setRememberMe(Boolean(checked))}
                      className="data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                    />
                    <Label htmlFor="remember" className="text-sm text-gray-500 cursor-pointer">
                      Remember me
                    </Label>
                  </div>
                  <button
                    type="button"
                    className="text-sm text-emerald-600 hover:text-emerald-700 font-medium transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-11 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-lg shadow-lg shadow-emerald-200 hover:shadow-emerald-300 transition-all duration-200 group"
                >
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Signing in...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      Sign in
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  )}
                </Button>
              </form>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-100" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-3 bg-white text-gray-400">or</span>
                </div>
              </div>

              <Button
                variant="outline"
                className="w-full h-11 border-gray-200 hover:bg-gray-50 hover:border-gray-300 rounded-lg font-medium text-gray-600 transition-all duration-200"
                type="button"
                onClick={handleGoogleContinue}
              >
                <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                Continue with Google
              </Button>

              <p className="text-center text-sm text-gray-400 mt-6">
                New here?{' '}
                <button
                  type="button"
                  className="text-emerald-600 hover:text-emerald-700 font-semibold transition-colors"
                >
                  Create account
                </button>
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
