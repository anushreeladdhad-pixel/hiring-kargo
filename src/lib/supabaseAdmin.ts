import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Server-only Supabase client using the service role key. Never import this
 * from a client component — it bypasses row-level security entirely, which
 * is fine here because this whole app is a single-founder internal tool with
 * no end-user auth model, but it must never reach the browser bundle.
 *
 * Typed as `any` deliberately: this project has no generated Database type
 * (see supabase/migrations/0001_init.sql for the actual schema), so table
 * shapes are enforced by src/lib/types.ts at the call site instead of by
 * the client itself.
 */
let _admin: SupabaseClient<any, any, any> | null = null;

export function supabaseAdmin(): SupabaseClient<any, any, any> {
  if (_admin) return _admin;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. ' +
        'Copy .env.example to .env.local and fill in your Supabase project keys.'
    );
  }

  _admin = createClient<any, any, any>(url, key, {
    auth: { persistSession: false },
  });
  return _admin;
}
