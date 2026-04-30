// ============================================================
// SAMA - Daily Data View
// Pure data view: posts grouped by date, no AI, no ER
// ============================================================

import React, { useState } from 'react';
import { Calendar, ChevronDown, ChevronRight, Eye, ThumbsUp, MessageCircle, Share2, Link2 } from 'lucide-react';
import type { ContentTopic } from '../services/postAnalyticsData';

const PLATFORMS = [
  { key: 'linkedin', label: 'LinkedIn', color: '#0077B5' },
  { key: 'instagram', label: 'Instagram', color: '#E4405F' },
  { key: 'youtube', label: 'YouTube', color: '#FF0000' },
  { key: 'twitter', label: 'X', color: '#000000' },
  { key: 'tiktok', label: 'TikTok', color: '#000000' },
  { key: 'facebook', label: 'Facebook', color: '#1877F2' },
] as const;

function formatMetric(n: number, hasAnalytics: boolean): string {
  // When hasAnalytics=false, show "—" (no analytics available from API)
  if (!hasAnalytics) return '—';
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toString();
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

interface TopicCardProps {
  topic: ContentTopic;
  defaultExpanded?: boolean;
}

function TopicCard({ topic, defaultExpanded = false }: TopicCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  // Sum engagement only from platforms that have analytics
  const totalEngagement = topic.platforms
    .filter(p => p.hasAnalytics)
    .reduce((s, p) => s + p.likes + p.comments + p.shares, 0);

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-md transition-shadow">
      {/* Header - always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-start gap-3 p-4 text-left hover:bg-slate-50 transition-colors"
      >
        <div className="mt-0.5 text-slate-400">
          {expanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="text-xs text-slate-500">{formatDate(topic.date)}</span>
          </div>
          <p className="font-medium text-slate-900 text-sm leading-snug line-clamp-2">
            {topic.title}
          </p>
        </div>
        <div className="text-right shrink-0 ml-2">
          <p className="text-lg font-bold text-slate-900">{formatMetric(totalEngagement, true)}</p>
          <p className="text-xs text-slate-400">engagements</p>
        </div>
      </button>

      {/* Expanded: platform breakdown */}
      {expanded && (
        <div className="border-t border-slate-100 px-4 pb-4 pt-3">
          {/* Platform grid */}
          <div className="space-y-2">
            {topic.platforms.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-2">No platform data</p>
            )}
            {topic.platforms.map(p => {
              const platformConfig = PLATFORMS.find(pl => pl.key === p.platform);
              const hasAnalytics = p.hasAnalytics;

              return (
                <div
                  key={p.platform}
                  className="flex items-center gap-3 p-2 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
                >
                  {/* Platform label */}
                  <div
                    className="w-20 shrink-0 flex items-center gap-1.5"
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: platformConfig?.color || '#666' }}
                    />
                    <span className="text-xs font-medium text-slate-700 truncate">
                      {platformConfig?.label || p.platform}
                    </span>
                    {!hasAnalytics && (
                      <span className="text-[10px] text-slate-400">(no data)</span>
                    )}
                  </div>

                  {/* Metrics */}
                  <div className="flex-1 flex items-center gap-1">
                    <MetricChip icon={<Eye className="w-3 h-3" />} value={p.views} hasAnalytics={hasAnalytics} color="text-blue-600" />
                    <MetricChip icon={<ThumbsUp className="w-3 h-3" />} value={p.likes} hasAnalytics={hasAnalytics} color="text-slate-600" />
                    <MetricChip icon={<MessageCircle className="w-3 h-3" />} value={p.comments} hasAnalytics={hasAnalytics} color="text-slate-600" />
                    <MetricChip icon={<Share2 className="w-3 h-3" />} value={p.shares} hasAnalytics={hasAnalytics} color="text-slate-600" />
                  </div>

                  {/* Link */}
                  {p.postUrl && (
                    <a
                      href={p.postUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="shrink-0 p-1 text-slate-400 hover:text-blue-600 transition-colors"
                      title="View post"
                    >
                      <Link2 className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              );
            })}
          </div>

          {/* No-data platforms */}
          {(() => {
            const activePlatforms = new Set(topic.platforms.map(p => p.platform));
            const missing = PLATFORMS.filter(pl => !activePlatforms.has(pl.key));
            if (missing.length === 0) return null;
            return (
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100">
                <span className="text-xs text-slate-400">Not posted:</span>
                <div className="flex flex-wrap gap-1">
                  {missing.map(pl => (
                    <span
                      key={pl.key}
                      className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full"
                    >
                      {pl.label}
                    </span>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}

interface MetricChipProps {
  icon: React.ReactNode;
  value: number;
  hasAnalytics: boolean;
  color: string;
}

function MetricChip({ icon, value, hasAnalytics, color }: MetricChipProps) {
  const displayValue = formatMetric(value, hasAnalytics);
  const isEmpty = displayValue === '—';
  return (
    <div
      className={`flex items-center gap-1 min-w-0 ${isEmpty ? 'text-slate-300' : color}`}
      style={{ minWidth: '52px' }}
    >
      {icon}
      <span className="text-xs font-semibold tabular-nums">{displayValue}</span>
    </div>
  );
}

interface DailyDataViewProps {
  topics: ContentTopic[];
  isLoading?: boolean;
}

export default function DailyDataView({ topics, isLoading }: DailyDataViewProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-slate-400 text-sm">Loading data...</div>
      </div>
    );
  }

  if (topics.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Calendar className="w-10 h-10 text-slate-300 mb-3" />
        <p className="text-slate-500 font-medium">No data yet</p>
        <p className="text-sm text-slate-400 mt-1">Click "Fetch Data" to load your posts</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Summary bar */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-500">
          {topics.length} day{topics.length !== 1 ? 's' : ''} of posts
        </p>
        <div className="flex items-center gap-4 text-xs text-slate-400">
          <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> Views</span>
          <span className="flex items-center gap-1"><ThumbsUp className="w-3 h-3" /> Likes</span>
          <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" /> Cmts</span>
          <span className="flex items-center gap-1"><Share2 className="w-3 h-3" /> Shrs</span>
        </div>
      </div>

      {/* Topic cards */}
      {topics.map((topic) => (
        <TopicCard key={topic.id} topic={topic} />
      ))}
    </div>
  );
}
