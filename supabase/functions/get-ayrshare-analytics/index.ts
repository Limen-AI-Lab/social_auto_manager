// ============================================================
// SAMA - Supabase Edge Function: get-ayrshare-analytics
//
// 功能：从 Ayrshare API 获取社交媒体分析数据
// 环境变量：
//   - AYRSHARE_API_KEY: Ayrshare API Key
//   - X_API_KEY: X/Twitter Consumer Key (可选，用于 X API)
//   - X_API_SECRET: X/Twitter Consumer Secret (可选，用于 X API)
//
// 使用方法：
//   supabase functions deploy get-ayrshare-analytics
//   supabase secrets set AYRSHARE_API_KEY=xxx X_API_KEY=xxx X_API_SECRET=xxx
//
// 增量抓取策略：
//   - mode=full: 每次抓取全部历史数据（默认）
//   - mode=incremental: 只抓取 lastFetchDate 之后新增/变更的帖子
//   - lastFetchDate 格式: ISO 8601 (e.g. "2026-03-15T00:00:00Z")
//
// 缓存策略：
//   - posts_cache 表：存储已抓取的帖子元数据（id, created, fetched_at）
//   - 增量模式：只抓取 cached_posts 中不存在的帖子
//   - 完整模式：对比 cache 时间戳，有变更则更新
// ============================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const AYRSHARE_API_BASE = 'https://api.ayrshare.com';

// ── 缓存配置 ────────────────────────────────────────────────────────────────

interface PostCacheEntry {
  post_id: string;
  profile_key: string;
  created: string;
  fetched_at: string;
}

interface GetAyrshareAnalyticsOptions {
  profileKeys: string[];
  lastDays?: number;
  startDate?: string;
  endDate?: string;
  type?: 'posts' | 'summary' | 'all';
  /** 抓取模式: 'full' | 'incremental' | 'refresh' */
  mode?: 'full' | 'incremental' | 'refresh';
  /** 增量模式：只抓取此时间之后新建的帖子（ISO 8601） */
  lastFetchDate?: string;
}

// ── Supabase 缓存客户端 ────────────────────────────────────────────────────

function createCacheClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey);
}

async function getCachedPostIds(
  supabase: ReturnType<typeof createClient>,
  profileKey: string
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('sama_post_cache')
    .select('post_id')
    .eq('profile_key', profileKey);

  if (error || !data) return new Set();
  return new Set((data as { post_id: string }[]).map(r => r.post_id));
}

async function upsertCacheEntries(
  supabase: ReturnType<typeof createClient>,
  entries: PostCacheEntry[]
): Promise<void> {
  if (entries.length === 0) return;
  const rows = entries.map(e => ({
    post_id: e.post_id,
    profile_key: e.profile_key,
    created: e.created,
    fetched_at: e.fetched_at,
  }));
  await supabase.from('sama_post_cache').upsert(rows, { onConflict: 'post_id,profile_key' });
}

async function deleteStaleCacheEntries(
  supabase: ReturnType<typeof createClient>,
  profileKey: string,
  validPostIds: string[]
): Promise<void> {
  if (validPostIds.length === 0) return;
  const { error } = await supabase
    .from('sama_post_cache')
    .delete()
    .eq('profile_key', profileKey)
    .not('post_id', 'in', `(${validPostIds.map(id => `'${id.replace(/'/g, "''")}'`).join(',')})`);
  if (error) console.warn('[Cache] deleteStaleCacheEntries error:', error.message);
}

// ── 并发抓取参数 ────────────────────────────────────────────────────────────

const BATCH_SIZE = 8;         // 每批并发请求数
const BATCH_DELAY_MS = 250;    // 批次间延迟（毫秒）

async function sleep(ms: number): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, ms));
}

interface HistoryPost {
  id: string;
  post: string;
  platforms: string[];
  postIds: Array<{ platform: string; id?: string; postUrl?: string; status?: string }>;
  created?: string;
  status?: string;
}

  interface GetAyrshareAnalyticsResult {
  success: boolean;
  /** 使用的抓取模式 */
  mode: 'full' | 'incremental' | 'refresh';
  /** 缓存统计 */
  cacheStats: {
    enabled: boolean;
    cachedSkipped: number;
    newlyFetched: number;
  };
  historyPosts: HistoryPost[];
  testedPosts: Array<{
    postId: string;
    profileKey: string;
    platforms: string[];
    httpStatus: number;
    responseBody: string;
    success: boolean;
    errorMessage?: string;
  }>;
  summaries: Array<{
    profileKey: string;
    platform: string;
    totalPosts: number;
    totalViews: number;
    totalLikes: number;
    totalComments: number;
    totalShares: number;
    totalClicks: number;
    totalReach: number;
    totalImpressions: number;
    avgEngagementRate: number;
    followers: number;
  }>;
  platformMetrics: Record<string, {
    platform: string;
    label: string;
    posts: number;
    views: number;
    likes: number;
    comments: number;
    shares: number;
    saves: number;
    clicks: number;
    reach: number;
    impressions: number;
    totalEngagement: number;
    avgEngagementRate: number;
    followers: number;
    paidImpressions: number;
    organicImpressions: number;
  }>;
  overallMetrics: {
    totalPosts: number;
    totalViews: number;
    totalLikes: number;
    totalComments: number;
    totalShares: number;
    totalSaves: number;
    totalClicks: number;
    totalReach: number;
    totalImpressions: number;
    totalEngagement: number;
    avgEngagementRate: number;
    paidImpressions: number;
    organicImpressions: number;
  };
  errors: string[];
  warnings: string[];
}

// Helper function to get API Keys from environment
function getApiKeys() {
  const apiKey = Deno.env.get('AYRSHARE_API_KEY');
  const xApiKey = Deno.env.get('X_API_KEY') || '';
  const xApiSecret = Deno.env.get('X_API_SECRET') || '';
  
  return { apiKey, xApiKey, xApiSecret };
}

// Build headers with optional X API keys
function buildHeaders(apiKey: string, xApiKey?: string, xApiSecret?: string): HeadersInit {
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
  
  // Add X/Twitter BYO headers if provided
  if (xApiKey) {
    headers['X-Twitter-OAuth1-Api-Key'] = xApiKey;
  }
  if (xApiSecret) {
    headers['X-Twitter-OAuth1-Api-Secret'] = xApiSecret;
  }
  
  return headers;
}

// Helper function
function n(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return parseInt(v, 10) || 0;
  return 0;
}

// Fetch history posts
async function fetchHistory(
  apiKey: string,
  xApiKey: string,
  xApiSecret: string,
  profileKey: string,
  startDate: string,
  endDate: string,
  limit: number
): Promise<{ posts: HistoryPost[]; error: string | null }> {
  const params = new URLSearchParams({ profileKey, limit: String(limit) });
  if (startDate) params.set('startDate', startDate);
  if (endDate) params.set('endDate', endDate);

  const url = `${AYRSHARE_API_BASE}/api/history?${params}`;

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: buildHeaders(apiKey, xApiKey, xApiSecret),
    });

    const text = await res.text();

    if (!res.ok) {
      return { posts: [], error: `HTTP ${res.status}: ${text.substring(0, 200)}` };
    }

    const json = JSON.parse(text) as Record<string, unknown>;
    const rawPosts = json['history'] || json['posts'] || [];
    
    const posts: HistoryPost[] = (rawPosts as Record<string, unknown>[]).map(raw => ({
      id: String(raw['id'] || ''),
      post: String(raw['post'] || ''),
      platforms: Array.isArray(raw['platforms'])
        ? (raw['platforms'] as string[]).map(p => String(p).toLowerCase())
        : [String(raw['platform'] || '').toLowerCase()].filter(Boolean),
      postIds: Array.isArray(raw['postIds']) 
        ? raw['postIds'].map((p: unknown) => {
            const e = p as Record<string, unknown>;
            return {
              platform: String(e['platform'] || '').toLowerCase(),
              id: e['id'] ? String(e['id']) : undefined,
              postUrl: e['postUrl'] ? String(e['postUrl']) : undefined,
              status: e['status'] ? String(e['status']) : undefined,
            };
          })
        : [],
      created: raw['created'] ? String(raw['created']) : undefined,
      status: raw['status'] ? String(raw['status']) : undefined,
    }));
    
    return { posts, error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { posts: [], error: msg };
  }
}

// Fetch social analytics (platform summary)
async function fetchSocialAnalytics(
  apiKey: string,
  xApiKey: string,
  xApiSecret: string,
  profileKey: string,
  startDate: string,
  endDate: string
): Promise<{ data: Record<string, unknown> | null; error: string | null }> {
  const payload = {
    profileKey,
    platforms: ['facebook', 'instagram', 'linkedin', 'youtube', 'twitter', 'tiktok'],
    startDate,
    endDate,
  };

  try {
    const res = await fetch(`${AYRSHARE_API_BASE}/api/analytics/social`, {
      method: 'POST',
      headers: buildHeaders(apiKey, xApiKey, xApiSecret),
      body: JSON.stringify(payload),
    });

    const text = await res.text();

    if (!res.ok) {
      return { data: null, error: `HTTP ${res.status}: ${text.substring(0, 200)}` };
    }

    return { data: JSON.parse(text) as Record<string, unknown>, error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { data: null, error: msg };
  }
}

// Fetch per-post analytics
async function fetchPostAnalytics(
  apiKey: string,
  xApiKey: string,
  xApiSecret: string,
  ayrsharePostId: string,
  profileKey: string,
  platforms: string[]
): Promise<{ data: Record<string, unknown> | null; statusCode: number; error: string | null }> {
  const payload: Record<string, unknown> = {
    id: ayrsharePostId,
    profileKey,
  };
  if (platforms.length > 0) {
    payload['platforms'] = platforms;
  }

  try {
    const res = await fetch(`${AYRSHARE_API_BASE}/api/analytics/post`, {
      method: 'POST',
      headers: buildHeaders(apiKey, xApiKey, xApiSecret),
      body: JSON.stringify(payload),
    });

    const text = await res.text();

    if (!res.ok) {
      return { data: null, statusCode: res.status, error: `HTTP ${res.status}: ${text}`, rawBody: text };
    }

    return { data: JSON.parse(text) as Record<string, unknown>, statusCode: res.status, error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { data: null, statusCode: 500, error: msg };
  }
}

// Main handler
serve(async (req: Request) => {
  // ── 鉴权 ──────────────────────────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const validSecret = Deno.env.get('REPORT_SECRET');

  if (!token || token !== validSecret) {
    return new Response(
      JSON.stringify({ success: false, error: 'Unauthorized: invalid or missing token' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }
  // ── 鉴权通过 ────────────────────────────────────────────────────────────────

  try {
    // Get API keys from environment
    const { apiKey, xApiKey, xApiSecret } = getApiKeys();

    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'AYRSHARE_API_KEY not configured. Set it with: supabase secrets set AYRSHARE_API_KEY=xxx' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const options: GetAyrshareAnalyticsOptions = await req.json();
    const {
      profileKeys,
      lastDays = 7,
      startDate: optionStartDate,
      endDate: optionEndDate,
      mode = 'full',
      lastFetchDate,
    } = options;

    if (!profileKeys || profileKeys.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'No profile keys provided' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // ── 初始化缓存 ────────────────────────────────────────────────────────────
    const supabase = createCacheClient();

    const endDate = optionEndDate || new Date().toISOString().split('T')[0];
    const startDate = optionStartDate || new Date(Date.now() - lastDays * 86400000).toISOString().split('T')[0];

    const result: GetAyrshareAnalyticsResult = {
      success: true,
      mode,
      cacheStats: { enabled: !!supabase, cachedSkipped: 0, newlyFetched: 0 },
      historyPosts: [],
      testedPosts: [],
      summaries: [],
      platformMetrics: {},
      overallMetrics: {
        totalPosts: 0, totalViews: 0, totalLikes: 0, totalComments: 0,
        totalShares: 0, totalSaves: 0, totalClicks: 0, totalReach: 0,
        totalImpressions: 0, totalEngagement: 0, avgEngagementRate: 0,
        paidImpressions: 0, organicImpressions: 0,
      },
      errors: [],
      warnings: [],
    };

    let totalCachedSkipped = 0;
    let totalNewlyFetched = 0;

    const platformMetricsAccum: Record<string, {
      views: number; likes: number; comments: number; shares: number;
      clicks: number; reach: number; impressions: number;
      totalEngagement: number; followers: number;
      paidImpressions: number; organicImpressions: number; posts: number;
    }> = {};

    const PLATFORM_LABELS: Record<string, string> = {
      linkedin: 'LinkedIn', instagram: 'Instagram', youtube: 'YouTube',
      twitter: 'X', tiktok: 'TikTok', facebook: 'Facebook',
    };

    // Process each profile key
    for (const profileKey of profileKeys) {
      const key = String(profileKey).trim();
      if (!key) continue;

      // Step 1: Fetch history
      const historyResult = await fetchHistory(apiKey, xApiKey, xApiSecret, key, startDate, endDate, 100);
      
      if (historyResult.error) {
        result.errors.push(`[${key}] History error: ${historyResult.error}`);
        continue;
      }

      result.historyPosts.push(...historyResult.posts);

      // ── STEP 2: Fetch social analytics (summary) — 始终全量获取 ──────────────
      const socialResult = await fetchSocialAnalytics(apiKey, xApiKey, xApiSecret, key, startDate, endDate);

      if (socialResult.data) {
        for (const [platform, value] of Object.entries(socialResult.data)) {
          if (!value || typeof value !== 'object') continue;
          const container = value as Record<string, unknown>;
          const analytics = (container['analytics'] ?? container) as Record<string, unknown>;

          const likes = n(analytics['likeCount']) || n(analytics['likes']) || 0;
          const comments = n(analytics['commentCount']) || n(analytics['comments']) || 0;
          const shares = n(analytics['shareCount']) || n(analytics['shares']) || 0;
          const impressions = n(analytics['impressions']) || 0;
          const totalEng = likes + comments + shares;
          const avgER = impressions > 0 ? (totalEng / impressions) * 100 : 0;

          if (!platformMetricsAccum[platform]) {
            platformMetricsAccum[platform] = {
              views: 0, likes: 0, comments: 0, shares: 0, clicks: 0,
              reach: 0, impressions: 0, totalEngagement: 0, followers: 0,
              paidImpressions: 0, organicImpressions: 0, posts: 0,
            };
          }

          const acc = platformMetricsAccum[platform];
          const viewsSource = platform === 'tiktok'
            ? analytics['viewCountTotal']
            : (analytics['pageMediaView'] || analytics['viewCount']);
          acc.views += n(viewsSource) || 0;
          acc.likes += likes;
          acc.comments += comments;
          acc.shares += shares;
          acc.impressions += impressions;
          acc.totalEngagement += totalEng;
          acc.paidImpressions += n(analytics['pagePostsImpressionsPaid']) || 0;
          acc.organicImpressions += n(analytics['pagePostsImpressionsNonviral']) || 0;
          const followersSource = platform === 'tiktok'
            ? analytics['followerCount']
            : (analytics['followersCount'] || analytics['fanCount']);
          acc.followers += n(followersSource) || 0;
          acc.posts += 1;

          result.summaries.push({
            profileKey: key,
            platform,
            totalPosts: 1,
            totalViews: n(viewsSource) || 0,
            totalLikes: likes,
            totalComments: comments,
            totalShares: shares,
            totalClicks: n(analytics['clickCount']) || n(analytics['clicks']) || 0,
            totalReach: n(analytics['reach']) || 0,
            totalImpressions: impressions,
            avgEngagementRate: avgER,
            followers: n(followersSource) || 0,
          });
        }
      }

      // ── 增量/刷新模式：过滤已缓存的帖子 ────────────────────────────────
      let postsToFetch = historyResult.posts;
      let cachedCount = 0;
      const fetchedAt = new Date().toISOString();

      if (mode === 'incremental' && supabase) {
        // 增量模式：跳过已缓存的帖子
        const cachedIds = await getCachedPostIds(supabase, key);
        const before = postsToFetch.length;
        if (lastFetchDate) {
          // 同时过滤 lastFetchDate 之后新建的帖子
          postsToFetch = postsToFetch.filter(p =>
            !cachedIds.has(p.id) &&
            (!p.created || p.created > lastFetchDate)
          );
        } else {
          postsToFetch = postsToFetch.filter(p => !cachedIds.has(p.id));
        }
        cachedCount = before - postsToFetch.length;
        if (cachedCount > 0) {
          result.warnings.push(`[${key}] Incremental: skipped ${cachedCount} cached posts`);
        }
      } else if (mode === 'refresh' && supabase) {
        // 刷新模式：跳过所有已缓存帖子
        const cachedIds = await getCachedPostIds(supabase, key);
        const before = postsToFetch.length;
        postsToFetch = postsToFetch.filter(p => !cachedIds.has(p.id));
        cachedCount = before - postsToFetch.length;
        if (cachedCount > 0) {
          result.warnings.push(`[${key}] Refresh: skipped ${cachedCount} cached posts`);
        }
      }

      totalCachedSkipped += cachedCount;

      const successfulToFetch = postsToFetch.filter(p => p.status !== 'error');
      if (successfulToFetch.length === 0) {
        const skipMsg = cachedCount > 0
          ? `All ${cachedCount} posts skipped (cached/incremental mode)`
          : `No successful posts to fetch in range`;
        result.warnings.push(`Profile ${key}: ${skipMsg}`);
        continue;
      }

      // ── STEP 3: 分批并发抓取帖子分析数据 ────────────────────────────────
      console.log(`[${key}] Fetching ${successfulToFetch.length} posts (batch size=${BATCH_SIZE}, mode=${mode})...`);

      // 将帖子分批
      const batches: HistoryPost[][] = [];
      for (let i = 0; i < successfulToFetch.length; i += BATCH_SIZE) {
        batches.push(successfulToFetch.slice(i, i + BATCH_SIZE));
      }

      const newCacheEntries: PostCacheEntry[] = [];

      for (let b = 0; b < batches.length; b++) {
        const batch = batches[b];
        // 当前批次并发请求
        const batchResults = await Promise.all(
          batch.map(async (post) => {
            const platforms = post.platforms.filter(Boolean);
            const pr = await fetchPostAnalytics(apiKey, xApiKey, xApiSecret, post.id, key, platforms);
            return { post, platforms, pr };
          })
        );

        for (const { post, platforms, pr } of batchResults) {
          result.testedPosts.push({
            postId: post.id,
            profileKey: key,
            platforms,
            httpStatus: pr.statusCode,
            responseBody: JSON.stringify(pr.data),
            success: pr.data !== null,
            errorMessage: pr.error || undefined,
          });

          // 缓存该帖子
          newCacheEntries.push({
            post_id: post.id,
            profile_key: key,
            created: post.created || '',
            fetched_at: fetchedAt,
          });
        }

        // 批次间延迟
        if (b < batches.length - 1) {
          await sleep(BATCH_DELAY_MS);
        }
      }

      // 更新缓存
      if (supabase && newCacheEntries.length > 0) {
        await upsertCacheEntries(supabase, newCacheEntries);
        console.log(`[${key}] Cached ${newCacheEntries.length} posts`);
      }

      totalNewlyFetched += successfulToFetch.length;
    }

    // Build platform metrics
    for (const [platform, acc] of Object.entries(platformMetricsAccum)) {
      const avgER = acc.impressions > 0
        ? Math.round((acc.totalEngagement / acc.impressions) * 10000) / 100
        : 0;

      result.platformMetrics[platform] = {
        platform,
        label: PLATFORM_LABELS[platform] || platform,
        posts: acc.posts,
        views: acc.views,
        likes: acc.likes,
        comments: acc.comments,
        shares: acc.shares,
        saves: 0,
        clicks: acc.clicks,
        reach: acc.reach,
        impressions: acc.impressions,
        totalEngagement: acc.totalEngagement,
        avgEngagementRate: avgER,
        followers: acc.followers,
        paidImpressions: acc.paidImpressions,
        organicImpressions: acc.organicImpressions,
      };

      // Accumulate overall metrics
      result.overallMetrics.totalPosts += acc.posts;
      result.overallMetrics.totalViews += acc.views;
      result.overallMetrics.totalLikes += acc.likes;
      result.overallMetrics.totalComments += acc.comments;
      result.overallMetrics.totalShares += acc.shares;
      result.overallMetrics.totalImpressions += acc.impressions;
      result.overallMetrics.totalEngagement += acc.totalEngagement;
      result.overallMetrics.paidImpressions += acc.paidImpressions;
      result.overallMetrics.organicImpressions += acc.organicImpressions;
    }

    // Calculate overall engagement rate
    if (result.overallMetrics.totalImpressions > 0) {
      result.overallMetrics.avgEngagementRate = Math.round(
        (result.overallMetrics.totalEngagement / result.overallMetrics.totalImpressions) * 10000
      ) / 100;
    }

    // 更新缓存统计
    result.cacheStats = {
      enabled: !!supabase,
      cachedSkipped: totalCachedSkipped,
      newlyFetched: totalNewlyFetched,
    };

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});