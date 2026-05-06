import React, { useState } from 'react';
import { Send, Loader2 } from 'lucide-react';
import type { BusinessUnit } from '../types';
import { publishToSocialMedia } from '../services/socialPublish';

const PLATFORMS = [
  { id: 'linkedin' as const, label: 'LinkedIn' },
  { id: 'facebook' as const, label: 'Facebook' },
  { id: 'twitter' as const, label: 'X (Twitter)' },
  { id: 'instagram' as const, label: 'Instagram' },
  { id: 'tiktok' as const, label: 'TikTok' },
  { id: 'youtube' as const, label: 'YouTube' },
] as const;

interface SimplePostProps {
  businessUnits: BusinessUnit[];
  onShowToast: (msg: string) => void;
}

export default function SimplePost({ businessUnits, onShowToast }: SimplePostProps) {
  const [selectedBuId, setSelectedBuId] = useState<string>('');
  const [postText, setPostText] = useState('');
  const [imageUrlsText, setImageUrlsText] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<string>>(new Set(PLATFORMS.map((p) => p.id)));
  const [sending, setSending] = useState(false);

  const bu = businessUnits.find((b) => b.id === selectedBuId);
  const profileCode = bu?.profileCode?.trim();

  const togglePlatform = (id: string) => {
    setSelectedPlatforms((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSend = async () => {
    if (!profileCode) {
      onShowToast('Select a business unit with Profile Key configured in Settings.');
      return;
    }
    const text = postText.trim();
    if (!text) {
      onShowToast('Enter post text.');
      return;
    }
    const platforms = Array.from(selectedPlatforms);
    if (platforms.length === 0) {
      onShowToast('Select at least one platform.');
      return;
    }

    const imageUrls = imageUrlsText
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && (s.startsWith('http://') || s.startsWith('https://')));

    setSending(true);
    try {
      const requests = [{
        profileKey: profileCode,
        businessUnit: bu?.label,
        posts: [{
          platforms,
          post: text,
          ...(imageUrls.length > 0 ? { mediaUrls: imageUrls } : {}),
          ...(platforms.includes('youtube') ? { youTubeOptions: { title: text.slice(0, 100), visibility: 'public' as const } } : {}),
        }],
      }];

      const result = await publishToSocialMedia({ requests });

      if (result.success) {
        onShowToast('Post sent to social media.');
        setPostText('');
        setImageUrlsText('');
      } else {
        onShowToast(result.error ?? 'Failed to send post.');
      }
    } catch (e) {
      onShowToast(e instanceof Error ? e.message : 'Failed to send post.');
    } finally {
      setSending(false);
    }
  };

  const visibleBusinessUnits = businessUnits.filter((b) => b.profileCode?.trim());

  return (
    <div className="flex-1 bg-slate-50 p-6 overflow-y-auto">
      <div className="max-w-2xl mx-auto">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Simple Post</h1>
          <p className="text-slate-500 mt-1">Send a text post (with optional images) to social platforms without a video.</p>
        </header>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Business unit</label>
            <select
              value={selectedBuId}
              onChange={(e) => setSelectedBuId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">Select business unit</option>
              {visibleBusinessUnits.map((b) => (
                <option key={b.id} value={b.id}>{b.label}</option>
              ))}
              {visibleBusinessUnits.length === 0 && (
                <option value="" disabled>No business units with Profile Key</option>
              )}
            </select>
            {businessUnits.length > 0 && visibleBusinessUnits.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">Add a Profile Key in Settings for at least one business unit.</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Post text</label>
            <textarea
              value={postText}
              onChange={(e) => setPostText(e.target.value)}
              placeholder="Write your post..."
              rows={5}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Image URLs (optional)</label>
            <textarea
              value={imageUrlsText}
              onChange={(e) => setImageUrlsText(e.target.value)}
              placeholder="One URL per line or comma-separated. Leave empty for text-only."
              rows={2}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Platforms</label>
            <div className="flex flex-wrap gap-3">
              {PLATFORMS.map((p) => (
                <label key={p.id} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedPlatforms.has(p.id)}
                    onChange={() => togglePlatform(p.id)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-700">{p.label}</span>
                </label>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={handleSend}
            disabled={sending || !profileCode || !postText.trim() || selectedPlatforms.size === 0}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-400 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
          >
            {sending ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Sending…
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                Send post
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
