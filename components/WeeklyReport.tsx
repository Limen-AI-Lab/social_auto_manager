// ============================================================
// SAMA - Weekly Report Component
//
// Renders WeeklyReportData:
//   - Performance Overview card
//   - Platform Performance table
//   - Posts by Date table
//   - Content Topics tags
//
// Print mode: renders the same layout in a print-friendly format.
// Uses the same transform logic as the Excel exporter — no divergence.
// ============================================================

import React, { useState } from 'react';
import {
  Printer, Download, Eye,
  ChevronDown, ChevronRight,
} from 'lucide-react';
import {
  fetchWeeklyReport,
  type WeeklyReportData,
  type WeeklyPlatformRow,
  type WeeklyTopicRow,
  type WeeklyPostPlatformRow,
  type WeeklyMetricKey,
  type WeeklyPostOfWeek,
  WEEKLY_PLATFORM_COLUMNS,
} from '../services/weeklyReportService';
import {
  downloadWeeklyReportAsExcel,
} from '../services/excelWeeklyExport';

// ─────────────────────────────────────────────────────────────────────────────
// Formatting helpers
// ─────────────────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toLocaleString();
}

function fmtFull(n: number): string {
  return n.toLocaleString();
}

function fmtER(n: number): string {
  return `${n.toFixed(2)}%`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Platform pill
// ─────────────────────────────────────────────────────────────────────────────

const PLATFORM_COLORS: Record<string, string> = {
  linkedin: '#0077b5',
  facebook: '#1877f2',
  instagram: '#e4405f',
  youtube: '#ff0000',
  twitter: '#1d9bf0',
  tiktok: '#000000',
};

function PlatformPill({ platform }: { platform: string }) {
  const label = platform === 'twitter' ? 'X' : platform.charAt(0).toUpperCase() + platform.slice(1);
  const bg = PLATFORM_COLORS[platform] ?? '#64748b';
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '3px 9px', borderRadius: 5,
        fontSize: 11, fontWeight: 700, color: '#fff', background: bg,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Delta badge
// ─────────────────────────────────────────────────────────────────────────────

function DeltaBadge({ direction, value }: { direction: 'up' | 'down' | 'flat'; value: number }) {
  if (direction === 'flat') {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 2,
        fontSize: 11, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
        background: '#f1f5f9', color: '#94a3b8',
      }}>
        &#8212; flat
      </span>
    );
  }
  const color = direction === 'up' ? '#065f46' : '#991b1b';
  const bg = direction === 'up' ? '#d1fae5' : '#fee2e2';
  const arrow = direction === 'up' ? '▲' : '▼';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 2,
      fontSize: 11, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
      background: bg, color,
    }}>
      {arrow} {Math.abs(value)}%
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ER bar
// ─────────────────────────────────────────────────────────────────────────────

function ERBar({ value, max = 20 }: { value: number; max?: number }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{
        flex: 1, height: 5, background: '#e2e8f0',
        borderRadius: 3, overflow: 'hidden', minWidth: 40,
      }}>
        <div style={{
          height: '100%', borderRadius: 3,
          width: `${pct}%`, background: '#3b82f6',
        }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', minWidth: 36, textAlign: 'right' }}>
        {fmtER(value)}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Metric cell
// ─────────────────────────────────────────────────────────────────────────────

function MetricCell({ value }: { value: number }) {
  if (value === 0) {
    return <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>&#8212;</span>;
  }
  return <span style={{ fontVariantNumeric: 'tabular-nums', fontFamily: 'SF Mono, Fira Code, monospace', fontSize: 12 }}>
    {fmtFull(value)}
  </span>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Overview card
// ─────────────────────────────────────────────────────────────────────────────

function OverviewCard({ data }: { data: WeeklyReportData['overview'] }) {
  const stats = [
    { label: 'Posts Published', value: fmtFull(data.totalPosts), sub: `${data.activePlatforms} platforms` },
    { label: 'Total Impressions', value: fmt(data.totalImpressions), sub: 'across all platforms' },
    { label: 'Total Engagements', value: fmtFull(data.totalEngagements), sub: 'likes + comments + shares' },
    { label: 'Engagement Rate', value: fmtER(data.avgER), sub: 'eng / impressions' },
    { label: 'Total Reach', value: fmt(data.totalReach), sub: 'unique accounts' },
  ];

  return (
    <div style={{
      background: '#fff', border: '1.5px solid #e2e8f0',
      borderRadius: 12, overflow: 'hidden', marginBottom: 16,
    }}>
      <div style={{
        padding: '14px 18px', borderBottom: '1px solid #e2e8f0',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: '#fafbfc',
      }}>
        <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: '#64748b' }}>
          Performance Overview
        </span>
        <span style={{ fontSize: 11, color: '#94a3b8' }}>
          {data.totalPosts > 0 ? `${data.activePlatforms} platforms active` : 'No data'}
        </span>
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${Math.min(stats.length, 5)}, minmax(0, 1fr))`,
        gap: 10, padding: '14px 18px',
      }}>
        {stats.map(s => (
          <div key={s.label}>
            <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 2 }}>
              {s.label}
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', letterSpacing: '-.02em' }}>
              {data.totalPosts > 0 ? s.value : '-'}
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>{s.sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Platform Performance table
// ─────────────────────────────────────────────────────────────────────────────

function PlatformPerfTable({ rows }: { rows: WeeklyPlatformRow[] }) {
  if (rows.length === 0) return null;

  // Collect all unique column keys across platforms
  const allCols = Array.from(new Set(rows.flatMap(r => r.columns.map(c => c.key))));

  return (
    <div style={{
      background: '#fff', border: '1.5px solid #e2e8f0',
      borderRadius: 12, overflow: 'hidden', marginBottom: 16,
    }}>
      <div style={{
        padding: '14px 18px', borderBottom: '1px solid #e2e8f0',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: '#fafbfc',
      }}>
        <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: '#64748b' }}>
          Platform Performance
        </span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#fafbfc' }}>
              <th style={thStyle}>Platform</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Posts</th>
              {allCols.map(col => (
                <th key={col} style={{ ...thStyle, textAlign: 'right' }}>
                  {col === 'er' ? 'Eng. Rate' : col.charAt(0).toUpperCase() + col.slice(1)}
                </th>
              ))}
              <th style={{ ...thStyle, textAlign: 'right' }}>vs Prev Week</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.platform} style={{ borderBottom: '1px solid #f1f5f9' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#fafbff')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}>
                <td style={tdStyle}><PlatformPill platform={row.platform} /></td>
                <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontFamily: 'monospace', fontSize: 12 }}>
                  {row.posts}
                </td>
                {allCols.map(col => {
                  const colDef = row.columns.find(c => c.key === col);
                  const val = colDef ? colDef.getValue({ engagement: row.totals.engagements, engagementRate: row.totals.er, impressions: row.totals.impressions, views: row.totals.views, likes: row.totals.likes, comments: row.totals.comments, shares: row.totals.shares, reach: row.totals.reach } as any) : 0;
                  if (col === 'er') {
                    return (
                      <td key={col} style={{ ...tdStyle, minWidth: 140 }}>
                        {val > 0 ? <ERBar value={val} /> : <span style={{ color: '#94a3b8' }}>&#8212;</span>}
                      </td>
                    );
                  }
                  return (
                    <td key={col} style={{ ...tdStyle, textAlign: 'right' }}>
                      <MetricCell value={val} />
                    </td>
                  );
                })}
                <td style={{ ...tdStyle, textAlign: 'right' }}>
                  {row.change
                    ? <DeltaBadge direction={row.change.direction} value={row.change.value} />
                    : <span style={{ color: '#94a3b8' }}>&#8212;</span>}
                </td>
              </tr>
            ))}
            {/* Total row */}
            <tr style={{ background: '#f8fafc', fontWeight: 700, borderTop: '2px solid #e2e8f0' }}>
              <td style={tdStyle}>Total</td>
              <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontFamily: 'monospace', fontSize: 12 }}>
                {rows.reduce((s, r) => s + r.posts, 0)}
              </td>
              {allCols.map(col => {
                const val = rows.reduce((s, r) => {
                  const cd = r.columns.find(c => c.key === col);
                  if (!cd) return s;
                  const raw = col === 'er' ? r.totals.er
                    : col === 'engagements' ? r.totals.engagements
                    : col === 'impressions' ? r.totals.impressions
                    : col === 'views' ? r.totals.views
                    : col === 'likes' ? r.totals.likes
                    : col === 'comments' ? r.totals.comments
                    : col === 'shares' ? r.totals.shares
                    : col === 'reach' ? r.totals.reach
                    : 0;
                  return s + raw;
                }, 0);
                if (col === 'er') {
                  const allImpressions = rows.reduce((s, r) => s + r.totals.impressions, 0);
                  const allEngagements = rows.reduce((s, r) => s + r.totals.engagements, 0);
                  const er = allImpressions > 0 ? (allEngagements / allImpressions) * 100 : 0;
                  return (
                    <td key={col} style={{ ...tdStyle, minWidth: 140 }}>
                      <ERBar value={er} />
                    </td>
                  );
                }
                return (
                  <td key={col} style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontFamily: 'monospace', fontSize: 12 }}>
                    {fmt(val)}
                  </td>
                );
              })}
              <td style={tdStyle} />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: '9px 12px', fontSize: 10.5, fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: '.08em', color: '#94a3b8',
  background: '#fafbfc', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '9px 12px', fontSize: 13, borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle',
};

// ─────────────────────────────────────────────────────────────────────────────
// Posts by Date table
// ─────────────────────────────────────────────────────────────────────────────

function PostsByDateTable({ topicRows }: { topicRows: WeeklyTopicRow[] }) {
  if (topicRows.length === 0) return null;

  return (
    <div style={{
      background: '#fff', border: '1.5px solid #e2e8f0',
      borderRadius: 12, overflow: 'hidden', marginBottom: 16,
    }}>
      <div style={{
        padding: '14px 18px', borderBottom: '1px solid #e2e8f0',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: '#fafbfc',
      }}>
        <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: '#64748b' }}>
          Posts by Date
        </span>
        <span style={{ fontSize: 11, color: '#94a3b8' }}>
          {topicRows.length} day{topicRows.length !== 1 ? 's' : ''} of posts
        </span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#fafbfc' }}>
              <th style={thStyle}>Date</th>
              <th style={{ ...thStyle, minWidth: 220 }}>Post Text</th>
              <th style={thStyle}>Platform</th>
              {['Views', 'Impressions', 'Likes', 'Comments', 'Engagements', 'Eng. Rate'].map(h => (
                <th key={h} style={{ ...thStyle, textAlign: 'right' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {topicRows.map(topic => (
              <React.Fragment key={topic.id}>
                {/* Date divider */}
                <tr style={{ background: '#f8fafc' }}>
                  <td colSpan={9} style={{
                    fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                    letterSpacing: '.08em', color: '#94a3b8', padding: '10px 12px',
                  }}>
                    {topic.dateLabel}
                  </td>
                </tr>
                {topic.platformRows.map(pr => (
                  <tr key={`${topic.id}||${pr.platform}`}
                      style={{ borderBottom: '1px solid #f1f5f9' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#fafbff')}
                      onMouseLeave={e => (e.currentTarget.style.background = '')}>
                    <td style={tdStyle}>
                      <span style={{ fontFamily: 'monospace', fontSize: 12, whiteSpace: 'nowrap' }}>
                        {topic.date.slice(5)}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, maxWidth: 260 }}>
                      <div style={{
                        fontSize: 12, color: '#64748b',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }} title={topic.postText}>
                        {topic.title}
                      </div>
                    </td>
                    <td style={tdStyle}><PlatformPill platform={pr.platform} /></td>
                    {/* Views */}
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <MetricCell value={pr.columns.find(c => c.key === 'views')?.value ?? 0} />
                    </td>
                    {/* Impressions */}
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <MetricCell value={pr.columns.find(c => c.key === 'impressions')?.value ?? 0} />
                    </td>
                    {/* Likes */}
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <MetricCell value={pr.columns.find(c => c.key === 'likes')?.value ?? 0} />
                    </td>
                    {/* Comments */}
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <MetricCell value={pr.columns.find(c => c.key === 'comments')?.value ?? 0} />
                    </td>
                    {/* Engagements */}
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <MetricCell value={pr.columns.find(c => c.key === 'engagements')?.value ?? 0} />
                    </td>
                    {/* ER */}
                    <td style={{ ...tdStyle, minWidth: 120 }}>
                      <ERBar value={pr.columns.find(c => c.key === 'er')?.value ?? 0} />
                    </td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Topics tags
// ─────────────────────────────────────────────────────────────────────────────

function TopicsTags({ topics }: { topics: WeeklyReportData['topics'] }) {
  if (topics.length === 0) return null;

  return (
    <div style={{
      background: '#fff', border: '1.5px solid #e2e8f0',
      borderRadius: 12, overflow: 'hidden', marginBottom: 16,
    }}>
      <div style={{
        padding: '14px 18px', borderBottom: '1px solid #e2e8f0',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: '#fafbfc',
      }}>
        <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: '#64748b' }}>
          Content Topics
        </span>
      </div>
      <div style={{ padding: '14px 18px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {topics.map((t, i) => (
          <div key={i} style={{
            background: '#eff6ff', border: '1.5px solid #bfdbfe',
            borderRadius: 8, padding: '8px 14px',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '.06em' }}>
              {t.label}
            </span>
            <span style={{ fontSize: 11, color: '#64748b' }}>{t.postCount} posts</span>
            <DeltaBadge direction={t.avgER > 0 ? 'up' : 'flat'} value={t.avgER} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Post of the Week
// ─────────────────────────────────────────────────────────────────────────────

function PostOfWeekCard({ posts }: { posts: WeeklyPostOfWeek[] }) {
  if (!posts || posts.length === 0) return null;

  const PLATFORM_TEXT_COLORS: Record<string, string> = {
    tiktok:    '#ffffff',
    instagram: '#ffffff',
    linkedin:  '#ffffff',
    youtube:   '#ffffff',
    facebook:  '#ffffff',
    twitter:   '#ffffff',
  };

  return (
    <div style={{
      background: '#fff', border: '1.5px solid #e2e8f0',
      borderRadius: 12, overflow: 'hidden', marginBottom: 16,
    }}>
      <div style={{
        padding: '14px 18px', borderBottom: '1px solid #e2e8f0',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: '#1e293b',
      }}>
        <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: '#ffffff' }}>
          Post of the Week
        </span>
        <span style={{ fontSize: 11, color: '#94a3b8' }}>
          Top post per platform
        </span>
      </div>
      <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {posts.map(post => (
          <div key={post.platform} style={{
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            padding: '12px 16px',
            background: '#fafbfc',
          }}>
            {/* Header row */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
              <PlatformPill platform={post.platform} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginBottom: 2 }}>
                  {post.title}
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>
                  {post.dateLabel}
                </div>
              </div>
              {post.postUrl && (
                <a
                  href={post.postUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: 11, color: '#3b82f6', textDecoration: 'none',
                    padding: '3px 8px', border: '1px solid #bfdbfe',
                    borderRadius: 4, whiteSpace: 'nowrap',
                  }}
                >
                  View Post →
                </a>
              )}
            </div>
            {/* Metrics row */}
            <div style={{ display: 'flex', gap: 16, marginBottom: 8, flexWrap: 'wrap' }}>
              {[
                { label: 'Views', value: fmtFull(post.views) },
                { label: 'Impressions', value: fmtFull(post.impressions) },
                { label: 'Engagements', value: fmtFull(post.engagement) },
                { label: 'Eng. Rate', value: fmtER(post.er) },
              ].map(m => (
                <div key={m.label}>
                  <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                    {m.label}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', fontVariantNumeric: 'tabular-nums', fontFamily: 'monospace' }}>
                    {m.value}
                  </div>
                </div>
              ))}
            </div>
            {/* Narrative */}
            <div style={{
              fontSize: 12, color: '#64748b', lineHeight: 1.5,
              fontStyle: 'italic', padding: '8px 10px',
              background: '#fff', border: '1px solid #f1f5f9',
              borderRadius: 6,
            }}>
              {post.narrative}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Client header
// ─────────────────────────────────────────────────────────────────────────────

function ReportHeader({ data }: { data: WeeklyReportData }) {
  return (
    <div style={{
      marginBottom: 16, padding: '12px 16px', background: '#fff',
      border: '1.5px solid #e2e8f0', borderRadius: 10,
      display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
    }}>
      {[
        { label: 'Client', value: data.clientName },
        { label: 'Report Period', value: data.periodLabel },
        { label: 'Generated', value: data.generatedAt },
        { label: 'Timezone', value: 'SAST (UTC+2)' },
      ].map(({ label, value }) => (
        <React.Fragment key={label}>
          {label !== 'Client' && (
            <div style={{ borderLeft: '1px solid #e2e8f0', height: 32 }} />
          )}
          <div>
            <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 2 }}>
              {label}
            </div>
            <div style={{ fontSize: label === 'Client' ? 16 : 14, fontWeight: label === 'Client' ? 700 : 600, color: '#0f172a' }}>
              {value}
            </div>
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

interface WeeklyReportProps {
  data: WeeklyReportData | null;
  isLoading: boolean;
  clientName?: string;
  onExportExcel?: () => void;
}

export default function WeeklyReport({ data, isLoading, clientName = 'Client', onExportExcel }: WeeklyReportProps) {
  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48 }}>
        <div style={{ color: '#94a3b8', fontSize: 14 }}>Generating report…</div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif' }}>
      <ReportHeader data={data} />
      <OverviewCard data={data.overview} />
      <PlatformPerfTable rows={data.platformRows} />
      <PostsByDateTable topicRows={data.topicRows} />
      <TopicsTags topics={data.topics} />
      <PostOfWeekCard posts={data.postOfWeek} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility: export weekly report to window for Excel
// ─────────────────────────────────────────────────────────────────────────────

export function exposeWeeklyReportForExcel(data: WeeklyReportData) {
  (window as any).__samaWeeklyReport = data;
}
