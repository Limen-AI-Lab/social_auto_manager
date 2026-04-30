// ============================================================
// SAMA - Report Data Cache Context
//
// Centralized cache for Daily/Weekly/Monthly report data.
// Data persists when switching views until:
//   - Manual refresh is triggered
//   - User changes filter parameters (date range, etc.)
//   - Page is refreshed/reloaded
// ============================================================

import React, { createContext, useContext, useReducer, useCallback, useRef } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface DailyReportData {
  clientName: string;
  generatedAt: string;
  posts: any[];
  overview?: {
    totalPosts: number;
    totalImpressions: number;
    totalEngagements: number;
  };
}

export interface WeeklyReportData {
  clientName: string;
  generatedAt: string;
  overview?: {
    totalPosts: number;
    totalImpressions: number;
    totalEngagements: number;
  };
}

export interface MonthlyReportData {
  clientName: string;
  generatedAt: string;
  overview?: {
    totalPosts: number;
    totalImpressions: number;
    totalEngagements: number;
  };
}

// Cache entry with metadata
interface CacheEntry<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  lastFetched: number | null; // timestamp
}

interface ReportCacheState {
  daily: CacheEntry<DailyReportData>;
  weekly: CacheEntry<WeeklyReportData>;
  monthly: CacheEntry<MonthlyReportData>;
  // Cache expiry time in ms (default 10 minutes)
  cacheExpiry: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Initial State
// ─────────────────────────────────────────────────────────────────────────────

const initialState: ReportCacheState = {
  daily: { data: null, loading: false, error: null, lastFetched: null },
  weekly: { data: null, loading: false, error: null, lastFetched: null },
  monthly: { data: null, loading: false, error: null, lastFetched: null },
  cacheExpiry: 10 * 60 * 1000, // 10 minutes
};

// ─────────────────────────────────────────────────────────────────────────────
// Actions
// ─────────────────────────────────────────────────────────────────────────────

type CacheAction =
  | { type: 'FETCH_START'; view: 'daily' | 'weekly' | 'monthly' }
  | { type: 'FETCH_SUCCESS'; view: 'daily' | 'weekly' | 'monthly'; data: any }
  | { type: 'FETCH_ERROR'; view: 'daily' | 'weekly' | 'monthly'; error: string }
  | { type: 'CLEAR_CACHE'; view?: 'daily' | 'weekly' | 'monthly' }
  | { type: 'CLEAR_ALL' };

function cacheReducer(state: ReportCacheState, action: CacheAction): ReportCacheState {
  switch (action.type) {
    case 'FETCH_START':
      return {
        ...state,
        [action.view]: {
          ...state[action.view],
          loading: true,
          error: null,
        },
      };

    case 'FETCH_SUCCESS':
      return {
        ...state,
        [action.view]: {
          data: action.data,
          loading: false,
          error: null,
          lastFetched: Date.now(),
        },
      };

    case 'FETCH_ERROR':
      return {
        ...state,
        [action.view]: {
          ...state[action.view],
          loading: false,
          error: action.error,
        },
      };

    case 'CLEAR_CACHE':
      if (action.view) {
        return {
          ...state,
          [action.view]: initialState[action.view],
        };
      }
      return initialState;

    case 'CLEAR_ALL':
      return initialState;

    default:
      return state;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────

interface ReportCacheContextValue {
  // State
  state: ReportCacheState;
  
  // Check if data is cached and not expired
  isCacheValid: (view: 'daily' | 'weekly' | 'monthly') => boolean;
  
  // Check if currently loading
  isLoading: (view: 'daily' | 'weekly' | 'monthly') => boolean;
  
  // Get cached data (may be null if not fetched yet)
  getData: <T>(view: 'daily' | 'weekly' | 'monthly') => T | null;
  
  // Fetch data with cache support
  fetchWithCache: <T>(
    view: 'daily' | 'weekly' | 'monthly',
    fetchFn: () => Promise<T>,
    forceRefresh?: boolean
  ) => Promise<T | null>;
  
  // Manual refresh for specific view
  refreshView: (view: 'daily' | 'weekly' | 'monthly') => Promise<void>;
  
  // Clear specific view cache
  clearViewCache: (view: 'daily' | 'weekly' | 'monthly') => void;
  
  // Clear all cache
  clearAllCache: () => void;
}

const ReportCacheContext = createContext<ReportCacheContextValue | null>(null);

// ─────────────────────────────────────────────────────────────────────────────
// Provider Component
// ─────────────────────────────────────────────────────────────────────────────

export function ReportCacheProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(cacheReducer, initialState);
  
  // Refs to store the latest fetch functions for each view
  const fetchFnsRef = useRef<Record<string, () => Promise<any>>>({});

  // Check if cache is valid (exists and not expired)
  const isCacheValid = useCallback((view: 'daily' | 'weekly' | 'monthly'): boolean => {
    const entry = state[view];
    if (!entry.data || !entry.lastFetched) return false;
    return Date.now() - entry.lastFetched < state.cacheExpiry;
  }, [state]);

  // Check if currently loading
  const isLoading = useCallback((view: 'daily' | 'weekly' | 'monthly'): boolean => {
    return state[view].loading;
  }, [state]);

  // Get cached data
  const getData = useCallback(<T,>(view: 'daily' | 'weekly' | 'monthly'): T | null => {
    return (state[view].data as T) ?? null;
  }, [state]);

  // Fetch with cache logic
  const fetchWithCache = useCallback(async <T,>(
    view: 'daily' | 'weekly' | 'monthly',
    fetchFn: () => Promise<T>,
    forceRefresh: boolean = false
  ): Promise<T | null> => {
    // Store the fetch function for manual refresh
    fetchFnsRef.current[view] = fetchFn;
    
    // Check cache if not forcing refresh
    if (!forceRefresh && isCacheValid(view)) {
      return state[view].data as T;
    }
    
    // Fetch new data
    dispatch({ type: 'FETCH_START', view });
    
    try {
      const data = await fetchFn();
      dispatch({ type: 'FETCH_SUCCESS', view, data });
      return data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      dispatch({ type: 'FETCH_ERROR', view, error: errorMessage });
      return null;
    }
  }, [state, isCacheValid]);

  // Manual refresh - re-fetch data for specific view
  const refreshView = useCallback(async (view: 'daily' | 'weekly' | 'monthly') => {
    const fetchFn = fetchFnsRef.current[view];
    if (fetchFn) {
      dispatch({ type: 'FETCH_START', view });
      try {
        const data = await fetchFn();
        dispatch({ type: 'FETCH_SUCCESS', view, data });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        dispatch({ type: 'FETCH_ERROR', view, error: errorMessage });
      }
    }
  }, []);

  // Clear specific view cache
  const clearViewCache = useCallback((view: 'daily' | 'weekly' | 'monthly') => {
    dispatch({ type: 'CLEAR_CACHE', view });
  }, []);

  // Clear all cache
  const clearAllCache = useCallback(() => {
    dispatch({ type: 'CLEAR_ALL' });
  }, []);

  const value: ReportCacheContextValue = {
    state,
    isCacheValid,
    isLoading,
    getData,
    fetchWithCache,
    refreshView,
    clearViewCache,
    clearAllCache,
  };

  return (
    <ReportCacheContext.Provider value={value}>
      {children}
    </ReportCacheContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useReportCache() {
  const context = useContext(ReportCacheContext);
  if (!context) {
    throw new Error('useReportCache must be used within a ReportCacheProvider');
  }
  return context;
}
