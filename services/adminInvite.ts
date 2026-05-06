import { getSupabase } from '../lib/supabase';
import type { UserRole } from '../types';

/**
 * Invite a new member via Edge Function admin-invite-user (creates user with email_confirm: true).
 * Caller must be admin or super_admin; the invited user can sign in immediately without verification.
 */
export async function inviteMember(
  email: string,
  password: string,
  options?: { display_name?: string; role?: UserRole }
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not configured');

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Not signed in');

  await supabase.auth.refreshSession();
  const { data: { session: sessionAfter } } = await supabase.auth.getSession();
  const currentSession = sessionAfter ?? session;
  if (!currentSession?.access_token) throw new Error('Not signed in');

  const { error } = await supabase.functions.invoke('admin-invite-user', {
    body: {
      email,
      password,
      display_name: options?.display_name ?? email.split('@')[0],
      role: options?.role ?? 'viewer',
    },
  });

  if (error) throw new Error(error.message || 'Invite failed');
}
