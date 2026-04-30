// ============================================================
// SAMA - Ayrshare Analytics Service
//
// Data flow:
//   1. GET /api/history  → post content + Ayrshare top-level IDs + platform post IDs
//   2. POST /api/analytics/post → per-post analytics keyed by platform name
//   3. POST /api/analytics/social → platform-level summary (fallback)
//
// Merge key: Ayrshare top-level post ID ("id" from /api/history)
//   → POST /api/analytics/post with { id: AyrshareID }
//   → response[platform] contains analytics for that specific platform
//
// Per-platform analytics keys in /api/analytics/post response:
//   facebook / instagram / linkedin / youtube / twitter / tiktok / etc.
//
// Twitter can return an ARRAY (threads) — each entry is one tweet in the thread.
// Per-platform errors appear as { status: "error", code: NNN, message: "..." }
// in the JSON body (NOT as HTTP 400). HTTP 400 = bad request / server error.
//
// Failed posts are preserved in the result with status='error' and errorMessage.
// ============================================================

import { SAMA_CONFIG } from '../src/config';

const AYRSHARE_API_BASE = 'https://api.ayrshare.com';
const SAMA_AYRSHARE_API_KEY = 'sama_ayrshare_api_key';
const SAMA_X_API_KEY = 'sama_x_api_key';
const SAMA_X_API_SECRET = 'sama_x_api_secret';

// ─────────────────────────────────────────────────────────────────────────────
// X/Twitter BYO API Key Management (Required since March 31, 2026)
//
// From Ayrshare docs: Starting March 31, 2026, all X/Twitter operations
// through Ayrshare require your own X API credentials.
// https://www.ayrshare.com/docs/dashboard/connect-social-accounts/x-twitter-byo-keys
// ─────────────────────────────────────────────────────────────────────────────

export function getStoredApiKey(): string | null {
  try {
    const localKey = localStorage.getItem(SAMA_AYRSHARE_API_KEY);
    if (localKey) return localKey;
  } catch {}
  return null;
}

export function setStoredApiKey(key: string): void {
  try { localStorage.setItem(SAMA_AYRSHARE_API_KEY, key); } catch {}
}

export function clearStoredApiKey(): void {
  try { localStorage.removeItem(SAMA_AYRSHARE_API_KEY); } catch {}
}

export function getStoredXApiKey(): string | null {
  try {
    return localStorage.getItem(SAMA_X_API_KEY);
  } catch {}
  return null;
}

export function setStoredXApiKey(key: string): void {
  try { localStorage.setItem(SAMA_X_API_KEY, key); } catch {}
}

export function clearStoredXApiKey(): void {
  try { localStorage.removeItem(SAMA_X_API_KEY); } catch {}
}

export function getStoredXApiSecret(): string | null {
  try {
    return localStorage.getItem(SAMA_X_API_SECRET);
  } catch {}
  return null;
}

export function setStoredXApiSecret(key: string): void {
  try { localStorage.setItem(SAMA_X_API_SECRET, key); } catch {}
}

export function clearStoredXApiSecret(): void {
  try { localStorage.removeItem(SAMA_X_API_SECRET); } catch {}
}

/**
 * Build fetch headers with optional X/Twitter BYO credentials.
 * X API Key and Secret are required for all X/Twitter operations starting March 31, 2026.
 */
function buildHeaders(apiKey: string, xApiKey?: string | null, xApiSecret?: string | null): Record<string, string> {
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

// ─────────────────────────────────────────────────────────────────────────────
// Core Types
// ─────────────────────────────────────────────────────────────────────────────

/** Result of one platform's analytics from /api/analytics/post */
export interface PostAnalytics {
  id: string;                  // Ayrshare top-level post ID (merge key)
  platform: string;            // Platform name (lowercase)
  postId?: string;             // Ayrshare post ID (alias for id, for compat)
  platformPostId?: string;     // Platform-native post ID (from postIds[] or postUrl)
  postUrl?: string;
  created?: string;
  /** 'success' if metrics were extracted, 'error' if analytics returned an error */
  status: 'success' | 'error';
  errorMessage?: string;       // Human-readable reason when status='error'
  // Extracted metrics (0 when status='error')
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  clicks: number;
  reach: number;
  impressions: number;
  engagementRate: number;
  followers?: number;
  /** Full raw platform entry from the API (preserved for debugging) */
  platformData?: Record<string, unknown>;
}

export interface ProfileSummary {
  profileKey: string;
  platform: string;
  totalPosts: number;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  totalSaves: number;
  totalClicks: number;
  totalReach: number;
  totalImpressions: number;
  avgEngagementRate: number;
  followers?: number;
  followersChange?: number;
}

export interface PlatformMetrics {
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
}

export interface OverallMetrics {
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
}

export interface GetAyrshareAnalyticsOptions {
  profileKeys: string[];
  lastDays?: number;
  startDate?: string;
  endDate?: string;
  type?: 'posts' | 'summary' | 'all';
}

export interface GetAyrshareAnalyticsResult {
  success: boolean;
  /** Full list of history posts fetched (up to 100 per profile) */
  historyPosts: HistoryPost[];
  /** Per-post analytics entries from tested posts */
  analytics?: PostAnalytics[];
  summaries?: ProfileSummary[];
  platformMetrics?: Record<string, PlatformMetrics>;
  overallMetrics?: OverallMetrics;
  analyticsCount?: number;
  summaryCount?: number;
  /** Full debug info for diagnosing issues */
  debugInfo?: {
    historyPostsFetched: number;
    postAnalyticsAttempted: number;
    postAnalyticsSucceeded: number;
    postAnalyticsFailed: number;
    httpErrors: Array<{ postId: string; status: number; body: string }>;
    apiErrors: Array<{ postId: string; platform: string; code: number; message: string }>;
    warnings: string[];
  };
  /** Per-post test results from the minimal chain (3 latest posts tested individually) */
  testedPosts?: TestedPostResult[];
  error?: string;
}

/** Result of testing /api/analytics/post for a single post */
export interface TestedPostResult {
  postId: string;
  profileKey: string;
  platforms: string[];
  requestPayload: Record<string, unknown>;
  httpStatus: number;
  responseBody: string;
  parsedResponse: Record<string, unknown> | null;
  success: boolean;
  errorMessage?: string;
  /** Post creation date from history API */
  created?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Logging helpers
// ─────────────────────────────────────────────────────────────────────────────
function logInfo(label: string, ...args: unknown[]): void {
  console.log(`[Ayrshare ${label}]`, ...args);
}

function logWarn(label: string, ...args: unknown[]): void {
  console.warn(`[Ayrshare ${label} WARN]`, ...args);
}

function logError(label: string, ...args: unknown[]): void {
  console.error(`[Ayrshare ${label} ERROR]`, ...args);
}

// ─────────────────────────────────────────────────────────────────────────────
// Safe number coercion
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
function n(v: unknown): number {
  return typeof v === 'number' && isFinite(v) ? v : 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-Platform Metrics Extraction
// Uses exact field names from the /api/analytics/post response per platform.
// ─────────────────────────────────────────────────────────────────────────────

export interface ExtractedPostMetrics {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  clicks: number;
  reach: number;
  impressions: number;
  /** TikTok /少数平台：个人主页浏览等（无则为 0） */
  profileViews: number;
}

/**
 * Extract metrics from the `analytics` sub-object of a platform entry
 * in the /api/analytics/post response.
 *
 * Each platform returns different field names — these extractors match
 * the exact API field names documented at:
 * https://www.ayrshare.com/docs/apis/analytics/post
 */
export function extractPostMetrics(platform: string, analytics: Record<string, unknown>): ExtractedPostMetrics {
  const a = analytics;

  switch (platform) {
    case 'facebook': {
      // ── Facebook post-level fields (exact names from API docs) ────────────
      //
      // Facebook categorises posts by mediaProductType and mediaUrls[].type:
      //   "REELS"    → Reels video content
      //   "VIDEO"    → Standard Facebook video
      //   "PHOTO"    → Photo post
      //   "STORY"   → Facebook Story
      //   "LINK"     → Link-only post
      //   "TEXT"     → Text-only status update
      //
      // Views field selection is content-type-aware:
      //
      //   Reels:  views = totalVideoViews
      //              (totalVideoViews is the comprehensive video play count.
      //               blueReelsPlayCount = plays AFTER first impression is already
      //               counted — a subset, not the total.)
      //
      //   Video:   views = totalVideoViews || videoViews
      //              (totalVideoViews is the total play count for standard videos.
      //               videoViews = 3-second plays — lower floor, use as fallback.)
      //
      //   Photo / Link / Text: views = mediaView
      //              (mediaView = total times the post was viewed or played.
      //               For non-video posts this is the primary display count.)
      //
      // Reactions: always use reactions.total (all reaction types combined).
      //   The individual type counts (like, love, haha, wow, angry, sad) are
      //   available in reactions.{type} if granular data is needed.

      const mediaProductType = String(a['mediaProductType'] || '').toUpperCase();
      // Also check mediaUrls[].type as a fallback (especially for Reels)
      const mediaUrls = a['mediaUrls'] as Array<Record<string, unknown>> | undefined;
      const mediaUrlType = mediaUrls?.[0] ? String(mediaUrls[0]['type'] || '').toUpperCase() : '';
      const isReels = mediaProductType === 'REELS' || mediaUrlType === 'STORY' || mediaUrlType === 'REEL';

      const totalVideoViews = n(a['totalVideoViews']); // Total video plays
      const videoViews3s    = n(a['videoViews']);        // 3-second plays (video floor)
      const reelsPlays      = n(a['blueReelsPlayCount']); // Reels: plays after first impression
      const mediaView       = n(a['mediaView']);         // All post views

      let views: number;
      if (isReels) {
        // Reels: totalVideoViews is the accurate total play count
        views = totalVideoViews > 0 ? totalVideoViews : reelsPlays;
      } else if (mediaProductType === 'VIDEO') {
        // Standard video: totalVideoViews > 0 → use it; videoViews as fallback
        views = totalVideoViews > 0 ? totalVideoViews : videoViews3s;
      } else {
        // Photo, link, text, or unknown: mediaView is the appropriate count
        views = mediaView;
      }

      // Reactions: always sum all reaction types (reactions.total)
      const reactions = a['reactions'] as Record<string, unknown> | undefined;
      const likes = reactions ? n(reactions['total']) : n(a['likeCount']);

      return {
        views,
        likes,
        comments:    n(a['commentsCount']),
        shares:      n(a['sharesCount']),
        saves:       0,
        clicks:      n(a['pagePostEngagements']),
        reach:       n(a['impressionsUnique']) || n(a['postImpressionsUnique']),
        impressions: n(a['impressions']) || n(a['impressionsUnique']) || 0,
        profileViews: 0,
      };
    }

    case 'instagram': {
      // ── Instagram FEED fields ────────────────────────────────────────────
      // viewsCount    Total views (photo = display count, video = play count)
      // likeCount     Likes
      // commentsCount Comments
      // savedCount    Saves
      // sharesCount   Shares
      // reachCount    Unique accounts reached
      //
      // ── Instagram REELS fields ────────────────────────────────────────────
      // playsCount                      Reels plays (1ms+ playback)
      // igReelsAggregatedAllPlaysCount  All reel plays (organic only)
      // likeCount / commentsCount / savedCount / sharesCount
      // reachCount
      //
      // ── Instagram STORY fields ────────────────────────────────────────────
      // viewsCount  Total story views
      // likeCount / commentsCount / repliesCount / sharesCount
      // reachCount
      const reelsPlays  = n(a['playsCount']) || n(a['igReelsAggregatedAllPlaysCount']);
      const feedViews   = n(a['viewsCount']);
      const views = Math.max(reelsPlays, feedViews, 0);

      return {
        views,
        likes:        n(a['likeCount']),
        comments:     n(a['commentsCount']),
        shares:       n(a['sharesCount']) || n(a['shareCount']) || 0,
        saves:        n(a['savedCount']) || n(a['savesCount']) || 0,
        clicks:       0,
        reach:        n(a['reachCount']) || 0,
        impressions:  n(a['impressions']) || 0,
        profileViews: 0,
      };
    }

    case 'linkedin': {
      // ── LinkedIn corporate account ─────────────────────────────────────────
      // impressionCount     Impressions
      // likeCount           Likes (all types, includes reactions)
      // commentCount       Comments
      // shareCount         Shares
      // clickCount         Link clicks
      // uniqueImpressionsCount  Unique reach
      // reactions: { like, praise, maybe, empathy, interest, appreciation }
      //   — for company pages, reactions.total is the aggregate
      //
      // ── LinkedIn personal account ─────────────────────────────────────────
      // likeCount, commentCount only (limited data)
      const reactions = a['reactions'] as Record<string, number> | undefined;
      let likes = n(a['likeCount']);
      if (reactions) {
        likes = Object.values(reactions).reduce((s, v) => s + v, 0);
      }

      return {
        views:       0, // LinkedIn provides no post-level views
        likes,
        comments:    n(a['commentCount']),
        shares:      n(a['shareCount']),
        saves:       0,
        clicks:      n(a['clickCount']) || 0,
        reach:       n(a['uniqueImpressionsCount']) || 0,
        impressions: n(a['impressionCount']) || 0,
        profileViews: 0,
      };
    }

    case 'youtube': {
      // ── YouTube post-level fields ────────────────────────────────────────
      // views              Total video views
      // likes              Likes
      // comments           Comments
      // dislikes           Dislikes
      // saves              Saves (watch later)
      // linkClicks         Clicks on links
      // estimatedMinutesWatched (reach proxy)
      //
      // YouTube can take 24-48h to process analytics for new videos.
      return {
        views:       n(a['views']),
        likes:       n(a['likes']),
        comments:    n(a['comments']),
        shares:      0,
        saves:       n(a['saves']) || 0,
        clicks:      n(a['linkClicks']) || 0,
        reach:       0,
        impressions: 0,
        profileViews: 0,
      };
    }

    case 'twitter': {
      // ── Twitter/X post-level fields ──────────────────────────────────────
      //
      // Metrics are in nested objects:
      //   publicMetrics     { impressionCount, likeCount, replyCount, retweetCount,
      //                       quoteCount, bookmarkCount }
      //   organicMetrics    { impressionCount, likeCount, replyCount, retweetCount, ... }
      //   nonPublicMetrics { impressionCount, userProfileClicks, engagements, video: {...} }
      //
      // Use organicMetrics when available (organic-only data).
      // Use publicMetrics as fallback.
      const organic = a['organicMetrics'] as Record<string, unknown> | undefined;
      const pub     = a['publicMetrics']  as Record<string, unknown> | undefined;
      const src     = organic || pub || {};

      const likes      = n(src['likeCount'])     || n(a['likeCount'])     || 0;
      const replies     = n(src['replyCount'])    || n(a['replyCount'])    || 0;
      const retweets   = n(src['retweetCount'])  || n(a['retweetCount'])  || 0;
      const quotes     = n(src['quoteCount'])    || n(a['quoteCount'])    || 0;
      const bookmarks   = n(src['bookmarkCount']) || n(a['bookmarkCount']) || 0;
      // Twitter: impressions is the view count proxy
      const impressions = n(src['impressionCount']) || n(a['impressionCount']) || 0;

      return {
        views:       impressions, // Twitter has no separate "views" field; use impressions
        likes,
        comments:    replies,
        shares:      retweets + quotes,
        saves:       bookmarks,
        clicks:      0,
        reach:       0,
        impressions,
        profileViews: 0,
      };
    }

    case 'tiktok': {
      // ── TikTok post-level fields ─────────────────────────────────────────
      // videoViews   Total video views (TikTok's primary video metric)
      // likeCount    Likes
      // commentsCount  Comments (may be absent/capped by TikTok)
      // shareCount   Shares (available for viral posts)
      // reach        Unique accounts that viewed the content
      // favorites    Saves (separate from shares, not in standard schema)
      //
      // TikTok can take 24-48h to update data.
      // Analytics unavailable if music copyright violation.
      return {
        views:       n(a['videoViews']) || n(a['viewCount']) || 0,
        likes:       n(a['likeCount']),
        comments:    n(a['commentsCount']),
        shares:      n(a['shareCount']),
        saves:       0,
        clicks:      0,
        reach:       n(a['reach']) || 0,
        impressions: n(a['videoViews']) || n(a['viewCount']) || 0,
        profileViews:
          n(a['profileViews']) ||
          n(a['profileViewCount']) ||
          n(a['profilePageViews']) ||
          0,
      };
    }

    default: {
      // Generic fallback — try common field names
      return {
        views:       n(a['views']) || n(a['impressions']) || n(a['viewCount']) || 0,
        likes:       n(a['likes']) || n(a['likeCount']) || 0,
        comments:    n(a['comments']) || n(a['commentCount']) || 0,
        shares:      n(a['shares']) || n(a['shareCount']) || 0,
        saves:       n(a['saves']) || 0,
        clicks:      n(a['clicks']) || n(a['linkClicks']) || 0,
        reach:       n(a['reach']) || n(a['reachCount']) || 0,
        impressions: n(a['impressions']) || n(a['impressionCount']) || 0,
        profileViews: n(a['profileViews']) || n(a['profileViewCount']) || 0,
      };
    }
  }
}

/**
 * Extract metrics from the /api/analytics/social (platform summary) response.
 * The response structure differs from post-level analytics.
 */
function extractSummaryMetrics(
  platform: string,
  data: Record<string, unknown>
): ExtractedPostMetrics {
  const a = data;

  switch (platform) {
    case 'facebook': {
      const reactions = a['reactions'] as Record<string, unknown> | undefined;
      const likes = reactions ? n(reactions['total']) : n(a['likeCount']);
      return {
        views:       n(a['pageMediaView']),
        likes,
        comments:    n(a['commentsCount']),
        shares:      n(a['shareCount']),
        saves:       0,
        clicks:      n(a['pagePostEngagements']),
        reach:       n(a['pagePostsImpressionsUnique']) || n(a['reachCount']) || 0,
        impressions: n(a['pagePostsImpressions']) || 0,
        profileViews: 0,
      };
    }
    case 'instagram':
      return {
        views:       n(a['viewsCount']),
        likes:       n(a['likeCount']),
        comments:    n(a['commentsCount']),
        shares:      0,
        saves:       0,
        clicks:      0,
        reach:       n(a['reachCount']) || 0,
        impressions: n(a['impressionsCount']) || 0,
        profileViews: 0,
      };
    case 'linkedin': {
      return {
        views:       0,
        likes:       n(a['likeCount']),
        comments:    n(a['commentCount']),
        shares:      n(a['shareCount']),
        saves:       0,
        clicks:      n(a['clickCount']) || 0,
        reach:       n(a['uniqueImpressionsCount']) || 0,
        impressions: n(a['impressionCount']) || 0,
        profileViews: 0,
      };
    }
    case 'youtube':
      return {
        views:       n(a['viewCount']),
        likes:       n(a['likeCount']),
        comments:    n(a['commentCount']),
        shares:      0,
        saves:       n(a['saveCount']) || 0,
        clicks:      n(a['linkClicks']) || 0,
        reach:       0,
        impressions: 0,
        profileViews: 0,
      };
    case 'twitter':
      return {
        views:       n(a['impressionCount']),
        likes:       n(a['likeCount']),
        comments:    n(a['replyCount']),
        shares:      n(a['retweetCount']) || 0,
        saves:       0,
        clicks:      n(a['linkClicks']) || 0,
        reach:       0,
        impressions: n(a['impressionCount']) || 0,
        profileViews: 0,
      };
    case 'tiktok':
      return {
        views:       n(a['viewCountTotal']) || n(a['views']) || 0,
        likes:       n(a['likeCountTotal']) || n(a['likes']) || 0,
        comments:    n(a['commentCountTotal']) || n(a['comments']) || 0,
        shares:      n(a['shareCountTotal']) || n(a['shares']) || 0,
        saves:       0,
        clicks:      0,
        reach:       n(a['viewCountTotal']) || n(a['views']) || 0,
        impressions: n(a['viewCountTotal']) || n(a['views']) || 0,
        profileViews:
          n(a['profileViews']) || n(a['profileViewCount']) || n(a['profilePageViews']) || 0,
      };
    default:
      return {
        views:       n(a['views']) || n(a['impressions']) || 0,
        likes:       n(a['likes']) || n(a['likeCount']) || 0,
        comments:    n(a['comments']) || n(a['commentCount']) || 0,
        shares:      n(a['shares']) || n(a['shareCount']) || 0,
        saves:       n(a['saves']) || 0,
        clicks:      n(a['clicks']) || n(a['linkClicks']) || 0,
        reach:       n(a['reach']) || 0,
        impressions: n(a['impressions']) || 0,
        profileViews: n(a['profileViews']) || 0,
      };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// History Post Normalization
// ─────────────────────────────────────────────────────────────────────────────
interface HistoryPostIdEntry {
  platform: string;
  id?: string;
  postUrl?: string;
  status?: string;
}

interface HistoryPost {
  id: string;                  // Ayrshare top-level post ID (the merge key)
  post: string;                // Post text content
  platforms: string[];          // Platform names this post was sent to
  postIds: HistoryPostIdEntry[]; // Per-platform native IDs + postUrls
  created?: string;
  status?: string;
}

function normalizeHistoryPost(raw: Record<string, unknown>): HistoryPost {
  const rawPostIds = Array.isArray(raw['postIds']) ? raw['postIds'] : [];
  const postIds: HistoryPostIdEntry[] = rawPostIds.map((p: unknown) => {
    const e = p as Record<string, unknown>;
    return {
      platform: String(e['platform'] || '').toLowerCase(),
      id:       e['id']       ? String(e['id'])       : undefined,
      postUrl:  e['postUrl']  ? String(e['postUrl'])  : undefined,
      status:   e['status']   ? String(e['status'])   : undefined,
    };
  });

  return {
    id:       String(raw['id']       || ''),
    post:     String(raw['post']     || ''),
    platforms: Array.isArray(raw['platforms'])
      ? (raw['platforms'] as string[]).map(p => String(p).toLowerCase())
      : [String(raw['platform'] || '').toLowerCase()].filter(Boolean),
    postIds,
    created:  raw['created'] ? String(raw['created']) : undefined,
    status:   raw['status']  ? String(raw['status'])  : undefined,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// API: Fetch history posts
// ─────────────────────────────────────────────────────────────────────────────
async function fetchHistory(
  apiKey: string,
  xApiKey: string | null,
  xApiSecret: string | null,
  profileKey: string,
  startDate: string,
  endDate: string,
  limit: number
): Promise<{ posts: HistoryPost[]; error: string | null }> {
  const params = new URLSearchParams({ profileKey, limit: String(limit) });
  if (startDate) params.set('startDate', startDate);
  if (endDate)   params.set('endDate',   endDate);

  const url = `${AYRSHARE_API_BASE}/api/history?${params}`;
  logInfo('History', '→ GET', url);

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: buildHeaders(apiKey, xApiKey, xApiSecret),
    });

    const text = await res.text();
    logInfo('History', `← HTTP ${res.status} | ${text.length} bytes | preview:`, text.substring(0, 400));

    if (!res.ok) {
      return { posts: [], error: `HTTP ${res.status}: ${text.substring(0, 200)}` };
    }

    const json = JSON.parse(text) as Record<string, unknown>;
    const rawPosts = json['history'] || json['posts'] || [];
    const posts: HistoryPost[] = (rawPosts as Record<string, unknown>[]).map(normalizeHistoryPost);
    logInfo('History', `  Parsed ${posts.length} history posts`);
    return { posts, error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logError('History', 'Exception:', msg);
    return { posts: [], error: msg };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// API: Fetch social analytics (platform summary)
// ─────────────────────────────────────────────────────────────────────────────
async function fetchSocialAnalytics(
  apiKey: string,
  xApiKey: string | null,
  xApiSecret: string | null,
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

  const url = `${AYRSHARE_API_BASE}/api/analytics/social`;
  logInfo('Social', '→ POST', url, JSON.stringify(payload));

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: buildHeaders(apiKey, xApiKey, xApiSecret),
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    logInfo('Social', `← HTTP ${res.status} | preview:`, text.substring(0, 300));

    if (!res.ok) {
      return { data: null, error: `HTTP ${res.status}: ${text.substring(0, 200)}` };
    }

    return { data: JSON.parse(text) as Record<string, unknown>, error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logError('Social', 'Exception:', msg);
    return { data: null, error: msg };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// API: Fetch per-post analytics via POST /api/analytics/post
//
// IMPORTANT: Requires the top-level Ayrshare post ID (the "id" field from
// /api/history), NOT the platform-specific postIds[].id.
// Response is keyed by platform name, e.g. { facebook: {...}, linkedin: {...} }
// Twitter can return an ARRAY when the post is a thread.
//
// Per-platform errors appear inside the JSON with:
//   { status: "error", code: NNN, message: "..." }
// These are NOT HTTP 400s — HTTP 400 means a bad request or server error.
//
// NOTE: This endpoint requires profileKey in the payload. Without it, Ayrshare
// returns HTTP 404 with code 186 "Post ID not found" even for valid post IDs.
// ─────────────────────────────────────────────────────────────────────────────
async function fetchPostAnalyticsForPost(
  apiKey: string,
  xApiKey: string | null,
  xApiSecret: string | null,
  profileKey: string,
  ayrsharePostId: string,
  platforms: string[]
): Promise<{
  data: Record<string, unknown> | null;
  statusCode: number;
  error: string | null;
  rawBody?: string;
}> {
  const url = `${AYRSHARE_API_BASE}/api/analytics/post`;
  const payload: Record<string, unknown> = {
    id: ayrsharePostId, // Ayrshare top-level post ID (merge key)
    profileKey,         // REQUIRED: Ayrshare profile key
  };
  if (platforms.length > 0) {
    payload['platforms'] = platforms;
  }

  logInfo('PostAnalytics', '→ POST', url);
  logInfo('PostAnalytics', `  profileKey=${profileKey} | postId=${ayrsharePostId} | platforms=[${platforms.join(', ')}]`);
  logInfo('PostAnalytics', '  Payload:', JSON.stringify(payload));

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: buildHeaders(apiKey, xApiKey, xApiSecret),
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    const preview = text.substring(0, 600);

    // Always log the full response for diagnostics
    if (!res.ok) {
      // HTTP 404/400/500: log FULL response body
      logError('PostAnalytics', `✗ HTTP ${res.status} for postId=${ayrsharePostId}`);
      logError('PostAnalytics', '  FULL RESPONSE BODY:', text);
      return { data: null, statusCode: res.status, error: `HTTP ${res.status}: ${text}`, rawBody: text };
    }

    logInfo('PostAnalytics', `✓ HTTP ${res.status} | preview: ${preview}`);
    logInfo('PostAnalytics', '  FULL RESPONSE BODY:', text);

    try {
      const json = JSON.parse(text) as Record<string, unknown>;
      // Log per-platform error statuses
      for (const [plat, val] of Object.entries(json)) {
        if (val && typeof val === 'object') {
          const entry = val as Record<string, unknown>;
          if (entry['status'] === 'error') {
            logWarn('PostAnalytics',
              `  Platform "${plat}" returned error: code=${entry['code']} message="${entry['message']}"`);
          }
        }
      }
      return { data: json, statusCode: res.status, error: null, rawBody: text };
    } catch {
      return { data: null, statusCode: res.status, error: `Invalid JSON: ${text.substring(0, 100)}`, rawBody: text };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logError('PostAnalytics', `Exception for postId=${ayrsharePostId}:`, msg);
    return { data: null, statusCode: 0, error: msg };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Build PostAnalytics from one platform entry in /api/analytics/post response
// Handles: normal object, Twitter thread array, error object
// ─────────────────────────────────────────────────────────────────────────────
interface PlatformEntry {
  platform: string;
  postId: string;      // Ayrshare top-level post ID
  postUrl?: string;
  created?: string;
}

function buildPostAnalyticsFromEntry(
  entry: Record<string, unknown>,
  meta: PlatformEntry
): PostAnalytics {
  // Detect error object (Ayrshare per-platform error)
  if (entry['status'] === 'error') {
    return {
      id:           meta.postId,
      platform:     meta.platform,
      postId:       meta.postId,
      postUrl:      meta.postUrl,
      created:      meta.created,
      status:       'error',
      errorMessage: `Ayrshare API error ${entry['code']}: ${entry['message']}`,
      views: 0, likes: 0, comments: 0, shares: 0, saves: 0,
      clicks: 0, reach: 0, impressions: 0, engagementRate: 0,
      platformData: entry,
    };
  }

  // Normal platform entry
  const analytics = entry['analytics'] as Record<string, unknown> | undefined;
  if (!analytics) {
    return {
      id:           meta.postId,
      platform:     meta.platform,
      postId:       meta.postId,
      postUrl:      meta.postUrl,
      created:      meta.created,
      status:       'error',
      errorMessage: 'No analytics object in response',
      views: 0, likes: 0, comments: 0, shares: 0, saves: 0,
      clicks: 0, reach: 0, impressions: 0, engagementRate: 0,
      platformData: entry,
    };
  }

  const m = extractPostMetrics(meta.platform, analytics);
  const totalEng = m.likes + m.comments + m.shares + m.saves;
  const engRate  = m.impressions > 0 ? (totalEng / m.impressions) * 100 : 0;

  return {
    id:             meta.postId,
    platform:       meta.platform,
    postId:         meta.postId,
    platformPostId: String(entry['id'] || ''),
    postUrl:        entry['postUrl'] ? String(entry['postUrl']) : meta.postUrl,
    created:        analytics['created'] ? String(analytics['created']) : meta.created,
    status:         'success',
    views:           m.views,
    likes:           m.likes,
    comments:        m.comments,
    shares:          m.shares,
    saves:           m.saves,
    clicks:          m.clicks,
    reach:           m.reach,
    impressions:     m.impressions,
    engagementRate:  Math.round(engRate * 100) / 100,
    platformData:    analytics,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Process the raw response from /api/analytics/post into PostAnalytics[]
// Handles Twitter thread arrays and error objects.
// ─────────────────────────────────────────────────────────────────────────────
function processAnalyticsResponse(
  response: Record<string, unknown>,
  ayrsharePostId: string,
  requestedPlatforms: string[]
): PostAnalytics[] {
  const results: PostAnalytics[] = [];

  for (const platform of requestedPlatforms) {
    const entry = response[platform];

    // Skip null/undefined platforms
    if (!entry) continue;

    // Twitter/X can return an ARRAY for threads (multiple tweets in the thread)
    if (Array.isArray(entry)) {
      logInfo('PostAnalytics', `  Platform "${platform}" returned ARRAY (thread) with ${entry.length} entries`);
      for (const tweet of entry as Record<string, unknown>[]) {
        const meta: PlatformEntry = {
          platform,
          postId:   ayrsharePostId,
          postUrl:  tweet['postUrl'] ? String(tweet['postUrl']) : undefined,
          created:  tweet['created'] ? String(tweet['created']) : undefined,
        };
        results.push(buildPostAnalyticsFromEntry(tweet, meta));
      }
      continue;
    }

    if (typeof entry !== 'object' || entry === null) {
      logWarn('PostAnalytics', `  Platform "${platform}": unexpected type ${typeof entry}`);
      continue;
    }

    const meta: PlatformEntry = {
      platform:   platform,
      postId:     ayrsharePostId,
      postUrl:    entry['postUrl'] ? String(entry['postUrl']) : undefined,
      created:   entry['created']  ? String(entry['created'])  : undefined,
    };
    results.push(buildPostAnalyticsFromEntry(entry as Record<string, unknown>, meta));
  }

  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// Concurrency & Rate Limiting
// ─────────────────────────────────────────────────────────────────────────────

const BATCH_SIZE = 10;          // 每批并发请求数（防止触发 API 限流）
const BATCH_DELAY_MS = 300;     // 批次之间延迟（毫秒）
const MAX_CONSECUTIVE_ERRORS = 3; // 连续失败超过此数则降低并发

async function delay(ms: number): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, ms));
}

async function sleepWithJitter(baseMs: number): Promise<void> {
  const jitter = Math.random() * 0.3 * baseMs; // ±15% 随机抖动
  await delay(baseMs + jitter);
}

/**
 * 分批并发抓取，带速率限制和自适应退避。
 * @param items 要抓取的数据项
 * @param fetchFn 单个抓取函数，返回 Promise
 * @param options.batchSize 每批并发数
 * @param options.batchDelay 批次间延迟
 * @param options.onProgress 进度回调 (completed, total)
 */
async function batchedFetch<T, R>(
  items: T[],
  fetchFn: (item: T, index: number) => Promise<R>,
  options: {
    batchSize?: number;
    batchDelay?: number;
    onProgress?: (completed: number, total: number) => void;
  } = {}
): Promise<R[]> {
  const { batchSize = BATCH_SIZE, batchDelay = BATCH_DELAY_MS, onProgress } = options;
  const results: R[] = new Array(items.length);
  let completed = 0;
  let consecutiveErrors = 0;
  let currentBatchSize = batchSize;

  for (let batchStart = 0; batchStart < items.length; batchStart += currentBatchSize) {
    const batchEnd = Math.min(batchStart + currentBatchSize, items.length);
    const batch = items.slice(batchStart, batchEnd);

    // 并发执行当前批次
    const batchPromises = batch.map(async (item, localIdx) => {
      const globalIdx = batchStart + localIdx;
      try {
        const result = await fetchFn(item, globalIdx);
        consecutiveErrors = 0;
        return { idx: globalIdx, result, error: null };
      } catch (err) {
        consecutiveErrors++;
        // 自适应退避：连续失败时降低并发量
        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS && currentBatchSize > 2) {
          currentBatchSize = Math.max(2, Math.floor(currentBatchSize * 0.6));
          consecutiveErrors = 0;
        }
        const msg = err instanceof Error ? err.message : String(err);
        return { idx: globalIdx, result: null, error: msg };
      }
    });

    const batchResults = await Promise.all(batchPromises);
    for (const { idx, result, error } of batchResults) {
      results[idx] = result as R;
      completed++;
      onProgress?.(completed, items.length);
    }

    // 批次间延迟（最后一批无需等待）
    if (batchEnd < items.length) {
      await sleepWithJitter(batchDelay);
    }
  }

  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main orchestrator
// ─────────────────────────────────────────────────────────────────────────────
export async function getAyrshareAnalytics(
  options: GetAyrshareAnalyticsOptions
): Promise<GetAyrshareAnalyticsResult> {
  const apiKey = getStoredApiKey();

  if (apiKey) {
    return fetchAnalyticsDirect(apiKey, options);
  }

  // Supabase Edge Function fallback
  try {
    const { getSupabase } = await import('../lib/supabase');
    const supabase = getSupabase();
    if (!supabase) {
      return { success: false, error: 'No Ayrshare API key. Add it in Settings.', historyPosts: [] };
    }

    const { data, error } = await supabase.functions.invoke('get-ayrshare-analytics', {
      body: {
        profileKeys: options.profileKeys,
        lastDays: options.lastDays ?? 7,
        startDate: options.startDate,
        endDate: options.endDate,
        type: options.type ?? 'all',
      },
    });

    if (error) {
      const msg = error.message || '';
      const hint = msg.toLowerCase().includes('fetch') || msg.includes('404')
        ? ' Deploy the Edge Function: supabase functions deploy get-ayrshare-analytics'
        : '';
      return { success: false, error: msg + hint, historyPosts: [] };
    }

    const result = data as GetAyrshareAnalyticsResult | null;
    if (!result) return { success: false, error: 'No response from function', historyPosts: [] };
    return result;
  } catch {
    return { success: false, error: 'No Ayrshare API key. Add it in Settings.', historyPosts: [] };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Minimal Chain: History → Summary Totals → 3 Latest Posts Tested Individually
// Scope: last 7 days only. No bulk loop. No refactors outside this function.
// ─────────────────────────────────────────────────────────────────────────────
async function fetchAnalyticsDirect(
  apiKey: string,
  options: GetAyrshareAnalyticsOptions
): Promise<GetAyrshareAnalyticsResult> {
  if (!options.profileKeys.length) {
    return { success: false, error: 'No profile keys provided', historyPosts: [] };
  }

  const days      = options.lastDays ?? 7;
  const endDate   = options.endDate   || new Date().toISOString().split('T')[0];
  const startDate = options.startDate
    || new Date(Date.now() - days * 86400000).toISOString().split('T')[0];

  // Get X/Twitter BYO API keys (required since March 31, 2026)
  const xApiKey = getStoredXApiKey();
  const xApiSecret = getStoredXApiSecret();

  logInfo('Analytics', `=== MINIMAL CHAIN START (last ${days} days) ===`);
  logInfo('Analytics', `Date range: ${startDate} → ${endDate}`);
  logInfo('Analytics', `Profiles: ${options.profileKeys.join(', ')}`);
  if (xApiKey) {
    logInfo('Analytics', `X API Key: configured (${xApiKey.substring(0, 8)}...)`);
  } else {
    logWarn('Analytics', 'X API Key: NOT configured - Twitter data may fail after March 31, 2026');
  }

  const allSummaries: ProfileSummary[] = [];
  const allPosts: PostAnalytics[] = [];
  const testedPosts: TestedPostResult[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  let totalHistoryPostsFetched = 0;
  let historyPosts: HistoryPost[] = [];

  const PLATFORM_LABELS: Record<string, string> = {
    linkedin: 'LinkedIn', instagram: 'Instagram', youtube: 'YouTube',
    twitter: 'X', tiktok: 'TikTok', facebook: 'Facebook',
  };

  const platformMetricsAccum: Record<string, {
    views: number; likes: number; comments: number; shares: number;
    clicks: number; reach: number; impressions: number;
    totalEngagement: number; followers: number;
    paidImpressions: number; organicImpressions: number; posts: number;
  }> = {};

  for (const profileKey of options.profileKeys) {
    const key = String(profileKey).trim();
    if (!key) continue;

    // ── STEP 1: Verify history returns recent posts ───────────────────────────
    logInfo('Analytics', `[STEP 1] Fetching history for profileKey=${key}...`);
    const historyResult = await fetchHistory(apiKey, xApiKey, xApiSecret, key, startDate, endDate, 100);

    if (historyResult.error) {
      const msg = `[STEP 1 FAIL] History error: ${historyResult.error}`;
      logError('Analytics', msg);
      errors.push(msg);
      continue;
    }

    historyPosts = [...historyPosts, ...(historyResult.posts || [])];
    logInfo('Analytics', `[STEP 1 PASS] History returned ${historyResult.posts?.length || 0} posts for ${key} (accumulated: ${historyPosts.length})`);
    totalHistoryPostsFetched += historyResult.posts?.length || 0;

    // Log each history post found
    for (let i = 0; i < historyPosts.length; i++) {
      const p = historyPosts[i];
      const postDate = p.created ? new Date(p.created).toISOString().split('T')[0] : 'unknown';
      logInfo('Analytics', `  [${i + 1}] id=${p.id} date=${postDate} platforms=[${p.platforms.join(',')}] status=${p.status || '?'}`);
    }

    // Filter successful posts for testing
    const successfulHistoryPosts = historyPosts.filter(p => p.status !== 'error');
    if (successfulHistoryPosts.length === 0) {
      warnings.push(`Profile ${key}: no successful posts in last ${days} days`);
      logWarn('Analytics', `Profile ${key}: no successful posts in date range`);
    }

    // ── STEP 2: Verify summary totals for last 7 days ─────────────────────────
    logInfo('Analytics', `[STEP 2] Fetching social summary for profileKey=${key}...`);
    const socialResult = await fetchSocialAnalytics(apiKey, xApiKey, xApiSecret, key, startDate, endDate);

    if (socialResult.error) {
      const msg = `[STEP 2 FAIL] Social summary error: ${socialResult.error}`;
      logError('Analytics', msg);
      errors.push(msg);
    } else if (socialResult.data) {
      logInfo('Analytics', `[STEP 2 PASS] Social summary received`);
      logInfo('Analytics', `  Social summary raw:`, JSON.stringify(socialResult.data).substring(0, 500));

      let platformCount = 0;
      for (const [platform, value] of Object.entries(socialResult.data)) {
        if (!value || typeof value !== 'object') continue;
        platformCount++;
        const container = value as Record<string, unknown>;
        const analytics = (container['analytics'] ?? container) as Record<string, unknown>;

        const m = extractSummaryMetrics(platform, analytics);
        const totalEng = m.likes + m.comments + m.shares;
        const avgER    = m.impressions > 0 ? (totalEng / m.impressions) * 100 : 0;

        logInfo('Analytics', `  Platform=${platform} | views=${m.views} likes=${m.likes} comments=${m.comments} shares=${m.shares} impressions=${m.impressions} reach=${m.reach}`);

        if (!platformMetricsAccum[platform]) {
          platformMetricsAccum[platform] = {
            views: 0, likes: 0, comments: 0, shares: 0, clicks: 0,
            reach: 0, impressions: 0, totalEngagement: 0, followers: 0,
            paidImpressions: 0, organicImpressions: 0, posts: 0,
          };
        }
        const acc = platformMetricsAccum[platform];
        // TikTok social analytics uses different field names:
        // viewCountTotal (period total views), likeCountTotal, followerCount
        const viewsSource = platform === 'tiktok'
          ? analytics['viewCountTotal']
          : (analytics['pageMediaView'] || analytics['viewCount']);
        acc.views        += n(viewsSource) || 0;
        acc.likes        += m.likes;
        acc.comments     += m.comments;
        acc.shares       += m.shares;
        acc.clicks       += m.clicks;
        acc.reach        += m.reach;
        acc.impressions  += m.impressions;
        acc.totalEngagement += totalEng;
        acc.paidImpressions += n(analytics['pagePostsImpressionsPaid']) || 0;
        acc.organicImpressions += n(analytics['pagePostsImpressionsNonviral']) || 0;
        // TikTok uses followerCount; others use followersCount or fanCount
        const followersSource = platform === 'tiktok'
          ? analytics['followerCount']
          : (analytics['followersCount'] || analytics['fanCount']);
        acc.followers    += n(followersSource) || 0;
        acc.posts        += 1;

        const viewsSrc = platform === 'tiktok'
          ? analytics['viewCountTotal']
          : (analytics['pageMediaView'] || analytics['viewCount']);
        const followersSrc = platform === 'tiktok'
          ? analytics['followerCount']
          : (analytics['followersCount'] || analytics['fanCount']);
        allSummaries.push({
          profileKey: key,
          platform,
          totalPosts:       1,
          totalViews:       n(viewsSrc) || 0,
          totalLikes:       m.likes,
          totalComments:    m.comments,
          totalShares:      m.shares,
          totalSaves:       0,
          totalClicks:      m.clicks,
          totalReach:       m.reach,
          totalImpressions: m.impressions,
          avgEngagementRate: avgER,
          followers:         n(followersSrc) || 0,
        });
      }
      logInfo('Analytics', `[STEP 2 PASS] ${platformCount} platforms in summary`);
    } else {
      logWarn('Analytics', `[STEP 2] No social summary data returned`);
    }

    // ── STEP 3: Fetch ALL post analytics with batched concurrency ──────────────
    const allSuccessfulPosts = successfulHistoryPosts;
    if (allSuccessfulPosts.length > 0) {
      logInfo('Analytics', `[STEP 3] Batched concurrency fetch for ${allSuccessfulPosts.length} posts (concurrency=${BATCH_SIZE})...`);

      const postFetchResults = await batchedFetch(
        allSuccessfulPosts,
        async (post: HistoryPost, idx: number): Promise<{
          post: HistoryPost;
          parsed: Record<string, unknown> | null;
          httpStatus: number;
          httpOk: boolean;
          parseErr?: string;
        }> => {
          const platforms = post.platforms.filter(Boolean);
          const payload: Record<string, unknown> = {
            id: post.id,
            profileKey: key,
          };
          if (platforms.length > 0) payload['platforms'] = platforms;

          const res = await fetch(`${AYRSHARE_API_BASE}/api/analytics/post`, {
            method: 'POST',
            headers: buildHeaders(apiKey, xApiKey, xApiSecret),
            body: JSON.stringify(payload),
          });

          const text = await res.text();
          let parsed: Record<string, unknown> | null = null;
          let parseErr: string | undefined;
          try {
            parsed = JSON.parse(text) as Record<string, unknown>;
          } catch {
            parseErr = `Invalid JSON: ${text.substring(0, 100)}`;
          }

          return {
            post,
            parsed,
            httpStatus: res.status,
            httpOk: res.ok && parsed !== null,
            parseErr,
          };
        },
        { batchSize: BATCH_SIZE, batchDelay: BATCH_DELAY_MS }
      );

      for (const { post, parsed, httpStatus, httpOk, parseErr } of postFetchResults) {
        const platforms = post.platforms.filter(Boolean);

        const tr: TestedPostResult = {
          postId: post.id,
          profileKey: key,
          platforms,
          requestPayload: { id: post.id, profileKey: key, ...(platforms.length ? { platforms } : {}) },
          httpStatus,
          responseBody: JSON.stringify(parsed),
          parsedResponse: parsed,
          success: httpOk,
          errorMessage: !httpOk ? `HTTP ${httpStatus}: ${JSON.stringify(parsed)}` : parseErr,
          created: post.created,
        };
        testedPosts.push(tr);

        if (httpOk && parsed) {
          const platformAnalytics = processAnalyticsResponse(parsed, post.id, platforms);
          for (const pa of platformAnalytics) {
            allPosts.push(pa);
          }
          logInfo('Analytics', `  [TEST] ${post.id.slice(0, 8)} ✓ ${platformAnalytics.length} platforms`);
        } else {
          logError('Analytics', `  [TEST] ${post.id.slice(0, 8)} ✗ ${tr.errorMessage}`);
          if (parsed && (parsed as any)['code'] === 186) {
            logError('Analytics', `  Ayrshare code=186: "${(parsed as any)['message']}"`);
          }
        }
      }
      logInfo('Analytics', `[STEP 3] Done: ${postFetchResults.filter(r => r.httpOk).length}/${postFetchResults.length} succeeded`);
    }

  // Build platform metrics
  const platformMetrics: Record<string, PlatformMetrics> = {};
  for (const [platform, acc] of Object.entries(platformMetricsAccum)) {
    const avgER = acc.impressions > 0
      ? Math.round((acc.totalEngagement / acc.impressions) * 10000) / 100
      : 0;
    platformMetrics[platform] = {
      platform,
      label: PLATFORM_LABELS[platform] || platform,
      posts:           acc.posts,
      views:          acc.views,
      likes:          acc.likes,
      comments:       acc.comments,
      shares:         acc.shares,
      saves:          0,
      clicks:         acc.clicks,
      reach:          acc.reach,
      impressions:     acc.impressions,
      totalEngagement: acc.totalEngagement,
      avgEngagementRate: avgER,
      followers:        acc.followers,
      paidImpressions:  acc.paidImpressions,
      organicImpressions: acc.organicImpressions,
    };
  }

  const overall = calculateOverallMetrics(platformMetrics);

  const testedSuccessCount = testedPosts.filter(p => p.success).length;
  const testedFailCount   = testedPosts.filter(p => !p.success).length;

  logInfo('Analytics', `═══════════════════════════════════════════════`);
  logInfo('Analytics', `=== FULL FETCH SUMMARY ===`);
  logInfo('Analytics', `historyPosts total:      ${historyPosts.length}`);
  logInfo('Analytics', `testedPosts total:       ${testedPosts.length}`);
  logInfo('Analytics', `  ✓ success:             ${testedSuccessCount}`);
  logInfo('Analytics', `  ✗ failed:             ${testedFailCount}`);
  logInfo('Analytics', `═══════════════════════════════════════════════`);

  return {
    success: errors.length === 0,
    historyPosts,
    summaries:    allSummaries,
    platformMetrics,
    overallMetrics: overall,
    analyticsCount: allPosts.length,
    summaryCount:  allSummaries.length,
    testedPosts,
    debugInfo: {
      historyPostsFetched:    totalHistoryPostsFetched,
      postAnalyticsAttempted: testedPosts.length,
      postAnalyticsSucceeded: testedSuccessCount,
      postAnalyticsFailed:    testedFailCount,
      httpErrors: testedPosts
        .filter(p => !p.success)
        .map(p => ({ postId: p.postId, status: p.httpStatus, body: p.responseBody })),
      apiErrors: [],
      warnings,
    },
    error: errors.length > 0 ? errors.join('; ') : undefined,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Aggregation helpers (unchanged from original)
// ─────────────────────────────────────────────────────────────────────────────
export function aggregateByPlatform(analytics: PostAnalytics[]): Record<string, PlatformMetrics> {
  const platformMap: Record<string, PlatformMetrics> = {};
  const labels: Record<string, string> = {
    linkedin: 'LinkedIn', instagram: 'Instagram', youtube: 'YouTube',
    twitter: 'X', tiktok: 'TikTok', facebook: 'Facebook',
  };

  for (const post of analytics) {
    const platform = post.platform?.toLowerCase() || 'unknown';
    if (!platformMap[platform]) {
      platformMap[platform] = {
        platform, label: labels[platform] || platform,
        posts: 0, views: 0, likes: 0, comments: 0, shares: 0,
        saves: 0, clicks: 0, reach: 0, impressions: 0,
        totalEngagement: 0, avgEngagementRate: 0, followers: 0,
        paidImpressions: 0, organicImpressions: 0,
      };
    }
    const m = platformMap[platform];
    m.posts++;
    m.views       += post.views || 0;
    m.likes       += post.likes || 0;
    m.comments    += post.comments || 0;
    m.shares      += post.shares || 0;
    m.saves       += post.saves || 0;
    m.clicks      += post.clicks || 0;
    m.reach       += post.reach || 0;
    m.impressions += post.impressions || 0;
    m.totalEngagement += (post.likes || 0) + (post.comments || 0) + (post.shares || 0);
  }

  for (const m of Object.values(platformMap)) {
    if (m.impressions > 0) {
      m.avgEngagementRate = Math.round((m.totalEngagement / m.impressions) * 10000) / 100;
    }
  }
  return platformMap;
}

export function calculateOverallMetrics(platformMetrics: Record<string, PlatformMetrics>): OverallMetrics {
  let totalPosts = 0, totalViews = 0, totalLikes = 0, totalComments = 0;
  let totalShares = 0, totalSaves = 0, totalClicks = 0, totalReach = 0;
  let totalImpressions = 0, totalEngagement = 0;
  let paidImpressions = 0, organicImpressions = 0;

  for (const m of Object.values(platformMetrics)) {
    totalPosts       += m.posts;
    totalViews       += m.views;
    totalLikes       += m.likes;
    totalComments    += m.comments;
    totalShares      += m.shares;
    totalSaves       += m.saves;
    totalClicks      += m.clicks;
    totalReach       += m.reach;
    totalImpressions += m.impressions;
    totalEngagement  += m.totalEngagement;
    paidImpressions  += m.paidImpressions;
    organicImpressions += m.organicImpressions;
  }

  return {
    totalPosts, totalViews, totalLikes, totalComments,
    totalShares, totalSaves, totalClicks, totalReach,
    totalImpressions, totalEngagement,
    avgEngagementRate: totalImpressions > 0
      ? Math.round((totalEngagement / totalImpressions) * 10000) / 100 : 0,
    paidImpressions, organicImpressions,
  };
}

export function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000)     return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

export function calculateChange(current: number, previous: number): { value: string; direction: 'up' | 'down' | 'flat' } {
  if (previous === 0) return { value: current > 0 ? '+100%' : '0%', direction: current > 0 ? 'up' : 'flat' };
  const change = Math.round(((current - previous) / previous) * 100);
  if (change > 0) return { value: `+${change}%`, direction: 'up' };
  if (change < 0) return { value: `${change}%`, direction: 'down' };
  return { value: '0%', direction: 'flat' };
}

export function getPlatformPriority(platform: string): { authority: number; conversion: number } {
  const priorities: Record<string, { authority: number; conversion: number }> = {
    linkedin: { authority: 5, conversion: 5 },
    instagram: { authority: 3, conversion: 3 },
    youtube: { authority: 4, conversion: 4 },
    twitter: { authority: 3, conversion: 2 },
    tiktok: { authority: 2, conversion: 2 },
    facebook: { authority: 3, conversion: 3 },
  };
  return priorities[platform.toLowerCase()] || { authority: 3, conversion: 3 };
}

// ─────────────────────────────────────────────────────────────────────────────
// Display metrics (unchanged from original)
// ─────────────────────────────────────────────────────────────────────────────
export type DisplayPlatform = 'linkedin' | 'facebook' | 'instagram' | 'youtube' | 'twitter' | 'tiktok';

export interface PlatformMetricsRaw {
  platform: DisplayPlatform;
  impressions: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  clicks: number;
  views: number;
  reach: number;
  followers: number;
}

export interface DisplayMetrics {
  platform: DisplayPlatform;
  always: { views: number; likes: number; comments: number; shares: number };
  primary: { label: string; value: number; direction: 'up' | 'down' | 'flat' | 'new'; changePct: number };
  secondary: { label: string; value: number; direction: 'up' | 'down' | 'flat' | 'new'; changePct: number };
}

const PRIMARY_METRICS: Record<DisplayPlatform, { label: string; field: keyof PlatformMetricsRaw }> = {
  linkedin:  { label: 'Impressions', field: 'impressions' },
  facebook:  { label: 'Reach',        field: 'reach' },
  instagram: { label: 'Impressions', field: 'impressions' },
  youtube:   { label: 'Views',        field: 'views' },
  twitter:   { label: 'Impressions', field: 'impressions' },
  tiktok:    { label: 'Views',        field: 'views' },
};

const SECONDARY_METRICS: Record<DisplayPlatform, { label: string; field: keyof PlatformMetricsRaw }> = {
  linkedin:  { label: 'Engagement%', field: 'impressions' },
  facebook:  { label: 'Clicks',      field: 'clicks' },
  instagram: { label: 'Reach',       field: 'reach' },
  youtube:   { label: 'Engagements',  field: 'impressions' },
  twitter:   { label: 'Engagement%', field: 'impressions' },
  tiktok:    { label: 'Impressions', field: 'impressions' },
};

function calcChange(thisWeek: number, lastWeek: number): { direction: 'up' | 'down' | 'flat' | 'new'; changePct: number } {
  if (lastWeek === 0) return { direction: thisWeek > 0 ? 'new' : 'flat', changePct: 0 };
  const pct = Math.round(((thisWeek - lastWeek) / lastWeek) * 100);
  if (pct > 0) return { direction: 'up', changePct: pct };
  if (pct < 0) return { direction: 'down', changePct: pct };
  return { direction: 'flat', changePct: 0 };
}

export function getDisplayMetrics(
  metrics: PlatformMetricsRaw,
  lastWeekMetrics: PlatformMetricsRaw
): DisplayMetrics {
  const eng = metrics.likes + metrics.comments + metrics.shares + metrics.saves;
  const er  = metrics.impressions > 0
    ? Math.round((eng / metrics.impressions) * 10000) / 100
    : 0;
  const lastEng = lastWeekMetrics.likes + lastWeekMetrics.comments + lastWeekMetrics.shares + lastWeekMetrics.saves;
  const lastER  = lastWeekMetrics.impressions > 0
    ? Math.round((lastEng / lastWeekMetrics.impressions) * 10000) / 100
    : 0;

  const primary   = PRIMARY_METRICS[metrics.platform];
  const secondary = SECONDARY_METRICS[metrics.platform];

  const getVal = (m: PlatformMetricsRaw, label: string, field: string): number => {
    if (label === 'Engagement%') return m.impressions > 0
      ? Math.round(((m.likes + m.comments + m.shares + m.saves) / m.impressions) * 10000) / 100
      : 0;
    if (label === 'Engagements') return m.likes + m.comments + m.shares + m.saves;
    return (m[field as keyof PlatformMetricsRaw] as number) ?? 0;
  };

  return {
    platform: metrics.platform,
    always: { views: metrics.views, likes: metrics.likes, comments: metrics.comments, shares: metrics.shares },
    primary: {
      label: primary.label,
      value: getVal(metrics, primary.label, primary.field),
      ...calcChange(getVal(metrics, primary.label, primary.field), getVal(lastWeekMetrics, primary.label, primary.field)),
    },
    secondary: {
      label: secondary.label,
      value: getVal(metrics, secondary.field, secondary.label),
      ...calcChange(getVal(metrics, secondary.field, secondary.label), getVal(lastWeekMetrics, secondary.field, secondary.label)),
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Full Chain: Fetch analytics for ALL historyPosts (no 3-post limit)
// Used for complete 7-day post × platform明细 export.
// ─────────────────────────────────────────────────────────────────────────────
export interface FullPostAnalyticsResult {
  historyPostsCount: number;
  successfulPostAnalyticsCount: number; // posts with at least one successful platform
  totalPostPlatformRows: number;         // post × platform rows (including Manual)
  availableRows: FullPostAnalyticsRow[]; // rows with real analytics
  manualRows: FullPostAnalyticsRow[];    // rows without analytics (need manual fill)
}

export interface FullPostAnalyticsRow {
  postId: string;
  postDate: string;
  postText: string;
  postUrl: string;
  platform: string;
  status: 'Available' | 'Manual' | 'Pending';
  // Only filled when status === 'Available'
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  impressions?: number;
  reach?: number;
  engagement?: number;
  engagementRate?: number;
  // Always filled
  fetchedAt: string;
}

/**
 * Fetch /api/history → /api/analytics/post for EVERY historyPost (no limit).
 * Returns full post × platform明细 with Analytics Status.
 *
 * Call from browser console via:
 *   const r = await window.__samaFullFetch({ profileKeys: ['xxx'], lastDays: 7 });
 *   console.table(r.availableRows);
 *   console.table(r.manualRows);
 */
export async function fetchAllPostAnalytics(options: {
  profileKeys: string[];
  lastDays?: number;
  startDate?: string;
  endDate?: string;
}): Promise<FullPostAnalyticsResult> {
  const apiKey = getStoredApiKey();
  if (!apiKey) {
    throw new Error('No Ayrshare API key found. Add it in Settings.');
  }

  const days = options.lastDays ?? 7;
  const endDate = options.endDate || new Date().toISOString().split('T')[0];
  const startDate = options.startDate
    || new Date(Date.now() - days * 86400000).toISOString().split('T')[0];

  console.clear();
  console.log('═══════════════════════════════════════════════');
  console.log('[FULL CHAIN] Starting — NO 3-post limit');
  console.log(`  Date range: ${startDate} → ${endDate}`);
  console.log(`  Profiles: ${options.profileKeys.join(', ')}`);
  console.log('═══════════════════════════════════════════════');

  const allHistoryPosts: HistoryPost[] = [];
  const allAvailableRows: FullPostAnalyticsRow[] = [];
  const allManualRows: FullPostAnalyticsRow[] = [];
  const fetchedAt = new Date().toISOString();

  for (const profileKey of options.profileKeys) {
    const key = String(profileKey).trim();
    if (!key) continue;

    console.log(`\n── Profile: ${key} ──`);

    // Step 1: Fetch all history posts
    const xApiKey = getStoredXApiKey();
    const xApiSecret = getStoredXApiSecret();
    const historyResult = await fetchHistory(apiKey, xApiKey, xApiSecret, key, startDate, endDate, 100);
    if (historyResult.error) {
      console.error(`[${key}] History error: ${historyResult.error}`);
      continue;
    }

    const posts = historyResult.posts || [];
    console.log(`[${key}] historyPosts: ${posts.length}`);

    for (let i = 0; i < posts.length; i++) {
      const hp = posts[i];
      const postDate = hp.created ? new Date(hp.created).toISOString().split('T')[0] : 'unknown';
      console.log(`  [${i + 1}/${posts.length}] postId=${hp.id} date=${postDate} platforms=[${hp.platforms.join(', ')}]`);
    }

    allHistoryPosts.push(...posts);

    // Step 2: Fetch analytics for EVERY post (no limit) — 使用分批并发
    console.log(`\n[${key}] Fetching analytics for all ${posts.length} posts (batched, concurrency=${BATCH_SIZE})...`);

    // 构建所有帖子的抓取任务
    type PostTask = { hp: HistoryPost; idx: number };
    const tasks: PostTask[] = posts.map((hp, idx) => ({ hp, idx }));

    const progressBar = (done: number, total: number) => {
      const pct = Math.round((done / total) * 100);
      const bar = '█'.repeat(Math.floor(pct / 5)) + '░'.repeat(20 - Math.floor(pct / 5));
      // 浏览器中使用 console.log 替代 stdout.write
      const prefix = done === total ? '\n' : '\r';
      console.log(`${prefix}  [${bar}] ${done}/${total} (${pct}%)   `);
    };

    const postResults = await batchedFetch(
      tasks,
      async ({ hp, idx }: PostTask): Promise<{
        hp: HistoryPost;
        parsed: Record<string, unknown> | null;
        httpStatus: number;
        httpOk: boolean;
      }> => {
        const platforms = hp.platforms.filter(Boolean);

        const payload: Record<string, unknown> = {
          id: hp.id,
          profileKey: key,
        };
        if (platforms.length > 0) payload['platforms'] = platforms;

        const res = await fetch(`${AYRSHARE_API_BASE}/api/analytics/post`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const text = await res.text();
        let parsed: Record<string, unknown> | null = null;
        try {
          parsed = JSON.parse(text) as Record<string, unknown>;
        } catch {
          parsed = null;
        }

        return { hp, parsed, httpStatus: res.status, httpOk: res.ok && parsed !== null };
      },
      {
        batchSize: BATCH_SIZE,
        batchDelay: BATCH_DELAY_MS,
        onProgress: progressBar,
      }
    );

    console.log('\n'); // 换行，结束进度条
    // Step 3: 处理分批抓取结果
    for (const { hp, parsed, httpStatus, httpOk } of postResults) {
      const platforms = hp.platforms.filter(Boolean);

      // Get postUrls per platform from history
      const urlMap: Record<string, string> = {};
      for (const entry of hp.postIds || []) {
        if (entry.platform && entry.postUrl) {
          urlMap[entry.platform.toLowerCase()] = entry.postUrl;
        }
      }

      if (platforms.length === 0) {
        for (const p of hp.platforms) {
          allManualRows.push({
            postId: hp.id,
            postDate: hp.created ? new Date(hp.created).toISOString().split('T')[0] : '',
            postText: (hp.post || '').substring(0, 200),
            postUrl: '',
            platform: p,
            status: 'Manual',
            fetchedAt,
          });
        }
        continue;
      }

      if (httpOk && parsed) {
        const perPlatformResults = processAnalyticsResponse(parsed, hp.id, platforms);
        let hasAnyData = false;

        for (const pa of perPlatformResults) {
          const url = pa.postUrl || urlMap[pa.platform] || '';

          if (pa.status === 'success') {
            hasAnyData = true;
            const eng = (pa.likes || 0) + (pa.comments || 0) + (pa.shares || 0) + (pa.saves || 0);
            const er = pa.impressions > 0 ? (eng / pa.impressions) * 100 : 0;

            allAvailableRows.push({
              postId: hp.id,
              postDate: hp.created ? new Date(hp.created).toISOString().split('T')[0] : '',
              postText: (hp.post || '').substring(0, 200),
              postUrl: url,
              platform: pa.platform,
              status: 'Available',
              views: pa.views,
              likes: pa.likes,
              comments: pa.comments,
              shares: pa.shares,
              impressions: pa.impressions,
              reach: pa.reach,
              engagement: eng,
              engagementRate: Math.round(er * 100) / 100,
              fetchedAt,
            });

            console.log(
              `  ✓ ${hp.id.slice(0, 8)} | ${pa.platform} | ` +
              `views=${pa.views} likes=${pa.likes} comments=${pa.comments} shares=${pa.shares}`
            );
          } else {
            allManualRows.push({
              postId: hp.id,
              postDate: hp.created ? new Date(hp.created).toISOString().split('T')[0] : '',
              postText: (hp.post || '').substring(0, 200),
              postUrl: url,
              platform: pa.platform,
              status: 'Manual',
              fetchedAt,
            });

            console.log(
              `  ✗ ${hp.id.slice(0, 8)} | ${pa.platform} | ` +
              `error: ${pa.errorMessage || 'no analytics'}`
            );
          }
        }

        if (perPlatformResults.length === 0) {
          for (const p of platforms) {
            allManualRows.push({
              postId: hp.id,
              postDate: hp.created ? new Date(hp.created).toISOString().split('T')[0] : '',
              postText: (hp.post || '').substring(0, 200),
              postUrl: urlMap[p] || '',
              platform: p,
              status: 'Manual',
              fetchedAt,
            });
          }
        }
      } else {
        console.log(`  ✗ ${hp.id.slice(0, 8)} | HTTP ${httpStatus} — all platforms Manual`);
        for (const p of platforms) {
          allManualRows.push({
            postId: hp.id,
            postDate: hp.created ? new Date(hp.created).toISOString().split('T')[0] : '',
            postText: (hp.post || '').substring(0, 200),
            postUrl: urlMap[p] || '',
            platform: p,
            status: 'Manual',
            fetchedAt,
          });
        }
      }
    }

  const successfulPosts = new Set(allAvailableRows.map(r => r.postId)).size;
  const totalRows = allAvailableRows.length + allManualRows.length;

  // ── Final Summary ──
  console.log('\n═══════════════════════════════════════════════');
  console.log('FULL CHAIN RESULT');
  console.log('═══════════════════════════════════════════════');
  console.log(`historyPosts count:         ${allHistoryPosts.length}`);
  console.log(`successful post analytics:  ${successfulPosts}`);
  console.log(`post × platform total rows: ${totalRows}`);
  console.log(`  Available rows:           ${allAvailableRows.length}`);
  console.log(`  Manual rows:              ${allManualRows.length}`);
  console.log('═══════════════════════════════════════════════');

  // Print tables
  if (allAvailableRows.length > 0) {
    console.log('\n── AVAILABLE ROWS (post × platform with analytics) ──');
    console.table(allAvailableRows.map(r => ({
      postId: r.postId.slice(0, 8),
      postDate: r.postDate,
      platform: r.platform,
      views: r.views,
      likes: r.likes,
      comments: r.comments,
      shares: r.shares,
      impressions: r.impressions,
      reach: r.reach,
      engagement: r.engagement,
      engagementRate: r.engagementRate,
      status: r.status,
    })));
  }

  if (allManualRows.length > 0) {
    console.log('\n── MANUAL ROWS (no analytics — need manual fill) ──');
    console.table(allManualRows.map(r => ({
      postId: r.postId.slice(0, 8),
      postDate: r.postDate,
      platform: r.platform,
      postText: r.postText.slice(0, 50) + (r.postText.length > 50 ? '...' : ''),
      status: r.status,
    })));
  }

  return {
    historyPostsCount: allHistoryPosts.length,
    successfulPostAnalyticsCount: successfulPosts,
    totalPostPlatformRows: totalRows,
    availableRows: allAvailableRows,
    manualRows: allManualRows,
  };
}
