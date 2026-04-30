// ============================================================
// SAMA - Daily Report Excel Export
//
// Exports from window.__samaDailyMatrix (TemplateMatrixExportPayload).
// All 6 platforms always shown, zeros shown when no analytics.
// Same layout as on-screen DailyDataView:
//   - 6 platforms in 2 rows: TikTok|Instagram|LinkedIn / YouTube|Facebook|Twitter / X
//   - Each platform: merged brand-color header + metric column + one column per day
//   - Metrics: Views / Likes / Comments / Shares / Reach / Impressions / Engagement
// ============================================================

import * as XLSX from 'xlsx';
import type { DailyMatrixCell } from './dailyReportService';
import type { TemplateMatrixExportPayload } from './reportMatrix';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function fmtLabel(platform: string): string {
  const map: Record<string, string> = {
    linkedin: 'LinkedIn',
    facebook: 'Facebook',
    instagram: 'Instagram',
    youtube: 'YouTube',
    twitter: 'Twitter / X',
    tiktok: 'TikTok',
  };
  return map[platform] ?? platform;
}

// ─────────────────────────────────────────────────────────────────────────────
// Cell type (mirrors excelWeeklyExport.ts)
// ─────────────────────────────────────────────────────────────────────────────

interface Cell {
  v: string | number;
  bold?: boolean;
  color?: string;
  bg?: string;
  align?: 'left' | 'center' | 'right';
  t?: 's' | 'n' | 'b';
}

type ExcelRow = (Cell | null)[];

function rgbFill(bg: string): { fgColor: { rgb: string }; patternType: 'solid' } {
  const hex = bg.replace(/^#/, '');
  return { fgColor: { rgb: hex }, patternType: 'solid' };
}

function applyCellStyle(cell: XLSX.XLSX_CellObject, c: Cell): void {
  if (!cell.s) cell.s = {};
  if (c.bold) cell.s.font = { bold: true };
  if (c.color) cell.s.font = { ...(cell.s.font || {}), color: { rgb: c.color } };
  if (c.bg) cell.s.fill = rgbFill(c.bg);
  if (c.align === 'left') cell.s.alignment = { horizontal: 'left' };
  if (c.align === 'right') cell.s.alignment = { horizontal: 'right' };
  if (c.align === 'center') cell.s.alignment = { horizontal: 'center' };
}

// ─────────────────────────────────────────────────────────────────────────────
// Daily matrix export (DailyView + fetchDailyMatrixReport)
// window.__samaDailyMatrix — same 2×3 layout & 7 metrics as on-screen template
// ─────────────────────────────────────────────────────────────────────────────

const MATRIX_PLATFORM_ROW_1 = ['tiktok', 'instagram', 'linkedin'] as const;
const MATRIX_PLATFORM_ROW_2 = ['youtube', 'facebook', 'twitter'] as const;

const MATRIX_HEADER_BG: Record<string, string> = {
  tiktok: '#000000',
  instagram: '#E4405F',
  linkedin: '#0077B5',
  youtube: '#FF0000',
  facebook: '#1877F2',
  twitter: '#000000',
};

const MATRIX_METRIC_KEYS: (keyof DailyMatrixCell)[] = [
  'views',
  'likes',
  'comments',
  'shares',
  'reach',
  'impressions',
  'engagements',
];

const METRIC_LABELS: Record<string, string> = {
  views: 'Views',
  likes: 'Likes',
  comments: 'Comments',
  shares: 'Shares',
  reach: 'Reach',
  impressions: 'Impressions',
  engagements: 'Engagement',
};

function padExcelRow(len: number): (Cell | null)[] {
  return Array(len).fill(null);
}

function matrixCardByPlatform(data: TemplateMatrixExportPayload, platform: string) {
  return data.cards.find((c) => c.platform === platform);
}

/**
 * Builds rows: metadata, then TikTok|Instagram|LinkedIn block, spacer, YouTube|Facebook|Twitter block,
 * optional post links. Uses merges for platform title bars (one bar per platform across metric + date cols).
 */
function buildTemplateMatrixExcelRows(data: TemplateMatrixExportPayload): {
  excelRows: ExcelRow[];
  merges: XLSX.Range[];
  totalCols: number;
} {
  const dcols = data.dateColumns;
  const colsPerPlatform = 1 + dcols.length;
  const GAP = 1;
  const totalCols = 3 * colsPerPlatform + 2 * GAP;

  const merges: XLSX.Range[] = [];
  const excelRows: ExcelRow[] = [];

  const startCol = (blockIndex: number) => blockIndex * (colsPerPlatform + GAP);

  const titleRow = padExcelRow(totalCols);
  titleRow[0] = { v: data.clientName || 'Report', bold: true, color: '0f172a', align: 'left' };
  excelRows.push(titleRow);

  const sub = padExcelRow(totalCols);
  const subLine =
    data.uniquePostsInPeriod !== undefined
      ? `${data.periodLabel} · ${data.uniquePostsInPeriod} posts`
      : data.periodLabel;
  sub[0] = {
    v: subLine,
    color: '64748b',
    align: 'left',
  };
  excelRows.push(sub);
  excelRows.push(padExcelRow(totalCols));

  const pushPlatformBand = (platforms: readonly string[]) => {
    const headerR = excelRows.length;
    const hdr = padExcelRow(totalCols);
    for (let i = 0; i < 3; i++) {
      const p = platforms[i];
      const c0 = startCol(i);
      hdr[c0] = {
        v: fmtLabel(p),
        bold: true,
        color: 'ffffff',
        bg: MATRIX_HEADER_BG[p] ?? '#334155',
        align: 'center',
      };
      merges.push({
        s: { r: headerR, c: c0 },
        e: { r: headerR, c: c0 + colsPerPlatform - 1 },
      });
    }
    excelRows.push(hdr);

    const drow = padExcelRow(totalCols);
    for (let i = 0; i < 3; i++) {
      const c0 = startCol(i);
      drow[c0] = { v: '', align: 'left' };
      dcols.forEach((col, j) => {
        drow[c0 + 1 + j] = {
          v: col.label,
          align: 'center',
          bg: 'f8fafc',
          color: '475569',
        };
      });
    }
    excelRows.push(drow);

    for (const key of MATRIX_METRIC_KEYS) {
      const mrow = padExcelRow(totalCols);
      for (let i = 0; i < 3; i++) {
        const p = platforms[i];
        const card = matrixCardByPlatform(data, p);
        const c0 = startCol(i);
        mrow[c0] = {
          v: METRIC_LABELS[key as keyof typeof METRIC_LABELS] ?? String(key),
          align: 'left',
          color: '0f172a',
          bold: true,
        };
        dcols.forEach((col, j) => {
          const raw = card?.byDate[col.iso]?.[key] ?? 0;
          const val = typeof raw === 'number' && Number.isFinite(raw) ? Math.round(raw) : 0;
          mrow[c0 + 1 + j] = {
            v: val,
            t: 'n',
            align: 'right',
            color: '0f172a',
          };
        });
      }
      excelRows.push(mrow);
    }
  };

  pushPlatformBand(MATRIX_PLATFORM_ROW_1);
  excelRows.push(padExcelRow(totalCols));
  pushPlatformBand(MATRIX_PLATFORM_ROW_2);

  const allPosts = data.cards.flatMap((c) =>
    c.posts
      .filter((p) => p.postUrl)
      .map((p) => ({ ...p, platformLabel: c.label }))
  );
  if (allPosts.length > 0) {
    excelRows.push(padExcelRow(totalCols));
    excelRows.push([
      { v: 'POST LINKS', bold: true, color: '64748b', bg: 'f1f5f9' },
      ...padExcelRow(totalCols - 1),
    ]);
    for (const post of allPosts) {
      excelRows.push([
        { v: post.platformLabel, bold: true, color: '64748b' },
        { v: post.dateLabel, color: '94a3b8' },
        { v: post.title || 'Untitled', color: '334155' },
        ...padExcelRow(totalCols - 3),
      ]);
      excelRows.push([
        { v: 'Link:', color: '94a3b8' },
        { v: post.postUrl, color: '1d9bf0' },
        ...padExcelRow(totalCols - 2),
      ]);
    }
  }

  return { excelRows, merges, totalCols };
}

export function downloadTemplateMatrixReportAsExcel(
  data: TemplateMatrixExportPayload | undefined,
  filenamePrefix: 'Daily_Report' | 'Weekly_Report' | 'Monthly_Report',
): void {
  // #region SAMA_DEBUG_LOG
  const _log = (msg: string, d: Record<string, unknown>) => {
    fetch('http://127.0.0.1:7772/ingest/9ca6233b-abe6-4974-bf17-14ebc8a821cb', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '423eb6' },
      body: JSON.stringify({ sessionId: '423eb6', location: 'excelDailyExport.ts:downloadTemplateMatrixReportAsExcel', message: msg, data: d, timestamp: Date.now() }),
    }).catch(() => {});
  };
  _log('export_fn', { hasData: !!data, dateColumnsLen: (data as any)?.dateColumns?.length, uniquePosts: (data as any)?.uniquePostsInPeriod, cardsCount: (data as any)?.cards?.length });
  // #endregion
  if (!data?.dateColumns?.length) {
    alert('请先点击 Load data 加载报表后再导出。');
    return;
  }

  const { excelRows, merges, totalCols } = buildTemplateMatrixExcelRows(data);
  const ws = XLSX.utils.aoa_to_sheet(excelRows);

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

  ws['!merges'] = merges;
  ws['!cols'] = Array.from({ length: totalCols }, () => ({ wch: 12 }));

  const gen = new Date().toISOString().slice(0, 10);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Performance by Platform');
  const filename = `${filenamePrefix}_${data.clientName || 'Client'}_${gen}.xlsx`;
  XLSX.writeFile(wb, filename);
  console.log('[SAMA] Matrix Excel downloaded:', filename);
}

export function downloadDailyMatrixReportAsExcel(): void {
  const win = window as unknown as { __samaDailyMatrix?: unknown };
  // #region SAMA_DEBUG_LOG
  const _log = (msg: string, data: Record<string, unknown>) => {
    fetch('http://127.0.0.1:7772/ingest/9ca6233b-abe6-4974-bf17-14ebc8a821cb', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '423eb6' },
      body: JSON.stringify({ sessionId: '423eb6', location: 'excelDailyExport.ts:downloadDailyMatrixReportAsExcel', message: msg, data, timestamp: Date.now() }),
    }).catch(() => {});
  };
  _log('export_called', { hasData: !!win.__samaDailyMatrix, dataKeys: win.__samaDailyMatrix ? Object.keys(win.__samaDailyMatrix as object) : [] });
  // #endregion
  // 前端 DailyDataView 用的也是 __samaDailyMatrix（TemplateMatrixExportPayload），
  // 这里改用 buildTemplateMatrixExcelRows 导出，保证前端和 Excel 数据一致。
  downloadTemplateMatrixReportAsExcel(win.__samaDailyMatrix as Parameters<typeof downloadTemplateMatrixReportAsExcel>[0], 'Daily_Report');
}

export function downloadWeeklyMatrixReportAsExcel(): void {
  const data = (window as unknown as { __samaWeeklyMatrix?: TemplateMatrixExportPayload }).__samaWeeklyMatrix;
  downloadTemplateMatrixReportAsExcel(data, 'Weekly_Report');
}

export function downloadMonthlyMatrixReportAsExcel(): void {
  const data = (window as unknown as { __samaMonthlyMatrix?: TemplateMatrixExportPayload }).__samaMonthlyMatrix;
  downloadTemplateMatrixReportAsExcel(data, 'Monthly_Report');
}
