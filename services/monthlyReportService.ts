// ============================================================
// SAMA - Monthly Report Data Service
//
// Data sources (按优先级):
//   1. Supabase Edge Function (推荐) - 通过 Supabase 获取 Ayrshare 数据
//   2. 直接调用 Ayrshare API (回退) - getAyrshareAnalytics()
//
// Data flow (Supabase优先):
//   Supabase Edge Function → sama_post_cache → Ayrshare API
//
// Responsibilities:
//   - Fetch 3 months: current, previous, same month last year
//   - Build per-platform KPI rows with Followers Growth (LinkedIn + Facebook only)
//   - Build CTR section (LinkedIn + Facebook only)
//   - Build Posts distribution table
//   - Build Top Content section
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
  fetchAnalyticsViaSupabase,
  hasReportSecret,
  getReportSecret,
  isSupabaseConfigured,
} from './supabaseApi';

// ─────────────────────────────────────────────────────────────────────────────
// Output types
// ─────────────────────────────────────────────────────────────────────────────

export interface MonthlyPlatformRow {
  platform: string;
  label: string;
  posts: number;
  /** Only present for LinkedIn and Facebook (Ayrshare API limitation) */
  followers?: number;
  followersChange?: number; // % change vs previous month
  /** Extra metrics — columns are dynamic per platform */
  columns: Array<{
    key: string;
    label: string;
    value: number;
    /** Column present in Jan/Feb/Mar blocks */
    hasMonthlyData?: boolean;
  }>;
  totals: {
    impressions: number;
    views: number;
    likes: number;
    comments: number;
    shares: number;
    reach: number;
    engagements: number;
    er: number;
    clicks: number;
    /** Monthly totals: [prev month, current month] */
    monthlyImpressions: [number, number]; // [prev, curr]
  };
  /** Per-month delta vs previous month */
  change?: {
    direction: 'up' | 'down' | 'flat';
    value: number; // percentage
    metric: string;
  };
}

export interface MonthlyCTRRow {
  platform: string;
  label: string;
  clicks: number;
  impressions: number;
  ctr: number;
  prevCtr: number;
  change: number; // pp change
}

export interface MonthlyPostsDistributionRow {
  platform: string;
  label: string;
  posts: [number, number]; // [prevMonth, currentMonth]
  change: number; // current vs prev (absolute)
}

export interface MonthlyTopContentRow {
  rank: number;
  date: string;
  dateLabel: string;
  title: string;
  platform: string;
  impressions: number;
  views: number;
  engagements: number;
  er: number;
}

/** Post of the Month — one per platform */
export interface MonthlyPostOfMonth {
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
  reposts: number;
  clicks: number;
  imageUrl?: string;
  postUrl?: string;
}

export interface MonthlyReportData {
  clientName: string;
  year: number;
  month: number;
  monthLabel: string; // "March 2026"
  generatedAt: string;
  /** Overview */
  overview: {
    totalPosts: number;
    totalImpressions: number;
    totalEngagements: number;
    totalReach: number;
    avgER: number;
    activePlatforms: number;
    totalFollowers?: number; // sum of LinkedIn + Facebook
    followersChange?: number;
  };
  /** Per-platform rows */
  platformRows: MonthlyPlatformRow[];
  /** CTR — only LinkedIn + Facebook */
  ctrRows: MonthlyCTRRow[];
  /** Posts distribution */
  postsDistribution: MonthlyPostsDistributionRow[];
  /** Top 5 performing content (cross-platform) */
  topContent: MonthlyTopContentRow[];
  /** Post of the Month — one entry per platform that has a top post */
  postOfMonth: MonthlyPostOfMonth[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Date helpers
// ─────────────────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function toISOSADate(date: Date): string {
  return date.toLocaleDateString('en-CA', { timeZone: 'Africa/Johannesburg' });
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * Get the date range for a given year/month (1-indexed).
 * Returns { start: YYYY-MM-01, end: last day of month } in SAST.
 */
function getMonthRange(year: number, month: number): { start: Date; end: Date } {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0); // last day of month
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

/**
 * 获取分析数据的统一入口（优先 Supabase，回退直接调用）
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
}> {
  const { profileKeys, startDate, endDate, forceDirect } = options;

  const start = new Date(startDate);
  const end = new Date(endDate);
  const lastDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);

  // 优先尝试 Supabase
  if (!forceDirect && isSupabaseConfigured() && hasReportSecret()) {
    console.log('[MonthlyReport] 优先使用 Supabase Edge Function...');
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
      };

      console.log('[MonthlyReport] Supabase 调用成功', {
        historyPostsCount: data.historyPosts?.length || 0,
        testedPostsCount: data.testedPosts?.length || 0,
      });

      return {
        historyPosts: data.historyPosts || [],
        testedPosts: data.testedPosts || [],
        summaries: data.summaries || [],
      };
    }

    console.warn('[MonthlyReport] Supabase 调用失败，回退到直接调用:', result.error);
  }

  // 回退到直接调用 Ayrshare API
  console.log('[MonthlyReport] 使用直接调用 Ayrshare API...');
  const directResult = await getAyrshareAnalytics({
    profileKeys,
    startDate,
    endDate,
  });

  return {
    historyPosts: directResult.historyPosts || [],
    testedPosts: directResult.testedPosts || [],
    summaries: directResult.summaries || [],
  };
}

/**
 * Fetch analytics for a given month (year/month, 1-indexed).
 * Returns { rows, platformMetrics } for that month.
 */
async function fetchMonthData(
  profileKeys: string[],
  year: number,
  month: number,
  forceDirect?: boolean
): Promise<{
  rows: PostAnalyticsRow[];
  platformMetrics: Record<string, PlatformMetrics>;
  summaries: Array<{
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
  }>;
}> {
  const { start, end } = getMonthRange(year, month);
  // Fetch a bit extra to ensure we capture the whole month
  const startDate = toISOSADate(new Date(start.getTime() - 86400000));
  const endDate = toISOSADate(new Date(end.getTime() + 86400000));

  // 优先使用 Supabase，回退直接调用
  const analyticsResult = await fetchAnalyticsData({
    profileKeys,
    startDate,
    endDate,
    forceDirect,
  });

  const historyPosts = analyticsResult.historyPosts || [];
  const testedPosts = analyticsResult.testedPosts || [];
  const summaries = analyticsResult.summaries || [];

  const rows = buildPostAnalyticsRows(testedPosts, historyPosts)
    .filter(row => {
      const d = new Date(row.createdAt);
      return d >= start && d <= end && row.analyticsStatus === 'Available';
    });

  // Build platform metrics from summaries
  const platformMetrics: Record<string, PlatformMetrics> = {};
  const PLATFORM_LABELS: Record<string, string> = {
    linkedin: 'LinkedIn', instagram: 'Instagram', youtube: 'YouTube',
    twitter: 'X', tiktok: 'TikTok', facebook: 'Facebook',
  };

  for (const s of summaries) {
    const p = s.platform;
    if (!p) continue;
    const eng = (s.totalLikes || 0) + (s.totalComments || 0) + (s.totalShares || 0);
    const er = (s.totalImpressions || 0) > 0
      ? Math.round((eng / (s.totalImpressions || 1)) * 10000) / 100
      : 0;
    platformMetrics[p] = {
      platform: p,
      label: PLATFORM_LABELS[p] || p,
      posts: s.totalPosts || 0,
      views: s.totalViews || 0,
      likes: s.totalLikes || 0,
      comments: s.totalComments || 0,
      shares: s.totalShares || 0,
      saves: s.totalSaves || 0,
      clicks: s.totalClicks || 0,
      reach: s.totalReach || 0,
      impressions: s.totalImpressions || 0,
      totalEngagement: eng,
      avgEngagementRate: er,
      followers: s.followers || 0,
      paidImpressions: 0,
      organicImpressions: 0,
    };
  }

  return { rows, platformMetrics, summaries };
}

// ─────────────────────────────────────────────────────────────────────────────
// Monthly KPI columns per platform
// ─────────────────────────────────────────────────────────────────────────────

/** Per-platform extra columns for the monthly KPI table */
const MONTHLY_PLATFORM_EXTRA: Record<string, Array<{ key: string; label: string }>> = {
  linkedin: [
    { key: 'impressions', label: 'Impressions' },
    { key: 'reach',       label: 'Reach' },
    { key: 'engagements', label: 'Engagements' },
    { key: 'er',          label: 'Eng. Rate' },
  ],
  facebook: [
    { key: 'views',       label: 'Views' },
    { key: 'reach',       label: 'Reach' },
    { key: 'engagements', label: 'Engagements' },
    { key: 'er',          label: 'Eng. Rate' },
  ],
  instagram: [
    { key: 'views',       label: 'Views' },
    { key: 'reach',       label: 'Reach' },
    { key: 'engagements', label: 'Engagements' },
    { key: 'er',          label: 'Eng. Rate' },
  ],
  youtube: [
    { key: 'views',       label: 'Views' },
    { key: 'comments',    label: 'Comments' },
    { key: 'er',          label: 'Eng. Rate' },
  ],
  twitter: [
    { key: 'impressions', label: 'Impressions' },
    { key: 'comments',    label: 'Comments' },
    { key: 'er',          label: 'Eng. Rate' },
  ],
  tiktok: [
    { key: 'views',       label: 'Views' },
    { key: 'reach',       label: 'Reach' },
    { key: 'engagements', label: 'Engagements' },
    { key: 'er',          label: 'Eng. Rate' },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Main fetch function
// ─────────────────────────────────────────────────────────────────────────────

export interface FetchMonthlyReportOptions {
  profileKeys: string[];
  year: number;
  month: number; // 1-12
  clientName?: string;
}

export async function fetchMonthlyReport(
  options: FetchMonthlyReportOptions
): Promise<MonthlyReportData> {
  const { profileKeys, year, month, clientName = 'Client' } = options;

  // ── Fetch 2 months: current + previous ─────────────────────────────────────
  const prevYear = year;
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYearOfPrevMonth = month === 1 ? year - 1 : year;

  const [currentData, prevData] = await Promise.all([
    fetchMonthData(profileKeys, year, month),
    fetchMonthData(profileKeys, prevYearOfPrevMonth, prevMonth),
  ]);

  // ── Build platform rows ─────────────────────────────────────────────────────
  const platformRows = buildMonthlyPlatformRows(
    currentData.rows,
    currentData.platformMetrics,
    prevData.rows,
    prevData.platformMetrics,
  );

  // ── Build CTR rows (LinkedIn + Facebook only) ──────────────────────────────
  const ctrRows = buildCTRRows(currentData.platformMetrics, prevData.platformMetrics);

  // ── Build Posts distribution ────────────────────────────────────────────────
  const postsDistribution = buildPostsDistribution(
    currentData.rows,
    prevData.rows,
  );

  // ── Build Top Content ────────────────────────────────────────────────────────
  const topContent = buildTopContent(currentData.rows);

  // ── Build Post of the Month ────────────────────────────────────────────────
  const postOfMonth = buildPostOfMonth(currentData.rows);

  // ── Overview KPIs ───────────────────────────────────────────────────────────
  const totalImpressions = platformRows.reduce((s, r) => s + r.totals.impressions, 0);
  const totalEngagements = platformRows.reduce((s, r) => s + r.totals.engagements, 0);
  const totalReach = platformRows.reduce((s, r) => s + r.totals.reach, 0);
  const avgER = totalImpressions > 0
    ? Math.round((totalEngagements / totalImpressions) * 10000) / 100
    : 0;

  // Followers: sum of LinkedIn + Facebook (only platforms that have it)
  const followersRows = platformRows.filter(r => r.followers !== undefined);
  const totalFollowers = followersRows.reduce((s, r) => s + (r.followers ?? 0), 0);
  const followersChange = followersRows.reduce((s, r) => {
    const change = r.followersChange ?? 0;
    return s + change;
  }, 0) / Math.max(followersRows.length, 1);

  return {
    clientName,
    year,
    month,
    monthLabel: `${MONTH_NAMES[month - 1]} ${year}`,
    generatedAt: new Date().toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
    }),
    overview: {
      totalPosts: platformRows.reduce((s, r) => s + r.posts, 0),
      totalImpressions,
      totalEngagements,
      totalReach,
      avgER,
      activePlatforms: platformRows.length,
      ...(totalFollowers > 0
        ? { totalFollowers, followersChange: Math.round(followersChange * 10) / 10 }
        : {}),
    },
    platformRows,
    ctrRows,
    postsDistribution,
    topContent,
    postOfMonth,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Build per-platform monthly rows
// ─────────────────────────────────────────────────────────────────────────────

const PLATFORM_LABELS: Record<string, string> = {
  linkedin: 'LinkedIn',
  instagram: 'Instagram',
  youtube: 'YouTube',
  twitter: 'X',
  tiktok: 'TikTok',
  facebook: 'Facebook',
};

function buildMonthlyPlatformRows(
  currentRows: PostAnalyticsRow[],
  currentMetrics: Record<string, PlatformMetrics>,
  prevRows: PostAnalyticsRow[],
  prevMetrics: Record<string, PlatformMetrics>,
): MonthlyPlatformRow[] {
  // Determine which platforms have data in the current month
  const platforms = new Set<string>();
  for (const row of currentRows) {
    if (row.analyticsStatus === 'Available') {
      platforms.add(row.platform.toLowerCase());
    }
  }

  const result: MonthlyPlatformRow[] = [];

  for (const platform of platforms) {
    const currentPlatRows = currentRows.filter(r => r.platform === platform);
    const prevPlatRows = prevRows.filter(r => r.platform === platform);
    const availCurrent = currentPlatRows.filter(r => r.analyticsStatus === 'Available');
    const availPrev = prevPlatRows.filter(r => r.analyticsStatus === 'Available');

    if (availCurrent.length === 0) continue;

    const sumRow = (rows: PostAnalyticsRow[]) => ({
      impressions: rows.reduce((s, r) => s + r.impressions, 0),
      views:       rows.reduce((s, r) => s + r.views, 0),
      likes:       rows.reduce((s, r) => s + r.likes, 0),
      comments:    rows.reduce((s, r) => s + r.comments, 0),
      shares:      rows.reduce((s, r) => s + r.shares, 0),
      reach:       rows.reduce((s, r) => s + r.reach, 0),
      engagements: rows.reduce((s, r) => s + r.engagement, 0),
      clicks:      rows.reduce((s, r) => s + (r as any).clicks ?? 0, 0),
    });

    const cur = sumRow(availCurrent);
    const prev = sumRow(availPrev);

    const er = cur.impressions > 0
      ? Math.round((cur.engagements / cur.impressions) * 10000) / 100
      : 0;

    // Monthly impressions: [prev month, current month]
    const monthlyImpressions: [number, number] = [
      prev.impressions,
      cur.impressions,
    ];

    // Followers — only LinkedIn and Facebook have reliable follower data
    const currentPM = currentMetrics[platform];
    const prevPM = prevMetrics[platform];
    let followers: number | undefined;
    let followersChange: number | undefined;

    if (platform === 'linkedin' || platform === 'facebook') {
      followers = currentPM?.followers ?? 0;
      const prevFollowers = prevPM?.followers ?? 0;
      if (prevFollowers > 0) {
        followersChange = Math.round(((followers - prevFollowers) / prevFollowers) * 10000) / 100;
      }
    }

    // Build extra columns (dynamic per platform)
    const extraCols = (MONTHLY_PLATFORM_EXTRA[platform] ?? [])
      .filter(col => {
        if (col.key === 'er') return cur.impressions > 0;
        return (cur as any)[col.key] > 0;
      })
      .map(col => ({
        key: col.key,
        label: col.label,
        value: col.key === 'er' ? er : ((cur as any)[col.key] ?? 0),
        hasMonthlyData: col.key === 'impressions' || col.key === 'views',
      }));

    // Change vs previous month
    const change = prev.impressions > 0
      ? {
          direction: (cur.engagements > prev.engagements ? 'up' : cur.engagements < prev.engagements ? 'down' : 'flat') as 'up' | 'down' | 'flat',
          value: Math.round(((cur.engagements - prev.engagements) / prev.engagements) * 100),
          metric: 'engagements',
        }
      : undefined;

    result.push({
      platform,
      label: PLATFORM_LABELS[platform] ?? platform,
      posts: availCurrent.length,
      ...(followers !== undefined ? { followers, followersChange } : {}),
      columns: extraCols,
      totals: {
        impressions: cur.impressions,
        views: cur.views,
        likes: cur.likes,
        comments: cur.comments,
        shares: cur.shares,
        reach: cur.reach,
        engagements: cur.engagements,
        er,
        clicks: cur.clicks,
        monthlyImpressions,
      },
      change,
    });
  }

  // Sort by total engagements descending
  result.sort((a, b) => b.totals.engagements - a.totals.engagements);

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Build CTR rows (LinkedIn + Facebook only)
// ─────────────────────────────────────────────────────────────────────────────

function buildCTRRows(
  current: Record<string, PlatformMetrics>,
  prev: Record<string, PlatformMetrics>
): MonthlyCTRRow[] {
  const result: MonthlyCTRRow[] = [];

  for (const platform of ['linkedin', 'facebook']) {
    const cur = current[platform];
    const pre = prev[platform];
    if (!cur) continue;

    const clicks = cur.clicks ?? 0;
    const impressions = cur.impressions ?? 0;
    const ctr = impressions > 0 ? Math.round((clicks / impressions) * 10000) / 100 : 0;

    const prevClicks = pre?.clicks ?? 0;
    const prevImpressions = pre?.impressions ?? 0;
    const prevCtr = prevImpressions > 0
      ? Math.round((prevClicks / prevImpressions) * 10000) / 100
      : 0;

    result.push({
      platform,
      label: PLATFORM_LABELS[platform] ?? platform,
      clicks,
      impressions,
      ctr,
      prevCtr,
      change: Math.round((ctr - prevCtr) * 100) / 100,
    });
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Build Posts distribution
// ─────────────────────────────────────────────────────────────────────────────

function buildPostsDistribution(
  currentRows: PostAnalyticsRow[],
  prevRows: PostAnalyticsRow[],
): MonthlyPostsDistributionRow[] {
  const allRows = [
    ...currentRows.map(r => ({ ...r, _month: 1 })), // current = 1
    ...prevRows.map(r => ({ ...r, _month: 0 })),     // prev = 0
  ];

  // Count by platform × month
  const counts = new Map<string, [number, number]>();
  for (const row of allRows) {
    if (row.analyticsStatus !== 'Available') continue;
    const plat = row.platform.toLowerCase();
    if (!counts.has(plat)) counts.set(plat, [0, 0]);
    const c = counts.get(plat)!;
    c[row._month] += 1;
  }

  const result: MonthlyPostsDistributionRow[] = [];

  for (const [platform, [prev, curr]] of counts) {
    if (prev === 0 && curr === 0) continue;
    result.push({
      platform,
      label: PLATFORM_LABELS[platform] ?? platform,
      posts: [prev, curr],
      change: curr - prev,
    });
  }

  // Sort by current month total descending
  result.sort((a, b) => b.posts[1] - a.posts[1]);

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Build Top Content
// ─────────────────────────────────────────────────────────────────────────────

function buildTopContent(rows: PostAnalyticsRow[]): MonthlyTopContentRow[] {
  // Get top 5 by engagement (post-level, deduplicated by postId)
  const byPost = new Map<string, PostAnalyticsRow>();

  for (const row of rows) {
    if (row.analyticsStatus !== 'Available') continue;
    const existing = byPost.get(row.postId);
    if (!existing || row.engagement > existing.engagement) {
      byPost.set(row.postId, row);
    }
  }

  return Array.from(byPost.values())
    .sort((a, b) => b.engagement - a.engagement)
    .slice(0, 5)
    .map((row, i) => {
      const d = new Date(row.createdAt);
      return {
        rank: i + 1,
        date: toISOSADate(d),
        dateLabel: formatDate(d),
        title: (row.postText || '').split('\n')[0].substring(0, 80) || 'Untitled',
        platform: row.platform,
        impressions: row.impressions,
        views: row.views,
        engagements: row.engagement,
        er: row.impressions > 0
          ? Math.round((row.engagement / row.impressions) * 10000) / 100
          : 0,
      };
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Build Post of the Month — one best post per platform
// ─────────────────────────────────────────────────────────────────────────────

function buildPostOfMonth(rows: PostAnalyticsRow[]): MonthlyPostOfMonth[] {
  // Group by platform, pick best post by engagement
  const byPlatform = new Map<string, PostAnalyticsRow[]>();
  for (const row of rows) {
    if (row.analyticsStatus !== 'Available') continue;
    const plat = row.platform.toLowerCase();
    if (!byPlatform.has(plat)) byPlatform.set(plat, []);
    byPlatform.get(plat)!.push(row);
  }

  const result: MonthlyPostOfMonth[] = [];

  for (const [platform, platRows] of byPlatform) {
    if (platRows.length === 0) continue;

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

    const narrative = `${PLATFORM_LABELS[platform] ?? platform} post "${title}" was the top performer this month with ${eng.toLocaleString()} engagements and an ER of ${er.toFixed(2)}%.`;

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
      reposts: 0,
      clicks: (best as any).clicks ?? 0,
      postUrl: best.platformPostUrl || best.postUrl || '',
    });
  }

  result.sort((a, b) => b.engagements - a.engagements);
  return result;
}
