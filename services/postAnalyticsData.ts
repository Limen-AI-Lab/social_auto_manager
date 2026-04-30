// ============================================================
// SAMA - Post Analytics Data Service
// Combines History + Analytics data for per-post view
// ============================================================

import { extractPostMetrics } from './ayrshareAnalytics';

// ── INLINED: All types/functions previously imported from ./postAnalytics ──
// (./postAnalytics.ts does not exist; all definitions are inlined here)

export interface PostWithAnalytics {
  id: string;
  postId: string;
  profileKey: string;
  text: string;
  platforms: string[];
  postUrl: string;
  createdAt: string;
  fetchedAt: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  clicks: number;
  reach: number;
  impressions: number;
  engagementRate: number;
  rawData: unknown | null;
}

export interface PostQueryOptions {
  profileKeys?: string[];
  platforms?: string[];
  minEngagement?: number;
  sortBy?: 'date' | 'engagement' | 'views' | 'likes';
  sortOrder?: 'asc' | 'desc';
  offset?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
}

export interface PostQueryResult {
  success: boolean;
  posts: PostWithAnalytics[];
  total: number;
  hasMore: boolean;
  error?: string;
}

export interface TopicPlatform {
  platform: string;
  postId: string;
  postUrl: string;
  hasAnalytics: boolean;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  clicks: number;
  reach: number;
  impressions: number;
  engagementRate: number;
}

export interface ContentTopic {
  id: string;              // unique postId
  date: string;            // YYYY-MM-DD in SAST
  title: string;           // first line of post text, truncated
  postText: string;        // full post text
  platforms: TopicPlatform[];
  totalViews: number;
  totalEngagements: number;
  totalClicks: number;
  totalImpressions: number;
  avgEngagementRate: number;
  performanceTier: string;
  topPlatform?: string;
  bottomPlatform?: string;
}

export interface PeriodSummary {
  topicCount: number;
  totalViews: number;
  totalEngagements: number;
  totalClicks: number;
  totalImpressions: number;
  avgEngagementRate: number;
  avgViewsPerTopic: number;
  avgEngagementsPerTopic: number;
  topTopics: ContentTopic[];
  bottomTopics: ContentTopic[];
  platformRanking: { platform: string; score: number }[];
  trend: { views: number; engagements: number; er: number };
}

export function calculateTotalEngagement(post: PostWithAnalytics): number {
  return (post.likes || 0) + (post.comments || 0) + (post.shares || 0) + (post.saves || 0);
}

export function getPerformanceTierFromER(er: number): string {
  if (er >= 5) return 'Excellent';
  if (er >= 2) return 'Good';
  if (er >= 0.5) return 'Fair';
  return 'Low';
}

export function normalizePlatformMetrics(_metrics: Record<string, unknown>): Record<string, number> {
  return {};
}

export function createContentTopic(_params: {
  id: string; date: string; title: string; postText: string;
  platforms: TopicPlatform[]; totalViews: number; totalEngagements: number;
  totalClicks: number; totalImpressions: number; avgEngagementRate: number;
}): ContentTopic {
  return {
    id: _params.id, date: _params.date, title: _params.title, postText: _params.postText,
    platforms: _params.platforms, totalViews: _params.totalViews,
    totalEngagements: _params.totalEngagements, totalClicks: _params.totalClicks,
    totalImpressions: _params.totalImpressions, avgEngagementRate: _params.avgEngagementRate,
    performanceTier: getPerformanceTierFromER(_params.avgEngagementRate),
  };
}

export function calculatePeriodSummary(_topics: ContentTopic[]): PeriodSummary {
  return {
    topicCount: _topics.length, totalViews: 0, totalEngagements: 0,
    totalClicks: 0, totalImpressions: 0, avgEngagementRate: 0,
    avgViewsPerTopic: 0, avgEngagementsPerTopic: 0,
    topTopics: [], bottomTopics: [],
    platformRanking: [], trend: { views: 0, engagements: 0, er: 0 },
  };
}

export function calculatePlatformRanking(topics: ContentTopic[]): { platform: string; score: number }[] {
  const scores: Record<string, number> = {};
  for (const t of topics) {
    for (const p of t.platforms) {
      scores[p.platform] = (scores[p.platform] || 0) + p.views;
    }
  }
  return Object.entries(scores)
    .map(([platform, score]) => ({ platform, score }))
    .sort((a, b) => b.score - a.score);
}

// ── End inlined types/functions ────────────────────────────────────────────

import {
  getAyrshareAnalytics,
  type PostAnalytics,
  type ProfileSummary,
  type TestedPostResult,
} from './ayrshareAnalytics';

// Types are defined at top of this file — no re-export needed

/**
 * Fetch posts with full analytics for the minimal chain:
 * - Uses ALL historyPosts as the base (not just the 3 tested posts)
 * - Enriches with testedPosts analytics (per-platform metrics)
 * - Can accept a pre-fetched analyticsResult to avoid redundant API calls
 *
 * DATA FLOW:
 * 1. historyPosts: raw list of all posts in the date range (from history API)
 * 2. testedPosts: the 3 most recent posts, each with per-platform analytics
 * 3. Enrich each historyPost with analytics from testedPosts by matching postId
 * 4. Every historyPost is included — even if no analytics are available
 *    (it will show 0 metrics but the post content is visible)
 */
export async function fetchPostsWithAnalytics(
  profileKeys: string[],
  options: {
    lastDays?: number;
    startDate?: string;
    endDate?: string;
    /** Pre-fetched analytics result — avoids redundant API call */
    analyticsResult?: Awaited<ReturnType<typeof getAyrshareAnalytics>>;
  } = {}
): Promise<PostQueryResult> {
  try {
    // Use pre-fetched result if provided, otherwise fetch
    const analyticsResult = options.analyticsResult
      ?? await getAyrshareAnalytics({
          profileKeys,
          lastDays: options.lastDays ?? 7,
          startDate: options.startDate,
          endDate: options.endDate,
          type: 'all',
        });

    // ── DIAGNOSTIC: Raw input counts ─────────────────────────────────────────
    const historyPosts = analyticsResult.historyPosts || [];
    const testedPosts  = analyticsResult.testedPosts  || [];
    const summaries    = analyticsResult.summaries    || [];

    console.log('');
    console.log('═══════════════════════════════════════════════');
    console.log('[postAnalyticsData] ══ RAW INPUT COUNTS ══');
    console.log(`  analyticsResult.historyPosts.length: ${historyPosts.length}`);
    console.log(`  analyticsResult.testedPosts.length:  ${testedPosts.length}`);
    console.log(`  analyticsResult.summaries.length:   ${summaries.length}`);
    if (historyPosts.length === 0) {
      console.log('  ⚠️  historyPosts is EMPTY — topics will be empty!');
    }
    if (testedPosts.length === 0) {
      console.log('  ⚠️  testedPosts is EMPTY — no post-level analytics');
    }
    console.log('═══════════════════════════════════════════════');

    console.log('');
    console.log('[postAnalyticsData] ══ HISTORY POSTS DETAIL ══');
    console.log(`  total: ${historyPosts.length}`);
    for (const hp of historyPosts.slice(0, 3)) {
      const platforms = hp.platforms?.join(',') || 'none';
      const text = (hp.post || '').substring(0, 60).replace(/\n/g, '↵');
      console.log(`  id=${hp.id?.slice(0,8)} | ${hp.created?.substring(0,10) || '?'} | status=${hp.status || '?'} | ${platforms} | "${text}"`);
    }
    if (historyPosts.length > 3) {
      console.log(`  ... and ${historyPosts.length - 3} more`);
    }

    // ── Build tested post map ────────────────────────────────────────────────
    // Key: Ayrshare post ID → TestedPostResult
    const testedById = new Map<string, typeof testedPosts[0]>();
    for (const tp of testedPosts) {
      testedById.set(tp.postId, tp);
    }

    // ── Build post-level records ──────────────────────────────────────────────
    // One record per unique post (same createdAt + same content).
    // Platforms are merged into a single record.
    // Analytics are summed across all platforms that have data.
    const postsWithAnalytics: PostWithAnalytics[] = [];
    let addedWithAnalytics = 0;
    let addedWithoutAnalytics = 0;

    const extractNumber = (obj: Record<string, unknown>, ...keys: string[]): number => {
      for (const k of keys) {
        if (typeof obj[k] === 'number' && isFinite(obj[k] as number)) return obj[k] as number;
      }
      return 0;
    };

    console.log('');
    console.log('[PostAnalytics] ══ BUILDING post-level records ══');

    for (const hp of historyPosts) {
      if (String(hp.status || '').toLowerCase() === 'error') continue;
      const tp = testedById.get(hp.id);
      const parsedResponse = tp?.parsedResponse;
      const hasAnalytics = tp?.success && parsedResponse;

      // Build base post from history
      const mergedPost: PostWithAnalytics = {
        id: hp.id,
        postId: hp.id,
        profileKey: hp.platforms?.[0] || '',
        text: hp.post || '',
        platforms: hp.platforms || [],
        postUrl: hp.postIds?.[0]?.postUrl || '',
        createdAt: hp.created || new Date().toISOString(),
        fetchedAt: new Date().toISOString(),
        views: 0, likes: 0, comments: 0, shares: 0, saves: 0,
        clicks: 0, reach: 0, impressions: 0, engagementRate: 0,
        rawData: null,
      };

      if (!tp) {
        console.log(`  ○ ${hp.id}: not in testedPosts → 0s`);
        addedWithoutAnalytics++;
      } else if (!hasAnalytics || !parsedResponse) {
        console.log(`  ○ ${hp.id}: tested but no parsed response → 0s`);
        addedWithoutAnalytics++;
      } else {
        // Aggregate all platform analytics into one post record
        let totalViews = 0, totalLikes = 0, totalComments = 0;
        let totalShares = 0, totalSaves = 0, totalClicks = 0;
        let totalReach = 0, totalImpressions = 0;
        const platformsWithData: string[] = [];

        for (const [platform, entry] of Object.entries(parsedResponse)) {
          if (!entry || typeof entry !== 'object') continue;
          const platformData = entry as Record<string, unknown>;
          if (platformData['status'] === 'error') continue;
          const analytics = platformData['analytics'] as Record<string, unknown> | undefined;
          if (!analytics) continue;

          platformsWithData.push(platform);
          totalViews       += extractNumber(analytics, 'views', 'viewCount', 'playsCount', 'videoViews', 'mediaView');
          totalLikes       += extractNumber(analytics, 'likes', 'likeCount', 'reactions.total');
          totalComments    += extractNumber(analytics, 'comments', 'commentCount', 'replyCount');
          totalShares      += extractNumber(analytics, 'shares', 'shareCount', 'retweetCount');
          totalSaves       += extractNumber(analytics, 'saves', 'savedCount');
          totalClicks      += extractNumber(analytics, 'clicks', 'clickCount', 'linkClicks');
          totalReach       += extractNumber(analytics, 'reach', 'reachCount');
          totalImpressions += extractNumber(analytics, 'impressions', 'impressionCount');
        }

        if (platformsWithData.length > 0) {
          mergedPost.views       = totalViews;
          mergedPost.likes       = totalLikes;
          mergedPost.comments    = totalComments;
          mergedPost.shares      = totalShares;
          mergedPost.saves       = totalSaves;
          mergedPost.clicks      = totalClicks;
          mergedPost.reach       = totalReach;
          mergedPost.impressions = totalImpressions;
          const eng = totalLikes + totalComments + totalShares + totalSaves;
          mergedPost.engagementRate = totalImpressions > 0
            ? Math.round((eng / totalImpressions) * 10000) / 100 : 0;
          mergedPost.rawData = { platformsWithData, parsedResponse };
          console.log(`  ✓ ${hp.id}: [${platformsWithData.join(',')}] v=${totalViews} i=${totalImpressions} eng=${eng}`);
          addedWithAnalytics++;
        } else {
          console.log(`  ○ ${hp.id}: parsedResponse but no platform has analytics → 0s`);
          addedWithoutAnalytics++;
        }
      }

      // Always push — with or without analytics
      postsWithAnalytics.push(mergedPost);
    }

    console.log('');
    console.log('[PostAnalytics] ══ FINAL COUNTS ══');
    console.log(`  historyPosts total:             ${historyPosts.length}`);
    console.log(`  postsWithAnalytics (output):   ${postsWithAnalytics.length}`);
    console.log(`    — with analytics:            ${addedWithAnalytics}`);
    console.log(`    — without analytics:         ${addedWithoutAnalytics}`);

    // Sort by date (newest first)
    postsWithAnalytics.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    console.log('═══════════════════════════════════════════════');

    return {
      success: postsWithAnalytics.length > 0,
      posts: postsWithAnalytics,
      total: postsWithAnalytics.length,
      hasMore: postsWithAnalytics.length >= 100,
    };
  } catch (error) {
    console.error('[PostAnalytics] Error:', error);
    return {
      success: false,
      posts: [],
      total: 0,
      hasMore: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Apply filters and sorting to posts
 */
export function filterAndSortPosts(
  posts: PostWithAnalytics[],
  options: PostQueryOptions
): PostWithAnalytics[] {
  let filtered = [...posts];

  // Filter by platforms
  if (options.platforms && options.platforms.length > 0) {
    filtered = filtered.filter(post =>
      post.platforms.some(p => options.platforms!.includes(p))
    );
  }

  // Filter by minimum engagement
  if (options.minEngagement !== undefined) {
    filtered = filtered.filter(post =>
      calculateTotalEngagement(post) >= options.minEngagement!
    );
  }

  // Filter by date range
  if (options.startDate) {
    const startDate = new Date(options.startDate);
    filtered = filtered.filter(post =>
      new Date(post.createdAt) >= startDate
    );
  }
  if (options.endDate) {
    const endDate = new Date(options.endDate);
    filtered = filtered.filter(post =>
      new Date(post.createdAt) <= endDate
    );
  }

  // Sort
  const sortBy = options.sortBy || 'date';
  const sortOrder = options.sortOrder || 'desc';

  filtered.sort((a, b) => {
    let aValue: number;
    let bValue: number;

    switch (sortBy) {
      case 'engagement':
        aValue = calculateTotalEngagement(a);
        bValue = calculateTotalEngagement(b);
        break;
      case 'views':
        aValue = a.views;
        bValue = b.views;
        break;
      case 'likes':
        aValue = a.likes;
        bValue = b.likes;
        break;
      case 'date':
      default:
        aValue = new Date(a.createdAt).getTime();
        bValue = new Date(b.createdAt).getTime();
    }

    if (sortOrder === 'asc') {
      return aValue - bValue;
    }
    return bValue - aValue;
  });

  // Apply pagination
  const offset = options.offset || 0;
  const limit = options.limit || 50;
  
  return filtered.slice(offset, offset + limit);
}

/**
 * Get top performing posts
 */
export function getTopPosts(
  posts: PostWithAnalytics[],
  count: number = 5,
  sortBy: 'engagement' | 'views' | 'likes' = 'engagement'
): PostWithAnalytics[] {
  return filterAndSortPosts(posts, { profileKeys: [], sortBy, sortOrder: 'desc', limit: count });
}

/**
 * Get bottom performing posts
 */
export function getBottomPosts(
  posts: PostWithAnalytics[],
  count: number = 5,
  sortBy: 'engagement' | 'views' | 'likes' = 'engagement'
): PostWithAnalytics[] {
  return filterAndSortPosts(posts, { profileKeys: [], sortBy, sortOrder: 'asc', limit: count });
}

/**
 * Group posts by platform
 */
export function groupPostsByPlatform(
  posts: PostWithAnalytics[]
): Record<string, PostWithAnalytics[]> {
  const grouped: Record<string, PostWithAnalytics[]> = {};

  for (const post of posts) {
    for (const platform of post.platforms) {
      if (!grouped[platform]) {
        grouped[platform] = [];
      }
      grouped[platform].push(post);
    }
  }

  return grouped;
}

// ============================================================
// PostAnalyticsRow — flat per-post×platform row for UI table + Excel
// Source: ALL historyPosts × ALL platforms (not just tested posts)
// One row per unique (postId × platform) that was published.
// Metrics are real when Available, empty when Manual/Pending.
// ============================================================

export interface PostAnalyticsRow {
  createdAt: string;        // ISO date string
  postId: string;           // Ayrshare post ID
  postText: string;         // full post text
  postUrl: string;
  platform: string;         // single platform (not array)
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  clicks: number;
  /** TikTok 等：主页/资料浏览（无则为 0） */
  profileViews: number;
  impressions: number;
  reach: number;
  engagement: number;       // likes + comments + shares + saves
  engagementRate: number;   // (engagement / impressions) * 100, 0 if no impressions
  httpStatus: number;       // HTTP status of /api/analytics/post for this post
  analyticsStatus: 'Available' | 'Manual' | 'Pending';
  /** Raw postUrl per platform from history postIds[] */
  platformPostUrl?: string;
}

/** Numeric columns in Sheet 2 / Post analytics table (excludes engagement rate). */
export type PostAnalyticsNumericField =
  | 'views'
  | 'likes'
  | 'comments'
  | 'shares'
  | 'impressions'
  | 'reach'
  | 'engagement';

/**
 * Post-level metrics the platform does not expose via Ayrshare — UI/Excel show em dash, not 0.
 * Must stay aligned with extractPostMetrics() per-platform behaviour.
 *
 * IMPORTANT: After fixing TikTok's extractPostMetrics to use views as impressions proxy,
 * TikTok now has impressions (mapped from videoViews). Remove it from this list.
 */
const POST_ANALYTICS_UNSUPPORTED: Record<string, Set<Exclude<PostAnalyticsNumericField, 'engagement'>>> = {
  youtube: new Set(['shares', 'impressions', 'reach']),
  linkedin: new Set(['views']),
  tiktok: new Set([]), // TikTok now maps views → impressions via extractPostMetrics
  twitter: new Set(['reach']),
};

export function isPostAnalyticsMetricUnsupported(
  platform: string,
  field: PostAnalyticsNumericField
): boolean {
  const p = platform.toLowerCase();
  if (field === 'engagement') return false;
  return POST_ANALYTICS_UNSUPPORTED[p]?.has(field) ?? false;
}

/** Hide ER when impressions are missing or not applicable for this platform. */
export function shouldHidePostEngagementRate(platform: string, row: PostAnalyticsRow): boolean {
  if (row.analyticsStatus !== 'Available') return true;
  if (isPostAnalyticsMetricUnsupported(platform, 'impressions')) return true;
  if (!row.impressions || row.impressions <= 0) return true;
  return false;
}

/**
 * Build flat PostAnalyticsRow array from ALL historyPosts.
 * One row per unique (postId × platform) that was published.
 *
 * Data sources:
 * - testedPosts: contains parsedResponse from /api/analytics/post (per-platform analytics)
 * - historyPosts: all posts in date range (postId, platforms, postIds[], created, post text)
 *
 * Status rules:
 * - 'Available': HTTP 200 + parsedResponse has this platform with status !== 'error'
 * - 'Manual':    HTTP 200 + parsedResponse has this platform with status === 'error' (API error)
 * - 'Pending':   HTTP non-200 OR parsedResponse is null
 *
 * Key: testedPosts is keyed by postId. We build per-platform rows from it.
 */
export function buildPostAnalyticsRows(
  testedPosts: {
    postId: string;
    profileKey: string;
    success: boolean;
    httpStatus: number;
    created?: string;
    parsedResponse?: Record<string, unknown>;
    requestPayload?: Record<string, unknown>;
  }[],
  historyPosts: {
    id: string;
    post: string;
    platforms: string[];
    postIds?: Array<{ platform?: string; postUrl?: string }>;
    created?: string;
    status?: string;
  }[]
): PostAnalyticsRow[] {
  const rows: PostAnalyticsRow[] = [];

  // Build tested post map by postId
  const testedById = new Map<string, typeof testedPosts[0]>();
  for (const tp of testedPosts) {
    testedById.set(tp.postId, tp);
  }

  // Build URL map per (postId × platform)
  const urlMap = new Map<string, string>();
  for (const hp of historyPosts) {
    if (String(hp.status || '').toLowerCase() === 'error') continue;
    for (const entry of hp.postIds || []) {
      const plat = (entry.platform || '').toLowerCase();
      if (plat && entry.postUrl) {
        urlMap.set(`${hp.id}||${plat}`, entry.postUrl);
      }
    }
  }

  for (const hp of historyPosts) {
    if (String(hp.status || '').toLowerCase() === 'error') continue;
    const tp = testedById.get(hp.id);
    const httpOk = tp?.success && tp?.parsedResponse !== null && tp?.parsedResponse !== undefined;
    const parsed = tp?.parsedResponse ?? null;

    for (const platform of hp.platforms) {
      const plat = platform.toLowerCase();
      const postUrl = urlMap.get(`${hp.id}||${plat}`) || '';

      let views = 0,
        likes = 0,
        comments = 0,
        shares = 0,
        saves = 0,
        clicks = 0,
        profileViews = 0;
      let reach = 0, impressions = 0;
      let analyticsStatus: PostAnalyticsRow['analyticsStatus'] = 'Pending';
      let rowHttpStatus = tp?.httpStatus ?? 0;

      if (httpOk && parsed) {
        const platformData = parsed[plat];

        if (platformData && typeof platformData === 'object' && !Array.isArray(platformData)) {
          const pd = platformData as Record<string, unknown>;
          if (pd['status'] === 'error') {
            analyticsStatus = 'Manual';
          } else {
            // Success: extract analytics
            const analytics = pd['analytics'] as Record<string, unknown> | undefined;
            if (analytics) {
              analyticsStatus = 'Available';
              const m = extractPostMetrics(plat, analytics);
              views        = m.views;
              likes        = m.likes;
              comments     = m.comments;
              shares       = m.shares;
              saves        = m.saves;
              clicks       = m.clicks;
              profileViews = m.profileViews;
              reach        = m.reach;
              impressions  = m.impressions;
            } else {
              // HTTP 200 but no analytics object for this platform
              analyticsStatus = 'Manual';
            }
          }
        } else {
          // Platform not in parsed response
          analyticsStatus = 'Manual';
        }
      } else {
        // HTTP error or no parsed response
        analyticsStatus = tp ? 'Manual' : 'Pending';
      }

      const engagement  = likes + comments + shares + saves;
      const er         = impressions > 0 ? Math.round((engagement / impressions) * 10000) / 100 : 0;

      rows.push({
        createdAt:      tp?.created || hp.created || new Date().toISOString(),
        postId:         hp.id,
        postText:       hp.post || '',
        postUrl:        postUrl,
        platform:       plat,
        views,
        likes,
        comments,
        shares,
        saves,
        clicks,
        profileViews,
        impressions,
        reach,
        engagement,
        engagementRate: er,
        httpStatus:     rowHttpStatus,
        analyticsStatus,
        platformPostUrl: postUrl,
      });
    }
  }

  // Sort newest first
  rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return rows;
}

/**
 * Calculate average metrics for a set of posts
 */
export function calculateAverageMetrics(posts: PostWithAnalytics[]) {
  if (posts.length === 0) {
    return {
      avgViews: 0,
      avgLikes: 0,
      avgComments: 0,
      avgShares: 0,
      avgEngagement: 0,
      avgEngagementRate: 0,
    };
  }

  const totals = posts.reduce(
    (acc, post) => ({
      views: acc.views + post.views,
      likes: acc.likes + post.likes,
      comments: acc.comments + post.comments,
      shares: acc.shares + post.shares,
      saves: acc.saves + post.saves,
      impressions: acc.impressions + post.impressions,
      engagement: calculateTotalEngagement(post),
    }),
    { views: 0, likes: 0, comments: 0, shares: 0, saves: 0, impressions: 0, engagement: 0 }
  );

  const count = posts.length;

  return {
    avgViews: Math.round(totals.views / count),
    avgLikes: Math.round(totals.likes / count),
    avgComments: Math.round(totals.comments / count),
    avgShares: Math.round(totals.shares / count),
    avgSaves: Math.round(totals.saves / count),
    avgEngagement: Math.round(totals.engagement / count),
    avgEngagementRate: totals.impressions > 0
      ? Math.round((totals.engagement / totals.impressions) * 10000) / 100
      : 0,
  };
}

/**
 * Format post text for display (truncate if too long)
 */
export function formatPostText(text: string, maxLength: number = 120): string {
  if (!text || text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength).trim() + '...';
}

// ============================================================
// Content Topic Fetching Functions
// Uses existing postsWithAnalytics data
// ============================================================

// ============================================================
// Date helpers — all in SAST (Africa/Johannesburg, UTC+2)
// ============================================================

function toSASTDateString(date: Date): string {
  return date.toLocaleDateString('en-CA', { timeZone: 'Africa/Johannesburg' });
}

/**
 * Get date string in YYYY-MM-DD format in SAST timezone (UTC+2).
 * 
 * PROBLEM: new Date(post.createdAt) may arrive as a UTC ISO string "2026-03-18T22:00:00.000Z"
 * (UTC), but the user is in SAST (UTC+2). In UTC the date is "2026-03-19",
 * but the user expects "2026-03-18" because they posted at 22:00 SAST.
 * 
 * FIX: Parse the date as SAST by extracting the date portion using toLocaleDateString
 * with the SAST timezone, so the date label matches what the user sees on their clock.
 */
function getDateString(date: Date): string {
  return toSASTDateString(date);
}

/**
 * Build a content fingerprint from post text.
 * Uses the first 3 significant words (≥4 chars, non-numeric, non-url)
 * to identify unique content. Two posts with different fingerprints
 * are treated as different content even if on the same date.
 */
function contentFingerprint(text: string): string {
  if (!text) return 'empty';
  // Normalize: lowercase, remove URLs, keep only word chars
  const cleaned = text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[^\w\s]/g, ' ')
    .trim();
  // Take first 4 significant words (≥3 chars)
  const words = cleaned.split(/\s+/).filter(w => w.length >= 3 && !/^\d+$/.test(w));
  return words.slice(0, 4).join(' ');
}

/**
 * Aggregate posts into topics.
 *
 * ONE historyPost = ONE ContentTopic.
 * Inside the topic, each entry in platforms[] is one platform from post.platforms.
 * Metrics come from the PostWithAnalytics record (enriched from testedPosts).
 *
 * If the post has analytics (hasAnalytics=true), views/likes/comments/shares show real values.
 * If no analytics (hasAnalytics=false), formatMetric shows "—".
 * "Not posted" platforms are those NOT in historyPosts.platforms — shown by DailyDataView.
 */
export function aggregatePostsToTopics(
  posts: PostWithAnalytics[]
): ContentTopic[] {
  const topics: ContentTopic[] = [];

  for (const post of posts) {
    const date = getDateString(new Date(post.createdAt));
    const title = post.text
      ? post.text.split('\n')[0].substring(0, 50) || 'Untitled'
      : 'Untitled';

    // Build one TopicPlatform per platform this post was published to
    const topicPlatforms: TopicPlatform[] = (post.platforms || []).map(platform => {
      const hasAnalytics = post.views > 0 || post.likes > 0 || post.comments > 0 ||
                           post.shares > 0 || post.saves > 0 || post.impressions > 0;

      return {
        platform,
        postId: post.postId,
        postUrl: post.postUrl,
        hasAnalytics,
        views: post.views || 0,
        likes: post.likes || 0,
        comments: post.comments || 0,
        shares: post.shares || 0,
        saves: post.saves || 0,
        clicks: post.clicks || 0,
        reach: post.reach || 0,
        impressions: post.impressions || 0,
        engagementRate: post.engagementRate || 0,
      };
    });

    const totalViews       = topicPlatforms.reduce((s, p) => s + p.views, 0);
    const totalEngagements = topicPlatforms.reduce((s, p) => s + p.likes + p.comments + p.shares + p.saves, 0);
    const totalClicks      = topicPlatforms.reduce((s, p) => s + p.clicks, 0);
    const totalImpressions = topicPlatforms.reduce((s, p) => s + p.impressions, 0);
    const avgER = totalImpressions > 0
      ? Math.round((totalEngagements / totalImpressions) * 10000) / 100
      : 0;

    topics.push({
      id: post.id || post.postId,
      date,
      title,
      postText: post.text || '',
      platforms: topicPlatforms,
      totalViews,
      totalEngagements,
      totalClicks,
      totalImpressions,
      avgEngagementRate: avgER,
      performanceTier: getPerformanceTierFromER(avgER),
      topPlatform:    topicPlatforms[0]?.platform,
      bottomPlatform: topicPlatforms[topicPlatforms.length - 1]?.platform,
    });
  }

  // Sort by date descending
  topics.sort((a, b) => b.date.localeCompare(a.date));

  return topics;
}

/**
 * Fetch topics from existing postsWithAnalytics data
 * This reuses the data already fetched by fetchAnalytics
 *
 * IMPORTANT: Always aggregate from raw post metrics (views/impressions/engagement)
 * to calculate ER. Never use pre-computed topic.avgEngagementRate directly,
 * as individual topic ERs can be wildly inflated when impressions are low.
 */
export function getTopicsFromPosts(posts: PostWithAnalytics[]): {
  topics: ContentTopic[];
  summary: PeriodSummary;
} {
  const topics = aggregatePostsToTopics(posts);

  // Recalculate period-level metrics by summing raw numbers, NOT by averaging topic ERs
  // This is the correct approach: (total engagements / total impressions) * 100
  const allPlatforms = topics.flatMap(t => t.platforms);
  const totalViews = topics.reduce((sum, t) => sum + t.totalViews, 0);
  const totalEngagements = topics.reduce((sum, t) => sum + t.totalEngagements, 0);
  const totalImpressions = topics.reduce((sum, t) => sum + t.totalImpressions, 0);
  const totalClicks = topics.reduce((sum, t) => sum + t.totalClicks, 0);
  const correctAvgER = totalImpressions > 0
    ? Math.round((totalEngagements / totalImpressions) * 10000) / 100
    : 0;

  // Recalculate each topic's ER using aggregate data
  const recalculatedTopics: ContentTopic[] = topics.map(topic => {
    const topicTotalEngagements = topic.platforms.reduce(
      (sum, p) => sum + p.likes + p.comments + p.shares + p.saves, 0
    );
    const topicTotalImpressions = topic.platforms.reduce((sum, p) => sum + p.impressions, 0);
    const correctTopicER = topicTotalImpressions > 0
      ? Math.round((topicTotalEngagements / topicTotalImpressions) * 10000) / 100
      : 0; // N/A when no impressions - never fallback to views

    // Recalculate per-platform ER too
    const recalcPlatforms = topic.platforms.map(p => {
      const pEngagements = p.likes + p.comments + p.shares + p.saves;
      const pER = p.impressions > 0 ? Math.round((pEngagements / p.impressions) * 10000) / 100 : 0;
      return { ...p, engagementRate: pER };
    });

    // Sort platforms by recalculated ER
    const sortedPlatforms = [...recalcPlatforms].sort((a, b) => b.engagementRate - a.engagementRate);

    return {
      ...topic,
      platforms: recalcPlatforms,
      avgEngagementRate: correctTopicER,
      totalEngagements: topicTotalEngagements,
      totalImpressions: topicTotalImpressions,
      topPlatform: sortedPlatforms[0]?.platform,
      bottomPlatform: sortedPlatforms[sortedPlatforms.length - 1]?.platform,
      performanceTier: getPerformanceTierFromER(correctTopicER),
    };
  });

  // Build a correct period summary (not using topic ERs)
  const summary: PeriodSummary = {
    topicCount: recalculatedTopics.length,
    totalViews,
    totalEngagements,
    totalClicks,
    totalImpressions,
    avgEngagementRate: correctAvgER,
    avgViewsPerTopic: recalculatedTopics.length > 0 ? Math.round(totalViews / recalculatedTopics.length) : 0,
    avgEngagementsPerTopic: recalculatedTopics.length > 0 ? Math.round(totalEngagements / recalculatedTopics.length) : 0,
    topTopics: [...recalculatedTopics].sort((a, b) => b.avgEngagementRate - a.avgEngagementRate).slice(0, 3),
    bottomTopics: [...recalculatedTopics].sort((a, b) => a.avgEngagementRate - b.avgEngagementRate).slice(0, 3).reverse(),
    platformRanking: calculatePlatformRanking(recalculatedTopics),
    trend: { views: 0, engagements: 0, er: 0 },
  };

  return { topics: recalculatedTopics, summary };
}

/**
 * Fetch a single topic by date from existing posts data
 */
export function getTopicByDate(
  posts: PostWithAnalytics[],
  date: string
): ContentTopic | null {
  const topics = aggregatePostsToTopics(posts);
  return topics.find(t => t.date === date) || null;
}

/**
 * Fetch topics within a date range from existing posts data
 */
export function getTopicsByRange(
  posts: PostWithAnalytics[],
  startDate: string,
  endDate: string
): ContentTopic[] {
  const topics = aggregatePostsToTopics(posts);
  return topics.filter(t => t.date >= startDate && t.date <= endDate);
}

/**
 * Get all available dates from posts
 */
export function getDatesFromPosts(posts: PostWithAnalytics[]): string[] {
  const dates = new Set<string>();
  for (const post of posts) {
    dates.add(getDateString(new Date(post.createdAt)));
  }
  return Array.from(dates).sort().reverse();
}
