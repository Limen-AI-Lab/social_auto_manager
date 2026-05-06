const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const AYRSHARE_API_KEY = Deno.env.get('AYRSHARE_API_KEY')!;
const AYRSHARE_HISTORY_URL = 'https://api.ayrshare.com/api/history';

/** Request: fetch post history for one or more profile keys. */
interface GetHistoryPayload {
  /** Profile keys (bu.profileCode) to fetch history for. */
  profileKeys: string[];
  /** Last n days of posts. Default 7. */
  lastDays?: number;
  /** Start date ISO 8601. If set, endDate required. */
  startDate?: string;
  /** End date ISO 8601. */
  endDate?: string;
  /** Max posts per profile. Default 50. */
  limit?: number;
}

/** Post ID entry from AyrShare history. */
export interface HistoryPostId {
  platform: string;
  id?: string;
  postUrl?: string;
  status?: string;
}

/** Single post in history. */
export interface HistoryPost {
  id: string;
  post: string;
  platforms: string[];
  postIds?: HistoryPostId[];
  created?: string;
  scheduleDate?: { utc?: string } | string;
  status?: string;
}

/** AyrShare history API response. */
interface AyrShareHistoryResponse {
  history?: HistoryPost[];
  count?: number;
  message?: string;
  status?: string;
  code?: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    if (!AYRSHARE_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: 'Server: AyrShare API key not configured' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const payload: GetHistoryPayload = await req.json();
    const profileKeys = Array.isArray(payload.profileKeys) ? payload.profileKeys : [];
    if (profileKeys.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'profileKeys array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const lastDays = payload.lastDays ?? 7;
    const limit = Math.min(payload.limit ?? 50, 100);
    const startDate = payload.startDate;
    const endDate = payload.endDate;

    let query = `limit=${limit}`;
    if (startDate && endDate) {
      query += `&startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;
    } else {
      query += `&lastDays=${lastDays}`;
    }

    const allPosts: HistoryPost[] = [];

    for (const profileKey of profileKeys) {
      const key = String(profileKey).trim();
      if (!key) continue;

      const url = `${AYRSHARE_HISTORY_URL}?${query}`;
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${AYRSHARE_API_KEY}`,
          'Profile-Key': key,
        },
      });

      const data: AyrShareHistoryResponse = await res.json().catch(() => ({}));

      if (!res.ok) {
        return new Response(
          JSON.stringify({
            success: false,
            error: data.message || data.status || `HTTP ${res.status}`,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (data.status === 'error' && data.code !== undefined) {
        return new Response(
          JSON.stringify({ success: false, error: data.message || 'History request failed' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const history = Array.isArray(data.history) ? data.history : [];
      for (const post of history) {
        if (post.status === 'success' && post.postIds?.length) {
          allPosts.push(post);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        posts: allPosts,
        count: allPosts.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
