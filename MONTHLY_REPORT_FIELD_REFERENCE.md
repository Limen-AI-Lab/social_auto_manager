# SAMA — Monthly Report 字段参考手册

> **用途：** 作为每月抓取数据的固定参考，确保每个平台使用正确的 API 字段。
> **最后更新：** 2026-03-30
> **诊断脚本：** `monthly_report_debug.py`
>
> **关联文档：** 周报模板标准见 `WEEKLY_REPORT_TEMPLATE.md`

---

## 每月操作流程

```
每月步骤：

1. 修改配置（monthly_report_debug.py 顶部）：
   YEAR = 2026
   MONTH_A = 2   ← 上个月
   MONTH_B = 3   ← 当前月
   MONTH_LABELS = ("Feb", "Mar")

2. 运行抓取脚本（如需要）：
   python3 social_performance_six_platforms.py

3. 运行诊断脚本（必做）：
   python3 monthly_report_debug.py

4. 检查输出：
   - debug/report_summary.json  → 总体状态
   - debug/{platform}_buggy_posts.json → 每个有 bug 平台的具体差异
   - 如有 FAIL → 修复 rebuild_excel_from_cache.py 中的 extract()
   - 如全部 PASS → 运行 rebuild_excel_from_cache.py 生成 Excel

5. 生成 Excel：
   python3 rebuild_excel_from_cache.py

6. 打开 Excel 验证最终输出
```

---

## 每月 Excel 输出模板

每个平台占 **5 列**（含 1 列标签 + 4 列数据），每月两块（Feb | Mar | MoM Δ）。

```
┌──────────────┬─────────┬─────────┬─────────┐
│ Platform     │  Feb    │   Mar   │  MoM %Δ │
├──────────────┼─────────┼─────────┼─────────┤
│ Number of Posts│   7    │   18    │ +157.1% │
│ Followers    │   337   │   337   │   0.0%  │
│ Follower Δ   │   —     │   0.0%  │   —     │
│ Views        │   476   │  34,094 │+7062.6% │  ← TikTok 主要指标
│ Reach        │   451   │  29,055 │+6342.4% │
│ Likes        │     2   │     523 │+26050%  │
│ Comments     │     1   │       8 │ +700.0% │
│ Shares       │     0   │     160 │   —     │
├──────────────┼─────────┴─────────┴─────────┤
│ POST OF THE MONTH                           │
│   Topic:    "Are you overcomplicating..."   │
│   Likes:    394                             │
│   Shares:   133                             │
│   Comments: 8                               │
│   Image:    (video)                        │
└─────────────────────────────────────────────┘
```

---

## 各平台字段参考

### 1. TikTok

#### 帖子级（`/api/analytics/post` → `body.tiktok.analytics`）

> **核心指标：** views = `videoViews`（不是 `viewCount`）

| 提取字段 | Excel 指标 | API 字段路径 | 备注 |
|---------|-----------|-------------|------|
| Views | Views | `analytics.videoViews` | **主要字段**，不是 viewCount |
| Likes | Likes | `analytics.likeCount` | |
| Comments | Comments | `analytics.commentsCount` | 可能不存在或为 0（TikTok 限制评论数据） |
| Shares | Shares | `analytics.shareCount` | 病毒帖可达 100+ |
| Reach | Reach | `analytics.reach` | 查看内容的独立账户数 |
| Impressions | — | **用 views 代替** | TikTok 无独立 impressions 字段 |
| Clicks | — | 不适用 | TikTok 不提供链接点击数据 |
| Saves/Favorites | — | 不提取 | `analytics.favorites` 存在但不使用 |

#### 账号级（`/api/analytics/social` → `social.tiktok.analytics`）

| 提取字段 | API 字段 | 备注 |
|---------|---------|------|
| Followers | `analytics.followerCount` | 账号粉丝数 |
| Impressions proxy | `analytics.viewCountTotal` | 60 天总播放 |
| Likes total | `analytics.likeCountTotal` | 账号历史总 likes |
| Shares total | `analytics.shareCountTotal` | 账号历史总分享 |
| Comments total | `analytics.commentCountTotal` | 账号历史总评论 |
| Profile views | `analytics.profileViews` | |

#### TikTok Excel 列配置

```python
return [
    ("Number of Posts", "posts"),
    ("Followers", "followers"),
    ("Follower Growth %", "fg"),
    ("Views", "views"),         # 主要指标
    ("Reach", "reach"),         # 2026-03 修复
    ("Likes", "likes"),
    ("Comments", "comments"),   # 可能为 0（TikTok 不提供）
    ("Shares", "shares"),
]
```

#### Post of the Month 评分

```python
# TikTok 使用加权评分（不是纯 views）
score = views * 0.4 + engagements * 0.4 + reach * 0.2
```

---

### 2. LinkedIn

#### 帖子级（`/api/analytics/post` → `body.linkedin.analytics`）

| 提取字段 | Excel 指标 | API 字段路径 | 备注 |
|---------|-----------|-------------|------|
| Impressions | Impressions | `analytics.impressionCount` | 主要指标 |
| Reach | Reach | `analytics.uniqueImpressionsCount` | 独立账户数 |
| Views | — | `analytics.videoViews` | 仅视频帖有，非主要 |
| Clicks | Clicks | `analytics.clickCount` | 链接点击 |
| Likes | Reactions | `analytics.likeCount` | 含所有 reaction 类型 |
| Comments | Comments | `analytics.commentCount` | |
| Shares | Reposts | `analytics.shareCount` | |
| ER% | Eng. Rate | 计算: reactions/impressions | |

#### LinkedIn Excel 列配置

```python
return [
    ("Number of Posts", "posts"),
    ("Followers", "followers"),
    ("Follower Growth %", "fg"),
    ("Impressions", "impressions"),  # 主要指标
    ("Engagement %", "engagement_pct"),
    ("Clicks", "clicks"),
    ("Reactions", "reactions"),
    ("Reposts", "reposts"),
]
```

---

### 3. Facebook

#### 帖子级（`/api/analytics/post` → `body.facebook.analytics`）

| 提取字段 | Excel 指标 | API 字段路径 | 备注 |
|---------|-----------|-------------|------|
| Impressions | Impressions | `analytics.impressionsUnique` | 主要指标 |
| Reach | Reach | `analytics.impressionsUnique` | = impressions |
| Views | Views | `analytics.blueReelsPlayCount` 或 `analytics.impressionsUnique` | Reels 优先 |
| Likes | Reactions | `analytics.likeCount` | 含所有 reaction 类型 |
| Comments | Comments | `analytics.commentsCount` | |
| Shares | Shares | `analytics.sharesCount` 或 `analytics.shareCount` | |

#### Facebook Excel 列配置

```python
return [
    ("Number of Posts", "posts"),
    ("Followers", "followers"),
    ("Follower Growth %", "fg"),
    ("Impressions", "impressions"),
    ("Reach", "reach"),
    ("Clicks", "clicks"),
    ("Reactions", "reactions"),
    ("Shares", "shares"),
]
```

---

### 4. Instagram

#### 帖子级（`/api/analytics/post` → `body.instagram.analytics`）

| 提取字段 | Excel 指标 | API 字段路径 | 备注 |
|---------|-----------|-------------|------|
| Impressions | Impressions / Total | `analytics.reachCount` 或 `analytics.impressionsCount` 或 `analytics.viewsCount` | 取最大值 |
| Reach | Reach | `analytics.reachCount` | |
| Views | Views | `analytics.viewsCount` | 图文 = 显示数；视频 = 播放数 |
| Likes | Reactions | `analytics.likeCount` | |
| Comments | Comments | `analytics.commentsCount` | |
| Shares | Shares | `analytics.sharesCount` 或 `analytics.shareCount` | |

#### Instagram Excel 列配置

```python
return [
    ("Number of Posts", "posts"),
    ("Followers", "followers"),
    ("Follower Growth %", "fg"),
    ("Total Impressions", "impressions"),  # 主要指标
    ("Reach", "reach"),
    ("Views", "views"),
    ("Reactions", "reactions"),
    ("Shares", "shares"),
]
```

---

### 5. YouTube

#### 帖子级（`/api/analytics/post` → `body.youtube.analytics`）

| 提取字段 | Excel 指标 | API 字段路径 | 备注 |
|---------|-----------|-------------|------|
| Views | Views | `analytics.viewCount` 或 `analytics.views` | 主要指标 |
| Likes | Likes | `analytics.likeCount` | |
| Comments | Comments | `analytics.commentCount` | |
| Shares | — | 不适用 | YouTube 不直接提供 |
| Saves | — | `analytics.saves` | |
| Impressions | — | 用 views 代替 | 无独立 impressions |
| Clicks | — | `analytics.linkClicks` | |

#### YouTube Excel 列配置

```python
return [
    ("Number of Posts", "posts"),
    ("Followers", "followers"),
    ("Follower Growth %", "fg"),
    ("Views", "views"),         # 主要指标
    ("Likes", "likes"),
    ("Comments", "comments"),
    ("Shares", "shares"),
    ("Engagement", "eng_yt"),  # likes + comments + shares
]
```

---

### 6. X (Twitter)

#### 帖子级（`/api/analytics/post` → `body.twitter[0].analytics`）

> **注意：** Twitter 返回数组（thread 支持），取第一个元素 `[0]`

| 提取字段 | Excel 指标 | API 字段路径 | 备注 |
|---------|-----------|-------------|------|
| Impressions | Impressions | `analytics.publicMetrics.impressionCount` | 主要指标 |
| Likes | Likes | `analytics.publicMetrics.likeCount` | |
| Comments | Comments | `analytics.publicMetrics.replyCount` | reply = comment |
| Reposts | Reposts | `analytics.publicMetrics.retweetCount` | |
| Shares | — | = retweetCount | Twitter 无独立 shares |
| Clicks | — | `analytics.organicMetrics.urlLinkClicks` 或 `userProfileClicks` | |
| Views | — | = impressions | Twitter 无独立 views |

**额外可用字段（不常用）：**
- `analytics.publicMetrics.quoteCount` — 引用推文
- `analytics.publicMetrics.bookmarkCount` — 收藏

#### 账号级（`/api/analytics/social` → `social.twitter.analytics`）

> **警告：** 账号级与帖子级字段结构不同，无 `publicMetrics` 对象

| 字段 | 路径 | 备注 |
|------|------|------|
| Followers | `analytics.followersCount` | |
| Following | `analytics.followingCount` | |
| Tweet count | `analytics.tweetCount` | 帖子总数（不是 impressions！） |

#### X/Twitter Excel 列配置

```python
return [
    ("Number of Posts", "posts"),
    ("Followers", "followers"),
    ("Follower Growth %", "fg"),
    ("Impressions", "impressions"),  # 主要指标
    ("Clicks", "clicks"),
    ("Likes", "likes"),
    ("Reposts", "reposts"),           # = retweets
]
```

---

## 账号级 API 字段对比

### `/api/analytics/social` 返回结构

```
{
  "linkedin":  { "analytics": { "impressionCount": ..., "uniqueImpressionsCount": ..., ... } },
  "facebook":  { "analytics": { "pagePostsImpressions": ..., "followersCount": ..., ... } },
  "instagram": { "analytics": { "viewsCount": ..., "reachCount": ..., "followersCount": ..., ... } },
  "youtube":   { "analytics": { "viewCount": ..., "subscriberCount": ..., ... } },
  "twitter":   { "analytics": { "followersCount": ..., "tweetCount": ..., "likeCount": ... } },
  "tiktok":    { "analytics": { "viewCountTotal": ..., "followerCount": ..., ... } }
}
```

---

## Bug 模式速查表

| 平台 | 问题现象 | 原因 | 解决方案 |
|------|---------|------|---------|
| TikTok | views/impressions 全为 0 | 使用了 `viewCount/views`，API 返回 `videoViews` | 改用 `videoViews` |
| TikTok | reach 全为 0 | reach 字段未映射 | 添加 `analytics.reach` |
| Twitter | social 级 impressions 永远为 0 | `publicMetrics` 只存在于 post 级 | social 级单独处理 |
| YouTube | ER% 异常高 | ER = engagements/impressions，但 impressions = 0 | 确保 impressions = views |
| LinkedIn | views 显示非零 | 错误将 videoViews 作为 views | views 归零（LinkedIn 无 post 级 views） |
| Instagram | 同一帖子 impressions ≠ reach | reachCount 和 impressionsCount 是不同指标 | 取 max(reachCount, impressionsCount) |

---

## Debug 输出文件说明

每月运行 `monthly_report_debug.py` 后，debug/ 目录包含：

```
debug/
├── report_summary.json         ← 所有平台的诊断状态（PASS / FAIL）
├── linkedin_buggy_posts.json  ← 有差异的帖子列表（如有）
├── facebook_buggy_posts.json
├── instagram_buggy_posts.json
├── youtube_buggy_posts.json
├── twitter_buggy_posts.json
├── tiktok_buggy_posts.json
└── EXCEL_VERIFICATION.txt      ← Excel 单元格值验证（如运行了验证）
```

**读报告方法：**
```python
import json
with open("debug/report_summary.json") as f:
    data = json.load(f)

for p in data["platforms"]:
    print(f"{p['label']}: {p['status']}")
    if p.get("bugs"):
        print(f"  BUG: {p['bugs']}")
    if p.get("warnings"):
        print(f"  WARN: {p['warnings']}")
```
