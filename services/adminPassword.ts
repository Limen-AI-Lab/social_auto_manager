import { getSupabase } from '../lib/supabase';

/**
 * Update another user's password (requires Edge Function admin-update-password with service role).
 * Caller must be admin or super_admin; the Edge Function verifies this.
 */
export async function updateMemberPassword(
  targetUserId: string,
  newPassword: string
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not configured');

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Not signed in');

  await supabase.auth.refreshSession();
  const { data: { session: sessionAfter } } = await supabase.auth.getSession();
  const currentSession = sessionAfter ?? session;
  if (!currentSession?.access_token) throw new Error('Not signed in');

  const { error } = await supabase.functions.invoke('admin-update-password', {
    body: { user_id: targetUserId, password: newPassword },
  });

  if (error) throw new Error(error.message || 'Password update failed');
}
