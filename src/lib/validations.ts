/**
 * Shared client-side validation utilities for auth forms.
 *
 * These provide instant feedback before the API round-trip, reducing
 * unnecessary network requests and improving perceived responsiveness.
 *
 * The email regex is intentionally lenient — it rejects obviously malformed
 * inputs (missing @, missing domain) while allowing valid-but-unusual forms
 * such as plus-addressing (user+tag@example.com) and subdomains.
 *
 * Server-side validation (API routes) remains the authoritative check.
 */

// Matches: local@domain.tld  — rejects "hello", "user@", "@domain", "a@b"
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Returns `true` when `email` looks like a valid email address.
 * Does NOT verify that the address actually exists or can receive mail.
 */
export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim())
}
