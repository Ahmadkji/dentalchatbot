export interface AuthErrorMapping {
  status: number
  message: string
}

function normalizeCode(input: unknown): string {
  if (typeof input === 'string') {
    return input
  }

  if (input && typeof input === 'object') {
    const maybeCode = (input as { code?: unknown }).code
    const maybeMessage = (input as { message?: unknown }).message

    if (typeof maybeCode === 'string' && maybeCode.trim()) {
      return maybeCode
    }

    if (typeof maybeMessage === 'string') {
      return maybeMessage
    }
  }

  return ''
}

function buildSignupMessage(code: string): AuthErrorMapping {
  switch (code) {
    case 'over_email_send_rate_limit':
      return {
        status: 429,
        message: 'Too many sign-up attempts. Please try again later.',
      }
    case 'email_address_invalid':
      return {
        status: 400,
        message: 'Please enter a valid email address.',
      }
    case 'weak_password':
      return {
        status: 400,
        message: 'Please choose a stronger password.',
      }
    default:
      return {
        status: 400,
        message: 'Unable to create account. Please try again.',
      }
  }
}

function buildConfirmationMessage(code: string): AuthErrorMapping {
  switch (code) {
    case 'over_email_send_rate_limit':
      return {
        status: 429,
        message: 'Too many confirmation requests. Please try again later.',
      }
    case 'email_address_invalid':
      return {
        status: 400,
        message: 'We could not send a confirmation email. Check the address and try again.',
      }
    case 'weak_password':
      return {
        status: 400,
        message: 'We could not send a confirmation email. Please try again.',
      }
    default:
      return {
        status: 400,
        message: 'Unable to send the confirmation email. Please try again.',
      }
  }
}

export function mapSignupError(error: unknown): AuthErrorMapping {
  return buildSignupMessage(normalizeCode(error))
}

export function mapConfirmationEmailError(error: unknown): AuthErrorMapping {
  return buildConfirmationMessage(normalizeCode(error))
}
