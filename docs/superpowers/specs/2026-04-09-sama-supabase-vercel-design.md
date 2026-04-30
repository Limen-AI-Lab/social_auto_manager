# SAMA 安全加固与 Supabase + Vercel 部署架构设计

**版本**：v1.0
**日期**：2026-04-09
**状态**：草稿

---

## 一、现状分析

### 1.1 当前部署情况

| 组件 | 状态 | 说明 |
|------|------|------|
| Vercel 项目 `social_auto_manager` | ⚠️ 已部署，main 分支 | 部署的是旧版代码，Edge Function 路径 404 |
| Supabase Edge Function `get-ayrshare-analytics` | ✅ 已写好代码 | **未部署**，需要手动推送 |
| Supabase 数据库迁移 `sama_post_cache` | ⚠️ SQL 已写好 | **未执行**，需在 Supabase Dashboard 运行 |
| Vercel Edge KV Storage | ❌ 未配置 | 需要创建 |
| 鉴权机制 | ❌ 无 | Edge Function 完全公开，任何人可调用 |

### 1.2 当前数据流向（不安全）

```
浏览器
  ↓ localStorage 明文存 AYRSHARE_API_KEY
  ↓ 直接调用 Ayrshare API（暴露 Key）
  → Ayrshare API
```

### 1.3 当前代码清单

**已完成（代码已写好）：**
- `supabase/functions/get-ayrshare-analytics/index.ts` — Edge Function 业务逻辑
- `supabase/migrations/20260409_001_create_sama_post_cache.sql` — 数据库建表 SQL
- `preview.html` — 前端报告 UI（日/周/月报，含 Excel 导出）
- `services/ayrshareAnalytics.ts` — 前端数据服务（备用）
- `components/` — React 组件（当前与 preview.html 独立，未集成）

**未完成（需要做）：**
- [ ] Supabase Edge Function 部署
- [ ] Supabase 数据库迁移执行
- [ ] Supabase 环境变量配置（AYRSHARE_API_KEY 等）
- [ ] Supabase 鉴权（添加 Bearer Token 验证）
- [ ] Vercel Edge Function 创建（鉴权 + 缓存代理）
- [ ] Vercel Edge KV Storage 配置
- [ ] 前端 `preview.html` 改造（改用 Vercel EF 作为唯一入口）
- [ ] 推送新 branch 到 Vercel

---

## 二、目标架构

### 2.1 安全数据流向（部署后）

```
浏览器
  ↓ 输入团队共享秘钥（一次性）
  ↓ 发送 REPORT_SECRET → Vercel Edge Function
  ↓ Vercel EF 验证通过后转发
  → Supabase Edge Function（内部使用 AYRSHARE_API_KEY，永不暴露）
      ↓
      → Ayrshare API（API Key 仅在此处存在）
      ↓
      → Supabase sama_post_cache（增量缓存）
      ↓
      ← 返回数据
  ← Vercel EF 写入 Edge KV 缓存（1小时 TTL）
  ↓
浏览器（收到最终报告数据）
```

### 2.2 完整架构图

```
┌─────────────────────────────────────────────────────────────┐
│                      浏览器 (Browser)                         │
│                  preview.html / SPA                          │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  输入团队共享秘钥 → 存 sessionStorage（会话级）           │ │
│  │  所有请求 → Authorization: Bearer <REPORT_SECRET>      │ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTPS
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              Vercel Edge Function (中间代理层)                 │
│              路径: /api/report                                │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  1. 验证 REPORT_SECRET（返回 401 若失败）                │ │
│  │  2. 查询 Vercel Edge KV 缓存                            │ │
│  │  3. 缓存命中 → 直接返回（节省 API 调用）                  │ │
│  │  4. 缓存未命中 → 转发至 Supabase EF                      │ │
│  │  5. Supabase EF 返回后 → 写入 Edge KV                   │ │
│  │  6. 返回给前端                                          │ │
│  └─────────────────────────────────────────────────────────┘ │
│  环境变量: SUPABASE_URL, SUPABASE_ANON_KEY, REPORT_SECRET    │
└──────────┬──────────────────────────────────┬───────────────┘
           │ Edge KV Cache (TTL: 1h)           │ HTTPS
           ▼                                  ▼
┌─────────────────────────┐    ┌────────────────────────────────────────┐
│   Vercel Edge KV        │    │         Supabase Edge Function          │
│  Key: report:{id}       │    │  get-ayrshare-analytics                  │
│  存: 报告快照 JSON       │    │                                          │
│                          │    │  ┌──────────────────────────────────┐  │
│                          │    │  │  验证 Authorization Bearer Token  │  │
│                          │    │  │  调用 Ayrshare API                │  │
│                          │    │  │  读写 sama_post_cache 表          │  │
│                          │    │  │  返回结构化数据                    │  │
│                          │    │  └──────────────────────────────────┘  │
│                          │    │  环境变量:                             │
└──────────────────────────┘    │  AYRSHARE_API_KEY                      │
                                │  X_API_KEY (X/Twitter, 可选)            │
                                │  X_API_SECRET                           │
                                │  SUPABASE_SERVICE_ROLE_KEY              │
                                └──────────────┬─────────────────────────┘
                                               │ HTTPS
                                               ▼
                                  ┌──────────────────────────┐
                                  │      Ayrshare API        │
                                  │  (真实社交媒体数据来源)     │
                                  └──────────────────────────┘
```

---

## 三、Supabase 部署计划

### 3.1 环境变量配置

在 Supabase Dashboard → Project Settings → Edge Functions → Secrets 中配置：

| 秘钥名 | 值 | 说明 |
|--------|-----|------|
| `AYRSHARE_API_KEY` | 你的 Ayrshare API Key | 必填，API 调用凭证 |
| `X_API_KEY` | X/Twitter Consumer Key | 可选，2026-03-31 后 X 必须配置 |
| `X_API_SECRET` | X/Twitter Consumer Secret | 可选 |
| `REPORT_SECRET` | 团队共享访问密码 | 必填，Vercel EF 和 Supabase EF 共用 |

### 3.2 数据库迁移（Supabase SQL Editor）

在 Supabase Dashboard → SQL Editor 中执行：

```sql
-- ============================================================
-- SAMA - Post Cache Table Migration
-- ============================================================

CREATE TABLE IF NOT EXISTS sama_post_cache (
  post_id     TEXT        NOT NULL,
  profile_key TEXT        NOT NULL,
  created     TEXT,
  fetched_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (post_id, profile_key)
);

CREATE INDEX IF NOT EXISTS idx_sama_post_cache_profile_fetched
  ON sama_post_cache (profile_key, fetched_at DESC);

CREATE OR REPLACE FUNCTION sama_cleanup_old_cache()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM sama_post_cache
  WHERE fetched_at < NOW() - INTERVAL '90 days';
END;
$$;
```

### 3.3 Edge Function 部署

```bash
cd /Users/huaweiwei/Desktop/截图/SAMA---Social-Auto-Manager-main
supabase login
supabase link --project-ref <your-project-ref>
supabase functions deploy get-ayrshare-analytics
supabase secrets set AYRSHARE_API_KEY=xxx X_API_KEY=xxx X_API_SECRET=xxx
```

**部署后测试：**

```bash
curl -X POST https://<project-ref>.supabase.co/functions/v1/get-ayrshare-analytics \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <REPORT_SECRET>" \
  -d '{"profileKeys":["<your-profile-key>"], "lastDays": 7}'
```

### 3.4 鉴权加固（Supabase EF 代码修改）

在 `supabase/functions/get-ayrshare-analytics/index.ts` 的 `serve()` 开头添加：

```typescript
serve(async (req: Request) => {
  // ── 鉴权 ──────────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const validSecret = Deno.env.get('REPORT_SECRET');

  if (!token || token !== validSecret) {
    return new Response(
      JSON.stringify({ success: false, error: 'Unauthorized: invalid token' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }
  // ── 原有业务逻辑继续 ───────────────────────────────────────
  ...
});
```

---

## 四、Vercel 部署计划

### 4.1 Vercel Edge Function 创建

在项目根目录新建 `api/report.ts`（或 `api/index.ts`）：

```typescript
// api/report.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // 1. 鉴权
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const validSecret = process.env.REPORT_SECRET;

  if (!token || token !== validSecret) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  // 2. 构造缓存 Key
  const { profileKeys, lastDays, startDate, endDate, mode } = req.body;
  const cacheKey = `report:${JSON.stringify(profileKeys)}:${startDate}:${endDate}`;

  // 3. 查询 Edge KV 缓存（伪代码，Vercel KV API）
  // const cached = await kv.get(cacheKey);
  // if (cached) return res.json({ ...JSON.parse(cached), cached: true });

  // 4. 转发到 Supabase EF
  const supabaseRes = await fetch(
    `${process.env.SUPABASE_URL}/functions/v1/get-ayrshare-analytics`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ profileKeys, lastDays, startDate, endDate, mode }),
    }
  );

  const data = await supabaseRes.json();

  // 5. 写入缓存（TTL 3600 秒）
  // await kv.set(cacheKey, JSON.stringify(data), { ex: 3600 });

  return res.json({ ...data, cached: false });
}
```

### 4.2 Vercel 环境变量

在 Vercel Dashboard → Project Settings → Environment Variables：

| 名称 | 值 |
|------|-----|
| `SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role key |
| `REPORT_SECRET` | 与 Supabase EF 相同的共享秘钥 |

### 4.3 Vercel Edge KV 配置

Vercel Hobby 计划包含 1 个 KV namespace（免费），操作步骤：

1. Vercel Dashboard → Storage → Create KV Database
2. 命名为 `sama-report-cache`
3. 绑定到 `social_auto_manager` 项目
4. Vercel CLI 配置：`vercel env pull .env.local`

> ⚠️ 注意：免费 Hobby 计划只有 1 个 KV。如需更多，可升级或用 Supabase 替代（Supabase 已有 `sama_post_cache`）。

### 4.4 推送新分支

```bash
cd /Users/huaweiwei/Desktop/截图/SAMA---Social-Auto-Manager-main
git checkout -b feature/supabase-integration
git add .
git commit -m "feat: Supabase EF deployment + Vercel auth proxy"
git push origin feature/supabase-integration
```

然后在 Vercel Dashboard 将 `feature/supabase-integration` 分支设为 Production 分支并触发部署。

---

## 五、前端改造（preview.html）

### 5.1 当前问题

- `preview.html` 中的 `services/ayrshareAnalytics.ts` 直接调用 Ayrshare API
- API Key 存在 localStorage（明文）
- 无鉴权机制

### 5.2 改造方案

改造 `preview.html` 中的 JavaScript，改为调用 Vercel Edge Function：

```typescript
// 新增配置区
const CONFIG = {
  apiBase: 'https://socialautomanager.vercel.app/api', // Vercel EF 入口
  secret: null, // 用户首次输入
};

// 鉴权：用户输入秘钥
async function authenticate(password) {
  const res = await fetch(`${CONFIG.apiBase}/report`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${password}`,
    },
    body: JSON.stringify({
      profileKeys: ['<your-profile-key>'],
      lastDays: 7,
      mode: 'incremental',
    }),
  });
  if (res.status === 401) throw new Error('无效的访问密码');
  return await res.json();
}

// 数据获取
async function fetchReport(options) {
  return authenticate(CONFIG.secret).then(() =>
    fetch(`${CONFIG.apiBase}/report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CONFIG.secret}`,
      },
      body: JSON.stringify(options),
    }).then(r => r.json())
  );
}
```

---

## 六、数据模型

### 6.1 Supabase Edge Function 请求格式

```typescript
interface ReportRequest {
  profileKeys: string[];        // Ayrshare profile keys
  lastDays?: number;            // 默认 7
  startDate?: string;           // ISO 8601，默认 lastDays 天前
  endDate?: string;             // ISO 8601，默认今天
  mode?: 'full' | 'incremental' | 'refresh'; // 默认 'full'
}
```

### 6.2 Supabase Edge Function 响应格式

```typescript
interface ReportResponse {
  success: boolean;
  mode: 'full' | 'incremental' | 'refresh';
  cacheStats: {
    enabled: boolean;
    cachedSkipped: number;
    newlyFetched: number;
  };
  historyPosts: HistoryPost[];         // 帖子列表
  summaries: PlatformSummary[];         // 各 profile × 平台汇总
  platformMetrics: PlatformMetrics;    // 全局按平台聚合
  overallMetrics: OverallMetrics;       // 全局总计
  errors: string[];
  warnings: string[];
}

interface HistoryPost {
  id: string;
  post: string;           // 帖子正文（前200字）
  platforms: string[];    // ['linkedin', 'instagram', ...]
  postIds: Array<{
    platform: string;
    id: string;
    postUrl: string;
    status: string;
  }>;
  created: string;        // ISO 8601
  status: string;
}

interface PlatformSummary {
  profileKey: string;
  platform: string;
  totalPosts: number;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  totalClicks: number;
  totalReach: number;
  totalImpressions: number;
  avgEngagementRate: number;
  followers: number;
}

interface PlatformMetrics {
  [platform: string]: {
    platform: string;
    label: string;         // 'LinkedIn', 'Instagram'...
    posts: number;
    views: number;
    likes: number;
    comments: number;
    shares: number;
    impressions: number;
    totalEngagement: number;
    avgEngagementRate: number;
    followers: number;
    paidImpressions: number;
    organicImpressions: number;
  };
}

interface OverallMetrics {
  totalPosts: number;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  totalSaves: number;
  totalClicks: number;
  totalReach: number;
  totalImpressions: number;
  totalEngagement: number;
  avgEngagementRate: number;
  paidImpressions: number;
  organicImpressions: number;
}
```

---

## 七、实施顺序

> **核心原则：先 Supabase，再 Vercel，最后前端**

| 步骤 | 操作 | 负责人 | 备注 |
|------|------|--------|------|
| 1 | Supabase SQL Editor 执行迁移 SQL | 你手动操作 | Dashboard → SQL Editor |
| 2 | Supabase Dashboard 配置环境变量 | 你手动操作 | AYRSHARE_API_KEY, REPORT_SECRET |
| 3 | Supabase Edge Function 部署 + 鉴权加固 | 我执行 | `supabase functions deploy` |
| 4 | Supabase EF 本地测试（curl） | 我验证 | 确保返回数据正常 |
| 5 | Supabase 部署确认后 → Vercel Edge KV | 你手动操作 | Storage → Create KV |
| 6 | Vercel Edge Function 创建 | 我执行 | 新建 `api/report.ts` |
| 7 | Vercel 环境变量配置 | 你手动操作 | Project Settings |
| 8 | `preview.html` 前端改造 | 我执行 | 改为调用 Vercel EF |
| 9 | 本地 `localhost:5173` 全功能测试 | 我验证 | 日/周/月报全部跑通 |
| 10 | 确认无 bug → push 新 branch | 我执行 | `feature/supabase-integration` |
| 11 | Vercel 触发部署到 branch | 你确认 | 预览链接测试 |
| 12 | 确认 Vercel OK → 切 main/production | 你确认 | 正式上线 |

---

## 八、已知限制与风险

| 风险 | 影响 | 缓解 |
|------|------|------|
| Supabase Hobby 有限制（并发数） | 多用户同时访问可能限流 | Vercel Edge KV 缓存减少调用频率 |
| Edge KV Hobby 计划只有 1 个 namespace | 最多 1 个 KV | 用 Supabase `sama_post_cache` 做主要缓存 |
| X/Twitter API BYO Key 2026-03-31 截止 | X 数据可能为空 | 检查是否已配置 X_API_KEY |
| REPORT_SECRET 泄露 | 任何人都能访问 | 定期更换，不在前端代码中硬编码 |
| Vercel Hobby 休眠（无流量 7 天后） | 冷启动慢 | 保持最低访问频率或升级 Hobby+ |

---

## 九、成功标准

- [ ] Supabase EF 返回正确报告数据（curl 测试）
- [ ] Vercel EF 返回 401（未带 Token）、200（带正确 Token）
- [ ] 日报（Daily Report）数据正确显示
- [ ] 周报（Weekly Report）数据正确显示，Delta 计算正确
- [ ] 月报（Monthly Report）数据正确显示，CTR、Followers 增长显示正确
- [ ] Excel 导出功能正常
- [ ] 新 branch 在 Vercel 部署成功并可访问
