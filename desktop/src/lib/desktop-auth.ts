// OAuth Device Flow helpers for the desktop client.

import { api, getWebBase } from "./api";

const TOKEN_KEY = "ishwe.qn.token";
const EXPIRY_KEY = "ishwe.qn.token_expiry";

export interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function storeToken(token: string, expiresInSec = 86_400): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(EXPIRY_KEY, String(Date.now() + expiresInSec * 1000));
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(EXPIRY_KEY);
}

export async function validateToken(): Promise<boolean> {
  const token = getStoredToken();
  if (!token) return false;
  try {
    await api("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } });
    return true;
  } catch {
    clearToken();
    return false;
  }
}

export async function requestDeviceCode(): Promise<DeviceCodeResponse> {
  const res = await api<{ data: DeviceCodeResponse }>("/api/auth/device/code");
  return res.data;
}

export async function pollForToken(
  deviceCode: string,
): Promise<TokenResponse | null> {
  try {
    const res = await api<{ data: TokenResponse }>(
      "/api/auth/device/token",
      { method: "POST", body: { device_code: deviceCode } },
    );
    return res.data;
  } catch (e: any) {
    if (e?.status === 428) return null; // pending
    throw e;
  }
}

export function buildAuthorizeUrl(userCode: string): string {
  return `${getWebBase()}/device-authorize?user_code=${encodeURIComponent(userCode)}`;
}
