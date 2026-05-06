import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Supabase project URL for Edge Function calls. */
export function getSupabaseUrl(): string | undefined {
  return supabaseUrl;
}

let client: SupabaseClient | null = null;

/**
 * Returns the Supabase client when VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set; otherwise null.
 */
export function getSupabase(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseAnonKey) return null;
  if (!client) {
    client = createClient(supabaseUrl, supabaseAnonKey);
  }
  return client;
}

export const BUCKET_VIDEOS = 'videos';
export const BUCKET_THUMBNAILS = 'thumbnails';
