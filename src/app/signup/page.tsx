import { Suspense } from 'react'
import LoginForm from '@/components/auth/LoginForm'

export default function SignupPage() {
  return (
    <Suspense>
      <LoginForm initialMode="signup" />
    </Suspense>
  )
}
