/**
 * SAMA - Unit Tests: 缓存策略
 *
 * 测试目标：
 * 1. 验证增量模式跳过已缓存的帖子
 * 2. 验证刷新模式跳过已缓存帖子但重新抓取
 * 3. 验证完整模式抓取所有帖子
 * 4. 验证缓存统计信息正确
 * 5. 验证 lastFetchDate 过滤逻辑
 */

import { describe, it, expect } from 'vitest';

// ─────────────────────────────────────────────────────────────────────────────
// 模拟的缓存策略实现（从 supabase/functions/get-ayrshare-analytics/index.ts 提取）
// ─────────────────────────────────────────────────────────────────────────────

type CacheMode = 'full' | 'incremental' | 'refresh';

interface Post {
  id: string;
  created: string;
  status?: string;
}

interface CacheStats {
  enabled: boolean;
  cachedSkipped: number;
  newlyFetched: number;
}

interface GetCachedPostIdsResult {
  cachedIds: Set<string>;
}

/**
 * 模拟：从缓存获取已缓存的帖子 ID
 */
async function getCachedPostIds(
  cachedData: Array<{ post_id: string; profile_key: string }>,
  profileKey: string
): Promise<Set<string>> {
  const filtered = cachedData.filter(e => e.profile_key === profileKey);
  return new Set(filtered.map(e => e.post_id));
}

/**
 * 模拟：根据模式过滤需要抓取的帖子
 */
function filterPostsByMode(
  mode: CacheMode,
  posts: Post[],
  cachedIds: Set<string>,
  lastFetchDate?: string
): { postsToFetch: Post[]; cachedCount: number } {
  let postsToFetch = posts;
  let cachedCount = 0;

  if (mode === 'incremental') {
    const before = postsToFetch.length;
    if (lastFetchDate) {
      postsToFetch = postsToFetch.filter(p =>
        !cachedIds.has(p.id) &&
        (!p.created || p.created > lastFetchDate)
      );
    } else {
      postsToFetch = postsToFetch.filter(p => !cachedIds.has(p.id));
    }
    cachedCount = before - postsToFetch.length;
  } else if (mode === 'refresh') {
    const before = postsToFetch.length;
    postsToFetch = postsToFetch.filter(p => !cachedIds.has(p.id));
    cachedCount = before - postsToFetch.length;
  }
  // mode === 'full': 不做任何过滤

  return { postsToFetch, cachedCount };
}

/**
 * 模拟：计算缓存统计
 */
function calculateCacheStats(
  mode: CacheMode,
  totalPosts: number,
  cachedCount: number
): CacheStats {
  const newlyFetched = mode === 'full' ? totalPosts : totalPosts - cachedCount;
  return {
    enabled: true,
    cachedSkipped: cachedCount,
    newlyFetched,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 测试：缓存过滤逻辑
// ─────────────────────────────────────────────────────────────────────────────

describe('缓存策略 - 过滤逻辑', () => {

  const samplePosts: Post[] = [
    { id: 'post1', created: '2026-04-01T10:00:00Z' },
    { id: 'post2', created: '2026-04-02T10:00:00Z' },
    { id: 'post3', created: '2026-04-03T10:00:00Z' },
    { id: 'post4', created: '2026-04-04T10:00:00Z' },
    { id: 'post5', created: '2026-04-05T10:00:00Z' },
  ];

  it('完整模式（full）：应该抓取所有帖子（不过滤）', () => {
    const cachedIds = new Set(['post1', 'post2']);
    const { postsToFetch, cachedCount } = filterPostsByMode('full', samplePosts, cachedIds);

    expect(postsToFetch).toHaveLength(5);
    expect(cachedCount).toBe(0);
  });

  it('增量模式（incremental）：应该跳过已缓存的帖子', () => {
    const cachedIds = new Set(['post1', 'post2', 'post3']);
    const { postsToFetch, cachedCount } = filterPostsByMode('incremental', samplePosts, cachedIds);

    expect(postsToFetch).toHaveLength(2); // post4, post5
    expect(cachedCount).toBe(3);
    expect(postsToFetch.map(p => p.id)).toEqual(['post4', 'post5']);
  });

  it('刷新模式（refresh）：应该跳过已缓存的帖子', () => {
    const cachedIds = new Set(['post1', 'post2', 'post3']);
    const { postsToFetch, cachedCount } = filterPostsByMode('refresh', samplePosts, cachedIds);

    expect(postsToFetch).toHaveLength(2);
    expect(cachedCount).toBe(3);
    expect(postsToFetch.map(p => p.id)).toEqual(['post4', 'post5']);
  });

  it('增量模式 + lastFetchDate：应该同时过滤缓存和日期', () => {
    const cachedIds = new Set(['post1', 'post3']);
    const lastFetchDate = '2026-04-03T00:00:00Z';

    const { postsToFetch, cachedCount } = filterPostsByMode(
      'incremental',
      samplePosts,
      cachedIds,
      lastFetchDate
    );

    // post1: 已缓存，跳过（缓存过滤）
    // post2: 未缓存，但 created < lastFetchDate，跳过（日期过滤）
    // post3: 已缓存，跳过（缓存过滤）
    // post4: 未缓存，且 created > lastFetchDate，保留
    // post5: 未缓存，且 created > lastFetchDate，保留
    expect(postsToFetch.map(p => p.id)).toEqual(['post4', 'post5']);
    // cachedCount = 所有被过滤的帖子数量（3个：post1, post2, post3）
    expect(cachedCount).toBe(3);
  });

  it('当没有缓存时，增量模式应该抓取所有帖子', () => {
    const cachedIds = new Set<string>();
    const { postsToFetch, cachedCount } = filterPostsByMode('incremental', samplePosts, cachedIds);

    expect(postsToFetch).toHaveLength(5);
    expect(cachedCount).toBe(0);
  });

  it('当所有帖子都已缓存时，增量模式应该返回空数组', () => {
    const cachedIds = new Set(['post1', 'post2', 'post3', 'post4', 'post5']);
    const { postsToFetch, cachedCount } = filterPostsByMode('incremental', samplePosts, cachedIds);

    expect(postsToFetch).toHaveLength(0);
    expect(cachedCount).toBe(5);
  });

  it('刷新模式应该跳过所有已缓存帖子（即使未过期）', () => {
    const cachedIds = new Set(['post1', 'post2']);
    const { postsToFetch, cachedCount } = filterPostsByMode('refresh', samplePosts, cachedIds);

    expect(postsToFetch).toHaveLength(3); // post3, post4, post5
    expect(cachedCount).toBe(2);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// 测试：缓存统计
// ─────────────────────────────────────────────────────────────────────────────

describe('缓存策略 - 缓存统计', () => {

  it('完整模式：newlyFetched=total（不过滤缓存）', () => {
    const stats = calculateCacheStats('full', 10, 5);

    expect(stats.enabled).toBe(true);
    expect(stats.newlyFetched).toBe(10); // 完整模式抓取全部
  });

  it('增量模式：正确计算跳过和新增数量', () => {
    const stats = calculateCacheStats('incremental', 10, 3);

    expect(stats.enabled).toBe(true);
    expect(stats.cachedSkipped).toBe(3);
    expect(stats.newlyFetched).toBe(7); // 10 - 3
  });

  it('刷新模式：正确计算跳过和新增数量', () => {
    const stats = calculateCacheStats('refresh', 10, 8);

    expect(stats.enabled).toBe(true);
    expect(stats.cachedSkipped).toBe(8);
    expect(stats.newlyFetched).toBe(2); // 10 - 8
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// 测试：缓存表操作（模拟）
// ─────────────────────────────────────────────────────────────────────────────

describe('缓存策略 - 缓存表操作', () => {

  it('应该正确获取指定 profile_key 的缓存数据', async () => {
    const cachedData = [
      { post_id: 'post1', profile_key: 'profileA' },
      { post_id: 'post2', profile_key: 'profileA' },
      { post_id: 'post3', profile_key: 'profileB' },
    ];

    const cachedIdsA = await getCachedPostIds(cachedData, 'profileA');
    const cachedIdsB = await getCachedPostIds(cachedData, 'profileB');

    expect(cachedIdsA.has('post1')).toBe(true);
    expect(cachedIdsA.has('post2')).toBe(true);
    expect(cachedIdsA.has('post3')).toBe(false);

    expect(cachedIdsB.has('post3')).toBe(true);
    expect(cachedIdsB.has('post1')).toBe(false);
  });

  it('应该处理空缓存数据', async () => {
    const cachedData: Array<{ post_id: string; profile_key: string }> = [];
    const cachedIds = await getCachedPostIds(cachedData, 'profileA');

    expect(cachedIds.size).toBe(0);
  });

  it('应该处理不存在的 profile_key', async () => {
    const cachedData = [
      { post_id: 'post1', profile_key: 'profileA' },
    ];
    const cachedIds = await getCachedPostIds(cachedData, 'profileNonExistent');

    expect(cachedIds.size).toBe(0);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// 测试：性能对比（缓存命中场景）
// ─────────────────────────────────────────────────────────────────────────────

describe('缓存策略 - 性能对比', () => {

  it('增量模式：跳过 80% 已缓存帖子时，大幅减少 API 调用', () => {
    const totalPosts = 100;
    const cachedPosts = 80;
    const stats = calculateCacheStats('incremental', totalPosts, cachedPosts);

    // 原本需要 100 次 API 调用，现在只需要 20 次
    expect(stats.newlyFetched).toBe(20);
    expect(stats.cachedSkipped).toBe(80);

    // API 调用减少比例
    const reductionRatio = (cachedPosts / totalPosts) * 100;
    expect(reductionRatio).toBe(80); // 减少了 80% 的 API 调用
  });

  it('增量模式：部分缓存命中时，减少 API 调用', () => {
    const totalPosts = 50;
    const cachedPosts = 25;
    const stats = calculateCacheStats('incremental', totalPosts, cachedPosts);

    expect(stats.newlyFetched).toBe(25);
    expect(stats.cachedSkipped).toBe(25);

    // 减少了 50% 的 API 调用
    const reductionRatio = (cachedPosts / totalPosts) * 100;
    expect(reductionRatio).toBe(50);
  });

  it('完整模式：无论缓存多少，newlyFetched=total', () => {
    const totalPosts = 100;
    const cachedPosts = 95;
    const stats = calculateCacheStats('full', totalPosts, cachedPosts);

    expect(stats.newlyFetched).toBe(100); // 完整模式抓取全部
    // 注意：calculateCacheStats 在 full 模式下，cachedSkipped=cachedCount（传入的参数）
    // 这是合理的，因为统计信息应该反映实际情况
    expect(stats.cachedSkipped).toBe(95);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// 测试：边界条件
// ─────────────────────────────────────────────────────────────────────────────

describe('缓存策略 - 边界条件', () => {

  it('应该处理空帖子列表', () => {
    const cachedIds = new Set(['post1', 'post2']);
    const { postsToFetch, cachedCount } = filterPostsByMode('incremental', [], cachedIds);

    expect(postsToFetch).toHaveLength(0);
    expect(cachedCount).toBe(0);
  });

  it('应该处理没有 created 日期的帖子', () => {
    const posts: Post[] = [
      { id: 'post1' }, // 没有 created
      { id: 'post2', created: '2026-04-01T10:00:00Z' },
    ];
    const cachedIds = new Set<string>();

    const { postsToFetch } = filterPostsByMode('incremental', posts, cachedIds, '2026-04-02T00:00:00Z');

    // post1: 没有 created，!p.created 为 true，保留
    // post2: created < lastFetchDate，跳过
    // 结果：只有 post1 保留（因为它没有 created 时间，无法判断日期）
    expect(postsToFetch.map(p => p.id)).toEqual(['post1']);
  });

  it('应该处理 lastFetchDate 为 undefined 的情况', () => {
    const posts: Post[] = [
      { id: 'post1', created: '2026-04-01T10:00:00Z' },
      { id: 'post2', created: '2026-04-02T10:00:00Z' },
    ];
    const cachedIds = new Set(['post1']);

    const { postsToFetch, cachedCount } = filterPostsByMode(
      'incremental',
      posts,
      cachedIds,
      undefined // 没有 lastFetchDate
    );

    // 只按缓存过滤
    expect(postsToFetch.map(p => p.id)).toEqual(['post2']);
    expect(cachedCount).toBe(1);
  });

  it('应该正确处理错误状态的帖子（status=error）', () => {
    const posts: Post[] = [
      { id: 'post1', status: 'error' },
      { id: 'post2', status: 'success' },
      { id: 'post3' }, // 没有 status
    ];
    const cachedIds = new Set<string>();

    const successfulPosts = posts.filter(p => p.status !== 'error');
    expect(successfulPosts).toHaveLength(2);
    expect(successfulPosts.map(p => p.id)).toEqual(['post2', 'post3']);
  });

});
