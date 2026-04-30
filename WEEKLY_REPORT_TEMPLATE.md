# SAMA — Weekly Report 模板标准

> **最后更新：** 2026-03-30
> **对应截图：** Screenshot_2026-03-30_at_21.21.07

---

## 模板结构（6 个板块）

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│  Report Header                                                          │
│  Boolell Advisory Mauritius  |  Report Period  |  Generated  |  SAST      │
└──────────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────────┐
│  PERFORMANCE OVERVIEW                         5 个 KPI 卡片                    │
│  ────────────────────────────────────────────────────────────────────           │
│  Posts Published: 55        Total Impressions: 4.3K    Total Engagements: 1.1K  │
│  Engagement Rate: 26.03%   Total Reach: 3.1K                                 │
└──────────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────────┐
│  PLATFORM PERFORMANCE                                                    │
│  ────────────────────────────────────────────────────────────────────           │
│  LinkedIn   9 posts  1,968 Impr  60 Likes  —        120 Eng  ▲  │  │
│  Facebook  15 posts       721 Views  4 Likes  689 Reach  50 Eng  ▲  │  │
│  Instagram 17 posts     1,326 Views 17 Likes 1,095 Reach  86 Eng  ▼  │  │
│  YouTube   16 posts     4,420 Views  7 Likes       —        60 Eng  ▼  │  │
│  X         16 posts       195 Impr    1 Like        —         1 Eng  —  │  │
│  TikTok    18 posts    34,094 Views 523 Likes 29,055 Reach1,134 Eng  ▲  │  │
│  Total     55 posts     4.3K         612 Likes                1.5K     │
└──────────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────┬─────────────────────────────────┐
│  POSTS BY DATE                            │  CONTENT TOPICS                │
│  ─────────────────────────────────────    │  ──────────────────────────── │
│  Date       Post Text         Platform  Views│  Engagements ER                │
│  ─────────────────────────────────────    │  ──────────────────────────── │
│  Mon 30 Mar                              │  [Banking in Mauritius × 3]  │
│  03-30  "Are you overcomplicating..."   │    1,134 eng  2.55%  ▲       │
│         LinkedIn                   1.4K 1.9% │  [GBC vs DC × 1]             │
│         TikTok             24,839  2.12%   │    634 eng  2.55%  ▲         │
│                                          │                                │
│  Sun 29 Mar                              │  [Trust in Mauritius × 2]    │
│  03-29  "Navigating Mauritius' banking..."  │    5,408 eng  1.65%  ▲    │
│         TikTok              4,999  2.18%   │                                │
│         TikTok                409  1.71%  │  [Corporate Advisory × 1]    │
│         TikTok                128  0.78%  │    15 eng  1.11%  ▲          │
│         TikTok                359  1.11%  │                                │
│  03-29  "Opening a Mauritius bank account..." │ [Strike-Off Notice × 1]  │
│         TikTok                375  1.87%  │    10 eng  0.88%  ▼          │
│         TikTok                317  1.26%  │                                │
│  ─────────────────────────────────────    │                                │
│  Sat 28 Mar                              │                                │
│  03-28  "Received a Notice of Strike-Off..." │                           │
│         TikTok              1,099  1.55%  │                                │
│  03-28  "Is your CSP in Mauritius no longer..."  │                         │
│         TikTok                245  0.41%  │                                │
│  03-28  "Thinking of expanding your enterprise..."  │                     │
│         TikTok                129  0.78%  │                                │
│  Fri 27 Mar                              │                                │
│  03-27  "Is your corporate administrator..."  │                            │
│         TikTok                305  0.66%  │                                │
│  03-27  "Navigating Mauritius' banking sector..."  │                        │
│         LinkedIn               568  2.26%  │                                │
│  ─────────────────────────────────────    │                                │
│  Total       55 posts     34,094 Views     │                                │
└────────────────────────────────────────────┴─────────────────────────────────┘
```

---

## 各 Section 详细说明

### 数据来源说明（重要）

Weekly Report 的 3 个数据视图来源不同：

| 视图 | 数据来源 | 说明 |
|------|---------|------|
| **Performance Overview** | 所有帖子汇总 | totalImpressions = 4.3K（跨平台汇总） |
| **Platform Performance** | 按平台汇总 | TikTok impressions 来自各帖子的 videoViews 之和 |
| **Posts by Date** | 每条帖子单独显示 | 所有平台帖子按日期分组显示 |

> ⚠️ Posts by Date 的数值与 Platform Performance 不一定相等，因为同一帖子可能出现在多个平台，两边相加逻辑不同。

---

### Section 1: Report Header

| 字段 | 值 |
|------|-----|
| Client | Boolell Advisory Mauritius |
| Report Period | 变量，取决于选中的周 |
| Generated | 时间戳 |
| Timezone | SAST (UTC+2) |

---

### Section 2: Performance Overview

5 个 KPI 卡片：

| KPI | 示例值 | 说明 |
|-----|-------|------|
| Posts Published | 55 | 本周总帖子数 |
| Total Impressions | 4.3K | impressions 之和（≥1000 转为 K 格式） |
| Total Engagements | 1.1K | likes + comments + shares 之和 |
| Engagement Rate | 26.03% | engagements / impressions × 100 |
| Total Reach | 3.1K | 所有平台 reach 之和 |

---

### Section 3: Platform Performance

**表头（动态，根据有数据的平台）：**

```
Platform | Posts | [Impressions] | [Views] | Likes | [Reach] | Engagements | vs Prev Week
```

**各平台列配置（`WEEKLY_PLATFORM_COLUMNS`）：**

| 平台 | 有数据的列 | ER 计算 |
|------|---------|---------|
| LinkedIn | Impr, Likes, Engagements | eng / impressions |
| Facebook | Views, Likes, Reach, Engagements | eng / impressions |
| Instagram | Views, Likes, Reach, Engagements | eng / impressions |
| YouTube | Views, Likes, Engagements | eng / impressions |
| X/Twitter | Impr, Likes, Engagements | eng / impressions |
| TikTok | Views, Likes, Reach, Engagements | eng / impressions |

**vs Prev Week：** ▲ 绿色（engagements 上升）/ ▼ 红色（下降）/ — 灰色（无变化）

---

### Section 4: Posts by Date（两栏布局）

左栏：帖子明细表，右栏：话题标签

**帖子明细表头（固定）：**

```
Date | Post Text | Platform | Views | Impressions | Likes | Comments | Engagements | Eng. Rate
```

- 按日期倒序排列（Mon → Sun）
- 每行 = 一个帖子在某个平台（同一帖子发布到多平台时每行一个）
- 日期分组标题（大写字母，灰色背景）
- Eng. Rate 列：数字 + ER Bar 可视化

**Engagement Rate 计算：**

```
ER% = engagements / impressions × 100
```

**示例（TikTok March 30）：**

```
views: 24,839
likes: 394
comments: 8
shares: 133
engagements: 394 + 8 + 133 = 535

ER% = 535 / 24,839 × 100 = 2.12%
```

**Content Topics（右栏）：**

```
[话题名 × N posts]  [话题名 × N posts]  ...
```

- 按 avg ER 降序排列
- 显示：话题关键词 + post 数量 + avg ER + ▲▼ 趋势
- 话题提取：取帖子文本前 3 个实词（≥4 字符）

---

### 各平台 ER 计算对比

| 平台 | ER 公式 | 说明 |
|------|--------|------|
| LinkedIn | eng / impressions | impressions = uniqueImpressionsCount |
| Facebook | eng / impressions | impressions = impressionsUnique |
| Instagram | eng / impressions | impressions = reachCount |
| YouTube | eng / impressions | impressions = views（作为 proxy） |
| X/Twitter | eng / impressions | impressions = publicMetrics.impressionCount |
| TikTok | eng / impressions | **impressions = views = videoViews** |

---

## 相关文件索引

| 文件 | 用途 |
|------|------|
| `weeklyReportService.ts` | 数据构建逻辑，`WEEKLY_PLATFORM_COLUMNS` 列定义 |
| `WeeklyReport.tsx` | React UI 组件 |
| `excelWeeklyExport.ts` | Excel 导出（5 个板块，**不含** Post of the Week） |
| `ayrshareAnalytics.ts` | API 数据抓取，`extractPostMetrics` 字段映射 |
| `monthly_report_debug.py` | 调试脚本（适用所有报表数据验证） |
| `MONTHLY_REPORT_FIELD_REFERENCE.md` | 各平台字段参考 |

---

## 数据异常速查

| 症状 | 可能原因 | 解决 |
|------|---------|------|
| TikTok views 全为 0 | `extractPostMetrics` 未使用 `videoViews` | 检查 `ayrshareAnalytics.ts` TikTok 分支 |
| ER% 异常高（>100%） | impressions=0 但 eng>0 | 检查 ER = eng/impressions 分母 |
| Overview ≠ Posts by Date 之和 | Overview 用跨平台汇总，Posts by Date 逐条相加 | 正常现象，无需修复 |
| Platform 列 ≠ Posts by Date 列 | Platform 用汇总值，Posts by Date 用帖子级数据 | 正常现象 |
| Twitter impressions=35 | 账号只有 2 粉丝，数据真实 | 无需修复 |
