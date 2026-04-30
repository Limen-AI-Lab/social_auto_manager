// ============================================================
// SAMA - Post Detail Modal (Stub)
// ============================================================

import React from 'react';
import type { PostWithAnalytics } from '../services/postAnalyticsData';

interface PostDetailModalProps {
  post: PostWithAnalytics | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function PostDetailModal({ post, isOpen, onClose }: PostDetailModalProps) {
  if (!isOpen || !post) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{ background: '#fff', borderRadius: 12, padding: 24, maxWidth: 480, width: '90%' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontWeight: 700, fontSize: 16 }}>Post Detail</h3>
          <button onClick={onClose} style={{ padding: '4px 8px', cursor: 'pointer' }}>✕</button>
        </div>
        <p style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>
          {post.text || 'No content'}
        </p>
        <p style={{ fontSize: 11, color: '#94a3b8' }}>
          Platforms: {post.platforms.join(', ')}
        </p>
      </div>
    </div>
  );
}
