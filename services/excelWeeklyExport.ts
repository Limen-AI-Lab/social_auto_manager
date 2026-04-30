// ============================================================
// SAMA - Weekly Report Excel Export
//
// 完全按照 WEEKLY_REPORT_TEMPLATE.md 模板结构：
//   1. Report Header（客户名 | 周期 | 生成时间）
//   2. Performance Overview（5 KPI 卡片）
//   3. Platform Performance（按平台汇总 + vs Prev Week）
//   4. Posts by Date + Content Topics（两栏并排布局）
//   5. Post Title Code Table（Code | Date | Post Title）
//
// 纯数据构建逻辑 → services/weeklyExcelBuilders.ts
// ============================================================

import * as XLSX from 'xlsx';
import type { WeeklyReportData } from './weeklyReportService';
import {
  buildAllSections,
  type Cell,
  type ExcelRow,
  computeColWidths,
  computeRowHeights,
  applyCellStyle,
} from './weeklyExcelBuilders';

export { buildAllSections } from './weeklyExcelBuilders';

function applyCellStyleToWs(
  ws: XLSX.WorkSheet,
  rows: ExcelRow,
): void {
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    for (let c = 0; c < row.length; c++) {
      const cell = row[c];
      if (!cell) continue;
      const addr = XLSX.utils.encode_cell({ r, c });
      const xc = ws[addr] as XLSX.XLSX_CellObject | undefined;
      if (xc) applyCellStyle(xc, cell);
    }
  }
}

export function downloadWeeklyReportAsExcel() {
  const data = (window as unknown as { __samaWeeklyReport?: WeeklyReportData }).__samaWeeklyReport;
  if (!data) {
    alert('No weekly report data. Generate a weekly report first.');
    return;
  }

  const rows = buildAllSections(data);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = computeColWidths(rows);
  ws['!rows'] = computeRowHeights(rows);
  applyCellStyleToWs(ws, rows);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Weekly Report');
  const filename = `Weekly_Report_${data.clientName || 'Client'}_${data.weekStart}.xlsx`;
  XLSX.writeFile(wb, filename);
  console.log('[SAMA] Weekly Excel downloaded:', filename);
}
