'use client'

const API = process.env.NEXT_PUBLIC_API_URL || '/api'
// Use 'token' key to be compatible with existing web app auth
const TOKEN_KEY = 'token'
const TOKEN_EXPIRY_KEY = 'desktop_token_expiry'

export interface DeviceCodeResponse {
  device_code: string
  user_code: string
  verification_uri: string
  expires_in: number
  interval: number
}

export interface TokenResponse {
  access_token: string
  token_type: string
}

/** Check if a stored token exists and is not expired */
export function hasValidToken(): boolean {
  if (typeof window === 'undefined') return false
  const token = localStorage.getItem(TOKEN_KEY)
  const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY)
  if (!token || !expiry) return false
  return Date.now() < Number(expiry)
}

/** Get stored token */
export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(TOKEN_KEY)
}

/** Store token with expiry */
export function storeToken(token: string, expiresIn?: number): void {
  localStorage.setItem(TOKEN_KEY, token)
  // Default 24h expiry if not specified
  const expiry = Date.now() + (expiresIn || 86400) * 1000
  localStorage.setItem(TOKEN_EXPIRY_KEY, String(expiry))
}

/** Clear stored token */
export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(TOKEN_EXPIRY_KEY)
}

/** Step 1: Request a device code from the server */
export async function requestDeviceCode(): Promise<DeviceCodeResponse> {
  const res = await fetch(`${API}/auth/device/code`)
  if (!res.ok) throw new Error('Failed to get device code')
  const data = await res.json()
  return data.data
}

/** Step 3: Poll for token exchange */
export async function pollForToken(deviceCode: string): Promise<TokenResponse | null> {
  const res = await fetch(`${API}/auth/device/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ device_code: deviceCode }),
  })

  if (res.status === 428) {
    // Authorization pending
    return null
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.detail || 'Token exchange failed')
  }

  const data = await res.json()
  return data.data
}
