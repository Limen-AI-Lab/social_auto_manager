const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const AYRSHARE_API_KEY = Deno.env.get('AYRSHARE_API_KEY')!;
const AYRSHARE_API_URL = 'https://api.ayrshare.com/api/post';
const AYRSHARE_HISTORY_URL = 'https://api.ayrshare.com/api/history';

interface PostRequest {
  post: string;
  platforms: string[];
  mediaUrls?: string[];
  youTubeOptions?: {
    title: string;
    description?: string;
    visibility?: string;
  };
}

interface BatchRequest {
  profileKey: string;
  businessUnit?: string;
  posts: PostRequest[];
}

interface RequestPayload {
  requests?: BatchRequest[];
  /** If set, only validate the profile key (test connection); do not post. */
  testProfileKey?: string;
  /** If set, fetch AyrShare post history (Daily Report). Uses profileKeys, lastDays or startDate/endDate, limit. */
  getHistory?: {
    profileKeys: string[];
    lastDays?: number;
    startDate?: string;
    endDate?: string;
    limit?: number;
  };
}

interface HistoryPostId {
  platform: string;
  id?: string;
  postUrl?: string;
  status?: string;
}

interface HistoryPost {
  id: string;
  post: string;
  platforms: string[];
  postIds?: HistoryPostId[];
  created?: string;
  scheduleDate?: { utc?: string } | string;
  status?: string;
}

interface AyrShareHistoryResponse {
  history?: HistoryPost[];
  count?: number;
  message?: string;
  status?: string;
  code?: number;
}

const AYRSHARE_USER_URL = 'https://api.ayrshare.com/api/user';

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
    const payload: RequestPayload = await req.json();

    // Test connection: validate profile key via AyrShare GET /user. Always return 200 so client can read body.
    if (payload.testProfileKey != null) {
      const profileKey = String(payload.testProfileKey).trim();
      if (!profileKey) {
        return new Response(
          JSON.stringify({ success: false, error: 'Profile key is required' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      try {
        if (!AYRSHARE_API_KEY) {
          return new Response(
            JSON.stringify({ success: false, error: 'Server: AyrShare API key not configured' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        const userRes = await fetch(AYRSHARE_USER_URL, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${AYRSHARE_API_KEY}`,
            'Profile-Key': profileKey,
          },
        });
        const userData = userRes.ok ? await userRes.json().catch(() => ({})) : null;
        if (!userRes.ok) {
          const errMsg = (userData?.message ?? userData?.error ?? userRes.statusText) || `HTTP ${userRes.status}`;
          return new Response(
            JSON.stringify({ success: false, error: errMsg }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        return new Response(
          JSON.stringify({ success: true, message: 'Connection successful' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (e) {
        return new Response(
          JSON.stringify({ success: false, error: (e as Error).message || 'Connection check failed' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Daily Report: fetch AyrShare post history for given profile keys
    if (payload.getHistory) {
      const { profileKeys = [], lastDays = 7, startDate, endDate, limit = 50 } = payload.getHistory;
      const keys = Array.isArray(profileKeys) ? profileKeys.filter((k: string) => String(k).trim()) : [];
      if (keys.length === 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'profileKeys array is required' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (!AYRSHARE_API_KEY) {
        return new Response(
          JSON.stringify({ success: false, error: 'Server: AyrShare API key not configured' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const limitNum = Math.min(Number(limit) || 50, 100);
      let query = `limit=${limitNum}`;
      if (startDate && endDate) {
        query += `&startDate=${encodeURIComponent(String(startDate))}&endDate=${encodeURIComponent(String(endDate))}`;
      } else {
        query += `&lastDays=${Number(lastDays) || 7}`;
      }
      const allPosts: HistoryPost[] = [];
      for (const profileKey of keys) {
        const key = String(profileKey).trim();
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
            JSON.stringify({ success: false, error: data.message || data.status || `HTTP ${res.status}` }),
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
        JSON.stringify({ success: true, posts: allPosts, count: allPosts.length }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!Array.isArray(payload.requests) || payload.requests.length === 0) {
      throw new Error('requests[] is missing or empty');
    }

    const results: unknown[] = [];

    for (const request of payload.requests) {
      const profileKey = request.profileKey?.trim();
      if (!profileKey) {
        throw new Error('profileKey is required for each request');
      }

      if (!Array.isArray(request.posts) || request.posts.length === 0) {
        throw new Error(`posts[] is missing or empty for profileKey`);
      }

      for (const post of request.posts) {
        try {
          const response = await fetch(AYRSHARE_API_URL, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${AYRSHARE_API_KEY}`,
              'Content-Type': 'application/json',
              'Profile-Key': profileKey,
            },
            body: JSON.stringify(post),
          });

          const result = await response.json();

          results.push({
            businessUnit: request.businessUnit,
            profileKey,
            post: post.post?.substring(0, 50) + '...',
            platforms: post.platforms,
            status: response.ok ? 'success' : 'failed',
            response: result,
          });
        } catch (error) {
          results.push({
            businessUnit: request.businessUnit,
            profileKey,
            post: post.post?.substring(0, 50) + '...',
            platforms: post.platforms,
            status: 'error',
            error: (error as Error).message,
          });
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        results,
        total: results.length,
        succeeded: results.filter((r: { status: string }) => r.status === 'success').length,
        failed: results.filter((r: { status: string }) => r.status !== 'success').length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
