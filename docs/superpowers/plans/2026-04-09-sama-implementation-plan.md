# SAMA 安全加固实施计划

> **For agentic workers:** 使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实施。

**目标：** 在 Supabase Edge Function 部署鉴权后，将 Vercel 设为统一入口，前端永远不暴露 Ayrshare API Key。

**架构：** Supabase Edge Function 处理所有 Ayrshare API 调用 + 数据库缓存；Vercel Edge Function 做统一鉴权代理 + Edge KV 缓存；前端通过 Vercel 访问所有数据。

**技术栈：** Supabase Edge Functions (Deno) / Vercel Edge Functions (Node.js) / Edge KV / preview.html

---

## 文件变更总览

| 操作 | 文件 |
|------|------|
| 修改 | `supabase/functions/get-ayrshare-analytics/index.ts` — 添加鉴权 |
| 新建 | `api/report.ts` — Vercel Edge Function 鉴权代理 |
| 修改 | `preview.html` — 改为调用 Vercel Edge Function |
| 新建 | `.env.local.example` — 环境变量示例文件 |
| 新建 | `supabase/.env.local` — Supabase 本地环境变量 |

---

## 阶段一：你来执行（Supabase 手动配置）

这些步骤需要你在 Supabase Dashboard 手动操作：

### 阶段一任务 A：在 Supabase SQL Editor 执行建表 SQL

**操作路径：** Supabase Dashboard → SQL Editor → 新建查询 → 粘贴执行以下 SQL

```sql
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

**成功标志：** 表 `sama_post_cache` 在 Table Editor 中可见。

---

### 阶段一任务 B：在 Supabase 配置环境变量

**操作路径：** Supabase Dashboard → Project Settings → Edge Functions → Secrets → New Secret

配置以下秘钥（你需要在 Supabase Dashboard 中找到你的 `Project URL` 和 `service_role` key）：

| Secret Name | 你填入的值 |
|------------|-----------|
| `AYRSHARE_API_KEY` | 你的 Ayrshare API Key |
| `X_API_KEY` | X/Twitter Consumer Key（可选，留空跳过）|
| `X_API_SECRET` | X/Twitter Consumer Secret（可选）|
| `REPORT_SECRET` | 团队共享密码（例如 `sama-team-2026`）|

> **重要：** `REPORT_SECRET` 要记下来，后面 Vercel 和前端都要用同一个值。

---

## 阶段二：我来执行（代码修改）

### 任务 1：Supabase Edge Function 添加鉴权

**文件：** `supabase/functions/get-ayrshare-analytics/index.ts`

**变更位置：** 第 357 行 `serve(async (req: Request) => {` 之后、获取 API Key 之前，插入鉴权块。

**完整修改 old_string → new_string：**

找到这两行（在原文件第 357-367 行附近）：
```typescript
serve(async (req: Request) => {
  try {
    // Get API keys from environment
    const { apiKey, xApiKey, xApiSecret } = getApiKeys();
    
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'AYRSHARE_API_KEY not configured...' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
```

替换为：
```typescript
serve(async (req: Request) => {
  // ── 鉴权 ──────────────────────────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const validSecret = Deno.env.get('REPORT_SECRET');

  if (!token || token !== validSecret) {
    return new Response(
      JSON.stringify({ success: false, error: 'Unauthorized: invalid or missing token' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }
  // ── 鉴权通过 ────────────────────────────────────────────────────────────────

  try {
    // Get API keys from environment
    const { apiKey, xApiKey, xApiSecret } = getApiKeys();

    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'AYRSHARE_API_KEY not configured. Set it with: supabase secrets set AYRSHARE_API_KEY=xxx' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
```

---

### 任务 2：Supabase Edge Function 部署

**执行命令（在项目根目录）：**

```bash
# 1. 登录 Supabase CLI
supabase login

# 2. 链接你的 Supabase 项目（project-ref 在 Dashboard → Settings → General）
supabase link --project-ref <your-project-ref>

# 3. 推送环境变量到 Supabase
supabase secrets set REPORT_SECRET=sama-team-2026

# 4. 部署 Edge Function
supabase functions deploy get-ayrshare-analytics

# 5. 验证部署成功
supabase functions list
```

**成功标志：** `supabase functions list` 显示 `get-ayrshare-analytics` 状态为 `ACTIVE`。

---

### 任务 3：Supabase Edge Function 本地测试

**执行命令：**

```bash
curl -X POST https://<your-project-ref>.supabase.co/functions/v1/get-ayrshare-analytics \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sama-team-2026" \
  -d '{"profileKeys": ["<your-profile-key>"], "lastDays": 7}'
```

**期望输出：**
- HTTP 200，`{"success": true, "historyPosts": [...], ...}`
- 若不带 Token：`{"success": false, "error": "Unauthorized..."}`，HTTP 401

---

### 任务 4：创建 Supabase 环境变量文件

**新建文件：** `supabase/.env.local`

```bash
# Supabase 项目配置
SUPABASE_URL=https://<your-project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>

# 业务密钥
AYRSHARE_API_KEY=<your-ayrshare-api-key>
X_API_KEY=<your-x-api-key>
X_API_SECRET=<your-x-api-secret>
REPORT_SECRET=sama-team-2026
```

**同时新建：** `.env.local.example`（不含真实值）

```bash
# Supabase 项目配置
SUPABASE_URL=https://<your-project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>

# 业务密钥
AYRSHARE_API_KEY=<your-ayrshare-api-key>
X_API_KEY=<your-x-api-key>
X_API_SECRET=<your-x-api-secret>
REPORT_SECRET=<your-team-secret>
```

---

### 任务 5：创建 Vercel Edge Function 鉴权代理

**新建文件：** `api/report.ts`

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Vercel Edge Function: 统一鉴权代理层
// 所有前端请求通过此函数转发到 Supabase Edge Function
// 路径: /api/report

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // ── 1. 只接受 POST ──────────────────────────────────────────────────────────
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  // ── 2. 鉴权：验证 Bearer Token ─────────────────────────────────────────────
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const validSecret = process.env.REPORT_SECRET;

  if (!token || token !== validSecret) {
    return res.status(401).json({ success: false, error: 'Unauthorized: invalid token' });
  }

  // ── 3. 构造缓存 Key ────────────────────────────────────────────────────────
  const { profileKeys, lastDays, startDate, endDate, mode } = req.body || {};
  const cacheKey = `report:${JSON.stringify(profileKeys || [])}:${startDate || ''}:${endDate || ''}`;

  // ── 4. 尝试读取 Edge KV 缓存 ───────────────────────────────────────────────
  // 注意：需在 Vercel Storage 中创建 KV Database 并绑定到项目后启用
  // 以下为条件启用（如果 kv 实例存在）
  try {
    const kv = (req as any).kv;
    if (kv) {
      const cached = await kv.get(cacheKey);
      if (cached) {
        const data = JSON.parse(cached as string);
        return res.json({ ...data, cached: true });
      }
    }
  } catch (e) {
    // KV 不可用时静默跳过，继续请求 Supabase
    console.warn('[Vercel EF] KV cache unavailable:', e);
  }

  // ── 5. 转发到 Supabase Edge Function ──────────────────────────────────────
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({
      success: false,
      error: 'Supabase not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
    });
  }

  const supabaseRes = await fetch(
    `${supabaseUrl}/functions/v1/get-ayrshare-analytics`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({ profileKeys, lastDays, startDate, endDate, mode }),
    }
  );

  const data = await supabaseRes.json();

  // ── 6. 写入 Edge KV 缓存（TTL 3600 秒 = 1 小时）───────────────────────────
  try {
    const kv = (req as any).kv;
    if (kv && data.success) {
      await kv.set(cacheKey, JSON.stringify(data), { ex: 3600 });
    }
  } catch (e) {
    console.warn('[Vercel EF] KV write failed:', e);
  }

  // ── 7. 返回数据 ─────────────────────────────────────────────────────────────
  return res.status(supabaseRes.status).json({ ...data, cached: false });
}
```

**说明：** Vercel Edge Function 需要在 Vercel Dashboard → Storage → Create KV Database 并绑定到项目后，`req.kv` 才会存在。KV 不可用时自动降级为直连 Supabase（功能正常，只是没有缓存）。

---

### 任务 6：修改 preview.html 改为调用 Vercel Edge Function

**文件：** `preview.html`

**需要修改的位置：** 文件底部 `<script>` 部分（约第 1356 行）

**Step 1: 替换配置区**

找到：
```javascript
<script>
function showPage(id, el) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById('page-' + id).classList.add('active');
  el.classList.add('active');
}
</script>
```

替换为：
```javascript
<script>
// ── 配置区 ──────────────────────────────────────────────────────────────────
const SAMA_CONFIG = {
  // Vercel Edge Function 入口（项目部署后的 URL）
  apiBase: 'https://socialautomanager.vercel.app/api',
  // REPORT_SECRET（团队共享密码，与 Supabase/Vercel 环境变量一致）
  secret: sessionStorage.getItem('sama_secret') || localStorage.getItem('sama_secret') || '',
};

// ── 鉴权状态 ────────────────────────────────────────────────────────────────
let isAuthenticated = false;

function saveSecret(secret) {
  sessionStorage.setItem('sama_secret', secret);
  isAuthenticated = true;
}

function clearSecret() {
  sessionStorage.removeItem('sama_secret');
  isAuthenticated = false;
  SAMA_CONFIG.secret = '';
}

// ── API 调用 ───────────────────────────────────────────────────────────────
async function apiFetch(options) {
  if (!SAMA_CONFIG.secret) {
    throw new Error('请先输入访问密码');
  }
  const res = await fetch(`${SAMA_CONFIG.apiBase}/report`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SAMA_CONFIG.secret}`,
    },
    body: JSON.stringify(options),
  });
  if (res.status === 401) {
    clearSecret();
    throw new Error('访问密码无效，请重新输入');
  }
  if (!res.ok) {
    throw new Error(`请求失败: HTTP ${res.status}`);
  }
  return await res.json();
}

// ── Tab 切换 ───────────────────────────────────────────────────────────────
function showPage(id, el) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById('page-' + id).classList.add('active');
  if (el) el.classList.add('active');
}

// ── 报告数据获取（改造现有函数使用 apiFetch）───────────────────────────────
async function fetchAndRenderDailyReport() {
  const data = await apiFetch({ profileKeys: ['<your-profile-key>'], lastDays: 2, mode: 'incremental' });
  // 调用现有的 renderDailyReport(data) 渲染函数
  if (typeof renderDailyReport === 'function') renderDailyReport(data);
}

async function fetchAndRenderWeeklyReport() {
  const data = await apiFetch({ profileKeys: ['<your-profile-key>'], lastDays: 7, mode: 'incremental' });
  if (typeof renderWeeklyReport === 'function') renderWeeklyReport(data);
}

async function fetchAndRenderMonthlyReport() {
  const data = await apiFetch({ profileKeys: ['<your-profile-key>'], lastDays: 30, mode: 'full' });
  if (typeof renderMonthlyReport === 'function') renderMonthlyReport(data);
}
</script>
```

**说明：**
1. `profileKeys` 需要替换为你的实际 Ayrshare Profile Key
2. `apiBase` 需在 Vercel 部署后更新为实际 URL
3. 所有真实 API 调用替换为 `apiFetch()`
4. API Key 不再存 localStorage，改为存 sessionStorage 的 `sama_secret`

---

### 任务 7：Git 提交与推送

```bash
cd /Users/huaweiwei/Desktop/截图/SAMA---Social-Auto-Manager-main

# 新建分支
git checkout -b feature/supabase-integration

# 提交
git add .
git commit -m "feat: add Supabase EF auth + Vercel proxy + secure frontend"

# 推送
git push origin feature/supabase-integration
```

---

## 阶段三：你来执行（Vercel 手动配置）

### 任务 A：Vercel Storage 创建 Edge KV

**操作路径：** Vercel Dashboard → Storage → Create Database → KV → 命名为 `sama-report-cache` → 绑定到 `social_auto_manager` 项目

---

### 任务 B：Vercel 环境变量配置

**操作路径：** Vercel Dashboard → Project Settings → Environment Variables

| Name | Value | Environments |
|------|-------|-------------|
| `SUPABASE_URL` | `https://<project-ref>.supabase.co` | Production, Preview, Development |
| `SUPABASE_SERVICE_ROLE_KEY` | 你的 service_role key | Production, Preview, Development |
| `REPORT_SECRET` | `sama-team-2026` | Production, Preview, Development |

---

### 任务 C：Vercel 触发 Branch 部署

1. Vercel Dashboard → `social_auto_manager` 项目 → Settings → Git
2. 将 `feature/supabase-integration` 分支设为 Preview 分支并触发部署
3. 或直接在 Vercel Dashboard 手动 Deploy，选择 `feature/supabase-integration` 分支

**成功标志：** Vercel 部署成功，预览 URL 可访问。

---

## 阶段四：我来验证

### 验证清单

- [ ] Supabase EF 测试：`curl` 返回 401（无 Token）和 200（带正确 Token）
- [ ] Supabase EF 返回的 `success: true` 且包含 `historyPosts`、`platformMetrics`
- [ ] Vercel EF 部署成功，预览 URL 响应正常
- [ ] Vercel EF 鉴权：返回 401（无/错误 Token）
- [ ] 日报（Daily）数据正确渲染
- [ ] 周报（Weekly）数据正确渲染，Delta 计算正确
- [ ] 月报（Monthly）数据正确渲染，CTR/Followers 显示
- [ ] Excel 导出按钮正常工作
- [ ] 新 branch 在 Vercel 预览链接可访问
