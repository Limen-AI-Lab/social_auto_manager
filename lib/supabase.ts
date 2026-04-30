// ============================================================
// SAMA - Supabase Client
// ============================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_KEY || '';

let supabaseInstance: SupabaseClient | null = null;
let supabaseAdminInstance: SupabaseClient | null = null;

/**
 * 获取 Supabase 客户端实例
 * 使用 Anon Key，适用于客户端
 */
export function getSupabase(): SupabaseClient | null {
  if (!supabaseInstance && supabaseUrl && supabaseAnonKey) {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false, // 前端不持久化 session
      },
    });
  }
  return supabaseInstance;
}

/**
 * 获取 Supabase Admin 客户端实例
 * 使用 Service Role Key，适用于需要更高权限的操作
 * 注意：Service Role Key 不应在客户端暴露，只用于可信环境
 */
export function getSupabaseAdmin(): SupabaseClient | null {
  if (!supabaseAdminInstance && supabaseUrl && supabaseServiceKey) {
    supabaseAdminInstance = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
      },
    });
  }
  return supabaseAdminInstance;
}

/**
 * 检查 Supabase 是否已配置
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

/**
 * 检查 Supabase Service Key 是否已配置
 */
export function isSupabaseAdminConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseServiceKey);
}

/**
 * 获取 Supabase 配置信息（用于调试）
 */
export function getSupabaseConfig(): {
  url: string;
  hasAnonKey: boolean;
  hasServiceKey: boolean;
} {
  return {
    url: supabaseUrl,
    hasAnonKey: Boolean(supabaseAnonKey),
    hasServiceKey: Boolean(supabaseServiceKey),
  };
}