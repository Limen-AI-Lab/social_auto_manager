// ============================================================
// SAMA - Monthly Report Excel Export
//
// Matches MonthlyReport.tsx UI template exactly.
// Structure:
//   1. Header: Client Name / Month / Generated / Timezone
//   2. Performance Overview: 6 KPI cards
//   3. Platform Summary: dynamic cols + Prev Month / Current Month / Δ MoM + Total row
//   4. CTR (LinkedIn + Facebook): Clicks / Impressions / CTR / Prev CTR / Δ
//   5. Posts Distribution: Prev Month Posts / Current Month Posts / Δ + Total row
//   6. Top Performing Content: Rank / Date / Post Text / Platform / Impressions / Views / Engagements / ER
// ============================================================

import * as XLSX from 'xlsx';
import type { MonthlyReportData } from './monthlyReportService';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function pct(n: number): string {
  return `${n.toFixed(2)}%`;
}

function fmtNum(n: number): number {
  return n;
}

function fmtK(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toLocaleString();
}

function fmtLabel(platform: string): string {
  const map: Record<string, string> = {
    linkedin: 'LinkedIn',
    facebook: 'Facebook',
    instagram: 'Instagram',
    youtube: 'YouTube',
    twitter: 'X',
    tiktok: 'TikTok',
  };
  return map[platform] ?? platform;
}

// ─────────────────────────────────────────────────────────────────────────────
// Cell type
// ─────────────────────────────────────────────────────────────────────────────

interface Cell {
  v: string | number;
  bold?: boolean;
  color?: string;
  bg?: string;
  align?: 'left' | 'center' | 'right';
}

type ExcelRow = (Cell | null)[];

// ─────────────────────────────────────────────────────────────────────────────
// Build Excel rows (array-of-arrays)
// ─────────────────────────────────────────────────────────────────────────────

function buildMonthlyExcelRows(data: MonthlyReportData): ExcelRow[] {
  const rows: ExcelRow[] = [];

  // ── Section 1: Report Header ───────────────────────────────────────────────
  rows.push([
    { v: data.clientName || 'Client Report', bold: true, color: '1e293b' },
    null,
    { v: data.monthLabel || '', color: '64748b' },
    null,
    { v: 'Generated:', color: '94a3b8' },
    { v: data.generatedAt, color: '64748b' },
    { v: 'Timezone:', color: '94a3b8' },
    { v: 'SAST (UTC+2)', color: '64748b' },
  ]);
  rows.push([]); // spacer

  // ── Section 2: Performance Overview ────────────────────────────────────────
  rows.push([
    { v: 'PERFORMANCE OVERVIEW', bold: true, color: '64748b', bg: 'f1f5f9' },
    null, null, null, null, null, null, null,
  ]);

  const ov = data.overview;
  const ovRows: [string, string | number][] = [
    ['Posts Published', fmtNum(ov.totalPosts)],
    ['Total Impressions', fmtK(ov.totalImpressions)],
    ['Total Engagements', fmtNum(ov.totalEngagements)],
    ['Engagement Rate', pct(ov.avgER)],
    ['Total Reach', fmtK(ov.totalReach)],
  ];
  // Layout: label | value pairs in 4 cols (2 pairs per row)
  for (let i = 0; i < ovRows.length; i += 2) {
    const [l1, v1] = ovRows[i];
    rows.push([
      { v: l1, color: '64748b' },
      { v: v1, bold: true, color: '0f172a' },
      ...(ovRows[i + 1]
        ? [
            { v: ovRows[i + 1][0], color: '64748b' },
            { v: ovRows[i + 1][1], bold: true, color: '0f172a' },
          ]
        : [null, null]),
      null, null, null, null,
    ]);
  }
  // Followers row (if available)
  if (ov.totalFollowers) {
    rows.push([
      { v: 'Total Followers', color: '64748b' },
      { v: fmtNum(ov.totalFollowers), bold: true, color: '0f172a' },
      { v: ov.followersChange !== undefined ? `▲ ${ov.followersChange > 0 ? '+' : ''}${ov.followersChange}% MoM` : '', color: ov.followersChange !== undefined && ov.followersChange >= 0 ? '059669' : 'dc2626' },
      null, null, null, null, null,
    ]);
  }
  rows.push([]); // spacer

  // ── Section 3: Platform Summary ────────────────────────────────────────────
  rows.push([
    { v: 'PLATFORM SUMMARY', bold: true, color: '64748b', bg: 'f1f5f9' },
    null, null, null, null, null, null, null,
  ]);

  // Determine prev/current month labels
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const prevMonthIdx = data.month === 1 ? 11 : data.month - 2; // 0-indexed: Jan=0
  const prevLabel = monthNames[prevMonthIdx];
  const currLabel = monthNames[data.month - 1];

  // Collect all unique metric keys across all platforms
  const allMetricKeys = new Set<string>();
  for (const pr of data.platformRows) {
    for (const c of pr.columns) {
      allMetricKeys.add(c.key);
    }
  }
  const orderedMetricKeys = Array.from(allMetricKeys).filter(k => k !== 'er');
  if (allMetricKeys.has('er')) orderedMetricKeys.push('er');

  // Header row
  const platHeader: (Cell | null)[] = [
    { v: 'Platform', bold: true, color: '64748b', bg: 'f8fafc' },
    { v: 'Posts', bold: true, color: '64748b', bg: 'f8fafc', align: 'right' },
  ];
  // Followers columns (LinkedIn + Facebook only)
  if (data.platformRows.some(r => r.followers !== undefined)) {
    platHeader.push({ v: 'Followers', bold: true, color: '64748b', bg: 'f8fafc', align: 'right' });
    platHeader.push({ v: 'Follower Δ', bold: true, color: '64748b', bg: 'f8fafc', align: 'right' });
  }
  // Dynamic metric columns
  for (const key of orderedMetricKeys) {
    const label = key === 'er' ? 'Eng. Rate'
      : key === 'views' ? 'Views'
      : key === 'impressions' ? 'Impressions'
      : key === 'likes' ? 'Likes'
      : key === 'comments' ? 'Comments'
      : key === 'shares' ? 'Shares'
      : key === 'reach' ? 'Reach'
      : key === 'engagements' ? 'Engagements'
      : key === 'clicks' ? 'Clicks'
      : key;
    platHeader.push({ v: label, bold: true, color: '64748b', bg: 'f8fafc', align: 'right' });
  }
  platHeader.push({ v: prevLabel, bold: true, color: '64748b', bg: 'f8fafc', align: 'right' });
  platHeader.push({ v: currLabel, bold: true, color: '64748b', bg: 'f8fafc', align: 'right' });
  platHeader.push({ v: 'Δ MoM', bold: true, color: '64748b', bg: 'f8fafc', align: 'right' });
  rows.push(platHeader);

  // Data rows
  for (const pr of data.platformRows) {
    const cells: (Cell | null)[] = [
      { v: fmtLabel(pr.platform), color: '334155' },
      { v: fmtNum(pr.posts), align: 'right' },
    ];

    // Followers (LinkedIn/Facebook only)
    if (data.platformRows.some(r => r.followers !== undefined)) {
      if (pr.followers !== undefined) {
        cells.push({ v: fmtK(pr.followers), align: 'right' });
        cells.push({ v: pr.followersChange !== undefined ? `${pr.followersChange >= 0 ? '+' : ''}${pr.followersChange}%` : '', align: 'right', color: pr.followersChange !== undefined && pr.followersChange >= 0 ? '059669' : 'dc2626' });
      } else {
        cells.push({ v: '—', align: 'right', color: '94a3b8' });
        cells.push({ v: '—', align: 'right', color: '94a3b8' });
      }
    }

    // Dynamic metric columns
    for (const key of orderedMetricKeys) {
      const colDef = pr.columns.find(c => c.key === key);
      if (!colDef) {
        cells.push(null);
        continue;
      }
      if (key === 'er') {
        cells.push({ v: colDef.value > 0 ? pct(colDef.value) : '—', align: 'right' });
      } else {
        cells.push({ v: fmtK(colDef.value), align: 'right' });
      }
    }

    // Prev month impressions (from monthlyImpressions[0])
    const prevImpr = pr.totals.monthlyImpressions[0];
    cells.push({ v: prevImpr > 0 ? fmtK(prevImpr) : '—', align: 'right', color: '94a3b8' });

    // Current month impressions (from monthlyImpressions[1])
    const currImpr = pr.totals.monthlyImpressions[1];
    cells.push({ v: currImpr > 0 ? fmtK(currImpr) : '—', align: 'right', bold: true, color: '0f172a' });

    // Δ MoM
    if (pr.change) {
      const sign = pr.change.direction === 'up' ? '+' : '';
      const arrow = pr.change.direction === 'up' ? '▲' : pr.change.direction === 'down' ? '▼' : '—';
      cells.push({ v: `${arrow} ${sign}${pr.change.value}%`, align: 'right' });
    } else {
      cells.push({ v: '—', align: 'right', color: '94a3b8' });
    }

    rows.push(cells);
  }

  // Total row
  const totalRow: (Cell | null)[] = [
    { v: 'Total', bold: true, color: '0f172a', bg: 'f8fafc' },
    { v: fmtNum(data.platformRows.reduce((s, r) => s + r.posts, 0)), bold: true, bg: 'f8fafc', align: 'right' },
  ];
  if (data.platformRows.some(r => r.followers !== undefined)) {
    totalRow.push({ v: fmtK(data.platformRows.reduce((s, r) => s + (r.followers ?? 0), 0)), bold: true, bg: 'f8fafc', align: 'right' });
    totalRow.push(null); // no delta for total
  }
  for (const key of orderedMetricKeys) {
    if (key === 'er') {
      const allEng = data.platformRows.reduce((s, r) => s + r.totals.engagements, 0);
      const allImpr = data.platformRows.reduce((s, r) => s + r.totals.impressions, 0);
      const er = allImpr > 0 ? (allEng / allImpr) * 100 : 0;
      totalRow.push({ v: pct(er), bold: true, bg: 'f8fafc', align: 'right' });
    } else {
      const total = data.platformRows.reduce((s, r) => {
        const c = r.columns.find(c => c.key === key);
        return s + (c?.value ?? 0);
      }, 0);
      totalRow.push({ v: fmtK(total), bold: true, bg: 'f8fafc', align: 'right' });
    }
  }
  // Prev month total impressions
  const totalPrevImpr = data.platformRows.reduce((s, r) => s + r.totals.monthlyImpressions[0], 0);
  const totalCurrImpr = data.platformRows.reduce((s, r) => s + r.totals.monthlyImpressions[1], 0);
  totalRow.push({ v: totalPrevImpr > 0 ? fmtK(totalPrevImpr) : '—', bold: true, bg: 'f8fafc', align: 'right', color: '94a3b8' });
  totalRow.push({ v: totalCurrImpr > 0 ? fmtK(totalCurrImpr) : '—', bold: true, bg: 'f8fafc', align: 'right', color: '0f172a' });
  totalRow.push(null); // no delta for total
  rows.push(totalRow);
  rows.push([]); // spacer

  // ── Section 4: CTR (LinkedIn + Facebook) ──────────────────────────────────
  if (data.ctrRows.length > 0) {
    rows.push([
      { v: 'CLICK-THROUGH RATE', bold: true, color: '64748b', bg: 'f1f5f9' },
      null, null, null, null, null, null, null,
    ]);
    rows.push([
      { v: 'Platform', bold: true, color: '64748b', bg: 'f8fafc' },
      { v: 'Clicks', bold: true, color: '64748b', bg: 'f8fafc', align: 'right' },
      { v: 'Impressions', bold: true, color: '64748b', bg: 'f8fafc', align: 'right' },
      { v: 'CTR', bold: true, color: '64748b', bg: 'f8fafc', align: 'right' },
      { v: 'Prev CTR', bold: true, color: '64748b', bg: 'f8fafc', align: 'right' },
      { v: 'Δ vs Prev', bold: true, color: '64748b', bg: 'f8fafc', align: 'right' },
      null, null, null,
    ]);
    for (const ctr of data.ctrRows) {
      const dir = ctr.change >= 0 ? 'up' : 'down';
      const arrow = dir === 'up' ? '▲' : '▼';
      rows.push([
        { v: fmtLabel(ctr.platform), color: '334155' },
        { v: fmtNum(ctr.clicks), align: 'right' },
        { v: fmtK(ctr.impressions), align: 'right' },
        { v: pct(ctr.ctr), align: 'right', bold: true },
        { v: pct(ctr.prevCtr), align: 'right' },
        { v: `${arrow} ${Math.abs(ctr.change)}pp`, align: 'right', color: dir === 'up' ? '059669' : 'dc2626' },
        null, null, null,
      ]);
    }
    // CTR total row
    const totalClicks = data.ctrRows.reduce((s, r) => s + r.clicks, 0);
    const totalImpr = data.ctrRows.reduce((s, r) => s + r.impressions, 0);
    const totalCTR = totalImpr > 0 ? (totalClicks / totalImpr) * 100 : 0;
    const prevTotalClicks = data.ctrRows.reduce((s, r) => s + r.clicks, 0); // Note: prev data would need separate tracking
    rows.push([
      { v: 'Total', bold: true, bg: 'f8fafc', color: '0f172a' },
      { v: fmtNum(totalClicks), bold: true, bg: 'f8fafc', align: 'right' },
      { v: fmtK(totalImpr), bold: true, bg: 'f8fafc', align: 'right' },
      { v: pct(totalCTR), bold: true, bg: 'f8fafc', align: 'right' },
      null, null, null, null, null,
    ]);
    rows.push([]); // spacer
  }

  // ── Section 5: Posts Distribution ──────────────────────────────────────────
  if (data.postsDistribution.length > 0) {
    rows.push([
      { v: 'POSTS DISTRIBUTION', bold: true, color: '64748b', bg: 'f1f5f9' },
      null, null, null, null, null, null, null,
    ]);
    rows.push([
      { v: 'Platform', bold: true, color: '64748b', bg: 'f8fafc' },
      { v: prevLabel, bold: true, color: '64748b', bg: 'f8fafc', align: 'right' },
      { v: currLabel, bold: true, color: '64748b', bg: 'f8fafc', align: 'right' },
      { v: 'Δ', bold: true, color: '64748b', bg: 'f8fafc', align: 'right' },
      null, null, null, null, null,
    ]);
    for (const pr of data.postsDistribution) {
      const dir = pr.change >= 0 ? 'up' : 'down';
      const arrow = dir === 'up' ? '▲' : '▼';
      rows.push([
        { v: fmtLabel(pr.platform), color: '334155' },
      { v: pr.posts[0] > 0 ? fmtNum(pr.posts[0]) : '—', align: 'right', color: '94a3b8' },
      { v: pr.posts[1] > 0 ? fmtNum(pr.posts[1]) : '—', align: 'right', bold: true, color: '0f172a' },
        { v: pr.change !== 0 ? `${arrow} ${Math.abs(pr.change)}` : '—', align: 'right', color: dir === 'up' ? '059669' : 'dc2626' },
        null, null, null, null, null,
      ]);
    }
    // Total row
    const totalPrevPosts = data.postsDistribution.reduce((s, r) => s + r.posts[0], 0);
    const totalCurrPosts = data.postsDistribution.reduce((s, r) => s + r.posts[1], 0);
    const totalChange = totalCurrPosts - totalPrevPosts;
    const totalDir = totalChange >= 0 ? 'up' : 'down';
    const totalArrow = totalDir === 'up' ? '▲' : '▼';
    rows.push([
      { v: 'Total', bold: true, bg: 'f8fafc', color: '0f172a' },
      { v: totalPrevPosts > 0 ? fmtNum(totalPrevPosts) : '—', bold: true, bg: 'f8fafc', align: 'right', color: '94a3b8' },
      { v: totalCurrPosts > 0 ? fmtNum(totalCurrPosts) : '—', bold: true, bg: 'f8fafc', align: 'right', color: '0f172a' },
      { v: totalChange !== 0 ? `${totalArrow} ${Math.abs(totalChange)}` : '—', bold: true, bg: 'f8fafc', align: 'right', color: totalDir === 'up' ? '059669' : 'dc2626' },
      null, null, null, null, null,
    ]);
    rows.push([]); // spacer
  }

  // ── Section 6: Top Performing Content ─────────────────────────────────────
  if (data.topContent.length > 0) {
    rows.push([
      { v: 'TOP PERFORMING CONTENT', bold: true, color: '64748b', bg: 'f1f5f9' },
      null, null, null, null, null, null, null,
    ]);
    rows.push([
      { v: '#', bold: true, color: '64748b', bg: 'f8fafc', align: 'center' },
      { v: 'Date', bold: true, color: '64748b', bg: 'f8fafc' },
      { v: 'Post Text', bold: true, color: '64748b', bg: 'f8fafc' },
      { v: 'Platform', bold: true, color: '64748b', bg: 'f8fafc' },
      { v: 'Impressions', bold: true, color: '64748b', bg: 'f8fafc', align: 'right' },
      { v: 'Views', bold: true, color: '64748b', bg: 'f8fafc', align: 'right' },
      { v: 'Engagements', bold: true, color: '64748b', bg: 'f8fafc', align: 'right' },
      { v: 'Eng. Rate', bold: true, color: '64748b', bg: 'f8fafc', align: 'right' },
      null, null,
    ]);
    for (const top of data.topContent) {
      rows.push([
        { v: `#${top.rank}`, color: 'fbbf24', bold: true, align: 'center' },
        { v: top.dateLabel, color: '64748b' },
        { v: top.title, color: '334155' },
        { v: fmtLabel(top.platform), color: '334155' },
        { v: top.impressions > 0 ? fmtK(top.impressions) : '—', align: 'right' },
        { v: top.views > 0 ? fmtNum(top.views) : '—', align: 'right', color: '94a3b8' },
        { v: top.engagements > 0 ? fmtK(top.engagements) : '—', align: 'right' },
        { v: top.er > 0 ? pct(top.er) : '—', align: 'right' },
        null, null,
      ]);
    }
  }

  // ── Section 7: Post of the Month ──────────────────────────────────────────
  if (data.postOfMonth && data.postOfMonth.length > 0) {
    rows.push([
      { v: 'POST OF THE MONTH', bold: true, color: 'ffffff', bg: '1e293b' },
      null, null, null, null, null, null, null,
    ]);
    rows.push([
      { v: 'Platform', bold: true, color: '64748b', bg: 'f8fafc' },
      { v: 'Date', bold: true, color: '64748b', bg: 'f8fafc' },
      { v: 'Post', bold: true, color: '64748b', bg: 'f8fafc' },
      { v: 'Views', bold: true, color: '64748b', bg: 'f8fafc', align: 'right' },
      { v: 'Impressions', bold: true, color: '64748b', bg: 'f8fafc', align: 'right' },
      { v: 'Engagements', bold: true, color: '64748b', bg: 'f8fafc', align: 'right' },
      { v: 'Eng. Rate', bold: true, color: '64748b', bg: 'f8fafc', align: 'right' },
      { v: 'Post Link', bold: true, color: '64748b', bg: 'f8fafc' },
    ]);

    for (const post of data.postOfMonth) {
      rows.push([
        { v: post.label, bold: true, color: 'ffffff', align: 'center', bg: '#64748b' },
        { v: post.dateLabel, color: '64748b' },
        { v: post.title, color: '334155' },
        { v: post.views > 0 ? fmtK(post.views) : '—', align: 'right', color: '0f172a' },
        { v: post.impressions > 0 ? fmtK(post.impressions) : '—', align: 'right', color: '0f172a' },
        { v: post.engagements > 0 ? fmtK(post.engagements) : '—', align: 'right', bold: true, color: '0f172a' },
        { v: post.er > 0 ? pct(post.er) : '—', align: 'right', color: '0f172a' },
        { v: post.postUrl || '—', color: post.postUrl ? '1d9bf0' : '94a3b8' },
      ]);
    }

    // Narrative rows
    rows.push([]); // spacer
    rows.push([
      { v: 'MONTHLY NARRATIVE', bold: true, color: 'ffffff', bg: '1e293b' },
      null, null, null, null, null, null, null,
    ]);
    for (const post of data.postOfMonth) {
      rows.push([
        { v: `[${post.label}]`, bold: true, color: '#64748b', bg: 'f8fafc' },
        { v: post.narrative, color: '334155' },
        null, null, null, null, null, null, null,
      ]);
    }
  }

  return rows;
}

// ─────────────────────────────────────────────────────────────────────────────
// Apply styles
// ─────────────────────────────────────────────────────────────────────────────

function applyCellStyle(cell: XLSX.XLSX_CellObject, c: Cell): void {
  if (!cell.s) cell.s = {};
  if (c.bold) {
    cell.s.font = { ...(cell.s.font || {}), bold: true };
  }
  if (c.color) {
    cell.s.font = { ...(cell.s.font || {}), color: { rgb: c.color } };
  }
  if (c.bg) {
    cell.s.fill = { fgColor: { rgb: c.bg }, patternType: 'solid' };
  }
  if (c.align) {
    cell.s.alignment = { horizontal: c.align };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Export function
// ─────────────────────────────────────────────────────────────────────────────

export function downloadMonthlyReportAsExcel() {
  const data = (window as any).__samaMonthlyReport as MonthlyReportData | undefined;
  if (!data) {
    alert('No monthly report data. Generate a monthly report first.');
    return;
  }

  const excelRows = buildMonthlyExcelRows(data);
  const ws = XLSX.utils.aoa_to_sheet(excelRows);

  // Apply cell-level styles
  for (let r = 0; r < excelRows.length; r++) {
    const row = excelRows[r];
    for (let c = 0; c < row.length; c++) {
      const cell = row[c];
      if (!cell) continue;
      const addr = XLSX.utils.encode_cell({ r, c });
      if (!ws[addr]) continue;
      const xc = ws[addr] as XLSX.XLSX_CellObject;
      applyCellStyle(xc, cell);
    }
  }

  // Column widths
  ws['!cols'] = [
    { wch: 12 }, // Platform / #
    { wch: 12 }, // Posts / Date
    { wch: 36 }, // Post Text
    { wch: 12 }, // Platform
    { wch: 14 }, // Impressions / Clicks
    { wch: 12 }, // Views / Impressions
    { wch: 14 }, // Engagements / CTR
    { wch: 12 }, // ER / Prev CTR
    { wch: 12 }, // Δ
    { wch: 12 }, // extra
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Monthly Report');

  const filename = `Monthly_Report_${data.clientName || 'Client'}_${data.monthLabel || new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, filename);
  console.log('[SAMA] Monthly Excel downloaded:', filename);
}
