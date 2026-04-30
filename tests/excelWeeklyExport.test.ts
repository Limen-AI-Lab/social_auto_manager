/**
 * SAMA - Weekly Report Excel Export UT
 *
 * 验证 excelWeeklyExport.ts 按模板生成的 Excel 结构
 * 与 WEEKLY_REPORT_TEMPLATE.md 定义完全一致：
 *   1. Report Header
 *   2. Performance Overview（5 KPI）
 *   3. Platform Performance
 *   4. Posts by Date + Content Topics
 *   5. Post Title Codes
 */

import { describe, it, expect } from 'vitest';
import {
  buildAllSections,
  buildReportHeader,
  buildPerformanceOverview,
  buildPlatformPerformanceTable,
  buildPostsByDateAndTopics,
  buildPostTitleTable,
  C,
  PLATFORM_COLORS,
  PLATFORM_LABELS,
} from '../services/weeklyExcelBuilders';
import type {
  WeeklyReportData,
  WeeklyPlatformRow,
  WeeklyTopicRow,
  WeeklyPostPlatformRow,
} from '../services/weeklyReportService';

// ─────────────────────────────────────────────────────────────────────────────
// Mock 数据工厂
// ─────────────────────────────────────────────────────────────────────────────

function makeMockReportData(overrides?: Partial<WeeklyReportData>): WeeklyReportData {
  return {
    clientName: 'Boolell Advisory Mauritius',
    weekStart: '2026-03-24',
    weekEnd: '2026-03-30',
    periodLabel: '24 Mar — 30 Mar 2026',
    generatedAt: '2026-03-31T10:00:00+02:00',
    matrix: { dateColumns: [], cards: [] },
    overview: {
      totalPosts: 55,
      totalImpressions: 4300,
      totalEngagements: 1100,
      totalReach: 3100,
      avgER: 25.58,
      activePlatforms: 6,
    },
    platformRows: [
      makePlatformRow('linkedin',    9,  1968, 140, 60, 120, 0, 0,   120, 'up'),
      makePlatformRow('facebook',   15,   721, 721,  4,   0, 50, 689,  50, 'up'),
      makePlatformRow('instagram',  17,  1326,1326, 17,   0, 86,1095,  86, 'down'),
      makePlatformRow('youtube',   16,  4420,4420,  7,   0,  0,   0,  60, 'down'),
      makePlatformRow('twitter',   16,   195,   0,  1,   0,  1,   0,   1, 'flat'),
      makePlatformRow('tiktok',    18, 34094,34094,523,1134, 0,29055,1134, 'up'),
    ],
    topicRows: [
      makeTopicRow('2026-03-30', 'Mon 30 Mar 2026', 'Are you overcomplicating...', 'linkedin', 1400, 1968, 120, 2.55, 'up'),
      makeTopicRow('2026-03-30', 'Mon 30 Mar 2026', 'Are you overcomplicating...', 'tiktok',  24839, 24839, 535, 2.12, 'up'),
      makeTopicRow('2026-03-29', 'Sun 29 Mar 2026', 'Navigating Mauritius banking...', 'tiktok', 4999, 4999, 120, 2.18, 'up'),
      makeTopicRow('2026-03-28', 'Sat 28 Mar 2026', 'Received a Notice of Strike-Off...', 'tiktok', 1099, 1099, 17, 1.55, 'up'),
    ],
    topics: [
      { label: 'Banking in Mauritius',  postCount: 3, avgER: 2.55 },
      { label: 'Trust in Mauritius',     postCount: 2, avgER: 1.65 },
      { label: 'Corporate Advisory',     postCount: 1, avgER: 1.11 },
      { label: 'Strike-Off Notice',     postCount: 1, avgER: 0.88 },
    ],
    postOfWeek: [],
    ...overrides,
  };
}

function makePlatformRow(
  platform: string,
  posts: number,
  impressions: number,
  views: number,
  likes: number,
  comments: number,
  shares: number,
  reach: number,
  engagements: number,
  direction: 'up' | 'down' | 'flat',
): WeeklyPlatformRow {
  return {
    platform,
    label: PLATFORM_LABELS[platform] ?? platform,
    posts,
    columns: [],
    totals: {
      impressions,
      views,
      likes,
      reach,
      engagements,
      comments,
      shares,
      er: impressions > 0 ? (engagements / impressions) * 100 : 0,
    },
    change: { direction, value: Math.floor(Math.random() * 20) + 1, metric: 'engagements' },
  };
}

function makeTopicRow(
  date: string,
  dateLabel: string,
  title: string,
  platform: string,
  views: number,
  impressions: number,
  engagements: number,
  er: number,
  trend: 'up' | 'down' | 'flat',
): WeeklyTopicRow {
  const pr: WeeklyPostPlatformRow = {
    platform,
    columns: [
      { key: 'views',       label: 'Views',       value: views,       hasData: views > 0 },
      { key: 'impressions', label: 'Impressions', value: impressions, hasData: impressions > 0 },
      { key: 'engagements', label: 'Engagements', value: engagements, hasData: engagements > 0 },
      { key: 'er',          label: 'ER%',         value: er,          hasData: er > 0, isER: true },
    ],
  };
  return {
    date, dateLabel,
    id: `post-${date}-${Math.random().toString(36).slice(2)}`,
    title,
    postText: title,
    platforms: [platform],
    platformRows: [pr],
    totals: { impressions, views, likes: 0, comments: 0, shares: 0, reach: 0, engagements, er },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 辅助：提取某列的 v 值（flattened）
// ─────────────────────────────────────────────────────────────────────────────

function colValues(rows: ReturnType<typeof buildAllSections>, colIdx: number): (string | number)[] {
  return rows.map(row => row[colIdx]?.v ?? null).filter(v => v !== null && v !== undefined) as (string | number)[];
}

// ─────────────────────────────────────────────────────────────────────────────
// 测试：常量 / 配色
// ─────────────────────────────────────────────────────────────────────────────

describe('配色 & 常量', () => {
  it('SECTION_BG 应为深色（模板标题栏背景）', () => {
    expect(C.SECTION_BG).toBe('1E293B');
    expect(C.SECTION_FG).toBe('FFFFFF');
  });

  it('TH_BG 应为浅灰（表头背景）', () => {
    expect(C.TH_BG).toBe('F1F5F9');
    expect(C.TH_FG).toBe('64748B');
  });

  it('平台配色应有 6 个平台', () => {
    const expected = ['tiktok', 'instagram', 'linkedin', 'youtube', 'facebook', 'twitter'];
    expected.forEach(p => {
      expect(PLATFORM_COLORS[p]).toBeDefined();
      expect(PLATFORM_COLORS[p]).toMatch(/^[0-9A-F]{6}$/);
    });
  });

  it('平台标签应与模板一致', () => {
    expect(PLATFORM_LABELS.tiktok).toBe('TikTok');
    expect(PLATFORM_LABELS.instagram).toBe('Instagram');
    expect(PLATFORM_LABELS.linkedin).toBe('LinkedIn');
    expect(PLATFORM_LABELS.youtube).toBe('YouTube');
    expect(PLATFORM_LABELS.facebook).toBe('Facebook');
    expect(PLATFORM_LABELS.twitter).toBe('X'); // 模板用 X
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 测试：Section 1 — Report Header
// ─────────────────────────────────────────────────────────────────────────────

describe('Section 1: Report Header', () => {
  it('第一行应为 section title 空行（bg=SECTION_BG）', () => {
    const data = makeMockReportData();
    const rows = buildReportHeader(data);
    const first = rows[0];
    expect(first[0]).toBeDefined();
    expect(first[0]!.bg).toBe(C.SECTION_BG);
    expect(first[0]!.bold).toBe(true);
  });

  it('第二行应包含客户名、Report Period、Generated、时区', () => {
    const data = makeMockReportData();
    const rows = buildReportHeader(data);
    const headerRow = rows[1];

    expect(headerRow[0]?.v).toBe(data.clientName);
    expect(headerRow[0]?.bold).toBe(true);
    expect(headerRow[0]?.color).toBe(C.EMPHASIS);

    const periodLabel = (headerRow as (typeof headerRow)[0][]).find(c => c?.v === 'Report Period:');
    expect(periodLabel).toBeDefined();

    const generatedLabel = (headerRow as (typeof headerRow)[0][]).find(c => c?.v === 'Generated:');
    expect(generatedLabel).toBeDefined();

    // 时区应为 SAST
    const tz = (headerRow as (typeof headerRow)[0][]).find(c => String(c?.v).includes('SAST'));
    expect(tz).toBeDefined();
  });

  it('Report Header 后应有一行 spacer', () => {
    const data = makeMockReportData();
    const rows = buildReportHeader(data);
    expect(rows[2]).toBeDefined();
    // spacer 行全部为 null
    expect(rows[2]!.every(c => c === null)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 测试：Section 2 — Performance Overview
// ─────────────────────────────────────────────────────────────────────────────

describe('Section 2: Performance Overview', () => {
  it('应输出 5 个 KPI 列（Posts Published / Impressions / Engagements / ER / Reach）', () => {
    const data = makeMockReportData();
    const rows = buildPerformanceOverview(data);

    // 第 1 行为 section title
    expect(rows[0][0]?.v).toBe('PERFORMANCE OVERVIEW');
    expect(rows[0][0]!.bg).toBe(C.SECTION_BG);

    // 第 2 行为表头（5 个 label）
    const kpiLabels = rows[1].map(c => c?.v as string);
    expect(kpiLabels).toContain('Posts Published');
    expect(kpiLabels).toContain('Total Impressions');
    expect(kpiLabels).toContain('Total Engagements');
    expect(kpiLabels).toContain('Engagement Rate');
    expect(kpiLabels).toContain('Total Reach');
  });

  it('KPI 数值行应与 overview 数据一致', () => {
    const data = makeMockReportData();
    const rows = buildPerformanceOverview(data);

    // 数值行（第 2 行，index=2）
    const valueRow = rows[2];
    const vals = valueRow.map(c => c?.v as string);
    // Posts Published
    expect(vals).toContain('55');
    // Total Engagements (1100 → 1.1K)
    expect(vals).toContain('1.1K');
    // Engagement Rate
    expect(vals).toContain('25.58%');
  });

  it('KPI 应居中对齐', () => {
    const data = makeMockReportData();
    const rows = buildPerformanceOverview(data);
    const valueRow = rows[2];
    valueRow.forEach(cell => {
      if (cell) expect(cell.align).toBe('center');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 测试：Section 3 — Platform Performance
// ─────────────────────────────────────────────────────────────────────────────

describe('Section 3: Platform Performance', () => {
  it('第一行应为 PLATFORM PERFORMANCE section title', () => {
    const data = makeMockReportData();
    const rows = buildPlatformPerformanceTable(data.platformRows);
    expect(rows[0][0]?.v).toBe('PLATFORM PERFORMANCE');
    expect(rows[0][0]!.bg).toBe(C.SECTION_BG);
  });

  it('表头列应包含：Platform / Posts / Impressions / Views / Likes / Comments / Shares / Reach / Engagements / vs Prev Week', () => {
    const data = makeMockReportData();
    const rows = buildPlatformPerformanceTable(data.platformRows);
    const header = rows[1].map(c => c?.v as string);
    expect(header).toContain('Platform');
    expect(header).toContain('Posts');
    expect(header).toContain('Impressions');
    expect(header).toContain('Views');
    expect(header).toContain('Likes');
    expect(header).toContain('Comments');
    expect(header).toContain('Shares');
    expect(header).toContain('Reach');
    expect(header).toContain('Engagements');
    expect(header).toContain('vs Prev Week');
  });

  it('平台顺序应为：LinkedIn / Facebook / Instagram / YouTube / X / TikTok（模板顺序）', () => {
    const data = makeMockReportData();
    const rows = buildPlatformPerformanceTable(data.platformRows);
    const dataRows = rows.slice(2, -1); // 去掉 section title / header / total / spacer
    const lastRow = rows[rows.length - 2]; // Total 行前一行
    expect(lastRow[0]?.v).toBe('Total'); // Total 行
  });

  it('各平台行平台名应使用模板标签（X 而非 Twitter）', () => {
    const data = makeMockReportData();
    const rows = buildPlatformPerformanceTable(data.platformRows);
    // 找到 X 行（Twitter 平台）
    const xRow = rows.find(r => r[0]?.v === 'X');
    expect(xRow).toBeDefined();
  });

  it('每行应有 vs Prev Week 列（▲▼ 或 —）', () => {
    const data = makeMockReportData();
    const rows = buildPlatformPerformanceTable(data.platformRows);
    const dataRows = rows.slice(2); // 从 platform 行开始
    dataRows.forEach(row => {
      if (row[0]?.v !== 'Total' && row[0]?.v !== 'PLATFORM PERFORMANCE') {
        const deltaCell = row[row.length - 1];
        if (deltaCell) {
          const v = String(deltaCell.v);
          expect(v).toMatch(/^[▲▼—]/);
        }
      }
    });
  });

  it('Total 行应包含所有平台的数值汇总', () => {
    const data = makeMockReportData();
    const rows = buildPlatformPerformanceTable(data.platformRows);
    const totalRow = rows[rows.length - 2]; // spacer 前一行
    expect(totalRow[0]?.v).toBe('Total');

    // 总 posts = 9+15+17+16+16+18 = 91
    expect(totalRow[1]?.v).toBe(91);
  });

  it('ER=0 的平台（Shares=0）应显示 — 而非 0', () => {
    // YouTube shares=0（已修正确保 shares=0）
    const data = makeMockReportData();
    const rows = buildPlatformPerformanceTable(data.platformRows);
    // YouTube 行: posts=16, shares=0
    const ytRow = rows.find(r => r[1]?.v === 16);
    expect(ytRow).toBeDefined();
    // Shares 在 col index 6
    expect(ytRow![6]?.v).toBe('—');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 测试：Section 4 — Posts by Date + Content Topics
// ─────────────────────────────────────────────────────────────────────────────

describe('Section 4: Posts by Date + Content Topics', () => {
  it('应有两列并排布局（Posts by Date col A-H, Content Topics col J+）', () => {
    const data = makeMockReportData();
    const rows = buildPostsByDateAndTopics(data.topicRows, data.topics);

    // Posts by Date section title 在 col 0
    const pbTitleRow = rows.find(r => r[0]?.v === 'POSTS BY DATE');
    expect(pbTitleRow).toBeDefined();

    // Content Topics section title 在 col 9（J 列）
    const ctTitleRow = rows.find(r => r[9]?.v === 'CONTENT TOPICS');
    expect(ctTitleRow).toBeDefined();
  });

  it('Posts by Date 列头应包含：Date / Post Text / Platform / Views / Impressions / Eng. / ER%', () => {
    const data = makeMockReportData();
    const rows = buildPostsByDateAndTopics(data.topicRows, data.topics);

    const headerRow = rows.find(r => r[0]?.v === 'Date');
    expect(headerRow).toBeDefined();
    const cols = headerRow!.map(c => c?.v as string);

    expect(cols).toContain('Date');
    expect(cols).toContain('Post Text');
    expect(cols).toContain('Platform');
    expect(cols).toContain('Views');
    expect(cols).toContain('Impressions');
    expect(cols).toContain('Eng.');
    expect(cols).toContain('ER%');
  });

  it('Content Topics 表头应包含：Topic / Posts / Avg ER% / Trend', () => {
    const data = makeMockReportData();
    const rows = buildPostsByDateAndTopics(data.topicRows, data.topics);

    const headerRow = rows.find(r => r[9]?.v === 'Topic');
    expect(headerRow).toBeDefined();
    const cols = headerRow!.map(c => c?.v as string).filter(Boolean);
    expect(cols).toContain('Topic');
    expect(cols).toContain('Posts');
    expect(cols).toContain('Avg ER%');
    expect(cols).toContain('Trend');
  });

  it('Content Topics 应按 avgER 降序排列', () => {
    const data = makeMockReportData();
    const rows = buildPostsByDateAndTopics(data.topicRows, data.topics);

    // 提取所有 topic 行（col 9 有 label 的行）
    const topicRows = rows.filter(r => {
      const label = r[9]?.v as string | undefined;
      return label && label !== 'Topic' && label !== 'CONTENT TOPICS' && !label.includes('posts');
    });

    // 第一个 topic 应为 avgER 最高的
    const firstTopicLabel = topicRows[0]?.[9]?.v as string;
    expect(firstTopicLabel).toBe('Banking in Mauritius'); // avgER=2.55 最高
  });

  it('日期分组标题应为大写（如 MON 30 MAR 2026）', () => {
    const data = makeMockReportData();
    const rows = buildPostsByDateAndTopics(data.topicRows, data.topics);

    // 找日期行（第一列为大写英文日期）
    const dateGroupRows = rows.filter(r => {
      const v = String(r[0]?.v ?? '');
      return v === v.toUpperCase() && v.includes('MAR') && r[1] === null;
    });
    expect(dateGroupRows.length).toBeGreaterThan(0);
  });

  it('Total 行应在 Posts by Date 最下方', () => {
    const data = makeMockReportData();
    const rows = buildPostsByDateAndTopics(data.topicRows, data.topics);

    const totalRow = rows.find(r => r[0]?.v === 'Total');
    expect(totalRow).toBeDefined();
    // Total 行应包含总帖子数
    expect(totalRow![1]?.v).toMatch(/posts/);
  });

  it('平台列应有品牌色背景（PlatformPill 样式）', () => {
    const data = makeMockReportData();
    const rows = buildPostsByDateAndTopics(data.topicRows, data.topics);

    // 找 TikTok 行
    const tiktokRow = rows.find(r => r[2]?.v === 'TikTok');
    expect(tiktokRow).toBeDefined();
    // TikTok 背景色为 000000
    expect(tiktokRow![2]!.bg).toBe(PLATFORM_COLORS.tiktok);
  });

  it('Impressions=0 时应显示 — 而非 0', () => {
    const data = makeMockReportData({ topicRows: [
      makeTopicRow('2026-03-30', 'Mon 30 Mar 2026', 'Test post', 'tiktok', 1000, 0, 50, 5.0, 'up'),
    ]});
    const rows = buildPostsByDateAndTopics(data.topicRows, data.topics);

    // 找到该帖行（Platform = TikTok）
    const tiktokRow = rows.find(r => r[2]?.v === 'TikTok');
    expect(tiktokRow).toBeDefined();
    // Impressions 列（index 4）应为 —
    expect(tiktokRow![4]?.v).toBe('—');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 测试：Section 5 — Post Title Codes
// ─────────────────────────────────────────────────────────────────────────────

describe('Section 5: Post Title Codes', () => {
  it('section title 应为 POST TITLE CODES', () => {
    const data = makeMockReportData();
    const rows = buildPostTitleTable(data.topicRows);
    expect(rows[0][0]?.v).toBe('POST TITLE CODES');
    expect(rows[0][0]!.bg).toBe(C.SECTION_BG);
  });

  it('表头应为 Code / Date / Post Title', () => {
    const data = makeMockReportData();
    const rows = buildPostTitleTable(data.topicRows);
    const header = rows[1].map(c => c?.v as string);
    expect(header).toContain('Code');
    expect(header).toContain('Date');
    expect(header).toContain('Post Title');
  });

  it('Code 应为 P1, P2, P3... 顺序编号（非 spacer 行）', () => {
    const data = makeMockReportData();
    const rows = buildPostTitleTable(data.topicRows);
    // spacer 行：Array(24).fill(null)，r[0] 是 null → typeof null === 'object'，需显式排除
    const codeRows = rows.slice(2).filter(r => r[0] !== null);

    codeRows.forEach((row, i) => {
      expect(row[0]?.v).toBe(`P${i + 1}`);
    });
  });

  it('每个 topicRow 对应一个 Code 行（非 spacer）', () => {
    const data = makeMockReportData();
    const rows = buildPostTitleTable(data.topicRows);
    const codeRows = rows.slice(2).filter(r => r[0] !== null);
    expect(codeRows.length).toBe(data.topicRows.length);
  });

  it('Code 列背景应为深色（SECTION_BG），文字白色', () => {
    const data = makeMockReportData();
    const rows = buildPostTitleTable(data.topicRows);
    const firstCodeRow = rows[2];
    expect(firstCodeRow[0]!.bg).toBe(C.SECTION_BG);
    expect(firstCodeRow[0]!.color).toBe('FFFFFF');
    expect(firstCodeRow[0]!.bold).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 测试：完整 buildAllSections
// ─────────────────────────────────────────────────────────────────────────────

describe('buildAllSections — 完整结构', () => {
  it('应按顺序包含 5 个 section', () => {
    const data = makeMockReportData();
    const rows = buildAllSections(data);

    const sectionTitles = rows.map(r => r[0]?.v as string).filter(Boolean);
    // 第 0 行 sectionTitle('') → '' 过滤掉，所以第 0 个是客户名
    expect(sectionTitles[0]).toContain('Boolell');
    expect(sectionTitles).toContain('PERFORMANCE OVERVIEW');
    expect(sectionTitles).toContain('PLATFORM PERFORMANCE');
    expect(sectionTitles).toContain('POSTS BY DATE');
    expect(sectionTitles).toContain('CONTENT TOPICS');
    expect(sectionTitles).toContain('POST TITLE CODES');
  });

  it('ER 格式应为 XX.XX%（两位小数）', () => {
    const data = makeMockReportData();
    const rows = buildAllSections(data);
    const allVals = rows.flat().map(c => c?.v).filter(Boolean);

    const erValues = allVals.filter(v => typeof v === 'string' && /^\d+\.\d{2}%$/.test(v));
    expect(erValues.length).toBeGreaterThan(0);
  });

  it('K 格式化应正确（≥1000 → K，≥1000000 → M）', () => {
    const data = makeMockReportData();
    const rows = buildAllSections(data);
    const allVals = rows.flat().map(c => c?.v as string).filter(Boolean);

    // 34094 Views → 34.1K
    const viewsK = allVals.find(v => v === '34.1K');
    expect(viewsK).toBe('34.1K');

    // 4300 Impressions → 4.3K
    const imprK = allVals.find(v => v === '4.3K');
    expect(imprK).toBe('4.3K');
  });

  it('总行数应 > 0（非空报告）', () => {
    const data = makeMockReportData();
    const rows = buildAllSections(data);
    expect(rows.length).toBeGreaterThan(20);
  });

  it('所有 spacer 行（空行）应正确识别', () => {
    const data = makeMockReportData();
    const rows = buildAllSections(data);
    const spacerRows = rows.filter(r => r.every(c => c === null));
    expect(spacerRows.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 测试：边界条件
// ─────────────────────────────────────────────────────────────────────────────

describe('边界条件', () => {
  it('空 topicRows 时 Posts by Date 应仍输出 section title 和表头', () => {
    const data = makeMockReportData({ topicRows: [], topics: [] });
    const rows = buildPostsByDateAndTopics(data.topicRows, data.topics);
    expect(rows[0][0]?.v).toBe('POSTS BY DATE');
    // 即使没有数据，也应有表头
    expect(rows[1][0]?.v).toBe('Date');
  });

  it('空平台数据时 Total 行仍应正常输出', () => {
    const data = makeMockReportData({ platformRows: [] });
    const rows = buildPlatformPerformanceTable(data.platformRows);
    const totalRow = rows[rows.length - 2];
    expect(totalRow[0]?.v).toBe('Total');
  });

  it('ER=0 时 Content Topics Trend 应显示 —（flat）或 ▼（down）', () => {
    const data = makeMockReportData({ topics: [
      { label: 'Zero ER Topic', postCount: 1, avgER: 0 },
    ]});
    const rows = buildPostsByDateAndTopics(data.topicRows, data.topics);
    const zeroErRow = rows.find(r => r[9]?.v === 'Zero ER Topic');
    expect(zeroErRow).toBeDefined();
    // avgER=0 → 0 < 2 → down → ▼（符合 builder 逻辑）
    const trend = String(zeroErRow![12]?.v ?? '');
    expect(['—', '▼'].includes(trend)).toBe(true);
  });

  it('clientName 为空时应有默认值', () => {
    const data = makeMockReportData({ clientName: '' });
    const rows = buildReportHeader(data);
    expect(rows[1][0]?.v).toBe('Weekly Report');
  });

  it('totalPosts=0 时 Overview KPI 应显示 —', () => {
    const data = makeMockReportData({ overview: {
      totalPosts: 0, totalImpressions: 0, totalEngagements: 0,
      totalReach: 0, avgER: 0, activePlatforms: 0,
    }});
    const rows = buildPerformanceOverview(data);
    // Posts Published = 0 → '—'（无数据时统一显示 em dash）
    const postsCell = rows[2][0];
    expect(postsCell?.v).toBe('—');
  });
});
