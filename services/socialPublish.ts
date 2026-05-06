import { getSupabase } from '../lib/supabase';
import type { SocialPublishRequestItem } from '../types';

export interface PublishToSocialMediaOptions {
  requests: SocialPublishRequestItem[];
}

export interface PublishToSocialMediaResult {
  success: boolean;
  results?: unknown[];
  total?: number;
  succeeded?: number;
  failed?: number;
  error?: string;
}

/**
 * Invoke publish-to-social-media Edge Function with requests containing profileKey (bu.profileCode).
 */
export async function publishToSocialMedia(
  options: PublishToSocialMediaOptions
): Promise<PublishToSocialMediaResult> {
  const supabase = getSupabase();
  if (!supabase) {
    return { success: false, error: 'Supabase not configured' };
  }

  const { data, error } = await supabase.functions.invoke('publish-to-social-media', {
    body: { requests: options.requests },
  });

  if (error) {
    console.error('[socialPublish] invoke error', error);
    return { success: false, error: error.message };
  }

  const result = data as PublishToSocialMediaResult | null;
  if (!result) {
    return { success: false, error: 'No response from function' };
  }

  return result;
}

export interface TestProfileConnectionResult {
  success: boolean;
  error?: string;
}

/**
 * Test that a profile key is valid by calling the Edge Function in test mode (AyrShare GET /user).
 */
export async function testProfileConnection(profileKey: string): Promise<TestProfileConnectionResult> {
  const supabase = getSupabase();
  if (!supabase) {
    return { success: false, error: 'Supabase not configured' };
  }

  const key = profileKey?.trim();
  if (!key) {
    return { success: false, error: 'Profile Key is required' };
  }

  const { data, error } = await supabase.functions.invoke('publish-to-social-media', {
    body: { testProfileKey: key },
  });

  if (error) {
    console.error('[socialPublish] test connection invoke error', error);
    return { success: false, error: error.message };
  }

  const result = data as { success?: boolean; error?: string; message?: string } | null;
  if (!result) {
    return { success: false, error: 'No response from server' };
  }

  if (result.success) {
    return { success: true };
  }

  return { success: false, error: result.error ?? result.message ?? 'Connection failed' };
}
