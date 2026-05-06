import { getSupabase } from '../lib/supabase';
import type { BusinessUnit } from '../types';

interface BusinessUnitRow {
  id: string;
  label: string;
  icon: string;
  logo: string | null;
  profile_code: string | null;
  created_at?: string;
  updated_at?: string;
}

function rowToBusinessUnit(row: BusinessUnitRow): BusinessUnit {
  return {
    id: row.id,
    label: row.label,
    icon: row.icon ?? 'Building2',
    logo: row.logo ?? undefined,
    profileCode: row.profile_code ?? undefined,
  };
}

/** Default BUs when Supabase is not configured or fetch fails. */
export const DEFAULT_BUSINESS_UNITS: BusinessUnit[] = [
  { id: 'real-estate', label: 'Real Estate', icon: 'Building2' },
  { id: 'immigration', label: 'Immigration', icon: 'Plane' },
  { id: 'insurance', label: 'Insurance', icon: 'ShieldCheck' },
  { id: 'test-profile', label: 'TESTProfile', icon: 'TestTube' },
];

/**
 * Fetch all business units from Supabase. Returns default list if not configured or error.
 */
export async function fetchBusinessUnits(): Promise<BusinessUnit[]> {
  const supabase = getSupabase();
  if (!supabase) return DEFAULT_BUSINESS_UNITS;
  const { data, error } = await supabase
    .from('business_units')
    .select('*')
    .order('label', { ascending: true });
  if (error) {
    console.error('[businessUnits] fetch error', error);
    return DEFAULT_BUSINESS_UNITS;
  }
  return (data ?? []).map((row) => rowToBusinessUnit(row as BusinessUnitRow));
}

export type BusinessUnitUpdate = Partial<
  Pick<BusinessUnit, 'label' | 'icon' | 'logo' | 'profileCode'>
>;

/**
 * Update a business unit by id. Writes profileCode as profile_code in DB.
 */
export async function updateBusinessUnit(
  id: string,
  updates: BusinessUnitUpdate
): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  const row: Record<string, unknown> = {};
  if (updates.label !== undefined) row.label = updates.label;
  if (updates.icon !== undefined) row.icon = updates.icon;
  if (updates.logo !== undefined) row.logo = updates.logo;
  if (updates.profileCode !== undefined) row.profile_code = updates.profileCode;
  if (Object.keys(row).length === 0) return true;
  const { error } = await supabase.from('business_units').update(row).eq('id', id);
  if (error) {
    console.error('[businessUnits] update error', error);
    return false;
  }
  return true;
}

/**
 * Insert or update a business unit. Used when super_admin adds or edits a BU.
 */
export async function upsertBusinessUnit(bu: BusinessUnit): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  const row = {
    id: bu.id,
    label: bu.label,
    icon: bu.icon ?? 'Building2',
    logo: bu.logo ?? null,
    profile_code: bu.profileCode ?? null,
  };
  const { error } = await supabase.from('business_units').upsert(row, {
    onConflict: 'id',
  });
  if (error) {
    console.error('[businessUnits] upsert error', error);
    return false;
  }
  return true;
}

/**
 * Delete a business unit by id. Only super_admin can do this (RLS enforces).
 */
export async function deleteBusinessUnit(id: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  const { error } = await supabase.from('business_units').delete().eq('id', id);
  if (error) {
    console.error('[businessUnits] delete error', error);
    return false;
  }
  return true;
}
