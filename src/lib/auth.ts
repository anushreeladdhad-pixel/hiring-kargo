import { cookies } from 'next/headers';

/**
 * Minimal single-user gate. This is a one-founder internal tool with no
 * multi-user auth model — a shared access code (set as APP_ACCESS_CODE) is
 * enough to keep the dashboard off the open internet. Not meant to
 * withstand a determined attacker; if that ever matters, swap this for
 * Supabase Auth.
 */
const COOKIE_NAME = 'kargo_access';

export function isUnlocked(): boolean {
  const code = process.env.APP_ACCESS_CODE;
  if (!code) return true; // no code configured -> open (e.g. local dev)
  return cookies().get(COOKIE_NAME)?.value === code;
}

export { COOKIE_NAME };
