// ============================================================
// SAMA - Supabase API Service
//
// 统一的 Supabase API 调用层
// 所有 Report 模块通过此服务与 Supabase Edge Function 通信
//
// 数据流向:
//   Report Service → SupabaseApi → Supabase Edge Function → Ayrshare API → sama_post_cache
//
// 环境变量:
//   VITE_SUPABASE_URL: Supabase 项目 URL
//   VITE_SUPABASE_ANON_KEY: Supabase Anon Key
//   VITE_SUPABASE_SERVICE_KEY: Supabase Service Role Key (仅用于可信环境)
// ============================================================

import { getSupabase, isSupabaseConfigured } from '../lib/supabase';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** 报告抓取模式 */
export type ReportFetchMode = 'full' | 'incremental' | 'refresh';

/** 调用 Supabase Edge Function 的通用选项 */
export interface SupabaseApiOptions {
  profileKeys: string[];
  lastDays?: number;
  startDate?: string;
  endDate?: string;
  mode?: ReportFetchMode;
  lastFetchDate?: string;
}

/** 调用结果 */
export interface SupabaseApiResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  cached?: boolean;
  cacheStats?: {
    enabled: boolean;
    cachedSkipped: number;
    newlyFetched: number;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Supabase Edge Function 名称
// ─────────────────────────────────────────────────────────────────────────────

const EDGE_FUNCTIONS = {
  /** 获取 Ayrshare 分析数据 */
  GET_AYRSHARE_ANALYTICS: 'get-ayrshare-analytics',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// 私有工具函数
// ─────────────────────────────────────────────────────────────────────────────

function getReportSecret(): string | null {
  try {
    return localStorage.getItem('sama_report_secret');
  } catch {
    return null;
  }
}

export function setReportSecret(secret: string): void {
  try {
    localStorage.setItem('sama_report_secret', secret);
  } catch {}
}

export function clearReportSecret(): void {
  try {
    localStorage.removeItem('sama_report_secret');
  } catch {}
}

// ─────────────────────────────────────────────────────────────────────────────
// 核心 API 函数
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 调用 Supabase Edge Function 的统一方法
 */
async function invokeEdgeFunction<T = unknown>(
  functionName: string,
  body: Record<string, unknown>,
  options: {
    useServiceKey?: boolean;
    reportSecret?: string;
  } = {}
): Promise<SupabaseApiResult<T>> {
  const supabase = getSupabase();

  if (!supabase) {
    return {
      success: false,
      error: 'Supabase 未配置。请在 Settings 中配置 Supabase 连接。',
    };
  }

  try {
    // 构建 Authorization header
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // 优先使用传入的 secret，否则尝试从 localStorage 获取
    const secret = options.reportSecret || getReportSecret();
    if (secret) {
      headers['Authorization'] = `Bearer ${secret}`;
    }

    const { data, error } = await supabase.functions.invoke(functionName, {
      headers,
      body,
    });

    if (error) {
      console.error(`[SupabaseApi] Edge Function "${functionName}" error:`, error);

      // 提供更有用的错误提示
      let errorMessage = error.message || 'Unknown error';

      if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
        errorMessage = '鉴权失败。请检查 REPORT_SECRET 是否正确配置。';
      } else if (errorMessage.includes('404') || errorMessage.includes('not found')) {
        errorMessage = `Edge Function "${functionName}" 未部署。请运行: supabase functions deploy ${functionName}`;
      } else if (errorMessage.includes('fetch') || errorMessage.includes('network')) {
        errorMessage = '无法连接到 Supabase。请检查网络连接。';
      }

      return {
        success: false,
        error: errorMessage,
      };
    }

    return {
      success: true,
      data: data as T,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[SupabaseApi] Unexpected error calling "${functionName}":`, err);

    return {
      success: false,
      error: message,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 公开 API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 检查 Supabase 是否已配置
 */
export function isApiConfigured(): boolean {
  return isSupabaseConfigured();
}

/**
 * 检查 REPORT_SECRET 是否已配置
 */
export function hasReportSecret(): boolean {
  return Boolean(getReportSecret());
}

/**
 * 获取 Ayrshare 分析数据
 *
 * @param options 抓取选项
 * @param reportSecret 可选的 REPORT_SECRET（会优先使用此值）
 * @returns 抓取结果
 */
export async function fetchAnalyticsViaSupabase(
  options: SupabaseApiOptions,
  reportSecret?: string
): Promise<SupabaseApiResult> {
  const body: Record<string, unknown> = {
    profileKeys: options.profileKeys,
    lastDays: options.lastDays ?? 7,
    mode: options.mode ?? 'full',
  };

  if (options.startDate) {
    body.startDate = options.startDate;
  }

  if (options.endDate) {
    body.endDate = options.endDate;
  }

  if (options.lastFetchDate) {
    body.lastFetchDate = options.lastFetchDate;
  }

  return invokeEdgeFunction(EDGE_FUNCTIONS.GET_AYRSHARE_ANALYTICS, body, {
    reportSecret,
  });
}

/**
 * 增量获取 Ayrshare 分析数据（仅获取新帖子）
 *
 * @param options 抓取选项
 * @param lastFetchDate 上次抓取时间（ISO 8601）
 * @param reportSecret 可选的 REPORT_SECRET
 * @returns 抓取结果
 */
export async function fetchAnalyticsIncremental(
  options: Omit<SupabaseApiOptions, 'mode' | 'lastFetchDate'>,
  lastFetchDate: string,
  reportSecret?: string
): Promise<SupabaseApiResult> {
  return fetchAnalyticsViaSupabase(
    {
      ...options,
      mode: 'incremental',
      lastFetchDate,
    },
    reportSecret
  );
}

/**
 * 刷新获取 Ayrshare 分析数据（跳过缓存）
 *
 * @param options 抓取选项
 * @param reportSecret 可选的 REPORT_SECRET
 * @returns 抓取结果
 */
export async function fetchAnalyticsRefresh(
  options: Omit<SupabaseApiOptions, 'mode'>,
  reportSecret?: string
): Promise<SupabaseApiResult> {
  return fetchAnalyticsViaSupabase(
    {
      ...options,
      mode: 'refresh',
    },
    reportSecret
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 诊断工具
// ─────────────────────────────────────────────────────────────────────────────

export interface DiagnosticsResult {
  supabaseConfigured: boolean;
  reportSecretConfigured: boolean;
  edgeFunctionDeployed: boolean;
  edgeFunctionStatus: string;
  lastError?: string;
}

/**
 * 诊断 Supabase 连接状态
 */
export async function diagnoseConnection(): Promise<DiagnosticsResult> {
  const result: DiagnosticsResult = {
    supabaseConfigured: isSupabaseConfigured(),
    reportSecretConfigured: hasReportSecret(),
    edgeFunctionDeployed: false,
    edgeFunctionStatus: 'unknown',
  };

  if (!result.supabaseConfigured) {
    result.lastError = 'Supabase 未配置';
    return result;
  }

  // 尝试调用 Edge Function 进行诊断
  const testResult = await invokeEdgeFunction(EDGE_FUNCTIONS.GET_AYRSHARE_ANALYTICS, {
    profileKeys: [],
  });

  if (testResult.success) {
    result.edgeFunctionDeployed = true;
    result.edgeFunctionStatus = 'active';
  } else {
    result.edgeFunctionDeployed = false;
    result.edgeFunctionStatus = testResult.error || 'unknown error';
    result.lastError = testResult.error;
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// 向后兼容：直接调用 Ayrshare API 的回退
// ─────────────────────────────────────────────────────────────────────────────

export { getStoredApiKey, setStoredApiKey } from './ayrshareAnalytics';

/**
 * 混合模式：优先使用 Supabase，失败时回退到直接调用
 *
 * @param options 抓取选项
 * @param reportSecret 可选的 REPORT_SECRET
 * @param fallbackFn 直接调用的回退函数
 * @returns 抓取结果
 */
export async function fetchWithSupabaseFallback<T>(
  options: SupabaseApiOptions,
  reportSecret: string | undefined,
  fallbackFn: () => Promise<T>
): Promise<{ source: 'supabase' | 'direct'; data: T; error?: string }> {
  // 优先尝试 Supabase
  if (isSupabaseConfigured()) {
    const result = await fetchAnalyticsViaSupabase(options, reportSecret);

    if (result.success && result.data) {
      return {
        source: 'supabase',
        data: result.data as T,
      };
    }

    console.warn(`[SupabaseApi] Supabase 调用失败，尝试回退到直接调用:`, result.error);
  }

  // 回退到直接调用
  try {
    const data = await fallbackFn();
    return {
      source: 'direct',
      data,
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error';
    return {
      source: 'direct',
      data: null as unknown as T,
      error,
    };
  }
}
