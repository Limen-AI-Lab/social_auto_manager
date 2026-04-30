# SAMA Report System — Integration Design

> **Goal:** 让 Python 数据管道抓取的数据通过 Supabase 接入 SAMA 前端，实现 Daily / Weekly / Monthly 三套报告在前端预览（与 Excel 布局一致），并在 Vercel 上部署团队版。

---

## 现状理解

| 组件 | 状态 |
|---|---|
| **Python 成功管道** | `social_performance_six_platforms.py` → 缓存 → `rebuild_excel_from_cache.py` ✅ 工作正常 |
| **Supabase** | 已配置但结构不清（可能只有 Auth，没有数据表或 Edge Functions） |
| **前端 React** | Overview / Posts / Report / Weekly / Monthly 等 Tab，数据 fetch 失败 ❌ |
| **Analyze Tab** | 存在但不工作，需要修复/替换 |
| **preview.html** | 另一个 agent 做的静态 UI 参考（布局正确，硬编码 mock 数据） |

---

## 架构设计

### 数据流向（三层）

```
┌─────────────────────────────────────────────────────────┐
│ Layer 1: Python 抓取层（已有，稳定）                        │
│  social_performance_six_platforms.py                     │
│  → scraped_report_cache/ (JSON 缓存)                     │
└──────────────────┬──────────────────────────────────────┘
                   │ 每日自动 / 手动触发
                   ▼
┌─────────────────────────────────────────────────────────┐
│ Layer 2: Supabase 数据层（需要新建）                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │ Edge Function: fetch-ayrshare-analytics         │    │
│  │   - 直接调 Ayrshare API（env API keys）          │    │
│  │   - 返回结构化 JSON 数据                         │    │
│  └─────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────┐    │
│  │ Edge Function: sync-to-postgres                 │    │
│  │   - 将数据写入 Supabase Postgres 表              │    │
│  └─────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────┐    │
│  │ Postgres Tables:                                 │    │
│  │   - analytics_posts: 单帖数据                     │    │
│  │   - analytics_platforms: 平台汇总                 │    │
│  │   - analytics_reports: 报告元数据                │    │
│  └─────────────────────────────────────────────────┘    │
└──────────────────┬──────────────────────────────────────┘
                   │ 前端调用
                   ▼
┌─────────────────────────────────────────────────────────┐
│ Layer 3: SAMA 前端（需要重构）                             │
│  - 用 preview.html 的布局替换现有 React 组件              │
│  - 前端直接调 Supabase Edge Functions 获取数据           │
│  - 去掉 Overview / Posts 等不可用的 Tab                  │
│  - 保留 Daily / Weekly / Monthly 三个报告 Tab           │
└─────────────────────────────────────────────────────────┘
```

### 数据库 Schema

```sql
-- 每日汇总快照（用于快速查询）
CREATE TABLE report_daily_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date DATE NOT NULL,
  platform TEXT NOT NULL,
  posts_count INT,
  impressions BIGINT,
  reach BIGINT,
  engagements BIGINT,
  views BIGINT,
  likes BIGINT,
  comments BIGINT,
  shares BIGINT,
  follower_count BIGINT,
  ctr DECIMAL(5,2),
  engagement_rate DECIMAL(5,2),
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(snapshot_date, platform)
);

-- 单帖数据
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id TEXT UNIQUE,
  platform TEXT NOT NULL,
  post_date DATE,
  post_text TEXT,
  post_url TEXT,
  views BIGINT,
  likes BIGINT,
  comments BIGINT,
  shares BIGINT,
  reach BIGINT,
  impressions BIGINT,
  engagements BIGINT,
  engagement_rate DECIMAL(5,2),
  topic TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 报告触发日志
CREATE TABLE report_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type TEXT, -- 'daily' | 'weekly' | 'monthly'
  status TEXT,   -- 'pending' | 'running' | 'done' | 'error'
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  result JSONB
);
```

### Edge Functions

1. **`fetch-ayrshare`** — 从 Ayrshare API 拉取原始数据，返回 JSON
2. **`sync-reports`** — 解析数据，写入 Postgres 表
3. **`get-daily-report`** — 查询 `report_daily_snapshots`，返回 Daily Report 所需的聚合数据
4. **`get-weekly-report`** — 查询跨日期的 `report_daily_snapshots` + `posts` 表
5. **`get-monthly-report`** — 同上，跨月聚合

### 前端布局（采用 preview.html 的设计）

| Tab | 内容 |
|---|---|
| **Daily** | 2×3 平台卡片网格，每张卡显示该日各平台 Metrics |
| **Weekly** | Overview KPIs → Platform Performance 表格（含 ER bar）→ Posts by Date → Content Topics |
| **Monthly** | Platform Summary（Jan/Feb/Mar 对比） → CTR → Posts Distribution → Top 5 Content |

---

## 需要确认的问题

1. **Supabase 配置**：你现在能访问 Supabase Dashboard 吗？里面有没有现有的数据表或 Edge Functions？

2. **API Keys**：Ayrshare 的 API Key 是存在本地 `.env` 还是 Supabase Secrets？如果是前者，Edge Function 需要通过某种方式安全调用。

3. **前端 Vercel 部署**：你们公司 SAMA 的 Vercel 项目 URL 是？现有分支叫什么？
