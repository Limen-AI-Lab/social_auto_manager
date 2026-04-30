-- ============================================================
-- SAMA - Post Cache Table Migration
--
-- 用于增量抓取策略：缓存已抓取的帖子 ID，
-- 避免重复调用 Ayrshare API，显著提升增量抓取效率。
--
-- 执行方式：
--   supabase db push
--   或在 Supabase Dashboard > SQL Editor 中直接执行
-- ============================================================

-- 帖子缓存表：存储已抓取的帖子元数据
CREATE TABLE IF NOT EXISTS sama_post_cache (
  post_id     TEXT        NOT NULL,
  profile_key TEXT        NOT NULL,
  created     TEXT,                  -- 帖子创建时间（ISO 8601）
  fetched_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),  -- 最后抓取时间
  PRIMARY KEY (post_id, profile_key)
);

-- 增量抓取索引：按 profile_key + fetched_at 快速查找
CREATE INDEX IF NOT EXISTS idx_sama_post_cache_profile_fetched
  ON sama_post_cache (profile_key, fetched_at DESC);

-- 自动清理：删除 90 天以上的缓存条目
CREATE OR REPLACE FUNCTION sama_cleanup_old_cache()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM sama_post_cache
  WHERE fetched_at < NOW() - INTERVAL '90 days';
END;
$$;

-- 定时清理（可选，每天凌晨 3 点执行）
-- 取消注释以启用自动清理：
-- SELECT cron.schedule('sama-cleanup-cache', '0 3 * * *', 'SELECT sama_cleanup_old_cache()');
