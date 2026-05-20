// Email regex — must match backend: schemas.py
const EMAIL_RE = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/

export function validateEmail(email: string): string | null {
  if (!email.trim()) return 'validation.email.required'
  if (!EMAIL_RE.test(email)) return 'validation.email.invalid'
  return null
}

/**
 * Password rules (mirrors backend min_length=8 + no-all-digits):
 *  - at least 8 characters
 *  - cannot be purely numeric
 */
export function validatePassword(password: string): string | null {
  if (!password) return 'validation.password.required'
  if (password.length < 8) return 'validation.password.minLength'
  if (/^\d+$/.test(password)) return 'validation.password.noAllDigits'
  return null
}
