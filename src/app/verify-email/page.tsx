import { VerifyEmailForm } from '@/components/auth/VerifyEmailForm'

export default function VerifyEmailPage({
  searchParams,
}: {
  searchParams?: { email?: string }
}) {
  const email = typeof searchParams?.email === 'string' ? searchParams.email : ''

  return <VerifyEmailForm email={email} />
}
