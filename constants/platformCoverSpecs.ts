import type { PlatformContent } from '../types';

export type PlatformKey = PlatformContent['platform'];

export interface PlatformCoverSpec {
  /** Recommended width in pixels (e.g. 1080) */
  width: number;
  /** Recommended height in pixels (e.g. 1920) */
  height: number;
  /** CSS aspect-ratio value for strict layout (e.g. "9/16", "4/5", "16/9") */
  aspectRatio: string;
}

/** Strict platform cover specs per product rules. Placeholder and cover must use these dimensions. */
const specs: Record<PlatformKey, PlatformCoverSpec> = {
  youtube: { width: 1080, height: 1920, aspectRatio: '9/16' },   // YouTube Shorts
  facebook: { width: 1080, height: 1350, aspectRatio: '4/5' },  // Facebook (Feed)
  linkedin: { width: 1920, height: 1080, aspectRatio: '16/9' },  // LinkedIn
  twitter: { width: 1280, height: 720, aspectRatio: '16/9' },   // X (Twitter)
  instagram: { width: 1080, height: 1350, aspectRatio: '4/5' },  // same as Facebook
  tiktok: { width: 1080, height: 1920, aspectRatio: '9/16' },    // same as YouTube Shorts
};

export function getPlatformCoverSpec(platform: PlatformKey): PlatformCoverSpec {
  return specs[platform] ?? specs.linkedin;
}
