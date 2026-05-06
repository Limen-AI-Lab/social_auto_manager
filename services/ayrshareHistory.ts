import { getSupabase } from '../lib/supabase';

export interface HistoryPostId {
  platform: string;
  id?: string;
  postUrl?: string;
  status?: string;
}

export interface HistoryPost {
  id: string;
  post: string;
  platforms: string[];
  postIds?: HistoryPostId[];
  created?: string;
  scheduleDate?: { utc?: string } | string;
  status?: string;
}

export interface GetAyrshareHistoryOptions {
  profileKeys: string[];
  lastDays?: number;
  startDate?: string;
  endDate?: string;
  limit?: number;
}

export interface GetAyrshareHistoryResult {
  success: boolean;
  posts?: HistoryPost[];
  count?: number;
  error?: string;
}

/**
 * Fetch AyrShare post history (with post URLs) for the given profile keys.
 * Uses the get-ayrshare-history Edge Function.
 */
export async function getAyrshareHistory(
  options: GetAyrshareHistoryOptions
): Promise<GetAyrshareHistoryResult> {
  const supabase = getSupabase();
  if (!supabase) {
    return { success: false, error: 'Supabase not configured' };
  }

  const { data, error } = await supabase.functions.invoke('get-ayrshare-history', {
    body: {
      profileKeys: options.profileKeys,
      lastDays: options.lastDays ?? 7,
      startDate: options.startDate,
      endDate: options.endDate,
      limit: options.limit ?? 50,
    },
  });

  if (error) {
    const msg = error.message || '';
    const hint = msg.toLowerCase().includes('fetch') || msg.includes('404')
      ? ' Deploy the Edge Function: supabase functions deploy get-ayrshare-history'
      : '';
    return { success: false, error: msg + hint };
  }

  const result = data as GetAyrshareHistoryResult | null;
  if (!result) {
    return { success: false, error: 'No response from function' };
  }

  return result;
}

/**
 * Extract one link per platform from history posts (latest post URL per platform).
 * Maps AyrShare platform names to report labels: twitter -> x, etc.
 */
export function extractLinksByPlatform(posts: HistoryPost[]): Record<string, string> {
  const links: Record<string, string> = {};
  const platformOrder = ['linkedin', 'instagram', 'youtube', 'twitter', 'tiktok', 'facebook'];

  for (const post of posts) {
    const postIds = post.postIds ?? [];
    for (const entry of postIds) {
      const url = entry.postUrl || (entry.id ? buildPostUrl(entry.platform, entry.id) : null);
      if (url && entry.platform) {
        const key = entry.platform.toLowerCase();
        if (!links[key]) {
          links[key] = url;
        }
      }
    }
  }

  const ordered: Record<string, string> = {};
  for (const p of platformOrder) {
    if (links[p]) ordered[p] = links[p];
  }
  for (const k of Object.keys(links)) {
    if (!ordered[k]) ordered[k] = links[k];
  }
  return ordered;
}

function buildPostUrl(platform: string, id: string): string | null {
  switch (platform.toLowerCase()) {
    case 'twitter':
      return `https://twitter.com/i/status/${id}`;
    case 'facebook':
      return `https://www.facebook.com/${id}`;
    case 'instagram':
      return `https://www.instagram.com/p/${id}`;
    case 'linkedin':
      return `https://www.linkedin.com/feed/update/urn:li:activity:${id}`;
    case 'youtube':
      return `https://www.youtube.com/watch?v=${id}`;
    case 'tiktok':
      return `https://www.tiktok.com/@_/video/${id}`;
    default:
      return null;
  }
}
