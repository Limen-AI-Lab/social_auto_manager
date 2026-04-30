// ============================================================
// SAMA - Weekly Report Excel Export: Pure Data Builders
//
// 不依赖 xlsx，只生成 Excel 结构数据（rows + styles）。
// 由 excelWeeklyExport.ts 中的 downloadWeeklyReportAsExcel 消费。
// ============================================================

import type {
  WeeklyReportData,
  WeeklyPlatformRow,
  WeeklyTopicRow,
  WeeklyPostPlatformRow,
} from './weeklyReportService';

// ─────────────────────────────────────────────────────────────────────────────
// 常量 & 配色
// ─────────────────────────────────────────────────────────────────────────────

export const PLATFORM_COLORS: Record<string, string> = {
  tiktok:    '000000',
  instagram: 'E4405F',
  linkedin:  '0077B5',
  youtube:   'FF0000',
  facebook:  '1877F2',
  twitter:   '000000',
};

export const PLATFORM_LABELS: Record<string, string> = {
  tiktok:    'TikTok',
  instagram: 'Instagram',
  linkedin:  'LinkedIn',
  youtube:   'YouTube',
  facebook:  'Facebook',
  twitter:   'X',
};

export const C = {
  HEADER_BG:  '1E293B',
  HEADER_FG:  'FFFFFF',
  SECTION_BG: '1E293B',
  SECTION_FG: 'FFFFFF',
  TH_BG:      'F1F5F9',
  TH_FG:      '64748B',
  ODD_ROW:    'FFFFFF',
  EVEN_ROW:   'F8FAFC',
  ZEBRA_ODD:  'FFFFFF',
  ZEBRA_EVEN: 'F1F5F9',
  TOTAL_BG:   'F8FAFC',
  META_FG:    '94A3B8',
  BODY_FG:    '334155',
  EMPHASIS:   '0F172A',
  UP:         '065F46',
  DOWN:       '991B1B',
  FLAT:       '94A3B8',
};

// ─────────────────────────────────────────────────────────────────────────────
// Cell / Row 类型
// ─────────────────────────────────────────────────────────────────────────────

export interface Cell {
  v: string | number;
  bold?: boolean;
  color?: string;
  bg?: string;
  align?: 'left' | 'center' | 'right';
}

export type ExcelRow = (Cell | null)[];

// ─────────────────────────────────────────────────────────────────────────────
// 辅助函数
// ─────────────────────────────────────────────────────────────────────────────

export function fmtK(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export function fmtFull(n: number): string {
  return n.toLocaleString();
}

export function fmtER(n: number): string {
  return `${n.toFixed(2)}%`;
}

export function spacer(): ExcelRow {
  return Array(24).fill(null);
}

export function sectionTitle(label: string): ExcelRow {
  const row: ExcelRow = new Array(24).fill(null);
  row[0] = { v: label, bold: true, color: C.SECTION_FG, bg: C.SECTION_BG };
  return row;
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 1: Report Header
// ─────────────────────────────────────────────────────────────────────────────

export function buildReportHeader(data: WeeklyReportData): ExcelRow[] {
  const tz = 'SAST (UTC+2)';
  return [
    sectionTitle(''),
    [
      { v: data.clientName || 'Weekly Report', bold: true, color: C.EMPHASIS },
      null, null, null, null, null, null, null,
      { v: 'Report Period:', color: C.META_FG },
      { v: data.periodLabel, color: C.BODY_FG },
      null, null,
      { v: 'Generated:', color: C.META_FG },
      { v: data.generatedAt, color: C.BODY_FG },
      null,
      { v: tz, color: C.META_FG },
    ],
    spacer(),
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 2: Performance Overview（5 KPI）
// ─────────────────────────────────────────────────────────────────────────────

export function buildPerformanceOverview(data: WeeklyReportData): ExcelRow[] {
  const { overview } = data;
  const kpis: Array<{ label: string; value: string; sub: string }> = [
    {
      label: 'Posts Published',
      value: overview.totalPosts > 0 ? fmtFull(overview.totalPosts) : '—',
      sub: `${overview.activePlatforms} platforms`,
    },
    {
      label: 'Total Impressions',
      value: overview.totalImpressions > 0 ? fmtK(overview.totalImpressions) : '—',
      sub: 'across all platforms',
    },
    {
      label: 'Total Engagements',
      value: overview.totalEngagements > 0 ? fmtK(overview.totalEngagements) : '—',
      sub: 'likes + comments + shares',
    },
    {
      label: 'Engagement Rate',
      value: overview.avgER > 0 ? fmtER(overview.avgER) : '—',
      sub: 'eng / impressions',
    },
    {
      label: 'Total Reach',
      value: overview.totalReach > 0 ? fmtK(overview.totalReach) : '—',
      sub: 'unique accounts',
    },
  ];

  return [
    sectionTitle('PERFORMANCE OVERVIEW'),
    kpis.map(k => ({ v: k.label, bold: true, color: C.TH_FG, bg: C.TH_BG, align: 'center' as const })),
    kpis.map(k => ({ v: k.value, bold: true, color: C.EMPHASIS, bg: C.EVEN_ROW, align: 'center' as const })),
    kpis.map(k => ({ v: k.sub, color: C.META_FG, bg: C.EVEN_ROW, align: 'center' as const })),
    spacer(),
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 3: Platform Performance
// ─────────────────────────────────────────────────────────────────────────────

export function buildPlatformPerformanceTable(platformRows: WeeklyPlatformRow[]): ExcelRow[] {
  const rows: ExcelRow[] = [sectionTitle('PLATFORM PERFORMANCE')];

  rows.push([
    { v: 'Platform',    bold: true, color: C.TH_FG, bg: C.TH_BG },
    { v: 'Posts',       bold: true, color: C.TH_FG, bg: C.TH_BG, align: 'center' },
    { v: 'Impressions', bold: true, color: C.TH_FG, bg: C.TH_BG, align: 'right' },
    { v: 'Views',       bold: true, color: C.TH_FG, bg: C.TH_BG, align: 'right' },
    { v: 'Likes',       bold: true, color: C.TH_FG, bg: C.TH_BG, align: 'right' },
    { v: 'Comments',    bold: true, color: C.TH_FG, bg: C.TH_BG, align: 'right' },
    { v: 'Shares',      bold: true, color: C.TH_FG, bg: C.TH_BG, align: 'right' },
    { v: 'Reach',       bold: true, color: C.TH_FG, bg: C.TH_BG, align: 'right' },
    { v: 'Engagements', bold: true, color: C.TH_FG, bg: C.TH_BG, align: 'right' },
    { v: 'vs Prev Week',bold: true, color: C.TH_FG, bg: C.TH_BG, align: 'center' },
  ]);

  let totalPosts = 0;
  let totalImpr = 0;
  let totalViews = 0;
  let totalLikes = 0;
  let totalComments = 0;
  let totalShares = 0;
  let totalReach = 0;
  let totalEng = 0;

  const ORDER = ['linkedin', 'facebook', 'instagram', 'youtube', 'twitter', 'tiktok'];
  const ordered = ORDER
    .map(p => platformRows.find(r => r.platform === p))
    .filter(Boolean) as WeeklyPlatformRow[];

  ordered.forEach((row, i) => {
    const t = row.totals;
    totalPosts     += row.posts;
    totalImpr     += t.impressions;
    totalViews    += t.views;
    totalLikes    += t.likes;
    totalComments += t.comments;
    totalShares   += t.shares;
    totalReach    += t.reach;
    totalEng      += t.engagements;

    const bg = i % 2 === 0 ? C.ZEBRA_ODD : C.ZEBRA_EVEN;
    const platformBg = PLATFORM_COLORS[row.platform] ?? C.TH_BG;

    let deltaCell: Cell;
    if (row.change) {
      const { direction, value } = row.change;
      const arrow = direction === 'up' ? '▲' : direction === 'down' ? '▼' : '—';
      const color = direction === 'up' ? C.UP : direction === 'down' ? C.DOWN : C.FLAT;
      deltaCell = { v: `${arrow} ${value}%`, color, bold: true, align: 'center', bg };
    } else {
      deltaCell = { v: '—', color: C.FLAT, align: 'center', bg };
    }

    rows.push([
      { v: PLATFORM_LABELS[row.platform] ?? row.platform, bold: true, color: 'FFFFFF', bg: platformBg, align: 'center' },
      { v: row.posts,   align: 'center', bg, color: C.EMPHASIS },
      { v: t.impressions > 0 ? fmtK(t.impressions) : '—', align: 'right', bg, color: t.impressions > 0 ? C.EMPHASIS : C.META_FG },
      { v: t.views     > 0 ? fmtK(t.views)           : '—', align: 'right', bg, color: t.views     > 0 ? C.EMPHASIS : C.META_FG },
      { v: t.likes     > 0 ? fmtFull(t.likes)      : '—', align: 'right', bg, color: t.likes     > 0 ? C.EMPHASIS : C.META_FG },
      { v: t.comments  > 0 ? fmtFull(t.comments)    : '—', align: 'right', bg, color: t.comments  > 0 ? C.EMPHASIS : C.META_FG },
      { v: t.shares    > 0 ? fmtFull(t.shares)     : '—', align: 'right', bg, color: t.shares    > 0 ? C.EMPHASIS : C.META_FG },
      { v: t.reach     > 0 ? fmtK(t.reach)          : '—', align: 'right', bg, color: t.reach     > 0 ? C.EMPHASIS : C.META_FG },
      { v: t.engagements > 0 ? fmtK(t.engagements)  : '—', align: 'right', bg, color: t.engagements > 0 ? C.EMPHASIS : C.META_FG },
      deltaCell,
    ]);
  });

  rows.push([
    { v: 'Total', bold: true, color: C.EMPHASIS, bg: C.TOTAL_BG, align: 'center' },
    { v: totalPosts, bold: true, align: 'center', bg: C.TOTAL_BG, color: C.EMPHASIS },
    { v: fmtK(totalImpr),   bold: true, align: 'right', bg: C.TOTAL_BG, color: C.EMPHASIS },
    { v: fmtK(totalViews), bold: true, align: 'right', bg: C.TOTAL_BG, color: C.EMPHASIS },
    { v: fmtFull(totalLikes),    bold: true, align: 'right', bg: C.TOTAL_BG, color: C.EMPHASIS },
    { v: fmtFull(totalComments), bold: true, align: 'right', bg: C.TOTAL_BG, color: C.EMPHASIS },
    { v: fmtFull(totalShares),   bold: true, align: 'right', bg: C.TOTAL_BG, color: C.EMPHASIS },
    { v: fmtK(totalReach),       bold: true, align: 'right', bg: C.TOTAL_BG, color: C.EMPHASIS },
    { v: fmtK(totalEng),         bold: true, align: 'right', bg: C.TOTAL_BG, color: C.EMPHASIS },
    { v: '—', color: C.FLAT, align: 'center', bg: C.TOTAL_BG },
  ]);

  rows.push(spacer());
  return rows;
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 4: Posts by Date + Content Topics（两栏并排）
// Posts by Date: col A-H, Content Topics: col J+
// ─────────────────────────────────────────────────────────────────────────────

export function buildPostsByDateAndTopics(
  topicRows: WeeklyTopicRow[],
  topics: WeeklyReportData['topics'],
): ExcelRow[] {
  const rows: ExcelRow[] = [];

  // ── 左栏：POSTS BY DATE ──────────────────────────────────────────────────
  rows.push(sectionTitle('POSTS BY DATE'));
  rows.push([
    { v: 'Date',        bold: true, color: C.TH_FG, bg: C.TH_BG },
    { v: 'Post Text',   bold: true, color: C.TH_FG, bg: C.TH_BG },
    { v: 'Platform',    bold: true, color: C.TH_FG, bg: C.TH_BG, align: 'center' },
    { v: 'Views',       bold: true, color: C.TH_FG, bg: C.TH_BG, align: 'right' },
    { v: 'Impressions', bold: true, color: C.TH_FG, bg: C.TH_BG, align: 'right' },
    { v: 'Eng.',        bold: true, color: C.TH_FG, bg: C.TH_BG, align: 'right' },
    { v: 'ER%',         bold: true, color: C.TH_FG, bg: C.TH_BG, align: 'right' },
    { v: '',            bold: true, color: C.TH_FG, bg: C.TH_BG },
  ]);

  let totalPosts = 0;
  let totalViews = 0;
  let totalImpr = 0;
  let totalEng = 0;

  topicRows.forEach(tr => {
    // 日期分组标题
    rows.push([
      { v: tr.dateLabel.toUpperCase(), bold: true, color: C.TH_FG, bg: C.TH_BG, align: 'left' },
      null, null, null, null, null, null, null,
    ]);

    tr.platformRows.forEach((pr, pIdx) => {
      const bg = pIdx % 2 === 0 ? C.ZEBRA_ODD : C.ZEBRA_EVEN;
      const viewVal  = pr.columns.find(c => c.key === 'views')?.value ?? 0;
      const imprVal  = pr.columns.find(c => c.key === 'impressions')?.value ?? 0;
      const engVal   = pr.columns.find(c => c.key === 'engagements')?.value ?? 0;
      const erVal    = pr.columns.find(c => c.key === 'er')?.value ?? 0;

      totalPosts++;
      totalViews += viewVal;
      totalImpr  += imprVal;
      totalEng   += engVal;

      const platformBg = PLATFORM_COLORS[pr.platform] ?? C.TH_BG;
      const erColor = erVal > 0 ? C.EMPHASIS : C.META_FG;

      // 截取日期部分（去掉星期，如 "Mon 30 Mar 2026" → "30 Mar 2026"）
      const shortDate = tr.dateLabel.replace(/^[A-Za-z]+\s+/, '');

      rows.push([
        { v: shortDate, color: C.BODY_FG, bg },
        { v: tr.title,  color: C.BODY_FG, bg },
        { v: PLATFORM_LABELS[pr.platform] ?? pr.platform, bold: true, color: 'FFFFFF', bg: platformBg, align: 'center' },
        { v: viewVal  > 0 ? fmtK(viewVal)  : '—', align: 'right', bg, color: viewVal  > 0 ? C.EMPHASIS : C.META_FG },
        { v: imprVal  > 0 ? fmtK(imprVal)  : '—', align: 'right', bg, color: imprVal  > 0 ? C.EMPHASIS : C.META_FG },
        { v: engVal   > 0 ? fmtK(engVal)   : '—', align: 'right', bg, color: engVal   > 0 ? C.EMPHASIS : C.META_FG },
        { v: erVal    > 0 ? fmtER(erVal)   : '—', align: 'right', bg, color: erColor },
        { v: '▲', align: 'center', bg, color: C.UP },
      ]);
    });
  });

  rows.push([
    { v: 'Total', bold: true, color: C.EMPHASIS, bg: C.TOTAL_BG },
    { v: `${totalPosts} posts`, bold: true, color: C.EMPHASIS, bg: C.TOTAL_BG },
    null,
    { v: fmtK(totalViews), bold: true, align: 'right', bg: C.TOTAL_BG, color: C.EMPHASIS },
    { v: fmtK(totalImpr),  bold: true, align: 'right', bg: C.TOTAL_BG, color: C.EMPHASIS },
    { v: fmtK(totalEng),   bold: true, align: 'right', bg: C.TOTAL_BG, color: C.EMPHASIS },
    null, null,
  ]);

  rows.push(spacer());

  // ── 右栏：CONTENT TOPICS（col J=9 起）───────────────────────────────────
  rows.push([
    { v: 'CONTENT TOPICS', bold: true, color: C.SECTION_FG, bg: C.SECTION_BG },
    null, null, null, null, null, null, null, null,  // col 0-8
    { v: 'CONTENT TOPICS', bold: true, color: C.SECTION_FG, bg: C.SECTION_BG },
    null, null, null, null,
  ]);

  rows.push([
    { v: 'Topic',     bold: true, color: C.TH_FG, bg: C.TH_BG },
    { v: 'Posts',     bold: true, color: C.TH_FG, bg: C.TH_BG, align: 'center' },
    { v: 'Avg ER%',   bold: true, color: C.TH_FG, bg: C.TH_BG, align: 'right' },
    { v: 'Trend',     bold: true, color: C.TH_FG, bg: C.TH_BG, align: 'center' },
    { v: '', bold: true, color: C.TH_FG, bg: C.TH_BG },
    { v: '', bold: true, color: C.TH_FG, bg: C.TH_BG },
    { v: '', bold: true, color: C.TH_FG, bg: C.TH_BG },
    { v: '', bold: true, color: C.TH_FG, bg: C.TH_BG },
    { v: '', bold: true, color: C.TH_FG, bg: C.TH_BG },
    // col 9 起的表头
    { v: 'Topic',     bold: true, color: C.TH_FG, bg: C.TH_BG },
    { v: 'Posts',     bold: true, color: C.TH_FG, bg: C.TH_BG, align: 'center' },
    { v: 'Avg ER%',   bold: true, color: C.TH_FG, bg: C.TH_BG, align: 'right' },
    { v: 'Trend',     bold: true, color: C.TH_FG, bg: C.TH_BG, align: 'center' },
    null, null, null, null, null, null, null, null,
  ]);

  const sortedTopics = [...topics].sort((a, b) => b.avgER - a.avgER);
  sortedTopics.forEach((topic, i) => {
    const bg = i % 2 === 0 ? C.ZEBRA_ODD : C.ZEBRA_EVEN;
    const direction = topic.avgER > 5 ? 'up' : topic.avgER < 2 ? 'down' : 'flat';
    const arrow = direction === 'up' ? '▲' : direction === 'down' ? '▼' : '—';
    const tColor = direction === 'up' ? C.UP : direction === 'down' ? C.DOWN : C.FLAT;

    const row: ExcelRow = new Array(24).fill(null);
    row[9]  = { v: topic.label, color: C.BODY_FG, bg };
    row[10] = { v: `${topic.postCount} posts`, color: C.BODY_FG, bg, align: 'center' };
    row[11] = { v: topic.avgER > 0 ? fmtER(topic.avgER) : '—', bold: true, align: 'right', bg, color: C.EMPHASIS };
    row[12] = { v: arrow, bold: true, align: 'center', bg, color: tColor };
    rows.push(row);
  });

  rows.push(spacer());
  return rows;
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 5: Post Title Code Table
// ─────────────────────────────────────────────────────────────────────────────

export function buildPostTitleTable(topicRows: WeeklyTopicRow[]): ExcelRow[] {
  const rows: ExcelRow[] = [sectionTitle('POST TITLE CODES')];

  rows.push([
    { v: 'Code',       bold: true, color: C.TH_FG, bg: C.TH_BG, align: 'center' },
    { v: 'Date',       bold: true, color: C.TH_FG, bg: C.TH_BG },
    { v: 'Post Title', bold: true, color: C.TH_FG, bg: C.TH_BG },
  ]);

  topicRows.forEach((tr, i) => {
    const bg = i % 2 === 0 ? C.ZEBRA_ODD : C.ZEBRA_EVEN;
    rows.push([
      { v: `P${i + 1}`, bold: true, color: 'FFFFFF', bg: C.SECTION_BG, align: 'center' },
      { v: tr.dateLabel, color: C.BODY_FG, bg },
      { v: tr.title, color: C.BODY_FG, bg },
    ]);
  });

  rows.push(spacer());
  return rows;
}

// ─────────────────────────────────────────────────────────────────────────────
// 合并所有 Section
// ─────────────────────────────────────────────────────────────────────────────

export function buildAllSections(data: WeeklyReportData): ExcelRow[] {
  const rows: ExcelRow[] = [];

  rows.push(...buildReportHeader(data));
  rows.push(...buildPerformanceOverview(data));
  rows.push(...buildPlatformPerformanceTable(data.platformRows));
  rows.push(...buildPostsByDateAndTopics(data.topicRows, data.topics));
  rows.push(...buildPostTitleTable(data.topicRows));

  return rows;
}

// ─────────────────────────────────────────────────────────────────────────────
// 列宽 & 行高
// ─────────────────────────────────────────────────────────────────────────────

export function computeColWidths(rows: ExcelRow[]): object[] {
  const maxLen: number[] = [];
  for (const row of rows) {
    row.forEach((cell, i) => {
      if (cell && cell.v !== undefined) {
        const len = String(cell.v).length;
        maxLen[i] = Math.max(maxLen[i] ?? 0, len);
      }
    });
  }
  return maxLen.map(l => ({
    wch: Math.max(8, Math.min(40, Math.ceil(l * 0.85))),
  }));
}

export function computeRowHeights(rows: ExcelRow[]): object[] {
  return rows.map(row => {
    const first = row[0];
    if (!first) return { hpt: 6 };
    if (first.bg === C.SECTION_BG && first.bold) return { hpt: 20 };
    if (first.bg === C.TH_BG) return { hpt: 18 };
    if (first.bg === C.TOTAL_BG) return { hpt: 18 };
    return { hpt: 16 };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 单元格样式（给 XLSX 写入用）
// ─────────────────────────────────────────────────────────────────────────────

export function applyCellStyle(
  cell: { s?: Record<string, unknown> },
  c: Cell,
): void {
  if (!cell.s) cell.s = {};
  if (c.bold)  cell.s.font = { ...(cell.s.font as Record<string, unknown> || {}), bold: true };
  if (c.color) cell.s.font = { ...(cell.s.font as Record<string, unknown> || {}), color: { rgb: c.color } };
  if (c.bg)    cell.s.fill = { fgColor: { rgb: c.bg }, patternType: 'solid' };
  if (c.align) cell.s.alignment = { horizontal: c.align };
}
