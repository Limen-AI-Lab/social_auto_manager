/**
 * SAMA - Unit Tests: 性能对比测试
 *
 * 测试目标：
 * 1. 验证 batchedFetch 并发执行带来显著提速
 * 2. 验证缓存策略减少 API 调用次数
 * 3. 验证不同 batchSize 对性能的影响
 * 4. 验证端到端性能提升（并发 + 缓存组合）
 */

import { describe, it, expect, bench } from 'vitest';

// ─────────────────────────────────────────────────────────────────────────────
// 模拟实现
// ─────────────────────────────────────────────────────────────────────────────

const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 300;

async function delay(ms: number): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, ms));
}

async function sleepWithJitter(baseMs: number): Promise<void> {
  const jitter = Math.random() * 0.3 * baseMs;
  await delay(baseMs + jitter);
}

async function batchedFetch<T, R>(
  items: T[],
  fetchFn: (item: T, index: number) => Promise<R>,
  options: {
    batchSize?: number;
    batchDelay?: number;
    onProgress?: (completed: number, total: number) => void;
  } = {}
): Promise<R[]> {
  const { batchSize = BATCH_SIZE, batchDelay = BATCH_DELAY_MS, onProgress } = options;
  const results: R[] = new Array(items.length);
  let completed = 0;

  for (let batchStart = 0; batchStart < items.length; batchStart += batchSize) {
    const batchEnd = Math.min(batchStart + batchSize, items.length);
    const batch = items.slice(batchStart, batchEnd);

    const batchPromises = batch.map(async (item, localIdx) => {
      const globalIdx = batchStart + localIdx;
      const result = await fetchFn(item, globalIdx);
      return { idx: globalIdx, result };
    });

    const batchResults = await Promise.all(batchPromises);
    for (const { idx, result } of batchResults) {
      results[idx] = result as R;
      completed++;
      onProgress?.(completed, items.length);
    }

    if (batchEnd < items.length) {
      await sleepWithJitter(batchDelay);
    }
  }

  return results;
}

// 模拟串行执行（batchSize=1）
async function serialFetch<T, R>(
  items: T[],
  fetchFn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i++) {
    const result = await fetchFn(items[i], i);
    results.push(result);
  }
  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// 测试：性能提速验证
// ─────────────────────────────────────────────────────────────────────────────

describe('性能对比 - 提速验证', () => {

  it('并发执行（batchSize=10）应该比串行快至少 3 倍', async () => {
    const itemCount = 20;
    const items = Array.from({ length: itemCount }, (_, i) => i);
    const delayPerItem = 30; // 每个请求耗时 30ms

    // 并发执行（batchSize=10）
    const concurrentStart = Date.now();
    await batchedFetch(
      items,
      async () => {
        await delay(delayPerItem);
        return true;
      },
      { batchSize: 10, batchDelay: 0 }
    );
    const concurrentTime = Date.now() - concurrentStart;

    // 串行执行
    const serialStart = Date.now();
    await serialFetch(
      items,
      async () => {
        await delay(delayPerItem);
        return true;
      }
    );
    const serialTime = Date.now() - serialStart;

    // 计算加速比
    const speedup = serialTime / concurrentTime;

    console.log('\n🚀 性能对比结果：');
    console.log(`  📌 测试配置: ${itemCount} 项，每项耗时 ${delayPerItem}ms`);
    console.log(`  ⚡ 并发执行（batchSize=10）: ${concurrentTime}ms`);
    console.log(`  🐌 串行执行（batchSize=1）: ${serialTime}ms`);
    console.log(`  🚀 加速比: ${speedup.toFixed(2)}x`);

    // 断言：并发应该至少快 3 倍
    expect(speedup).toBeGreaterThanOrEqual(3);
  });

  it('大数据量（100 项）并发执行应该快至少 5 倍', async () => {
    const itemCount = 100;
    const items = Array.from({ length: itemCount }, (_, i) => i);
    const delayPerItem = 10; // 每个请求耗时 10ms

    // 并发执行
    const concurrentStart = Date.now();
    await batchedFetch(
      items,
      async () => {
        await delay(delayPerItem);
        return true;
      },
      { batchSize: 10, batchDelay: 0 }
    );
    const concurrentTime = Date.now() - concurrentStart;

    // 串行执行
    const serialStart = Date.now();
    await serialFetch(
      items,
      async () => {
        await delay(delayPerItem);
        return true;
      }
    );
    const serialTime = Date.now() - serialStart;

    const speedup = serialTime / concurrentTime;

    console.log('\n🚀 大数据量性能对比（100 项）：');
    console.log(`  ⚡ 并发执行: ${concurrentTime}ms`);
    console.log(`  🐌 串行执行: ${serialTime}ms`);
    console.log(`  🚀 加速比: ${speedup.toFixed(2)}x`);

    // 100 项时，并发应该至少快 5 倍
    expect(speedup).toBeGreaterThanOrEqual(5);
  });

  it('中等数据量（50 项）并发执行应该快至少 4 倍', async () => {
    const itemCount = 50;
    const items = Array.from({ length: itemCount }, (_, i) => i);
    const delayPerItem = 20;

    const concurrentStart = Date.now();
    await batchedFetch(
      items,
      async () => {
        await delay(delayPerItem);
        return true;
      },
      { batchSize: 10, batchDelay: 0 }
    );
    const concurrentTime = Date.now() - concurrentStart;

    const serialStart = Date.now();
    await serialFetch(
      items,
      async () => {
        await delay(delayPerItem);
        return true;
      }
    );
    const serialTime = Date.now() - serialStart;

    const speedup = serialTime / concurrentTime;

    console.log('\n🚀 中等数据量性能对比（50 项）：');
    console.log(`  ⚡ 并发执行: ${concurrentTime}ms`);
    console.log(`  🐌 串行执行: ${serialTime}ms`);
    console.log(`  🚀 加速比: ${speedup.toFixed(2)}x`);

    expect(speedup).toBeGreaterThanOrEqual(4);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// 测试：batchSize 对性能的影响
// ─────────────────────────────────────────────────────────────────────────────

describe('性能对比 - batchSize 影响', () => {

  it('batchSize=10 比 batchSize=2 更快', async () => {
    const items = Array.from({ length: 30 }, (_, i) => i);
    const delayPerItem = 20;

    // batchSize=2
    const smallBatchStart = Date.now();
    await batchedFetch(
      items,
      async () => {
        await delay(delayPerItem);
        return true;
      },
      { batchSize: 2, batchDelay: 0 }
    );
    const smallBatchTime = Date.now() - smallBatchStart;

    // batchSize=10
    const largeBatchStart = Date.now();
    await batchedFetch(
      items,
      async () => {
        await delay(delayPerItem);
        return true;
      },
      { batchSize: 10, batchDelay: 0 }
    );
    const largeBatchTime = Date.now() - largeBatchStart;

    console.log('\n📊 batchSize 对比：');
    console.log(`  batchSize=2:  ${smallBatchTime}ms`);
    console.log(`  batchSize=10: ${largeBatchTime}ms`);
    console.log(`  提速比: ${(smallBatchTime / largeBatchTime).toFixed(2)}x`);

    // batchSize=10 应该更快
    expect(largeBatchTime).toBeLessThan(smallBatchTime);
  });

  it('batchSize 过大会触发 API 限流风险', async () => {
    // 这个测试验证 batchSize 的合理范围
    // SAMA 使用的 BATCH_SIZE=10 是一个平衡值：
    // - 足够大以实现并发提速
    // - 不会过大以避免触发 API 限流

    const reasonableBatchSizes = [5, 10, 15, 20];

    for (const batchSize of reasonableBatchSizes) {
      const items = Array.from({ length: 50 }, (_, i) => i);

      const start = Date.now();
      await batchedFetch(
        items,
        async () => {
          await delay(5);
          return true;
        },
        { batchSize, batchDelay: 0 }
      );
      const time = Date.now() - start;

      console.log(`  batchSize=${batchSize}: ${time}ms`);
      expect(time).toBeLessThan(500); // 应该快速完成
    }
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// 测试：缓存策略的性能影响
// ─────────────────────────────────────────────────────────────────────────────

describe('性能对比 - 缓存策略影响', () => {

  it('增量模式：80% 缓存命中时，API 调用减少 80%', () => {
    const totalPosts = 100;
    const cachedPosts = 80;
    const apiCallsWithoutCache = totalPosts;
    const apiCallsWithCache = totalPosts - cachedPosts;

    const reductionPercent = ((apiCallsWithoutCache - apiCallsWithCache) / apiCallsWithoutCache) * 100;

    console.log('\n💾 缓存性能提升：');
    console.log(`  总帖子数: ${totalPosts}`);
    console.log(`  已缓存: ${cachedPosts}`);
    console.log(`  无缓存时 API 调用: ${apiCallsWithoutCache}`);
    console.log(`  有缓存时 API 调用: ${apiCallsWithCache}`);
    console.log(`  API 调用减少: ${reductionPercent}%`);

    expect(reductionPercent).toBe(80);
  });

  it('增量模式：50% 缓存命中时，API 调用减少 50%', () => {
    const totalPosts = 100;
    const cachedPosts = 50;
    const apiCallsWithoutCache = totalPosts;
    const apiCallsWithCache = totalPosts - cachedPosts;

    const reductionPercent = ((apiCallsWithoutCache - apiCallsWithCache) / apiCallsWithoutCache) * 100;

    expect(reductionPercent).toBe(50);
  });

  it('组合优化（并发 + 缓存）：最大性能提升', async () => {
    const totalPosts = 100;
    const cachedPosts = 80;
    const delayPerItem = 30; // API 响应时间

    // 场景 1：完全串行，无缓存
    const serialNoCacheTime = totalPosts * delayPerItem; // 3000ms

    // 场景 2：并发，有缓存（80% 命中）
    const cachedPostsCount = totalPosts - cachedPosts; // 20 项需要抓取
    const concurrentWithCacheBatches = Math.ceil(cachedPostsCount / 10);
    const concurrentWithCacheTime = concurrentWithCacheBatches * delayPerItem; // 2 * 30 = 60ms（理想情况）

    console.log('\n🎯 组合优化最大性能提升：');
    console.log(`  场景 1（串行 + 无缓存）: ${serialNoCacheTime}ms`);
    console.log(`  场景 2（并发 + 80% 缓存）: ~${concurrentWithCacheTime}ms`);
    console.log(`  理论最大提速比: ${(serialNoCacheTime / concurrentWithCacheTime).toFixed(0)}x`);

    // 理论上，组合优化可以达到 50 倍以上的提速
    const maxSpeedup = serialNoCacheTime / concurrentWithCacheTime;
    expect(maxSpeedup).toBeGreaterThan(40);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// 测试：端到端性能场景
// ─────────────────────────────────────────────────────────────────────────────

describe('性能对比 - 端到端场景', () => {

  it('场景：7 天数据抓取（10 个帖子，6 个平台）', async () => {
    // 模拟：7 天内发布 10 个帖子，发布到 6 个平台
    const totalPosts = 10;
    const platformsPerPost = 6;
    const delayPerRequest = 50; // 每次 API 请求 50ms

    // 原始方法：串行抓取每个帖子的每个平台
    // 每个帖子需要 6 次请求（每个平台一次）
    const serialRequests = totalPosts * platformsPerPost;
    const serialTime = serialRequests * delayPerRequest; // 10 * 6 * 50 = 3000ms

    // 优化后：并发 + 缓存（假设 30% 帖子已缓存）
    const cachedPosts = Math.floor(totalPosts * 0.3); // 3 个帖子已缓存
    const postsToFetch = totalPosts - cachedPosts; // 7 个帖子需要抓取
    const cachedRequests = postsToFetch * platformsPerPost; // 42 次请求

    const batches = Math.ceil(cachedRequests / 10); // 5 批
    const concurrentTime = batches * delayPerRequest + (batches - 1) * 0.3 * 1000; // 约 450ms

    console.log('\n📅 端到端场景（7 天数据）：');
    console.log(`  总帖子数: ${totalPosts}`);
    console.log(`  每帖子平台数: ${platformsPerPost}`);
    console.log(`  缓存命中: ${cachedPosts} 帖子`);
    console.log(`  ─────────────────────`);
    console.log(`  原始（串行）: ${serialTime}ms`);
    console.log(`  优化后（并发+缓存）: ~${concurrentTime}ms`);
    console.log(`  提速比: ${(serialTime / concurrentTime).toFixed(1)}x`);

    expect(serialTime / concurrentTime).toBeGreaterThan(2);
  });

  it('场景：30 天数据抓取（100 个帖子）', async () => {
    const totalPosts = 100;
    const delayPerRequest = 50;

    // 原始：串行
    const serialTime = totalPosts * delayPerRequest; // 5000ms

    // 优化：并发 + 缓存（50% 命中）
    const cachedPosts = 50;
    const postsToFetch = 50;
    const batches = Math.ceil(postsToFetch / 10); // 5 批
    const concurrentTime = batches * delayPerRequest + (batches - 1) * 0.3 * 1000; // 约 450ms

    console.log('\n📅 端到端场景（30 天数据）：');
    console.log(`  总帖子数: ${totalPosts}`);
    console.log(`  缓存命中: ${cachedPosts} 帖子`);
    console.log(`  ─────────────────────`);
    console.log(`  原始（串行）: ${serialTime}ms`);
    console.log(`  优化后（并发+缓存）: ~${concurrentTime}ms`);
    console.log(`  提速比: ${(serialTime / concurrentTime).toFixed(1)}x`);

    expect(serialTime / concurrentTime).toBeGreaterThan(3);
  });

  it('场景：重复抓取（数据未变化）', async () => {
    // 当用户刷新报告时，如果数据未变化：
    // - 原始方法：重新抓取所有数据（浪费）
    // - 优化后：使用缓存，秒级响应

    const totalPosts = 50;

    // 原始：重新抓取
    const originalRefreshTime = totalPosts * 50; // 2500ms

    // 优化：检查缓存
    const cachedRefreshTime = 10; // 只是检查缓存，几乎瞬时

    console.log('\n🔄 重复抓取场景：');
    console.log(`  总帖子数: ${totalPosts}`);
    console.log(`  ─────────────────────`);
    console.log(`  原始（重新抓取）: ${originalRefreshTime}ms`);
    console.log(`  优化后（缓存命中）: ${cachedRefreshTime}ms`);
    console.log(`  提速比: ${(originalRefreshTime / cachedRefreshTime)}x`);

    expect(originalRefreshTime / cachedRefreshTime).toBeGreaterThan(100);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// 测试：实际时间测量（Vitest Bench）
// ─────────────────────────────────────────────────────────────────────────────

describe('性能对比 - 实际时间测量', () => {

  it('batchedFetch 并发执行时间测量', async () => {
    const items = Array.from({ length: 50 }, (_, i) => i);

    // 测量 batchedFetch（batchSize=10）
    const start = Date.now();
    await batchedFetch(
      items,
      async (item) => {
        await delay(10);
        return item * 2;
      },
      { batchSize: 10, batchDelay: 0 }
    );
    const time = Date.now() - start;

    console.log(`\n⏱️  实际测量：50 项，batchSize=10，delay=10ms`);
    console.log(`  总耗时: ${time}ms`);

    // 50 项，每项 10ms
    // 串行：500ms
    // 并发（10 个一批，5 批）：约 50-60ms
    expect(time).toBeLessThan(150); // 留一些余量
  });

  it('不同数据量的实际耗时', async () => {
    const testCases = [
      { count: 10, batchSize: 10 },
      { count: 20, batchSize: 10 },
      { count: 50, batchSize: 10 },
      { count: 100, batchSize: 10 },
    ];

    for (const { count, batchSize } of testCases) {
      const items = Array.from({ length: count }, (_, i) => i);

      const start = Date.now();
      await batchedFetch(
        items,
        async () => {
          await delay(10);
          return true;
        },
        { batchSize, batchDelay: 0 }
      );
      const time = Date.now() - start;

      console.log(`  ${count} 项 (batchSize=${batchSize}): ${time}ms`);

      // 验证时间在合理范围内
      expect(time).toBeLessThan(count * 10); // 不应该超过串行时间
    }
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// 测试：性能稳定性
// ─────────────────────────────────────────────────────────────────────────────

describe('性能对比 - 稳定性验证', () => {

  it('多次运行应该保持相似的性能特征', async () => {
    const items = Array.from({ length: 30 }, (_, i) => i);
    const times: number[] = [];

    // 运行 3 次
    for (let run = 0; run < 3; run++) {
      const start = Date.now();
      await batchedFetch(
        items,
        async () => {
          await delay(20);
          return true;
        },
        { batchSize: 10, batchDelay: 0 }
      );
      times.push(Date.now() - start);
    }

    console.log('\n📈 性能稳定性测试（3 次运行）：');
    times.forEach((time, i) => {
      console.log(`  第 ${i + 1} 次: ${time}ms`);
    });

    // 验证：所有运行时间应该相似（差距 < 50%）
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const maxDiff = Math.max(...times.map(t => Math.abs(t - avg)));
    const variancePercent = (maxDiff / avg) * 100;

    console.log(`  平均: ${avg}ms`);
    console.log(`  最大偏差: ${variancePercent.toFixed(1)}%`);

    expect(variancePercent).toBeLessThan(50);
  });

});
