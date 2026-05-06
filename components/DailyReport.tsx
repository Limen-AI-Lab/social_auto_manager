import React, { useState, useRef } from 'react';
import { Copy, CheckCircle2, Loader2, Calendar } from 'lucide-react';
import type { ContentProject, BusinessUnit } from '../types';
import { getAyrshareHistory, extractLinksByPlatform, type HistoryPost } from '../services/ayrshareHistory';

const SOCIAL_PLATFORMS = ['linkedin', 'instagram', 'youtube', 'x', 'tiktok', 'facebook'] as const;
const PLATFORM_LABELS: Record<string, string> = {
  linkedin: 'LinkedIn',
  instagram: 'Instagram',
  youtube: 'Youtube',
  x: 'X',
  twitter: 'X',
  tiktok: 'TikTok',
  facebook: 'Facebook',
};

interface DailyReportProps {
  projects: ContentProject[];
  businessUnits: BusinessUnit[];
  onShowToast: (msg: string) => void;
}

export default function DailyReport({ projects, businessUnits, onShowToast }: DailyReportProps) {
  const [reportDate, setReportDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  });
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(new Set());
  const [links, setLinks] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  const toggleProject = (id: string) => {
    setSelectedProjectIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedProjects = projects.filter((p) => selectedProjectIds.has(p.id));
  const profileKeysFromSelection = Array.from(
    new Set(
      selectedProjects
        .map((p) => businessUnits.find((bu) => bu.id === p.businessUnit)?.profileCode)
        .filter((key): key is string => Boolean(key?.trim()))
    )
  );

  const fetchLinks = async () => {
    const profileKeys =
      profileKeysFromSelection.length > 0
        ? profileKeysFromSelection
        : businessUnits
            .map((bu) => bu.profileCode)
            .filter((key): key is string => Boolean(key?.trim()));

    if (profileKeys.length === 0) {
      onShowToast('No profile keys configured. Add Profile Key in Settings for at least one business unit.');
      return;
    }

    setLoading(true);
    setLinks({});
    try {
      const [y, m, d] = reportDate.split('-').map(Number);
      const start = new Date(y, m - 1, d, 0, 0, 0, 0);
      const end = new Date(y, m - 1, d, 23, 59, 59, 999);
      const startDate = start.toISOString();
      const endDate = end.toISOString();

      const result = await getAyrshareHistory({
        profileKeys,
        startDate,
        endDate,
        limit: 100,
      });

      if (!result.success) {
        onShowToast(result.error ?? 'Failed to fetch history');
        return;
      }

      const posts = (result.posts ?? []) as HistoryPost[];
      const extracted = extractLinksByPlatform(posts);
      const normalized: Record<string, string> = {};
      for (const [platform, url] of Object.entries(extracted)) {
        const key = platform === 'twitter' ? 'x' : platform;
        normalized[key] = url;
      }
      setLinks(normalized);
      const count = Object.keys(normalized).length;
      onShowToast(count > 0 ? `Fetched ${count} link(s) from AyrShare.` : 'No posts found for this date.');
    } catch (e) {
      onShowToast(e instanceof Error ? e.message : 'Failed to fetch links');
    } finally {
      setLoading(false);
    }
  };

  const [year, month, day] = reportDate.split('-').map(Number);
  const localDate = new Date(year, month - 1, day);
  const formattedDate = localDate.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const hasSocialLinks = SOCIAL_PLATFORMS.some((p) => links[p]);

  const handleCopy = async () => {
    if (!previewRef.current) return;
    try {
      const html = previewRef.current.innerHTML;
      const text = previewRef.current.innerText;
      const clipboardItem = new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([text], { type: 'text/plain' }),
      });
      await navigator.clipboard.write([clipboardItem]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      onShowToast('Copied to clipboard');
    } catch {
      const range = document.createRange();
      range.selectNodeContents(previewRef.current);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      document.execCommand('copy');
      selection?.removeAllRanges();
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      onShowToast('Copied to clipboard');
    }
  };

  const publishedOrReady = projects.filter(
    (p) => p.status === 'published' || p.status === 'ready'
  );

  return (
    <div className="flex-1 bg-slate-50 p-6 overflow-y-auto">
      <div className="max-w-6xl mx-auto">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Daily Report</h1>
          <p className="text-slate-500 mt-1">
            Select uploads, fetch posted links from AyrShare, then copy the email-style report.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: date, project selection, fetch */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
              <h2 className="text-lg font-semibold text-slate-800 mb-4">Report details</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Report date</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="date"
                      value={reportDate}
                      onChange={(e) => setReportDate(e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Select uploads (optional)
                  </label>
                  <p className="text-xs text-slate-500 mb-2">
                    Choose projects to scope which business units to fetch links for. If none selected, all units with Profile Key are used.
                  </p>
                  <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
                    {publishedOrReady.length === 0 ? (
                      <div className="px-3 py-4 text-sm text-slate-500">No published or saved projects yet.</div>
                    ) : (
                      publishedOrReady.map((p) => {
                        const bu = businessUnits.find((b) => b.id === p.businessUnit);
                        const checked = selectedProjectIds.has(p.id);
                        return (
                          <label
                            key={p.id}
                            className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleProject(p.id)}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm text-slate-800 truncate flex-1">{p.videoName}</span>
                            {bu && (
                              <span className="text-xs text-slate-500 shrink-0">{bu.label}</span>
                            )}
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={fetchLinks}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-400 text-white font-medium rounded-lg transition-colors"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Fetching links…
                    </>
                  ) : (
                    'Fetch links from AyrShare'
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Right: email preview + copy */}
          <div className="lg:col-span-7">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 sticky top-6 flex flex-col max-h-[calc(100vh-8rem)]">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-800">Email preview</h2>
                <button
                  type="button"
                  onClick={handleCopy}
                  disabled={!hasSocialLinks}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {copied ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                  {copied ? 'Copied!' : 'Copy email'}
                </button>
              </div>
              <div className="flex-1 overflow-auto p-6 bg-slate-50 rounded-lg border border-slate-200 min-h-[200px]">
                <div
                  ref={previewRef}
                  className="text-slate-900"
                  style={{ fontFamily: 'Arial, sans-serif', fontSize: '11pt', lineHeight: '1.5' }}
                >
                  <p style={{ margin: '0 0 1em 0' }}>Dear all,</p>
                  <p style={{ margin: '0 0 1em 0' }}>
                    Please find a brief summary of posts for BAM on {formattedDate} (Yesterday), with approved blog.
                  </p>
                  {hasSocialLinks ? (
                    <>
                      <p style={{ margin: '0 0 0.5em 0' }}>
                        <strong>Repurposed Digital Avatar video posted also on:</strong>
                      </p>
                      <ol style={{ margin: '0 0 1em 0', paddingLeft: '2em' }}>
                        {SOCIAL_PLATFORMS.map((platform) => {
                          const url = links[platform];
                          if (!url) return null;
                          const label = PLATFORM_LABELS[platform] ?? platform;
                          return (
                            <li key={platform} style={{ marginBottom: '0.25em' }}>
                              <a href={url} style={{ color: '#0563C1', textDecoration: 'underline' }}>
                                {label}
                              </a>
                            </li>
                          );
                        })}
                      </ol>
                    </>
                  ) : (
                    <p style={{ margin: '0 0 1em 0', color: '#999', fontStyle: 'italic' }}>
                      Select uploads and report date, then click “Fetch links from AyrShare” to fill links.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
