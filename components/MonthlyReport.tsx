// ============================================================
// SAMA - Monthly Report Component
//
// Renders MonthlyReportData:
//   - March 2026 — Platform Summary (KPI table with Followers Growth)
//   - CTR (LinkedIn + Facebook only)
//   - Posts Distribution (Jan / Feb / Mar)
//   - Top Performing Content
//
// Print mode: renders the same layout in a print-friendly format.
// Uses the same transform logic as the Excel exporter — no divergence.
// ============================================================

import React from 'react';
import {
  type MonthlyReportData,
  type MonthlyPlatformRow,
  type MonthlyCTRRow,
  type MonthlyPostsDistributionRow,
  type MonthlyTopContentRow,
} from '../services/monthlyReportService';

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
// Shared components
// ─────────────────────────────────────────────────────────────────────────────

const PLATFORM_COLORS: Record<string, string> = {
  linkedin: '#0077b5',
  facebook: '#1877f2',
  instagram: '#e4405f',
  youtube: '#ff0000',
  twitter: '#1d9bf0',
  tiktok: '#fe2c55',
};

function PlatformPill({ platform, showTikTokFull }: { platform: string; showTikTokFull?: boolean }) {
  const label = platform === 'twitter' ? 'X' : platform === 'tiktok' && !showTikTokFull
    ? 'TikTok' : platform.charAt(0).toUpperCase() + platform.slice(1);
  const bg = platform === 'tiktok' ? 'linear-gradient(135deg, #25f4ee, #fe2c55)' : (PLATFORM_COLORS[platform] ?? '#64748b');
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

function DeltaBadge({ direction, value, unit = '%' }: { direction: 'up' | 'down' | 'flat'; value: number; unit?: string }) {
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
  const sign = direction === 'up' ? '+' : '-';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 2,
      fontSize: 11, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
      background: bg, color,
    }}>
      {arrow} {sign}{Math.abs(value)}{unit}
    </span>
  );
}

function ERBar({ value, max = 20, color = '#3b82f6' }: { value: number; max?: number; color?: string }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{
        flex: 1, height: 5, background: '#e2e8f0',
        borderRadius: 3, overflow: 'hidden', minWidth: 40,
      }}>
        <div style={{
          height: '100%', borderRadius: 3,
          width: `${pct}%`, background: color,
        }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', minWidth: 36, textAlign: 'right' }}>
        {fmtER(value)}
      </span>
    </div>
  );
}

function MetricCell({ value }: { value: number }) {
  if (!value) return <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>&#8212;</span>;
  return <span style={{ fontVariantNumeric: 'tabular-nums', fontFamily: 'SF Mono, Fira Code, monospace', fontSize: 12 }}>
    {fmtFull(value)}
  </span>;
}

function MetricCellFmt({ value }: { value: number }) {
  if (!value) return <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>&#8212;</span>;
  return <span style={{ fontVariantNumeric: 'tabular-nums', fontFamily: 'SF Mono, Fira Code, monospace', fontSize: 12 }}>
    {fmt(value)}
  </span>;
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
// Card wrapper
// ─────────────────────────────────────────────────────────────────────────────

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
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
          {title}
        </span>
        {subtitle && <span style={{ fontSize: 11, color: '#94a3b8' }}>{subtitle}</span>}
      </div>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Report header
// ─────────────────────────────────────────────────────────────────────────────

function ReportHeader({ data }: { data: MonthlyReportData }) {
  const metas = [
    { label: 'Client', value: data.clientName },
    { label: 'Report Month', value: data.monthLabel },
    { label: 'Generated', value: data.generatedAt },
    { label: 'Timezone', value: 'SAST (UTC+2)' },
  ];
  return (
    <div style={{
      marginBottom: 16, padding: '12px 16px', background: '#fff',
      border: '1.5px solid #e2e8f0', borderRadius: 10,
      display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
    }}>
      {metas.map(({ label, value }, i) => (
        <React.Fragment key={label}>
          {i > 0 && <div style={{ borderLeft: '1px solid #e2e8f0', height: 32 }} />}
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
// Overview card
// ─────────────────────────────────────────────────────────────────────────────

function OverviewCard({ data }: { data: MonthlyReportData['overview'] }) {
  const stats = [
    { label: 'Posts Published', value: fmtFull(data.totalPosts), sub: `${data.activePlatforms} platforms` },
    { label: 'Total Impressions', value: fmt(data.totalImpressions), sub: 'across all platforms' },
    { label: 'Total Engagements', value: fmtFull(data.totalEngagements), sub: 'likes + comments + shares' },
    { label: 'Engagement Rate', value: fmtER(data.avgER), sub: 'eng / impressions' },
    { label: 'Total Reach', value: fmt(data.totalReach), sub: 'unique accounts' },
    ...(data.totalFollowers
      ? [{ label: 'Total Followers', value: fmtFull(data.totalFollowers), sub: `▲ ${data.followersChange}% MoM` }]
      : []),
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
          {data.monthLabel} — Performance Overview
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
// Platform Summary table
// ─────────────────────────────────────────────────────────────────────────────

function PlatformSummaryTable({ rows, year, month }: { rows: MonthlyPlatformRow[]; year: number; month: number }) {
  if (rows.length === 0) return null;

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const prevLabel = monthNames[prevMonth - 1] + ' ' + prevYear;
  const currLabel = monthNames[month - 1] + ' ' + year;

  return (
    <Card title={`${rows[0]?.label ? '' : ''}`} subtitle="Jan vs Feb vs Mar comparison">
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thStyle}>Platform</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Posts</th>
              {/* Followers columns — only if any row has followers */}
              {rows.some(r => r.followers !== undefined) && (
                <>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Followers</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Follower Δ</th>
                </>
              )}
              {/* Dynamic extra columns */}
              {rows[0]?.columns.map(col => (
                <th key={col.key} style={{ ...thStyle, textAlign: 'right' }}>{col.label}</th>
              ))}
              <th style={{ ...thStyle, textAlign: 'right' }}>{prevLabel}</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>{currLabel}</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Δ MoM</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => {
              const platColor = PLATFORM_COLORS[row.platform] ?? '#3b82f6';
              return (
                <tr key={row.platform}
                    style={{ borderBottom: '1px solid #f1f5f9' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#fafbff')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}>
                  <td style={tdStyle}><PlatformPill platform={row.platform} /></td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontFamily: 'monospace', fontSize: 12 }}>
                    {row.posts}
                  </td>
                  {rows.some(r => r.followers !== undefined) && (
                    <>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        {row.followers !== undefined
                          ? <MetricCellFmt value={row.followers} />
                          : <span style={{ color: '#94a3b8' }}>&#8212;</span>}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        {row.followersChange !== undefined
                          ? <DeltaBadge direction={row.followersChange >= 0 ? 'up' : 'down'} value={row.followersChange} />
                          : <span style={{ color: '#94a3b8' }}>&#8212;</span>}
                      </td>
                    </>
                  )}
                  {row.columns.map(col => (
                    <td key={col.key} style={{ ...tdStyle, textAlign: 'right' }}>
                      {col.key === 'er'
                        ? (col.value > 0 ? <ERBar value={col.value} color={platColor} /> : <span style={{ color: '#94a3b8' }}>&#8212;</span>)
                        : <MetricCellFmt value={col.value} />}
                    </td>
                  ))}
                  <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontFamily: 'monospace', fontSize: 12 }}>
                    {row.totals.monthlyImpressions[0] > 0 ? fmt(row.totals.monthlyImpressions[0]) : '-'}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontFamily: 'monospace', fontSize: 12 }}>
                    {row.totals.monthlyImpressions[1] > 0 ? fmt(row.totals.monthlyImpressions[1]) : '-'}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    {row.change
                      ? <DeltaBadge direction={row.change.direction} value={row.change.value} />
                      : <span style={{ color: '#94a3b8' }}>&#8212;</span>}
                  </td>
                </tr>
              );
            })}
            {/* Total row */}
            <tr style={{ background: '#f8fafc', fontWeight: 700 }}>
              <td style={tdStyle}>Total</td>
              <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontFamily: 'monospace', fontSize: 12 }}>
                {rows.reduce((s, r) => s + r.posts, 0)}
              </td>
              {rows.some(r => r.followers !== undefined) && (
                <>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    <MetricCellFmt value={rows.reduce((s, r) => s + (r.followers ?? 0), 0)} />
                  </td>
                  <td style={tdStyle} />
                </>
              )}
              {rows[0]?.columns.map(col => (
                <td key={col.key} style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontFamily: 'monospace', fontSize: 12 }}>
                  {col.key === 'er'
                    ? fmtER(rows.reduce((s, r) => s + (r.totals.engagements / Math.max(r.totals.impressions, 1)), 0) /
                        Math.max(rows.length, 1))
                    : fmt(rows.reduce((s, r) => {
                        const colRow = r.columns.find(c => c.key === col.key);
                        return s + (colRow?.value ?? 0);
                      }, 0))}
                </td>
              ))}
              <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontFamily: 'monospace', fontSize: 12 }}>
                {fmt(rows.reduce((s, r) => s + r.totals.monthlyImpressions[0], 0))}
              </td>
              <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontFamily: 'monospace', fontSize: 12 }}>
                {fmt(rows.reduce((s, r) => s + r.totals.monthlyImpressions[1], 0))}
              </td>
              <td style={tdStyle} />
            </tr>
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CTR table
// ─────────────────────────────────────────────────────────────────────────────

function CTRTable({ rows }: { rows: MonthlyCTRRow[] }) {
  if (rows.length === 0) {
    return (
      <Card title="Click-Through Rate" subtitle="LinkedIn & Facebook only">
        <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
          No CTR data available for this period.
        </div>
      </Card>
    );
  }

  return (
    <Card title="Click-Through Rate" subtitle="LinkedIn & Facebook only — CTR = Clicks / Impressions">
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thStyle}>Platform</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Clicks</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Impressions</th>
              <th style={{ ...thStyle, minWidth: 160 }}>CTR</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Prev CTR</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Δ vs Prev</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.platform}
                  style={{ borderBottom: '1px solid #f1f5f9' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#fafbff')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}>
                <td style={tdStyle}><PlatformPill platform={row.platform} /></td>
                <td style={{ ...tdStyle, textAlign: 'right' }}><MetricCell value={row.clicks} /></td>
                <td style={{ ...tdStyle, textAlign: 'right' }}><MetricCellFmt value={row.impressions} /></td>
                <td style={{ ...tdStyle }}>
                  <ERBar value={row.ctr} max={10} color={PLATFORM_COLORS[row.platform] ?? '#3b82f6'} />
                </td>
                <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontFamily: 'monospace', fontSize: 12 }}>
                  {fmtER(row.prevCtr)}
                </td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>
                  <DeltaBadge
                    direction={row.change >= 0 ? 'up' : 'down'}
                    value={Math.abs(row.change)}
                    unit="pp"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Posts Distribution table
// ─────────────────────────────────────────────────────────────────────────────

function PostsDistributionTable({ rows, year, month }: { rows: MonthlyPostsDistributionRow[]; year: number; month: number }) {
  if (rows.length === 0) return null;

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const prevLabel = monthNames[prevMonth - 1] + ' ' + prevYear;
  const currLabel = monthNames[month - 1] + ' ' + year;

  return (
    <Card title="Posts Distribution" subtitle={`Posts published: ${prevLabel} vs ${currLabel}`}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thStyle}>Platform</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>{prevLabel}</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>{currLabel}</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Δ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.platform}
                  style={{ borderBottom: '1px solid #f1f5f9' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#fafbff')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}>
                <td style={tdStyle}><PlatformPill platform={row.platform} /></td>
                {row.posts.map((count, i) => (
                  <td key={i} style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontFamily: 'monospace', fontSize: 12 }}>
                    {count > 0 ? count : <span style={{ color: '#94a3b8' }}>-</span>}
                  </td>
                ))}
                <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontFamily: 'monospace', fontSize: 12, fontWeight: 700 }}>
                  {row.change > 0 ? `+${row.change}` : row.change < 0 ? `${row.change}` : '-'}
                </td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>
                  <DeltaBadge direction={row.change >= 0 ? 'up' : 'down'} value={Math.abs(row.change)} />
                </td>
              </tr>
            ))}
            {/* Total */}
            <tr style={{ background: '#f8fafc', fontWeight: 700 }}>
              <td style={tdStyle}>Total</td>
              {([0, 1] as const).map(i => (
                <td key={i} style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontFamily: 'monospace', fontSize: 12 }}>
                  {rows.reduce((s, r) => s + r.posts[i], 0)}
                </td>
              ))}
              <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontFamily: 'monospace', fontSize: 12, fontWeight: 700 }}>
                {rows.reduce((s, r) => s + r.change, 0) > 0
                  ? '+' + rows.reduce((s, r) => s + r.change, 0)
                  : rows.reduce((s, r) => s + r.change, 0)}
              </td>
              <td style={tdStyle} />
            </tr>
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Top Content table
// ─────────────────────────────────────────────────────────────────────────────

function TopContentTable({ rows }: { rows: MonthlyTopContentRow[] }) {
  if (rows.length === 0) return null;

  return (
    <Card title="Top Performing Content" subtitle={`${rows[0]?.dateLabel ? rows[0].dateLabel.split(' ').slice(0, 2).join(' ') : ''} · Top ${rows.length} by engagement`}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thStyle}></th>
              <th style={thStyle}>Date</th>
              <th style={{ ...thStyle, minWidth: 200 }}>Post Text</th>
              <th style={thStyle}>Platform</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Impressions</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Views</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Engagements</th>
              <th style={{ ...thStyle, minWidth: 120 }}>Engagement Rate</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.postId ?? row.rank}
                  style={{ borderBottom: '1px solid #f1f5f9' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#fafbff')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}>
                <td style={tdStyle}>
                  <span style={{
                    display: 'inline-block',
                    fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.1em',
                    background: 'linear-gradient(135deg, #fbbf24, #f59e0b)', color: '#fff',
                    padding: '2px 6px', borderRadius: 4,
                  }}>
                    #{row.rank}
                  </span>
                </td>
                <td style={{ ...tdStyle, fontVariantNumeric: 'tabular-nums', fontFamily: 'monospace', fontSize: 12, whiteSpace: 'nowrap' }}>
                  {row.dateLabel}
                </td>
                <td style={{ ...tdStyle, maxWidth: 260 }}>
                  <div style={{
                    fontSize: 12, color: '#64748b',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }} title={row.title}>
                    {row.title}
                  </div>
                </td>
                <td style={tdStyle}>
                  <PlatformPill platform={row.platform} showTikTokFull />
                </td>
                <td style={{ ...tdStyle, textAlign: 'right' }}><MetricCellFmt value={row.impressions} /></td>
                <td style={{ ...tdStyle, textAlign: 'right' }}><MetricCell value={row.views} /></td>
                <td style={{ ...tdStyle, textAlign: 'right' }}><MetricCellFmt value={row.engagements} /></td>
                <td style={{ ...tdStyle }}>
                  {row.er > 0
                    ? <ERBar value={row.er} color={PLATFORM_COLORS[row.platform] ?? '#3b82f6'} />
                    : <span style={{ color: '#94a3b8' }}>&#8212;</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

interface MonthlyReportProps {
  data: MonthlyReportData | null;
  isLoading: boolean;
  year: number;
  month: number;
  clientName?: string;
  onGenerateNarrative?: () => void;
  narrative?: { summary: string; topPerformers: string; insights: string } | null;
  isNarrativeLoading?: boolean;
}

export default function MonthlyReport({ data, isLoading, year, month, clientName = 'Client', onGenerateNarrative, narrative, isNarrativeLoading }: MonthlyReportProps) {
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
      <PlatformSummaryTable rows={data.platformRows} year={year} month={month} />
      <CTRTable rows={data.ctrRows} />
      <PostsDistributionTable rows={data.postsDistribution} year={year} month={month} />
      <TopContentTable rows={data.topContent} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility: export monthly report to window for Excel
// ─────────────────────────────────────────────────────────────────────────────

export function exposeMonthlyReportForExcel(data: MonthlyReportData) {
  (window as any).__samaMonthlyReport = data;
}
