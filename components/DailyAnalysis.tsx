// ============================================================
// SAMA - Daily Analysis Component
//
// Renders DailyReportData (from dailyReportService.ts):
//   - Report header: client name, period, generated
//   - Performance by Platform (matches Excel template format)
//     Row 1: TikTok | Instagram | LinkedIn
//     Row 2: YouTube | Facebook | Twitter / X
//   - Each platform: Views / Likes / Comments / Shares / Reach / Impressions / Engagement
//
// Print mode: renders the same layout in a print-friendly format.
// Uses the same transform logic as the Excel exporter — no divergence.
// ============================================================

import React, { useEffect } from 'react';
import {
  Printer, Download,
} from 'lucide-react';
import {
  fetchDailyReport,
  type DailyReportData,
  type DailyPostEntry,
  type DailyPlatformMetrics,
} from '../services/dailyReportService';
import {
  downloadDailyReportAsExcel,
} from '../services/excelDailyExport';

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface DailyAnalysisProps {
  profileKeys: string[];
  clientName?: string;
  onShowToast?: (msg: string) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Formatting helpers
// ─────────────────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toLocaleString();
}

function fmtER(n: number): string {
  return `${n.toFixed(2)}%`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Platform config
// ─────────────────────────────────────────────────────────────────────────────

const PLATFORM_CONFIG: Record<string, { label: string; bg: string }> = {
  tiktok: { label: 'TikTok', bg: '#000000' },
  instagram: { label: 'Instagram', bg: '#E4405F' },
  linkedin: { label: 'LinkedIn', bg: '#0077B5' },
  youtube: { label: 'YouTube', bg: '#FF0000' },
  facebook: { label: 'Facebook', bg: '#1877F2' },
  twitter: { label: 'Twitter / X', bg: '#000000' },
};

const PLATFORM_ROW_1 = ['tiktok', 'instagram', 'linkedin'];
const PLATFORM_ROW_2 = ['youtube', 'facebook', 'twitter'];

const METRIC_LABELS: Record<keyof DailyPlatformMetrics, string> = {
  views:       'Views',
  likes:       'Likes',
  comments:    'Comments',
  shares:      'Shares',
  reach:       'Reach',
  impressions: 'Impressions',
  engagements: 'Engagement',
  er:          'Eng. Rate',
};
const METRIC_KEYS = (Object.keys(METRIC_LABELS) as (keyof DailyPlatformMetrics)[]).filter(k => k !== 'er');

/** "09 Apr 2026" → "Apr 9" — column headers aligned with Excel export */
function shortDateLabel(dateLabel: string): string {
  const p = dateLabel.trim().split(/\s+/);
  if (p.length >= 2) {
    const day = String(parseInt(p[0], 10));
    return `${p[1]} ${day}`;
  }
  return dateLabel;
}

// ─────────────────────────────────────────────────────────────────────────────
// Metric display
// ─────────────────────────────────────────────────────────────────────────────

function MetricValue({ value }: { value: number }) {
  return (
    <span style={{ fontVariantNumeric: 'tabular-nums', fontFamily: 'SF Mono, Fira Code, monospace', fontSize: 12, color: '#0f172a' }}>
      {value.toLocaleString()}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Single platform card (matches Excel template cell)
// ─────────────────────────────────────────────────────────────────────────────

function PlatformCard({
  platform,
  olderPost,
  newerPost,
}: {
  platform: string;
  /** Chronologically older day (posts[1] when two days loaded) */
  olderPost?: DailyPostEntry;
  /** Newer day (posts[0]) */
  newerPost?: DailyPostEntry;
}) {
  const config = PLATFORM_CONFIG[platform] ?? { label: platform, bg: '#334155' };
  const metricsOlder = olderPost?.platformMetrics[platform];
  const metricsNewer = newerPost?.platformMetrics[platform];
  const twoDays = !!olderPost && !!newerPost;

  return (
    <div style={{
      background: '#fff',
      borderRadius: 0,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Platform header */}
      <div style={{
        background: config.bg,
        color: '#fff',
        textAlign: 'center',
        padding: '6px 8px',
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: '.03em',
      }}>
        {config.label}
      </div>

      {/* Metrics table — same structure as Excel: metric | day(s) */}
      <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#f8fafc' }}>
            <th style={{ width: '38%', padding: '4px 6px', fontWeight: 600, fontSize: 10, color: '#64748b', textAlign: 'left' }} />
            {twoDays && (
              <th style={{ padding: '4px 6px', fontWeight: 600, fontSize: 10, color: '#475569', textAlign: 'center' }}>
                {shortDateLabel(olderPost!.dateLabel)}
              </th>
            )}
            <th style={{ padding: '4px 6px', fontWeight: 600, fontSize: 10, color: '#475569', textAlign: 'center' }}>
              {newerPost ? shortDateLabel(newerPost.dateLabel) : '—'}
            </th>
          </tr>
        </thead>
        <tbody>
          {METRIC_KEYS.map((key, i) => {
            const isAlt = i % 2 === 1;
            const cellOlder = metricsOlder ? ((metricsOlder as Record<string, number>)[key] ?? 0) : null;
            const cellNewer = metricsNewer ? ((metricsNewer as Record<string, number>)[key] ?? 0) : null;
            return (
              <tr key={key} style={isAlt ? { background: '#f8fafc' } : { background: '#fff' }}>
                <td style={{ color: '#0f172a', fontWeight: 700, padding: '4px 6px' }}>
                  {METRIC_LABELS[key]}
                </td>
                {twoDays && (
                  <td style={{ textAlign: 'right', padding: '4px 6px' }}>
                    {metricsOlder !== undefined ? <MetricValue value={cellOlder ?? 0} /> : <span style={{ color: '#94a3b8' }}>&#8212;</span>}
                  </td>
                )}
                <td style={{ textAlign: 'right', padding: '4px 6px' }}>
                  {metricsNewer !== undefined ? <MetricValue value={cellNewer ?? 0} /> : <span style={{ color: '#94a3b8' }}>&#8212;</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Platform row (3 platforms side by side)
// ─────────────────────────────────────────────────────────────────────────────

function PlatformRow({
  platforms,
  olderPost,
  newerPost,
}: {
  platforms: string[];
  olderPost?: DailyPostEntry;
  newerPost?: DailyPostEntry;
}) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: 1,
      background: '#e2e8f0',
      borderRadius: 8,
      overflow: 'hidden',
    }}>
      {platforms.map(plat => (
        <PlatformCard
          key={plat}
          platform={plat}
          olderPost={olderPost}
          newerPost={newerPost}
        />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Report header
// ─────────────────────────────────────────────────────────────────────────────

function ReportHeader({ data }: { data: DailyReportData }) {
  return (
    <div style={{
      marginBottom: 16,
      padding: '12px 16px',
      background: '#fff',
      border: '1.5px solid #e2e8f0',
      borderRadius: 10,
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      flexWrap: 'wrap',
    }}>
      <div>
        <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 2 }}>
          Client
        </div>
        <div style={{ fontSize: 16, fontWeight: 700 }}>{data.clientName}</div>
      </div>
      <div style={{ borderLeft: '1px solid #e2e8f0', height: 32 }} />
      <div>
        <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 2 }}>
          Report Period
        </div>
        <div style={{ fontSize: 14, fontWeight: 600 }}>
          {data.posts.length >= 2
            ? `${data.posts[1].dateLabel} — ${data.posts[0].dateLabel}`
            : data.posts.length === 1
            ? data.posts[0].dateLabel
            : '—'}
        </div>
      </div>
      <div style={{ borderLeft: '1px solid #e2e8f0', height: 32 }} />
      <div>
        <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 2 }}>
          Generated
        </div>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{data.generatedAt}</div>
      </div>
      <div style={{ borderLeft: '1px solid #e2e8f0', height: 32 }} />
      <div>
        <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 2 }}>
          Timezone
        </div>
        <div style={{ fontSize: 14, fontWeight: 600 }}>SAST (UTC+2)</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Toolbar
// ─────────────────────────────────────────────────────────────────────────────

function Toolbar({ onExportExcel }: { onExportExcel: () => void }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginBottom: 16,
      flexWrap: 'wrap',
    }}>
      <button
        onClick={() => window.print()}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '7px 14px',
          borderRadius: 7,
          border: '1.5px solid #e2e8f0',
          background: '#fff',
          color: '#334155',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'all .15s',
        }}
      >
        <Printer size={14} />
        Download PDF
      </button>
      <button
        onClick={onExportExcel}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '7px 14px',
          borderRadius: 7,
          border: 'none',
          background: '#3b82f6',
          color: '#fff',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'all .15s',
        }}
      >
        <Download size={14} />
        Export Excel
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Empty state
// ─────────────────────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 48,
      color: '#94a3b8',
    }}>
      <svg width="48" height="48" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
      <p style={{ marginTop: 12, fontSize: 14, fontWeight: 600 }}>No daily data yet</p>
      <p style={{ marginTop: 4, fontSize: 12 }}>Fetch your data to generate a daily report</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function DailyAnalysis({ profileKeys, clientName = 'Client', onShowToast }: DailyAnalysisProps) {
  const [data, setData] = React.useState<DailyReportData | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Sync to window for Excel export
  useEffect(() => {
    if (data) {
      (window as any).__samaDailyReport = data;
    }
  }, [data]);

  async function handleGenerate() {
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchDailyReport({ profileKeys, clientName });
      setData(result);
      onShowToast?.('Daily report generated successfully');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to generate daily report';
      setError(msg);
      onShowToast?.(msg);
    } finally {
      setIsLoading(false);
    }
  }

  function handleExportExcel() {
    if (!data) {
      onShowToast?.('No daily report data. Generate a report first.');
      return;
    }
    downloadDailyReportAsExcel();
    onShowToast?.('Daily Excel exported');
  }

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48 }}>
        <div style={{ color: '#94a3b8', fontSize: 14 }}>Generating daily report…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 16 }}>
        <div style={{
          padding: '12px 16px',
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: 8,
          color: '#dc2626',
          fontSize: 13,
          marginBottom: 16,
        }}>
          {error}
        </div>
        <button onClick={handleGenerate} style={{ cursor: 'pointer', padding: '7px 14px', borderRadius: 7, border: 'none', background: '#3b82f6', color: '#fff', fontSize: 13, fontWeight: 600 }}>
          Try Again
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: 32, textAlign: 'center' }}>
        <EmptyState />
        <button
          onClick={handleGenerate}
          style={{
            marginTop: 16,
            padding: '8px 20px',
            borderRadius: 7,
            border: 'none',
            background: '#3b82f6',
            color: '#fff',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Generate Daily Report
        </button>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif' }}>
      <ReportHeader data={data} />
      <Toolbar onExportExcel={handleExportExcel} />

      {/* ── Performance by Platform (matches Excel template) ── */}
      <div style={{
        background: '#fff',
        border: '1.5px solid #e2e8f0',
        borderRadius: 12,
        overflow: 'hidden',
      }}>
        {/* Card header */}
        <div style={{
          padding: '14px 18px',
          borderBottom: '1px solid #e2e8f0',
          background: '#fafbfc',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: '#64748b' }}>
            Performance by Platform
          </span>
          <span style={{ fontSize: 11, color: '#94a3b8' }}>
            {data.posts.length >= 2
              ? `${data.posts[1].dateLabel} — ${data.posts[0].dateLabel}`
              : data.posts.length === 1
              ? data.posts[0].dateLabel
              : ''}
          </span>
        </div>

        {/* Platform grid — both rows use the same two days (older → newer) per platform */}
        <div style={{ padding: 12 }}>
          <PlatformRow
            platforms={PLATFORM_ROW_1}
            olderPost={data.posts[1]}
            newerPost={data.posts[0]}
          />
        </div>

        <div style={{ padding: '0 12px 12px' }}>
          <PlatformRow
            platforms={PLATFORM_ROW_2}
            olderPost={data.posts[1]}
            newerPost={data.posts[0]}
          />
        </div>

        {/* Post Links */}
        {data.posts.some(p => p.postUrl) && (
          <div style={{ padding: '0 12px 12px', borderTop: '1px solid #e2e8f0', paddingTop: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: '#94a3b8', marginBottom: 8 }}>
              Post Links
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {data.posts.filter(p => p.postUrl).map((post, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
                  <span style={{ color: '#94a3b8', minWidth: 80 }}>{post.dateLabel}</span>
                  <span style={{ color: '#334155', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 300 }}>
                    {post.title}
                  </span>
                  <a
                    href={post.postUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#3b82f6', textDecoration: 'none', fontSize: 11, whiteSpace: 'nowrap' }}
                  >
                    View Post →
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
