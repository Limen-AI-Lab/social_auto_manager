// ============================================================
// SAMA - Weekly Report Data Service
//
// Data sources (按优先级):
//   1. Supabase Edge Function (推荐) - 通过 Supabase 获取 Ayrshare 数据
//   2. 直接调用 Ayrshare API (回退) - getAyrshareAnalytics()
//
// Data flow (Supabase优先):
//   Supabase Edge Function → sama_post_cache → Ayrshare API
//
// Responsibilities:
//   - Window control: pick the most recent completed week (Mon–Sun)
//   - Aggregate per-platform totals from postAnalyticsRows
//   - Calculate ER per platform
//   - Identify content topics (one topic = one unique post content)
//   - Build prev-week comparison (if data available)
// ============================================================

import {
  getAyrshareAnalytics,
  type PlatformMetrics,
} from './ayrshareAnalytics';
import {
  buildPostAnalyticsRows,
  type PostAnalyticsRow,
} from './postAnalyticsData';
import {
  addCalendarDaysISO,
  enumerateDateColumns,
  formatShortDateLabel,
} from './reportDateUtils';
import { buildMatrixCardsForDateColumns } from './reportMatrix';
import type { ReportMatrixPlatformCard } from './reportMatrix';
import {
  fetchAnalyticsViaSupabase,
  hasReportSecret,
  getReportSecret,
  isSupabaseConfigured,
  type SupabaseApiResult,
} from './supabaseApi';

// ─────────────────────────────────────────────────────────────────────────────
// Platform column definitions — what each platform shows in Weekly posts table
// Only include metrics the platform actually returns (no N/A, no placeholder)
// ─────────────────────────────────────────────────────────────────────────────

export type WeeklyMetricKey = 'views' | 'likes' | 'comments' | 'shares' | 'impressions' | 'reach' | 'engagements' | 'er';

export interface WeeklyPlatformColumn {
  key: WeeklyMetricKey;
  label: string;           // Short column header
  abbr: string;            // Very short (for narrow screens)
  /** Returns the numeric value for this metric on this platform from a PostAnalyticsRow */
  getValue: (row: PostAnalyticsRow) => number;
  /** Whether to show ER bar for this column */
  isER?: boolean;
  /** Whether this is the primary "views-like" metric (Views for most, Impressions for LinkedIn/X) */
  isPrimary?: boolean;
}

/**
 * Per-platform column definitions for the Weekly posts table.
 * Order matters: first = primary column after Platform badge.
 * Columns only appear if the platform returns this metric.
 *
 * Engagement Rate (er) always uses impressions as denominator.
 * If platform has no impressions, ER is hidden for that row.
 */
export const WEEKLY_PLATFORM_COLUMNS: Record<string, WeeklyPlatformColumn[]> = {
  linkedin: [
    { key: 'impressions', label: 'Impressions', abbr: 'Impr.', getValue: r => r.impressions, isPrimary: true },
    { key: 'likes',       label: 'Likes',       abbr: 'Likes',  getValue: r => r.likes },
    { key: 'comments',    label: 'Comments',    abbr: 'Cmts',   getValue: r => r.comments },
    { key: 'engagements', label: 'Engagements', abbr: 'Eng.',   getValue: r => r.engagement },
    { key: 'er',          label: 'Eng. Rate',   abbr: 'ER%',    getValue: r => r.engagementRate, isER: true },
  ],
  facebook: [
    { key: 'views',       label: 'Views',       abbr: 'Views',  getValue: r => r.views,       isPrimary: true },
    { key: 'likes',       label: 'Likes',       abbr: 'Likes',  getValue: r => r.likes },
    { key: 'reach',       label: 'Reach',       abbr: 'Reach',  getValue: r => r.reach },
    { key: 'engagements', label: 'Engagements', abbr: 'Eng.',   getValue: r => r.engagement },
    { key: 'er',          label: 'Eng. Rate',   abbr: 'ER%',   getValue: r => r.engagementRate, isER: true },
  ],
  instagram: [
    { key: 'views',       label: 'Views',       abbr: 'Views',  getValue: r => r.views,       isPrimary: true },
    { key: 'likes',       label: 'Likes',       abbr: 'Likes',  getValue: r => r.likes },
    { key: 'reach',       label: 'Reach',       abbr: 'Reach',  getValue: r => r.reach },
    { key: 'engagements', label: 'Engagements', abbr: 'Eng.',  getValue: r => r.engagement },
    { key: 'er',          label: 'Eng. Rate',   abbr: 'ER%',   getValue: r => r.engagementRate, isER: true },
  ],
  youtube: [
    { key: 'views',       label: 'Views',       abbr: 'Views',  getValue: r => r.views,       isPrimary: true },
    { key: 'likes',       label: 'Likes',       abbr: 'Likes',  getValue: r => r.likes },
    { key: 'comments',    label: 'Comments',    abbr: 'Cmts',   getValue: r => r.comments },
    { key: 'er',          label: 'Eng. Rate',   abbr: 'ER%',   getValue: r => r.engagementRate, isER: true },
  ],
  twitter: [
    { key: 'views',       label: 'Views',       abbr: 'Views',  getValue: r => r.views,       isPrimary: true },
    { key: 'likes',       label: 'Likes',       abbr: 'Likes',  getValue: r => r.likes },
    { key: 'comments',    label: 'Comments',    abbr: 'Cmts',   getValue: r => r.comments },
    { key: 'er',          label: 'Eng. Rate',   abbr: 'ER%',   getValue: r => r.engagementRate, isER: true },
  ],
  tiktok: [
    { key: 'views',       label: 'Views',       abbr: 'Views',  getValue: r => r.views,       isPrimary: true },
    { key: 'likes',       label: 'Likes',       abbr: 'Likes',  getValue: r => r.likes },
    { key: 'reach',       label: 'Reach',       abbr: 'Reach',  getValue: r => r.reach },
    { key: 'engagements', label: 'Engagements', abbr: 'Eng.',   getValue: r => r.engagement },
    { key: 'er',          label: 'Eng. Rate',   abbr: 'ER%',   getValue: r => r.engagementRate, isER: true },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Output types
// ─────────────────────────────────────────────────────────────────────────────

export interface WeeklyPlatformRow {
  platform: string;
  label: string;
  /** Posts published on this platform in the week */
  posts: number;
  /** Columns to show (from WEEKLY_PLATFORM_COLUMNS, only those with non-zero data) */
  columns: WeeklyPlatformColumn[];
  /** Pre-computed totals for the overview card */
  totals: {
    impressions: number;
    views: number;
    likes: number;
    comments: number;
    shares: number;
    reach: number;
    engagements: number;
    er: number; // engagements / impressions * 100
  };
  /** Comparison vs previous week */
  change?: {
    direction: 'up' | 'down' | 'flat';
    value: number; // percentage
    metric: 'engagements' | 'impressions' | 'er';
  };
}

export interface WeeklyTopicRow {
  /** ISO date string */
  date: string;
  /** Human-readable: "Monday, 30 Mar 2026" */
  dateLabel: string;
  /** Post ID (used as key) */
  id: string;
  /** First line of post text, truncated */
  title: string;
  /** Full post text */
  postText: string;
  /** Unique platforms this post was published to */
  platforms: string[];
  /** Per-platform rows with only the columns that have data */
  platformRows: WeeklyPostPlatformRow[];
  /** Aggregated totals across all platforms */
  totals: WeeklyPlatformRow['totals'];
}

export interface WeeklyPostPlatformRow {
  platform: string;
  columns: Array<{
    key: WeeklyMetricKey;
    label: string;
    value: number;
    isER?: boolean;
    hasData: boolean;
  }>;
}

/** 与 Daily 相同的 3×2 矩阵（列 = 周内各日） */
export interface WeeklyMatrixBlock {
  dateColumns: { iso: string; label: string }[];
  cards: ReportMatrixPlatformCard[];
}

export interface WeeklyReportData {
  clientName: string;
  /** ISO start of week: Monday YYYY-MM-DD */
  weekStart: string;
  /** ISO end of week: Sunday YYYY-MM-DD */
  weekEnd: string;
  /** Human readable: "24 Mar — 30 Mar 2026" */
  periodLabel: string;
  generatedAt: string;
  /** 模板矩阵：TikTok…X，列为周内日期 */
  matrix: WeeklyMatrixBlock;
  /** Overview KPIs */
  overview: {
    totalPosts: number;
    totalImpressions: number;
    totalEngagements: number;
    totalReach: number;
    avgER: number;
    activePlatforms: number;
  };
  /** Per-platform summary rows (for Platform Performance table) */
  platformRows: WeeklyPlatformRow[];
  /** Posts grouped by date with per-platform breakdown */
  topicRows: WeeklyTopicRow[];
  /** Content topics (theme groupings) */
  topics: Array<{
    label: string;
    postCount: number;
    avgER: number;
  }>;
  /** Post of the Week — one entry per platform that has a post */
  postOfWeek: WeeklyPostOfWeek[];
}

/** Post of the Week — one per platform */
export interface WeeklyPostOfWeek {
  platform: string;
  label: string;
  title: string;
  narrative: string;
  dateLabel: string;
  views: number;
  impressions: number;
  likes: number;
  comments: number;
  shares: number;
  clicks: number;
  imageUrl?: string;
  postUrl?: string;
  engagement: number;
  er: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Date helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the Monday of the week containing `date`.
 * All dates in SAST (Africa/Johannesburg, UTC+2).
 */
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun, 1=Mon, ...
  const diff = day === 0 ? -6 : 1 - day; // Mon=0 offset from Sunday
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Returns the Sunday of the week containing `date`.
 */
function getWeekEnd(date: Date): Date {
  const start = getWeekStart(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

/**
 * Format a Date as "DD Mon YYYY" (e.g. "30 Mar 2026")
 */
function formatDate(date: Date): string {
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * Format a Date as full "Weekday, DD Mon YYYY" (e.g. "Monday, 30 Mar 2026")
 */
function formatFullDate(date: Date): string {
  return date.toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * Format a Date as ISO YYYY-MM-DD (SAST-adjusted)
 */
function toISOSADate(date: Date): string {
  return date.toLocaleDateString('en-CA', { timeZone: 'Africa/Johannesburg' });
}

// ─────────────────────────────────────────────────────────────────────────────
// Main fetch function
// ─────────────────────────────────────────────────────────────────────────────

export interface FetchWeeklyReportOptions {
  profileKeys: string[];
  /** Range start (inclusive). Defaults to Monday of current ISO week. */
  weekStart?: Date;
  /** When set with weekStart, range end (inclusive). Otherwise Sunday after weekStart. */
  weekEnd?: Date;
  /** Client name for display */
  clientName?: string;
  /** 是否强制使用直接调用（跳过 Supabase） */
  forceDirect?: boolean;
}

/**
 * 获取分析数据的统一入口
 * 优先使用 Supabase Edge Function，失败时回退到直接调用
 */
async function fetchAnalyticsData(options: {
  profileKeys: string[];
  startDate: string;
  endDate: string;
  forceDirect?: boolean;
}): Promise<{
  historyPosts: Array<Record<string, unknown>>;
  testedPosts: Array<Record<string, unknown>>;
  summaries: Array<Record<string, unknown>>;
  platformMetrics: Record<string, Record<string, unknown>>;
  overallMetrics: Record<string, unknown>;
  source: 'supabase' | 'direct';
}> {
  const { profileKeys, startDate, endDate, forceDirect } = options;

  // 计算天数范围
  const start = new Date(startDate);
  const end = new Date(endDate);
  const lastDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);

  // 优先尝试 Supabase
  if (!forceDirect && isSupabaseConfigured() && hasReportSecret()) {
    console.log('[WeeklyReport] 优先使用 Supabase Edge Function...');
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
        summaries?: Array<Record<string, unknown>>;
        platformMetrics?: Record<string, Record<string, unknown>>;
        overallMetrics?: Record<string, unknown>;
      };

      console.log('[WeeklyReport] Supabase 调用成功', {
        historyPostsCount: data.historyPosts?.length || 0,
        testedPostsCount: data.testedPosts?.length || 0,
      });

      return {
        historyPosts: data.historyPosts || [],
        testedPosts: data.testedPosts || [],
        summaries: data.summaries || [],
        platformMetrics: data.platformMetrics || {},
        overallMetrics: data.overallMetrics || {},
        source: 'supabase',
      };
    }

    console.warn('[WeeklyReport] Supabase 调用失败，回退到直接调用:', result.error);
  }

  // 回退到直接调用 Ayrshare API
  console.log('[WeeklyReport] 使用直接调用 Ayrshare API...');
  const directResult = await getAyrshareAnalytics({
    profileKeys,
    lastDays,
    startDate,
    endDate,
  });

  return {
    historyPosts: directResult.historyPosts || [],
    testedPosts: directResult.testedPosts || [],
    summaries: directResult.summaries || [],
    platformMetrics: directResult.platformMetrics || {},
    overallMetrics: directResult.overallMetrics || {},
    source: 'direct',
  };
}

export async function fetchWeeklyReport(
  options: FetchWeeklyReportOptions
): Promise<WeeklyReportData> {
  const {
    profileKeys,
    weekStart: providedWeekStart,
    weekEnd: providedWeekEnd,
    clientName = 'Client',
    forceDirect = false,
  } = options;

  let weekStart = new Date(providedWeekStart ?? getWeekStart(new Date()));
  weekStart.setHours(0, 0, 0, 0);
  let weekEnd =
    providedWeekEnd !== undefined
      ? new Date(providedWeekEnd)
      : getWeekEnd(new Date(weekStart.getTime()));
  if (providedWeekEnd !== undefined) {
    weekEnd.setHours(23, 59, 59, 999);
  }

  const weekStartISO = toISOSADate(weekStart);
  const weekEndISO = toISOSADate(weekEnd);
  const spanDays = Math.max(1, enumerateDateColumns(weekStartISO, weekEndISO).length);
  const prevWeekEndISO = addCalendarDaysISO(weekStartISO, -1);
  const prevWeekStartISO = addCalendarDaysISO(prevWeekEndISO, -(spanDays - 1));

  const fetchStartISO = addCalendarDaysISO(prevWeekStartISO, -1);
  const fetchEndISO = addCalendarDaysISO(weekEndISO, 1);
  const lastDays = Math.max(
    7,
    enumerateDateColumns(fetchStartISO, fetchEndISO).length
  );

  // ── Step 1: Fetch analytics (优先 Supabase，回退直接调用) ──────────────────
  const analyticsResult = await fetchAnalyticsData({
    profileKeys,
    startDate: fetchStartISO,
    endDate: fetchEndISO,
    forceDirect,
  });

  console.log('[WeeklyReport] 数据来源:', analyticsResult.source);

  // ── Step 2: Build post rows ────────────────────────────────────────────────
  const historyPosts = analyticsResult.historyPosts || [];
  const testedPosts = analyticsResult.testedPosts || [];

  // Build ALL post×platform rows
  const allRows = buildPostAnalyticsRows(testedPosts, historyPosts);

  const weekRows = allRows.filter(row => {
    const rowDate = toISOSADate(new Date(row.createdAt));
    return rowDate >= weekStartISO && rowDate <= weekEndISO;
  });

  const prevWeekRows = allRows.filter(row => {
    const rowDate = toISOSADate(new Date(row.createdAt));
    return rowDate >= prevWeekStartISO && rowDate <= prevWeekEndISO;
  });

  // ── Step 3: Build platform rows ────────────────────────────────────────────
  const platformRows = buildPlatformRows(weekRows, prevWeekRows);

  // ── Step 4: Build topic rows (posts grouped by date) ──────────────────────
  const topicRows = buildTopicRows(weekRows);

  const matrixDateISOs = enumerateDateColumns(weekStartISO, weekEndISO);
  const matrixDateColumns = matrixDateISOs.map((iso) => ({
    iso,
    label: formatShortDateLabel(iso),
  }));
  const matrixCards = buildMatrixCardsForDateColumns(matrixDateISOs, weekRows);

  // ── Step 5: Overview KPIs ─────────────────────────────────────────────────
  const totalImpressions = platformRows.reduce((s, r) => s + r.totals.impressions, 0);
  const totalEngagements = platformRows.reduce((s, r) => s + r.totals.engagements, 0);
  const totalReach = platformRows.reduce((s, r) => s + r.totals.reach, 0);
  const avgER = totalImpressions > 0
    ? Math.round((totalEngagements / totalImpressions) * 10000) / 100
    : 0;

  // ── Step 6: Topics (content themes) ───────────────────────────────────────
  const topics = buildTopics(weekRows);

  // ── Step 6: Post of the Week ─────────────────────────────────────────────
  const postOfWeek = buildPostOfWeek(weekRows);

  return {
    clientName,
    weekStart: weekStartISO,
    weekEnd: weekEndISO,
    periodLabel: `${formatDate(weekStart)} — ${formatDate(weekEnd)}`,
    generatedAt: new Date().toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric'
    }),
    matrix: {
      dateColumns: matrixDateColumns,
      cards: matrixCards,
    },
    overview: {
      totalPosts: weekRows.length,
      totalImpressions,
      totalEngagements,
      totalReach,
      avgER,
      activePlatforms: platformRows.length,
    },
    platformRows,
    topicRows,
    topics,
    postOfWeek,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Build per-platform summary rows
// ─────────────────────────────────────────────────────────────────────────────

const PLATFORM_LABELS: Record<string, string> = {
  linkedin: 'LinkedIn',
  instagram: 'Instagram',
  youtube: 'YouTube',
  twitter: 'Twitter / X',
  tiktok: 'TikTok',
  facebook: 'Facebook',
};

/**
 * Build WeeklyPlatformRow[] from post×platform rows.
 * Only includes platforms that have at least 1 row in the week.
 * Columns are dynamically selected to only show metrics with non-zero data.
 */
function buildPlatformRows(
  weekRows: PostAnalyticsRow[],
  prevWeekRows: PostAnalyticsRow[]
): WeeklyPlatformRow[] {
  // Group rows by platform
  const byPlatform = new Map<string, PostAnalyticsRow[]>();
  for (const row of weekRows) {
    const plat = row.platform.toLowerCase();
    if (!byPlatform.has(plat)) byPlatform.set(plat, []);
    byPlatform.get(plat)!.push(row);
  }

  // Group prev-week rows
  const prevByPlatform = new Map<string, PostAnalyticsRow[]>();
  for (const row of prevWeekRows) {
    const plat = row.platform.toLowerCase();
    if (!prevByPlatform.has(plat)) prevByPlatform.set(plat, []);
    prevByPlatform.get(plat)!.push(row);
  }

  const result: WeeklyPlatformRow[] = [];

  for (const [platform, rows] of byPlatform) {
    // Only include if at least 1 row with Available analytics
    const availableRows = rows.filter(r => r.analyticsStatus === 'Available');
    if (availableRows.length === 0) continue;

    // Sum totals from Available rows only
    const totals = {
      impressions: availableRows.reduce((s, r) => s + r.impressions, 0),
      views:       availableRows.reduce((s, r) => s + r.views, 0),
      likes:       availableRows.reduce((s, r) => s + r.likes, 0),
      comments:    availableRows.reduce((s, r) => s + r.comments, 0),
      shares:      availableRows.reduce((s, r) => s + r.shares, 0),
      reach:       availableRows.reduce((s, r) => s + r.reach, 0),
      engagements: availableRows.reduce((s, r) => s + r.engagement, 0),
      er: 0,
    };
    totals.er = totals.impressions > 0
      ? Math.round((totals.engagements / totals.impressions) * 10000) / 100
      : 0;

    // Determine which columns to show (only non-zero or non-missing)
    const availableCols = WEEKLY_PLATFORM_COLUMNS[platform] ?? [];
    const activeCols = availableCols.filter(col => {
      if (col.key === 'er') {
        // ER shown if we have impressions data
        return totals.impressions > 0;
      }
      return totals[col.key as keyof typeof totals] > 0;
    });

    // Prev week comparison (by engagements)
    const prevRows = prevByPlatform.get(platform) ?? [];
    const prevAvailable = prevRows.filter(r => r.analyticsStatus === 'Available');
    const prevEngagements = prevAvailable.reduce((s, r) => s + r.engagement, 0);

    const change = prevEngagements > 0
      ? {
          direction: totals.engagements > prevEngagements ? 'up' as const
                  : totals.engagements < prevEngagements ? 'down' as const
                  : 'flat' as const,
          value: Math.round(((totals.engagements - prevEngagements) / prevEngagements) * 100),
          metric: 'engagements' as const,
        }
      : undefined;

    result.push({
      platform,
      label: PLATFORM_LABELS[platform] ?? platform,
      posts: availableRows.length,
      columns: activeCols,
      totals,
      change,
    });
  }

  // Sort by total engagements descending
  result.sort((a, b) => b.totals.engagements - a.totals.engagements);

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Build topic rows (posts by date with per-platform breakdown)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build WeeklyTopicRow[] from post×platform rows, grouped by date.
 * Each row = one unique post (one date × one content).
 * Platforms inside each row show only the metrics with non-zero data.
 */
function buildTopicRows(rows: PostAnalyticsRow[]): WeeklyTopicRow[] {
  // Group by unique post (same date + same postText)
  const byPost = new Map<string, { date: string; rows: PostAnalyticsRow[] }>();

  for (const row of rows) {
    const dateISO = toISOSADate(new Date(row.createdAt));
    // Key by date + first 80 chars of text
    const key = `${dateISO}||${(row.postText || '').substring(0, 80)}`;
    if (!byPost.has(key)) {
      byPost.set(key, { date: dateISO, rows: [] });
    }
    byPost.get(key)!.rows.push(row);
  }

  const topicRows: WeeklyTopicRow[] = [];

  for (const [, { date, rows: postRows }] of byPost) {
    // Deduplicate platforms (same post may appear on multiple platforms)
    const byPlatform = new Map<string, PostAnalyticsRow[]>();
    for (const r of postRows) {
      const plat = r.platform.toLowerCase();
      if (!byPlatform.has(plat)) byPlatform.set(plat, []);
      byPlatform.get(plat)!.push(r);
    }

    const platformRowsOut: WeeklyPostPlatformRow[] = [];
    let totalImpressions = 0, totalViews = 0, totalLikes = 0;
    let totalComments = 0, totalShares = 0, totalReach = 0, totalEngagements = 0;

    for (const [platform, platformRows] of byPlatform) {
      const available = platformRows.filter(r => r.analyticsStatus === 'Available');
      if (available.length === 0) continue;

      // Sum across all rows for this platform (should be 1 usually)
      const sum = {
        impressions: available.reduce((s, r) => s + r.impressions, 0),
        views:       available.reduce((s, r) => s + r.views, 0),
        likes:       available.reduce((s, r) => s + r.likes, 0),
        comments:    available.reduce((s, r) => s + r.comments, 0),
        shares:      available.reduce((s, r) => s + r.shares, 0),
        reach:       available.reduce((s, r) => s + r.reach, 0),
        engagements: available.reduce((s, r) => s + r.engagement, 0),
      };

      totalImpressions += sum.impressions;
      totalViews += sum.views;
      totalLikes += sum.likes;
      totalComments += sum.comments;
      totalShares += sum.shares;
      totalReach += sum.reach;
      totalEngagements += sum.engagements;

      // Build column display: only show metrics with non-zero values
      const availableCols = WEEKLY_PLATFORM_COLUMNS[platform] ?? [];
      const colOut = availableCols
        .filter(col => {
          if (col.key === 'er') return sum.impressions > 0;
          return sum[col.key as keyof typeof sum] > 0;
        })
        .map(col => ({
          key: col.key,
          label: col.label,
          value: col.key === 'er'
            ? (sum.impressions > 0 ? Math.round((sum.engagements / sum.impressions) * 10000) / 100 : 0)
            : sum[col.key as keyof typeof sum] ?? 0,
          isER: col.isER,
          hasData: true,
        }));

      platformRowsOut.push({
        platform,
        columns: colOut,
      });
    }

    const totals = {
      impressions: totalImpressions,
      views: totalViews,
      likes: totalLikes,
      comments: totalComments,
      shares: totalShares,
      reach: totalReach,
      engagements: totalEngagements,
      er: totalImpressions > 0
        ? Math.round((totalEngagements / totalImpressions) * 10000) / 100
        : 0,
    };

    const firstRow = postRows[0];
    const title = (firstRow?.postText || '').split('\n')[0].substring(0, 80) || 'Untitled';

    topicRows.push({
      date,
      dateLabel: formatFullDate(new Date(date + 'T00:00:00')),
      id: firstRow?.postId ?? date,
      title,
      postText: firstRow?.postText ?? '',
      platforms: platformRowsOut.map(r => r.platform),
      platformRows: platformRowsOut,
      totals,
    });
  }

  // Sort by date descending (newest first)
  topicRows.sort((a, b) => b.date.localeCompare(a.date));

  return topicRows;
}

// ─────────────────────────────────────────────────────────────────────────────
// Build content topics (theme groupings)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Very simple topic extraction: group posts by first significant word(s).
 * Returns label + post count + avg ER.
 * In production this could be enhanced with AI topic extraction.
 */
function buildTopics(rows: PostAnalyticsRow[]): WeeklyReportData['topics'] {
  // Group by first 3 words of post text
  const groups = new Map<string, { count: number; totalImpressions: number; totalEngagements: number }>();

  for (const row of rows) {
    if (row.analyticsStatus !== 'Available') continue;
    if (!row.postText) continue;

    const words = row.postText
      .toLowerCase()
      .replace(/https?:\/\/\S+/g, '')
      .replace(/[^\w\s]/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(w => w.length >= 4 && !/^\d+$/.test(w))
      .slice(0, 3)
      .join(' ');

    if (!words) continue;

    if (!groups.has(words)) {
      groups.set(words, { count: 0, totalImpressions: 0, totalEngagements: 0 });
    }
    const g = groups.get(words)!;
    g.count++;
    g.totalImpressions += row.impressions;
    g.totalEngagements += row.engagement;
  }

  return Array.from(groups.entries())
    .map(([label, g]) => ({
      label: label.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      postCount: g.count,
      avgER: g.totalImpressions > 0
        ? Math.round((g.totalEngagements / g.totalImpressions) * 10000) / 100
        : 0,
    }))
    .sort((a, b) => b.avgER - a.avgER);
}

// ─────────────────────────────────────────────────────────────────────────────
// Build Post of the Week — one best post per platform
// ─────────────────────────────────────────────────────────────────────────────

function buildPostOfWeek(rows: PostAnalyticsRow[]): WeeklyPostOfWeek[] {
  // Group all available rows by platform
  const byPlatform = new Map<string, PostAnalyticsRow[]>();
  for (const row of rows) {
    if (row.analyticsStatus !== 'Available') continue;
    const plat = row.platform.toLowerCase();
    if (!byPlatform.has(plat)) byPlatform.set(plat, []);
    byPlatform.get(plat)!.push(row);
  }

  const result: WeeklyPostOfWeek[] = [];

  for (const [platform, platRows] of byPlatform) {
    if (platRows.length === 0) continue;

    // Pick the best post: highest engagements (ties broken by impressions)
    const best = [...platRows].sort((a, b) =>
      b.engagement !== a.engagement
        ? b.engagement - a.engagement
        : b.impressions - a.impressions
    )[0];

    const eng = best.engagement;
    const impr = best.impressions;
    const er = impr > 0 ? Math.round((eng / impr) * 10000) / 100 : 0;

    const title = (best.postText || '').split('\n')[0].substring(0, 80) || 'Untitled';
    const d = new Date(best.createdAt);

    // Simple narrative: platform + metrics highlight
    const narrative = `${PLATFORM_LABELS[platform] ?? platform} post "${title}" drove ${eng.toLocaleString()} engagements with an ER of ${er.toFixed(2)}% this week.`;

    result.push({
      platform,
      label: PLATFORM_LABELS[platform] ?? platform,
      title,
      narrative,
      dateLabel: formatDate(d),
      views: best.views,
      impressions: impr,
      likes: best.likes,
      comments: best.comments,
      shares: best.shares,
      clicks: 0,
      postUrl: best.platformPostUrl || best.postUrl || '',
      engagement: eng,
      er,
    });
  }

  // Sort by engagements descending
  result.sort((a, b) => b.engagement - a.engagement);

  return result;
}
