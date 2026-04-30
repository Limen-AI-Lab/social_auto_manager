// ============================================================
// SAMA - Analytics Report
// Simplified: Daily/Weekly/Monthly 3x2 Platform Cards
//
// Features:
//   - Cached data: switching views preserves previously loaded data
//   - Manual refresh buttons per view
//   - Cache expires after 10 minutes
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import {
  BarChart3,
  Calendar,
  FileBarChart,
  RefreshCw,
  Loader2,
  CheckCircle,
} from 'lucide-react';
import DailyAnalysis from './DailyAnalysis';
import WeeklyReport from './WeeklyReport';
import MonthlyReport from './MonthlyReport';
import { ReportCacheProvider, useReportCache } from '../context/ReportCacheContext';
import { getReportProfileKeys } from '../services/reportProfileKeys';
import {
  fetchWeeklyReport,
  type WeeklyReportData,
} from '../services/weeklyReportService';
import {
  fetchMonthlyReport,
  type MonthlyReportData,
} from '../services/monthlyReportService';

type ReportView = 'daily' | 'weekly' | 'monthly';

// ─────────────────────────────────────────────────────────────────────────────
// Refresh Button Component
// ─────────────────────────────────────────────────────────────────────────────

function RefreshButton({
  view,
  lastFetched,
  onRefresh,
  loading,
}: {
  view: ReportView;
  lastFetched: number | null;
  onRefresh: () => void;
  loading: boolean;
}) {
  const formatTime = (ts: number | null) => {
    if (!ts) return 'Not fetched';
    const date = new Date(ts);
    return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <button
      onClick={onRefresh}
      disabled={loading}
      className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      title={`Last updated: ${formatTime(lastFetched)}`}
    >
      <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
      <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
      {lastFetched && !loading && (
        <span className="text-slate-400 text-[10px]">
          ({formatTime(lastFetched)})
        </span>
      )}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Cache Status Badge
// ─────────────────────────────────────────────────────────────────────────────

function CacheStatusBadge({
  lastFetched,
  loading,
  hasData,
}: {
  lastFetched: number | null;
  loading: boolean;
  hasData: boolean;
}) {
  if (loading) {
    return (
      <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-xs">
        <Loader2 className="w-3 h-3 animate-spin" />
        Loading
      </span>
    );
  }

  if (hasData && lastFetched) {
    const minutesAgo = Math.round((Date.now() - lastFetched) / 60000);
    return (
      <span className="flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-600 rounded text-xs">
        <CheckCircle className="w-3 h-3" />
        {minutesAgo === 0 ? 'Just now' : `${minutesAgo}m ago`}
      </span>
    );
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Weekly Report with Cache
// ─────────────────────────────────────────────────────────────────────────────

function WeeklyReportWithCache({ profileKeys }: { profileKeys: string[] }) {
  const { state, fetchWithCache } = useReportCache();
  
  const fetchWeekly = useCallback(
    () => fetchWeeklyReport({ profileKeys }),
    [profileKeys]
  );

  const weeklyData = state.weekly.data as WeeklyReportData | null;
  const loading = state.weekly.loading;
  const hasData = !!weeklyData;

  // Auto-fetch on mount if no data
  useEffect(() => {
    if (!hasData && !loading && !state.weekly.error) {
      fetchWithCache('weekly', fetchWeekly);
    }
  }, []);

  // Listen for refresh events from parent
  useEffect(() => {
    const handleRefresh = () => {
      fetchWithCache('weekly', fetchWeekly, true);
    };
    window.addEventListener('sama-refresh-weekly', handleRefresh);
    return () => window.removeEventListener('sama-refresh-weekly', handleRefresh);
  }, [fetchWithCache, fetchWeekly]);

  if (loading && !weeklyData) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          <p style={{ color: '#94a3b8', fontSize: 14 }}>Generating weekly report...</p>
        </div>
      </div>
    );
  }

  if (state.weekly.error && !weeklyData) {
    return (
      <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: 16, color: '#dc2626' }}>
        Error: {state.weekly.error}
      </div>
    );
  }

  return (
    <WeeklyReport
      data={weeklyData}
      isLoading={loading}
      clientName={weeklyData?.clientName}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Monthly Report with Cache
// ─────────────────────────────────────────────────────────────────────────────

function MonthlyReportWithCache({ profileKeys }: { profileKeys: string[] }) {
  const { state, fetchWithCache } = useReportCache();
  
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  
  const fetchMonthly = useCallback(
    () => fetchMonthlyReport({ profileKeys, year: currentYear, month: currentMonth }),
    [profileKeys, currentYear, currentMonth]
  );

  const monthlyData = state.monthly.data as MonthlyReportData | null;
  const loading = state.monthly.loading;
  const hasData = !!monthlyData;

  // Auto-fetch on mount if no data
  useEffect(() => {
    if (!hasData && !loading && !state.monthly.error) {
      fetchWithCache('monthly', fetchMonthly);
    }
  }, []);

  // Listen for refresh events from parent
  useEffect(() => {
    const handleRefresh = () => {
      fetchWithCache('monthly', fetchMonthly, true);
    };
    window.addEventListener('sama-refresh-monthly', handleRefresh);
    return () => window.removeEventListener('sama-refresh-monthly', handleRefresh);
  }, [fetchWithCache, fetchMonthly]);

  if (loading && !monthlyData) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          <p style={{ color: '#94a3b8', fontSize: 14 }}>Generating monthly report...</p>
        </div>
      </div>
    );
  }

  if (state.monthly.error && !monthlyData) {
    return (
      <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: 16, color: '#dc2626' }}>
        Error: {state.monthly.error}
      </div>
    );
  }

  return (
    <MonthlyReport
      data={monthlyData}
      isLoading={loading}
      year={currentYear}
      month={currentMonth}
      clientName={monthlyData?.clientName}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Inner Component (uses cache context)
// ─────────────────────────────────────────────────────────────────────────────

function AnalyticsReportInner() {
  const [view, setView] = useState<ReportView>('daily');
  const profileKeys = getReportProfileKeys();
  
  const {
    state,
    refreshView,
  } = useReportCache();

  // Handle view switch
  const handleViewChange = (newView: ReportView) => {
    setView(newView);
  };

  // Handle refresh for current view
  const handleRefresh = async () => {
    if (view === 'daily') {
      // DailyAnalysis has its own refresh mechanism
      // Trigger a custom event that DailyAnalysis can listen to
      window.dispatchEvent(new CustomEvent('sama-refresh-daily'));
    } else if (view === 'weekly') {
      window.dispatchEvent(new CustomEvent('sama-refresh-weekly'));
    } else if (view === 'monthly') {
      window.dispatchEvent(new CustomEvent('sama-refresh-monthly'));
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Page header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <BarChart3 className="w-7 h-7 text-blue-600" />
                Social Media Report
              </h1>
              <p className="text-slate-500 mt-1 text-sm">
                Daily · Weekly · Monthly analytics across all platforms
              </p>
            </div>

            {/* View toggle - only Daily/Weekly/Monthly */}
            <div className="flex items-center bg-white border border-slate-200 rounded-lg p-1">
              <button
                onClick={() => handleViewChange('daily')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  view === 'daily'
                    ? 'bg-blue-50 text-blue-600 border border-blue-200'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Calendar className="w-4 h-4" />
                Daily
              </button>
              <button
                onClick={() => handleViewChange('weekly')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  view === 'weekly'
                    ? 'bg-blue-50 text-blue-600 border border-blue-200'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <FileBarChart className="w-4 h-4" />
                Weekly
              </button>
              <button
                onClick={() => handleViewChange('monthly')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  view === 'monthly'
                    ? 'bg-blue-50 text-blue-600 border border-blue-200'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <FileBarChart className="w-4 h-4" />
                Monthly
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Timezone notice */}
      <div className="max-w-6xl mx-auto px-6 py-3">
        <div className="px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700 flex items-center gap-2">
          <Calendar className="w-4 h-4 shrink-0" />
          South Africa Standard Time (UTC+2)
        </div>
      </div>

      {/* Cache status bar */}
      <div className="max-w-6xl mx-auto px-6 py-2">
        <div className="flex items-center justify-between text-xs text-slate-500 bg-slate-100 rounded-lg px-4 py-2">
          <div className="flex items-center gap-4">
            <span className="font-medium">Cached views:</span>
            <div className="flex items-center gap-2">
              <CacheStatusBadge
                lastFetched={state.daily.lastFetched}
                loading={state.daily.loading}
                hasData={!!state.daily.data}
              />
              <span className="text-slate-400">|</span>
              <CacheStatusBadge
                lastFetched={state.weekly.lastFetched}
                loading={state.weekly.loading}
                hasData={!!state.weekly.data}
              />
              <span className="text-slate-400">|</span>
              <CacheStatusBadge
                lastFetched={state.monthly.lastFetched}
                loading={state.monthly.loading}
                hasData={!!state.monthly.data}
              />
            </div>
          </div>
          <RefreshButton
            view={view}
            lastFetched={state[view].lastFetched}
            onRefresh={handleRefresh}
            loading={state[view].loading}
          />
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-6xl mx-auto px-6 pb-8">
        {view === 'daily' && (
          <DailyAnalysis profileKeys={profileKeys} />
        )}
        
        {view === 'weekly' && (
          <WeeklyReportWithCache profileKeys={profileKeys} />
        )}
        
        {view === 'monthly' && (
          <MonthlyReportWithCache profileKeys={profileKeys} />
        )}
      </div>

      {/* Footer */}
      <footer className="text-center text-xs text-slate-400 py-6 mt-8 border-t border-slate-200">
        Data from AyrShare API · South Africa Standard Time (UTC+2) · {new Date().toLocaleDateString('en-GB')}
      </footer>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Export (with Provider)
// ─────────────────────────────────────────────────────────────────────────────

export default function AnalyticsReport() {
  return (
    <ReportCacheProvider>
      <AnalyticsReportInner />
    </ReportCacheProvider>
  );
}
