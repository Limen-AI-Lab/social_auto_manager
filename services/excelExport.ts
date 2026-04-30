// ============================================================
// SAMA - Excel Export
//
// Exports:
//   Sheet 1 (Overview): Overall metrics + platform summary
//   Sheet 2 (Post Details): postAnalyticsRows — same columns & display rules as UI
//   Sheet 3 (Weekly): Weekly report — platform KPIs + posts by date
//   Sheet 4 (Monthly): Monthly report — platform KPIs + CTR + Top Content
//
// IMPORTANT: All Excel transforms use the SAME data as the UI components.
// The window.__samaWeeklyReport and window.__samaMonthlyReport are set
// by WeeklyReport/MonthlyReport after they receive data.
// ============================================================

import * as XLSX from 'xlsx';
import {
  isPostAnalyticsMetricUnsupported,
  shouldHidePostEngagementRate,
  type PostAnalyticsRow,
  type PostAnalyticsNumericField,
} from './postAnalyticsData';
import type { WeeklyReportData } from './weeklyReportService';
import type { MonthlyReportData } from './monthlyReportService';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toLocaleString();
}

function fmtER(n: number): string {
  return `${n.toFixed(2)}%`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sheet 1: Overview
// ─────────────────────────────────────────────────────────────────────────────

function buildOverviewRows(): Record<string, string | number>[] {
  const overall = (window as any).samaOverallData || {};
  const platformData = (window as any).samaPlatformData || {};
  const dateRange = (window as any).samaReportDateRange || {};
  const periodLabel = (window as any).samaReportPeriod || '';

  const periodDisplay: Record<string, string> = {
    '7d': 'Last 7 Days', '14d': 'Last 14 Days',
    '30d': 'Last 30 Days', '90d': 'Last 90 Days',
  };

  const rows: Record<string, string | number>[] = [
    { Metric: 'Report Period', Value: periodDisplay[periodLabel] || 'Last 7 Days' },
    { Metric: 'Date Range', Value: dateRange.start ? `${dateRange.start} → ${dateRange.end}` : '' },
    { Metric: 'Report Generated', Value: new Date().toLocaleString('en-ZA') },
    { '': '' },
    { Metric: '─── Overall Metrics ───', Value: '' },
    { Metric: 'Total Posts', Value: overall.totalPosts || 0 },
    { Metric: 'Total Views', Value: overall.totalViews || 0 },
    { Metric: 'Total Likes', Value: overall.totalLikes || 0 },
    { Metric: 'Total Comments', Value: overall.totalComments || 0 },
    { Metric: 'Total Shares', Value: overall.totalShares || 0 },
    { Metric: 'Total Impressions', Value: overall.totalImpressions || 0 },
    { Metric: 'Total Reach', Value: overall.totalReach || 0 },
    { Metric: 'Total Engagement', Value: overall.totalEngagement || 0 },
    { Metric: 'Engagement Rate', Value: overall.avgEngagementRate != null ? `${overall.avgEngagementRate}%` : '0%' },
    { '': '' },
    { Metric: '─── Platform Summary ───', Value: '' },
  ];

  const PLATFORM_LABELS: Record<string, string> = {
    linkedin: 'LinkedIn', instagram: 'Instagram', youtube: 'YouTube',
    twitter: 'X', tiktok: 'TikTok', facebook: 'Facebook',
  };
  const platformOrder = ['linkedin', 'facebook', 'instagram', 'youtube', 'twitter', 'tiktok'];

  for (const key of platformOrder) {
    const m = platformData[key];
    if (!m) continue;
    rows.push({ Metric: `${PLATFORM_LABELS[key] || key}`, Value: '' });
    rows.push({ Metric: '  Views', Value: m.views || 0 });
    rows.push({ Metric: '  Impressions', Value: m.impressions || 0 });
    rows.push({ Metric: '  Likes', Value: m.likes || 0 });
    rows.push({ Metric: '  Comments', Value: m.comments || 0 });
    rows.push({ Metric: '  Shares', Value: m.shares || 0 });
    rows.push({ Metric: '  Engagement Rate', Value: m.avgEngagementRate != null ? `${m.avgEngagementRate}%` : '0%' });
  }

  return rows;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sheet 2: Post Details (same as existing)
// ─────────────────────────────────────────────────────────────────────────────

function buildPostDetailRows(): Record<string, string | number>[] {
  const posts = ((window as unknown as { samaPostsData?: PostAnalyticsRow[] }).samaPostsData || []) as PostAnalyticsRow[];
  if (posts.length === 0) return [];

  const cap = (p: string) => (p ? p.charAt(0).toUpperCase() + p.slice(1) : '');

  function excelNumeric(platform: string, field: PostAnalyticsNumericField, row: PostAnalyticsRow): number {
    if (row.analyticsStatus !== 'Available') return 0;
    if (field !== 'engagement' && isPostAnalyticsMetricUnsupported(platform, field)) return 0;
    return row[field] as number;
  }

  return posts.map((row) => {
    const plat = (row.platform || '').toLowerCase();
    const status = row.analyticsStatus || 'Pending';
    const hideEr = shouldHidePostEngagementRate(plat, row);
    const er = status === 'Available' && !hideEr ? `${row.engagementRate.toFixed(2)}%` : '0%';

    return {
      'Post Date': row.createdAt ? new Date(row.createdAt).toLocaleDateString('en-ZA') : '',
      'Post Text': row.postText || '',
      'Platform': plat === 'twitter' ? 'X' : cap(plat),
      'Post URL': row.postUrl || row.platformPostUrl || '',
      'Views': excelNumeric(plat, 'views', row),
      'Likes': excelNumeric(plat, 'likes', row),
      'Comments': excelNumeric(plat, 'comments', row),
      'Shares': excelNumeric(plat, 'shares', row),
      'Impressions': excelNumeric(plat, 'impressions', row),
      'Reach': excelNumeric(plat, 'reach', row),
      'Engagement': excelNumeric(plat, 'engagement', row),
      'Engagement Rate': er,
      'Analytics Status': status,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Sheet 3: Weekly Report
// ─────────────────────────────────────────────────────────────────────────────

function buildWeeklySheet(): Record<string, string | number>[] {
  const data = (window as any).__samaWeeklyReport as WeeklyReportData | undefined;
  if (!data) return [{ Note: 'No weekly report data. Generate a weekly report first.' }];

  const rows: Record<string, string | number>[] = [];

  // Header
  rows.push({ 'Weekly Report': data.clientName, '': data.periodLabel });
  rows.push({ 'Generated': data.generatedAt, '': 'SAST (UTC+2)' });
  rows.push({ '': '' });

  // Overview
  rows.push({ '': '─── Performance Overview ───' });
  rows.push({ Metric: 'Total Posts', Value: data.overview.totalPosts });
  rows.push({ Metric: 'Total Impressions', Value: data.overview.totalImpressions });
  rows.push({ Metric: 'Total Engagements', Value: data.overview.totalEngagements });
  rows.push({ Metric: 'Total Reach', Value: data.overview.totalReach });
  rows.push({ Metric: 'Engagement Rate', Value: `${data.overview.avgER.toFixed(2)}%` });
  rows.push({ Metric: 'Active Platforms', Value: data.overview.activePlatforms });
  rows.push({ '': '' });

  // Platform Performance
  rows.push({ '': '─── Platform Performance ───' });
  const platHeader = ['Platform', 'Posts'];
  // Collect all column headers
  const allCols = Array.from(new Set(data.platformRows.flatMap(r => r.columns.map(c => c.key))));
  platHeader.push(...allCols.map(c => c === 'er' ? 'Eng. Rate' : c.charAt(0).toUpperCase() + c.slice(1)));
  platHeader.push('vs Prev Week');
  rows.push(platHeader as unknown as Record<string, string | number>);

  for (const pr of data.platformRows) {
    const row: Record<string, string | number> = {
      Platform: pr.label,
      Posts: pr.posts,
    };
    for (const col of allCols) {
      const cd = pr.columns.find(c => c.key === col);
      const totalOf = (key: string) => {
        if (key === 'er') return pr.totals.er;
        if (key === 'engagements') return pr.totals.engagements;
        if (key === 'impressions') return pr.totals.impressions;
        if (key === 'views') return pr.totals.views;
        if (key === 'likes') return pr.totals.likes;
        if (key === 'comments') return pr.totals.comments;
        if (key === 'shares') return pr.totals.shares;
        if (key === 'reach') return pr.totals.reach;
        return 0;
      };
      row[col === 'er' ? 'Eng. Rate' : col.charAt(0).toUpperCase() + col.slice(1)] =
        col === 'er' ? `${totalOf(col).toFixed(2)}%` : totalOf(col);
    }
    row['vs Prev Week'] = pr.change
      ? `${pr.change.direction === 'up' ? '▲' : pr.change.direction === 'down' ? '▼' : ''} ${pr.change.value}%`
      : '0%';
    rows.push(row);
  }
  rows.push({ '': '' });

  // Posts by Date
  rows.push({ '': '─── Posts by Date ───' });
  rows.push({
    'Date': 'Date',
    'Post Text': 'Post Text',
    'Platform': 'Platform',
    'Views': 'Views',
    'Impressions': 'Impressions',
    'Likes': 'Likes',
    'Comments': 'Comments',
    'Engagements': 'Engagements',
    'Eng. Rate': 'Eng. Rate',
  } as unknown as Record<string, string | number>);

  for (const topic of data.topicRows) {
    for (const pr of topic.platformRows) {
      const row: Record<string, string | number> = {
        'Date': topic.dateLabel,
        'Post Text': topic.title,
        'Platform': pr.platform.charAt(0).toUpperCase() + pr.platform.slice(1),
      };
      for (const col of pr.columns) {
        const label = col.key === 'er' ? 'Eng. Rate'
          : col.key === 'views' ? 'Views'
          : col.key === 'impressions' ? 'Impressions'
          : col.key === 'likes' ? 'Likes'
          : col.key === 'comments' ? 'Comments'
          : col.key === 'engagements' ? 'Engagements'
          : col.key;
        row[label] = col.key === 'er' ? `${col.value.toFixed(2)}%` : col.value;
      }
      rows.push(row);
    }
  }

  return rows;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sheet 4: Monthly Report
// ─────────────────────────────────────────────────────────────────────────────

function buildMonthlySheet(): Record<string, string | number>[] {
  const data = (window as any).__samaMonthlyReport as MonthlyReportData | undefined;
  if (!data) return [{ Note: 'No monthly report data. Generate a monthly report first.' }];

  const rows: Record<string, string | number>[] = [];

  // Header
  rows.push({ 'Monthly Report': data.clientName, '': data.monthLabel });
  rows.push({ 'Generated': data.generatedAt, '': 'SAST (UTC+2)' });
  rows.push({ '': '' });

  // Overview
  rows.push({ '': '─── Performance Overview ───' });
  rows.push({ Metric: 'Total Posts', Value: data.overview.totalPosts });
  rows.push({ Metric: 'Total Impressions', Value: data.overview.totalImpressions });
  rows.push({ Metric: 'Total Engagements', Value: data.overview.totalEngagements });
  rows.push({ Metric: 'Total Reach', Value: data.overview.totalReach });
  rows.push({ Metric: 'Engagement Rate', Value: `${data.overview.avgER.toFixed(2)}%` });
  rows.push({ Metric: 'Active Platforms', Value: data.overview.activePlatforms });
  if (data.overview.totalFollowers) {
    rows.push({ Metric: 'Total Followers', Value: data.overview.totalFollowers });
    rows.push({ Metric: 'Follower Change', Value: `▲ ${data.overview.followersChange}% MoM` });
  }
  rows.push({ '': '' });

  // Dynamic month labels
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const prevMonth = data.month === 1 ? 12 : data.month - 1;
  const prevYear = data.month === 1 ? data.year - 1 : data.year;
  const prevLabel = monthNames[prevMonth - 1] + ' ' + prevYear;
  const currLabel = monthNames[data.month - 1] + ' ' + data.year;

  // Platform Summary
  rows.push({ '': '─── Platform Summary ───' });
  const hasFollowers = data.platformRows.some(r => r.followers !== undefined);
  const platHeader = ['Platform', 'Posts'];
  if (hasFollowers) platHeader.push('Followers', 'Follower Δ');
  for (const col of data.platformRows[0]?.columns ?? []) {
    platHeader.push(col.label);
  }
  platHeader.push(prevLabel, currLabel, 'Δ MoM');
  rows.push(platHeader as unknown as Record<string, string | number>);

  for (const pr of data.platformRows) {
    const row: Record<string, string | number> = {
      Platform: pr.label,
      Posts: pr.posts,
    };
    if (hasFollowers) {
      row['Followers'] = pr.followers ?? 0;
      row['Follower Δ'] = pr.followersChange != null
        ? `${pr.followersChange >= 0 ? '▲' : '▼'} ${Math.abs(pr.followersChange)}%`
        : '0%';
    }
    for (const col of pr.columns) {
      row[col.label] = col.key === 'er' ? `${col.value.toFixed(2)}%` : col.value;
    }
    row[prevLabel] = pr.totals.monthlyImpressions[0];
    row[currLabel] = pr.totals.monthlyImpressions[1];
    row['Δ MoM'] = pr.change
      ? `${pr.change.direction === 'up' ? '▲' : pr.change.direction === 'down' ? '▼' : ''} ${pr.change.value}%`
      : '0%';
    rows.push(row);
  }
  rows.push({ '': '' });

  // CTR
  if (data.ctrRows.length > 0) {
    rows.push({ '': '─── Click-Through Rate ───' });
    rows.push({
      Platform: 'Platform',
      Clicks: 'Clicks',
      Impressions: 'Impressions',
      CTR: 'CTR',
      'Prev CTR': 'Prev CTR',
      'Δ vs Prev': 'Δ vs Prev',
    } as unknown as Record<string, string | number>);
    for (const r of data.ctrRows) {
      rows.push({
        Platform: r.label,
        Clicks: r.clicks,
        Impressions: r.impressions,
        CTR: `${r.ctr.toFixed(2)}%`,
        'Prev CTR': `${r.prevCtr.toFixed(2)}%`,
        'Δ vs Prev': `${r.change >= 0 ? '▲' : '▼'} ${Math.abs(r.change)}pp`,
      });
    }
    rows.push({ '': '' });
  }

  // Posts Distribution
  if (data.postsDistribution.length > 0) {
    rows.push({ '': '─── Posts Distribution ───' });
    rows.push({
      Platform: 'Platform',
      [prevLabel]: prevLabel,
      [currLabel]: currLabel,
      'Δ': 'Δ',
    } as unknown as Record<string, string | number>);
    for (const r of data.postsDistribution) {
      rows.push({
        Platform: r.label,
        [prevLabel]: r.posts[0] || 0,
        [currLabel]: r.posts[1] || 0,
        'Δ': `${r.change >= 0 ? '+' : ''}${r.change}`,
      });
    }
    rows.push({ '': '' });
  }

  // Top Content
  if (data.topContent.length > 0) {
    rows.push({ '': '─── Top Performing Content ───' });
    rows.push({
      Rank: 'Rank',
      Date: 'Date',
      'Post Text': 'Post Text',
      Platform: 'Platform',
      Impressions: 'Impressions',
      Views: 'Views',
      Engagements: 'Engagements',
      'Eng. Rate': 'Eng. Rate',
    } as unknown as Record<string, string | number>);
    for (const r of data.topContent) {
      rows.push({
        Rank: `#${r.rank}`,
        Date: r.dateLabel,
        'Post Text': r.title,
        Platform: r.platform.charAt(0).toUpperCase() + r.platform.slice(1),
        Impressions: r.impressions,
        Views: r.views,
        Engagements: r.engagements,
        'Eng. Rate': `${r.er.toFixed(2)}%`,
      });
    }
  }

  return rows;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main exports
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Download full analytics report as a 2-sheet Excel file:
 *   Sheet 1: Overview (overall metrics + platform breakdown)
 *   Sheet 2: Post Details (postAnalyticsRows — same as Posts view)
 */
export function downloadFullReportAsExcel() {
  const posts = (window as unknown as { samaPostsData?: PostAnalyticsRow[] }).samaPostsData;
  if ((!posts || posts.length === 0) && !((window as any).samaOverallData)) {
    alert('No data available. Please fetch data first.');
    return;
  }

  const wb = XLSX.utils.book_new();

  // Sheet 1: Overview
  const overviewRows = buildOverviewRows();
  const wsOverview = XLSX.utils.json_to_sheet(overviewRows);
  wsOverview['!cols'] = [{ wch: 30 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsOverview, 'Overview');

  // Sheet 2: Post Details
  const postRows = buildPostDetailRows();
  if (postRows.length > 0) {
    const wsPosts = XLSX.utils.json_to_sheet(postRows);
    wsPosts['!cols'] = [
      { wch: 12 }, { wch: 40 }, { wch: 12 }, { wch: 45 },
      { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 },
      { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 16 }, { wch: 18 },
    ];
    XLSX.utils.book_append_sheet(wb, wsPosts, 'Post Details');
  }

  const filename = `SAMA_Analytics_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, filename);
  console.log('[SAMA] Excel report downloaded:', filename);
}

/**
 * Download weekly report as Excel (Sheet 3 of full report).
 * Uses window.__samaWeeklyReport populated by WeeklyReport component.
 */
export function downloadWeeklyReportAsExcel() {
  const wb = XLSX.utils.book_new();

  const weeklyRows = buildWeeklySheet();
  const ws = XLSX.utils.json_to_sheet(weeklyRows);
  // Auto-size columns
  const colWidths: { ch: number }[] = [];
  if (weeklyRows.length > 0) {
    const keys = Object.keys(weeklyRows[0]);
    for (const k of keys) {
      const maxLen = Math.max(k.length, ...weeklyRows.map(r => String(r[k] ?? '').length));
      colWidths.push({ ch: Math.min(maxLen + 2, 50) });
    }
    ws['!cols'] = colWidths;
  }
  XLSX.utils.book_append_sheet(wb, ws, 'Weekly Report');

  const filename = `SAMA_Weekly_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, filename);
  console.log('[SAMA] Weekly Excel downloaded:', filename);
}

/**
 * Download monthly report as Excel.
 * Uses window.__samaMonthlyReport populated by MonthlyReport component.
 */
export function downloadMonthlyReportAsExcel() {
  const wb = XLSX.utils.book_new();

  const monthlyRows = buildMonthlySheet();
  const ws = XLSX.utils.json_to_sheet(monthlyRows);
  if (monthlyRows.length > 0) {
    const keys = Object.keys(monthlyRows[0]);
    const colWidths: { ch: number }[] = keys.map(k => ({ ch: Math.min(Math.max(k.length, 8) + 2, 50) }));
    ws['!cols'] = colWidths;
  }
  XLSX.utils.book_append_sheet(wb, ws, 'Monthly Report');

  const filename = `SAMA_Monthly_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, filename);
  console.log('[SAMA] Monthly Excel downloaded:', filename);
}

/**
 * Download combined 4-sheet report (Overview + Post Details + Weekly + Monthly).
 */
export function downloadCombinedReportAsExcel() {
  const wb = XLSX.utils.book_new();

  // Sheet 1
  const overviewRows = buildOverviewRows();
  const ws1 = XLSX.utils.json_to_sheet(overviewRows);
  ws1['!cols'] = [{ wch: 30 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, ws1, 'Overview');

  // Sheet 2
  const postRows = buildPostDetailRows();
  if (postRows.length > 0) {
    const ws2 = XLSX.utils.json_to_sheet(postRows);
    ws2['!cols'] = [
      { wch: 12 }, { wch: 40 }, { wch: 12 }, { wch: 45 },
      { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 },
      { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 16 }, { wch: 18 },
    ];
    XLSX.utils.book_append_sheet(wb, ws2, 'Post Details');
  }

  // Sheet 3: Weekly
  const weeklyRows = buildWeeklySheet();
  const ws3 = XLSX.utils.json_to_sheet(weeklyRows);
  if (weeklyRows.length > 0) {
    const keys = Object.keys(weeklyRows[0]);
    ws3['!cols'] = keys.map(k => ({ ch: Math.min(Math.max(k.length, 8) + 2, 50) }));
  }
  XLSX.utils.book_append_sheet(wb, ws3, 'Weekly Report');

  // Sheet 4: Monthly
  const monthlyRows = buildMonthlySheet();
  const ws4 = XLSX.utils.json_to_sheet(monthlyRows);
  if (monthlyRows.length > 0) {
    const keys = Object.keys(monthlyRows[0]);
    ws4['!cols'] = keys.map(k => ({ ch: Math.min(Math.max(k.length, 8) + 2, 50) }));
  }
  XLSX.utils.book_append_sheet(wb, ws4, 'Monthly Report');

  const filename = `SAMA_Combined_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, filename);
  console.log('[SAMA] Combined report Excel downloaded:', filename);
}
