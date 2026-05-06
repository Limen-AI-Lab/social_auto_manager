import { getSupabase } from '../lib/supabase';

/**
 * Fetch allowed business unit ids for a profile (editor/viewer). Used for "my visible BUs" and Team page.
 * RLS: authenticated can read (own or any for admin).
 */
export async function fetchAllowedBusinessUnitIds(profileId: string): Promise<string[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('profile_business_units')
    .select('business_unit_id')
    .eq('profile_id', profileId);
  if (error) {
    console.error('[profileBusinessUnits] fetch error', error);
    return [];
  }
  return (data ?? []).map((row) => row.business_unit_id);
}

/**
 * Set allowed business units for a profile (editor/viewer). Only super_admin/admin can call; used from Team page.
 * Replaces all existing assignments with the given list.
 */
export async function setAllowedBusinessUnits(
  profileId: string,
  businessUnitIds: string[]
): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  const { error: deleteError } = await supabase
    .from('profile_business_units')
    .delete()
    .eq('profile_id', profileId);
  if (deleteError) {
    console.error('[profileBusinessUnits] delete error', deleteError);
    return false;
  }
  if (businessUnitIds.length === 0) return true;
  const rows = businessUnitIds.map((business_unit_id) => ({
    profile_id: profileId,
    business_unit_id,
  }));
  const { error: insertError } = await supabase.from('profile_business_units').insert(rows);
  if (insertError) {
    console.error('[profileBusinessUnits] insert error', insertError);
    return false;
  }
  return true;
}
