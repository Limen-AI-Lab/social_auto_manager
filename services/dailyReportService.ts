// ============================================================
// SAMA - Daily Report Data Service
//
// Data sources (按优先级):
//   1. Supabase Edge Function (推荐) - 通过 Supabase 获取 Ayrshare 数据
//   2. 直接调用 Ayrshare API (回退) - getAyrshareAnalytics()
//
// Data flow (Supabase优先):
//   Supabase Edge Function → sama_post_cache → Ayrshare API
//
// Responsibilities:
//   - Fetch most recent posts (default: last 3 days for safety)
//   - Pick the 2 most recent unique posts (by date)
//   - Build per-platform metrics for each of the 2 days
// ============================================================

import {
  getAyrshareAnalytics,
  type ProfileSummary,
} from './ayrshareAnalytics';
import {
  buildPostAnalyticsRows,
  type PostAnalyticsRow,
} from './postAnalyticsData';
import type { DailyPreset } from './reportDateUtils';
import {
  enumerateDateColumns,
  formatShortDateLabel,
  getDailyDateLabel,
  getDailyDateRange,
} from './reportDateUtils';
import {
  buildMatrixCardsForDateColumns,
  toISOSADateSAST,
  type ReportMatrixCell,
  type ReportMatrixPlatformCard,
  type ReportMatrixPostLine,
} from './reportMatrix';
import {
  buildDailyPlatformDetailCards,
  type DailyPlatformDetailCard,
} from './dailyPlatformDetails';
import {
  fetchAnalyticsViaSupabase,
  hasReportSecret,
  getReportSecret,
  isSupabaseConfigured,
} from './supabaseApi';

// ─────────────────────────────────────────────────────────────────────────────
// Output types
// ─────────────────────────────────────────────────────────────────────────────

export interface DailyPlatformMetrics {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  reach: number;
  impressions: number;
  engagements: number;
  er: number; // engagements / impressions * 100
}

export interface DailyPostEntry {
  /** ISO date: YYYY-MM-DD */
  date: string;
  /** Human-readable: "26 Mar 2026" */
  dateLabel: string;
  postId: string;
  /** First line of post text, truncated to 80 chars */
  title: string;
  postText: string;
  /** Per-platform metrics (only platforms that have posts on this date) */
  platformMetrics: Record<string, DailyPlatformMetrics>;
  /** Direct link to the post on the platform */
  postUrl?: string;
}

export interface DailyReportData {
  clientName: string;
  /** ISO date: YYYY-MM-DD */
  generatedAt: string;
  /** The 2 most recent posts, newest first */
  posts: DailyPostEntry[];
  /** Overall summary */
  overview: {
    totalPosts: number;
    activePlatforms: number;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Date helpers
// ─────────────────────────────────────────────────────────────────────────────

const MONTH_NAMES_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function toISOSADate(date: Date): string {
  return date.toLocaleDateString('en-CA', { timeZone: 'Africa/Johannesburg' });
}

function formatDateLabel(date: Date): string {
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Africa/Johannesburg',
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Main fetch function
// ─────────────────────────────────────────────────────────────────────────────

export interface FetchDailyReportOptions {
  profileKeys: string[];
  /** Number of recent posts to include. Default: 2 */
  postCount?: number;
  /** Client name for display */
  clientName?: string;
  /** 是否强制使用直接调用（跳过 Supabase） */
  forceDirect?: boolean;
}

/**
 * 获取分析数据的统一入口（优先 Supabase，回退直接调用）
 */
async function fetchAnalyticsData(options: {
  profileKeys: string[];
  lastDays: number;
  startDate?: string;
  endDate?: string;
  forceDirect?: boolean;
}): Promise<{
  historyPosts: Array<Record<string, unknown>>;
  testedPosts: Array<Record<string, unknown>>;
  source: 'supabase' | 'direct';
}> {
  const { profileKeys, lastDays, startDate, endDate, forceDirect } = options;

  // 优先尝试 Supabase
  if (!forceDirect && isSupabaseConfigured() && hasReportSecret()) {
    console.log('[DailyReport] 优先使用 Supabase Edge Function...');
    const result = await fetchAnalyticsViaSupabase({
      profileKeys,
      lastDays,
      startDate,
      endDate,
      mode: 'full',
    }, getReportSecret() || undefined);

    if (result.success && result.data) {
      const data = result.data as {
        historyPosts?: Array<Record<string, unknown>>;
        testedPosts?: Array<Record<string, unknown>>;
      };

      console.log('[DailyReport] Supabase 调用成功', {
        historyPostsCount: data.historyPosts?.length || 0,
        testedPostsCount: data.testedPosts?.length || 0,
      });

      return {
        historyPosts: data.historyPosts || [],
        testedPosts: data.testedPosts || [],
        source: 'supabase',
      };
    }

    console.warn('[DailyReport] Supabase 调用失败，回退到直接调用:', result.error);
  }

  // 回退到直接调用 Ayrshare API
  console.log('[DailyReport] 使用直接调用 Ayrshare API...');
  const directResult = await getAyrshareAnalytics({
    profileKeys,
    lastDays,
    startDate,
    endDate,
  });

  return {
    historyPosts: directResult.historyPosts || [],
    testedPosts: directResult.testedPosts || [],
    source: 'direct',
  };
}

export async function fetchDailyReport(
  options: FetchDailyReportOptions
): Promise<DailyReportData> {
  const {
    profileKeys,
    postCount = 2,
    clientName = 'Client',
    forceDirect = false,
  } = options;

  // Fetch last 3 days to ensure we have 2 posts (safety buffer)
  const fetchDays = 3;

  // ── Step 1: Fetch analytics (优先 Supabase，回退直接调用) ─────────────────
  const analyticsResult = await fetchAnalyticsData({
    profileKeys,
    lastDays: fetchDays,
    forceDirect,
  });

  console.log('[DailyReport] 数据来源:', analyticsResult.source);

  const historyPosts = analyticsResult.historyPosts || [];
  const testedPosts = analyticsResult.testedPosts || [];

  // Build ALL post×platform rows
  const allRows = buildPostAnalyticsRows(testedPosts, historyPosts);

  // Filter to Available analytics only
  const availableRows = allRows.filter(r => r.analyticsStatus === 'Available');

  // Sort by date descending (newest first)
  availableRows.sort((a, b) => {
    const dateA = new Date(a.createdAt).getTime();
    const dateB = new Date(b.createdAt).getTime();
    return dateB - dateA;
  });

  // ── Step 2: Pick top N unique posts (by date) ──────────────────────────────
  const seenDates = new Set<string>();
  const selectedRows: PostAnalyticsRow[] = [];

  for (const row of availableRows) {
    const dateKey = toISOSADate(new Date(row.createdAt));
    if (!seenDates.has(dateKey)) {
      seenDates.add(dateKey);
      selectedRows.push(row);
      if (selectedRows.length >= postCount) break;
    }
  }

  // ── Step 3: Build DailyPostEntry for each post ────────────────────────────
  const posts: DailyPostEntry[] = selectedRows.map(row => {
    const postDate = new Date(row.createdAt);
    const dateISO = toISOSADate(postDate);

    // Collect all rows for the same post (same date + same text)
    const samePostRows = availableRows.filter(r => {
      const rDate = toISOSADate(new Date(r.createdAt));
      return rDate === dateISO && r.postId === row.postId;
    });

    // Group by platform
    const platformMetrics: Record<string, DailyPlatformMetrics> = {};

    for (const r of samePostRows) {
      const plat = r.platform.toLowerCase();
      const eng = r.engagement;
      const impr = r.impressions;
      const existing = platformMetrics[plat];

      if (existing) {
        existing.views += r.views;
        existing.likes += r.likes;
        existing.comments += r.comments;
        existing.shares += r.shares;
        existing.reach += r.reach;
        existing.impressions += impr;
        existing.engagements += eng;
      } else {
        platformMetrics[plat] = {
          views: r.views,
          likes: r.likes,
          comments: r.comments,
          shares: r.shares,
          reach: r.reach,
          impressions: impr,
          engagements: eng,
          er: impr > 0 ? Math.round((eng / impr) * 10000) / 100 : 0,
        };
      }
    }

    // Recalculate ER after merge
    for (const m of Object.values(platformMetrics)) {
      m.er = m.impressions > 0
        ? Math.round((m.engagements / m.impressions) * 10000) / 100
        : 0;
    }

    const title = (row.postText || '').split('\n')[0].substring(0, 80) || 'Untitled';

    return {
      date: dateISO,
      dateLabel: formatDateLabel(postDate),
      postId: row.postId,
      title,
      postText: row.postText || '',
      platformMetrics,
      postUrl: row.platformPostUrl || '',
    };
  });

  // Sort posts by date descending (newest first)
  posts.sort((a, b) => b.date.localeCompare(a.date));

  // ── Step 4: Build overview ────────────────────────────────────────────────
  const allPlatforms = new Set<string>();
  for (const post of posts) {
    for (const plat of Object.keys(post.platformMetrics)) {
      allPlatforms.add(plat);
    }
  }

  return {
    clientName,
    generatedAt: toISOSADate(new Date()),
    posts,
    overview: {
      totalPosts: posts.length,
      activePlatforms: allPlatforms.size,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Daily matrix (3×2 template: metrics × calendar days + post titles per platform)
// ─────────────────────────────────────────────────────────────────────────────

export type DailyMatrixCell = ReportMatrixCell;
export type DailyMatrixPostLine = ReportMatrixPostLine;
export type DailyMatrixPlatformCard = ReportMatrixPlatformCard;

export interface DailyMatrixReport {
  clientName: string;
  preset: DailyPreset;
  periodLabel: string;
  dateColumns: { iso: string; label: string }[];
  cards: DailyMatrixPlatformCard[];
  uniquePostsInPeriod: number;
  /** 区间内各平台汇总卡片（与概览 UI 一致：指标行 + 底栏 Followers） */
  platformDetails: DailyPlatformDetailCard[];
}

export async function fetchDailyMatrixReport(options: {
  profileKeys: string[];
  preset: DailyPreset;
  clientName?: string;
}): Promise<DailyMatrixReport> {
  const { profileKeys, preset, clientName = 'Client' } = options;
  const { start, end } = getDailyDateRange(preset);
  const periodLabel = getDailyDateLabel(preset);
  const dateISOs = enumerateDateColumns(start, end);

  // #region SAMA_DEBUG_LOG
  const _log = (msg: string, data: Record<string, unknown>) => {
    fetch('http://127.0.0.1:7772/ingest/9ca6233b-abe6-4974-bf17-14ebc8a821cb', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '423eb6' },
      body: JSON.stringify({ sessionId: '423eb6', location: 'dailyReportService.ts:fetchDailyMatrixReport', message: msg, data, timestamp: Date.now() }),
    }).catch(() => {});
  };
  // #endregion

  const dateColumns = dateISOs.map((iso) => ({ iso, label: formatShortDateLabel(iso) }));

  // #region SAMA_DEBUG_LOG
  _log('date_range', { start, end, dateISOs, dateColumnsCount: dateColumns.length });
  // #endregion

  const lastDays = Math.max(14, dateISOs.length + 5);

  const analyticsResult = await getAyrshareAnalytics({
    profileKeys,
    lastDays,
    startDate: start,
    endDate: end,
  });

  const historyPosts = analyticsResult.historyPosts || [];
  const testedPosts = analyticsResult.testedPosts || [];
  const allRows = buildPostAnalyticsRows(testedPosts, historyPosts);

  // #region SAMA_DEBUG_LOG
  _log('raw_rows', {
    historyPostsCount: historyPosts.length,
    testedPostsCount: testedPosts.length,
    allRowsCount: allRows.length,
    allRowsSampleDates: allRows.slice(0, 5).map(r => ({ createdAt: r.createdAt, platform: r.platform, status: r.analyticsStatus })),
  });
  // #endregion

  const inRange = (iso: string) => iso >= start && iso <= end;
  const availableRows = allRows.filter(
    (r) =>
      r.analyticsStatus === 'Available' &&
      inRange(toISOSADateSAST(new Date(r.createdAt)))
  );

  // #region SAMA_DEBUG_LOG
  _log('available_rows', {
    availableRowsCount: availableRows.length,
    availableRowsSample: availableRows.slice(0, 5).map(r => ({
      createdAt: r.createdAt,
      isoSAST: toISOSADateSAST(new Date(r.createdAt)),
      inRange: inRange(toISOSADateSAST(new Date(r.createdAt))),
      platform: r.platform,
      views: r.views,
    })),
    rangeStart: start,
    rangeEnd: end,
  });
  // #endregion

  const uniqueIds = new Set(availableRows.map((r) => r.postId));

  const cards = buildMatrixCardsForDateColumns(dateISOs, availableRows);

  const summaries = (analyticsResult.summaries ?? []) as ProfileSummary[];
  const platformDetails = buildDailyPlatformDetailCards(availableRows, summaries);

  // #region SAMA_DEBUG_LOG
  _log('cards_built', {
    uniqueIdsCount: uniqueIds.size,
    cardsCount: cards.length,
    platformDetailsCount: platformDetails.length,
    platformDetailsSample: platformDetails.map(c => ({ platform: c.platform, mode: c.mode, metricsCount: c.metrics.length, followers: c.followers })),
  });
  // #endregion

  return {
    clientName,
    preset,
    periodLabel,
    dateColumns,
    cards,
    uniquePostsInPeriod: uniqueIds.size,
    platformDetails,
  };
}
