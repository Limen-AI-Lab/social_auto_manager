// ============================================================
// SAMA - Post Analytics Table
// Sheet 2 preview: one row per post × platform (postAnalyticsRows only)
// ============================================================

import React from 'react';
import {
  isPostAnalyticsMetricUnsupported,
  shouldHidePostEngagementRate,
  type PostAnalyticsRow,
  type PostAnalyticsNumericField,
} from '../services/postAnalyticsData';
import { ExternalLink } from 'lucide-react';

function formatCompactInt(n: number): string {
  if (n === 0) return '0';
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return String(n);
}

function formatMetric(
  platform: string,
  field: PostAnalyticsNumericField,
  value: number,
  status: PostAnalyticsRow['analyticsStatus']
): string {
  if (status !== 'Available') return '—';
  if (isPostAnalyticsMetricUnsupported(platform, field)) return '—';
  return formatCompactInt(value);
}

function formatDate(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function StatusBadge({ status }: { status: string }) {
  const STYLES: Record<string, string> = {
    Available: 'bg-green-100 text-green-700',
    Manual:    'bg-amber-100 text-amber-700',
    Pending:   'bg-slate-100 text-slate-500',
  };
  const style = STYLES[status] || 'bg-slate-100 text-slate-500';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${style}`}>
      {status}
    </span>
  );
}

function PlatformBadge({ platform }: { platform: string }) {
  const COLORS: Record<string, string> = {
    linkedin: 'bg-[#0077B5]', facebook: 'bg-[#1877F2]', instagram: 'bg-[#E4405F]',
    youtube: 'bg-[#FF0000]', twitter: 'bg-slate-800', tiktok: 'bg-black',
  };
  const color = COLORS[platform] || 'bg-slate-500';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-white text-xs font-semibold ${color}`}>
      {platform === 'twitter' ? 'X' : platform.charAt(0).toUpperCase() + platform.slice(1)}
    </span>
  );
}

function truncate(text: string, max: number): string {
  if (!text) return '—';
  return text.length > max ? text.substring(0, max) + '…' : text;
}

interface PostAnalyticsTableProps {
  rows: PostAnalyticsRow[];
}

export default function PostAnalyticsTable({ rows }: PostAnalyticsTableProps) {
  if (rows.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
        No post-level analytics available for this period.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Post Date</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider min-w-[12rem]">Post Text</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Platform</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider min-w-[10rem]">Post URL</th>
              <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Views</th>
              <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Likes</th>
              <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Comments</th>
              <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Shares</th>
              <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Impressions</th>
              <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Reach</th>
              <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Engagement</th>
              <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Engagement Rate</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Analytics Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const plat = row.platform.toLowerCase();
              const url = row.postUrl || row.platformPostUrl || '';
              const hideEr = shouldHidePostEngagementRate(plat, row);
              return (
                <tr key={row.postId + '||' + plat} className="border-b border-slate-100 hover:bg-slate-50/80">
                  <td className="px-3 py-2.5 text-slate-700 font-medium whitespace-nowrap">
                    {formatDate(row.createdAt)}
                  </td>
                  <td className="px-3 py-2.5 text-slate-600 max-w-xs align-top">
                    <span title={row.postText || undefined}>{truncate(row.postText, 80)}</span>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <PlatformBadge platform={plat} />
                  </td>
                  <td className="px-3 py-2.5 align-top">
                    {url ? (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 underline break-all text-xs"
                      >
                        {truncate(url, 48)}
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-slate-700">
                    {formatMetric(plat, 'views', row.views, row.analyticsStatus)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-slate-700">
                    {formatMetric(plat, 'likes', row.likes, row.analyticsStatus)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-slate-700">
                    {formatMetric(plat, 'comments', row.comments, row.analyticsStatus)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-slate-700">
                    {formatMetric(plat, 'shares', row.shares, row.analyticsStatus)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-slate-700">
                    {formatMetric(plat, 'impressions', row.impressions, row.analyticsStatus)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-slate-700">
                    {formatMetric(plat, 'reach', row.reach, row.analyticsStatus)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono font-semibold text-slate-800">
                    {formatMetric(plat, 'engagement', row.engagement, row.analyticsStatus)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono font-semibold text-blue-600">
                    {row.analyticsStatus === 'Available' && !hideEr
                      ? `${row.engagementRate.toFixed(2)}%`
                      : '—'}
                  </td>
                  <td className="px-3 py-2.5">
                    <StatusBadge status={row.analyticsStatus} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
