export type AppView = 'dashboard' | 'distribution-history' | 'recent-generated' | 'daily-report' | 'simple-post' | 'editor' | 'settings';

/** BU id or 'all' for sidebar/filter selection. */
export type BusinessUnitFilter = string;

export interface BusinessUnit {
  id: string;
  label: string;
  icon: string; // Icon name from lucide-react
  /** AyrShare profile key per BU; used as profileKey when calling publish-to-social-media. */
  profileCode?: string;
  logo?: string; // Image URL shown before tab name in sidebars
}

export interface PlatformContent {
  platform: 'linkedin' | 'facebook' | 'twitter' | 'instagram' | 'tiktok' | 'youtube';
  title: string;
  content: string;
  hashtags: string[];
  status: 'draft' | 'scheduled' | 'published';
  selected: boolean;
  /** Per-platform cover image URL (user upload or generated). */
  coverUrl?: string;
}

export interface ContentProject {
  id: string;
  videoName: string;
  uploadDate: string;
  /** Business unit id (links to BusinessUnit.id). */
  businessUnit: string;
  status: 'processing' | 'ready' | 'published' | 'failed';
  thumbnailUrl: string;
  /** Video first-frame image URL for default cover and platform cropping. */
  sourceCoverUrl?: string;
  /** Video file URL in Supabase Storage (persisted). */
  videoUrl?: string;
  generatedContent: PlatformContent[];
  createdAt?: string; // ISO timestamp for "new" label logic
  updatedAt?: string; // ISO timestamp for status display
}

export interface UserPreferences {
  tone: 'professional' | 'casual' | 'urgent';
  language: 'en-ZA' | 'af-ZA' | 'zu-ZA';
}

// Settings related types
export type SettingsPage = 'prompts' | 'platforms' | 'api' | 'team';

/** Per-platform prompt config (Global Default; keyed by platform only, not BU). */
export interface PlatformPromptConfig {
  platform: PlatformContent['platform'];
  titlePrompt?: string;
  titleMaxLength?: number;
  titleTone?: string;
  bodyPrompt?: string;
  bodyMaxLength?: number;
  bodyTone?: string;
  bodyIncludeCta?: boolean;
  bodyCtaOptions?: string;
  hashtagAlwaysInclude?: string[];
  hashtagPool?: string[];
  hashtagAiSelectMin?: number;
  hashtagAiSelectMax?: number;
  hashtagAiGenerated?: number;
  hashtagTotalMax?: number;
}

/** Per-BU per-platform overrides (Domain Specific). Empty = use Global Default. */
export interface DomainPromptOverrides {
  platform: PlatformContent['platform'];
  titlePrompt?: string;
  bodyPrompt?: string;
  hashtagPrompt?: string;
  hashtagAlwaysInclude?: string[];
  hashtagPool?: string[];
  hashtagAiSelectMin?: number;
  hashtagAiSelectMax?: number;
  hashtagAiGenerated?: number;
  hashtagTotalMax?: number;
}

export interface PlatformConfig {
  platform: 'linkedin' | 'facebook' | 'twitter' | 'instagram' | 'tiktok' | 'youtube';
  enabled: boolean;
  order: number;
  systemPrompt?: string;
  titlePrompt?: string;
  bodyPrompt?: string;
  hashtagPrompt?: string;
}

export interface APIConfig {
  airshare?: {
    apiKey: string;
    connected: boolean;
    lastSync?: string;
  };
  [platform: string]: {
    apiKey: string;
    connected: boolean;
  } | undefined;
}

/** Distribution webhook (e.g. n8n): URL and multipart form field names. */
export interface WebhookConfig {
  webhookUrl: string;
  webhookPayloadField?: string;
  webhookVideoField?: string;
}

/** Payload sent to distribution webhook: one request per business unit, posts = selected platform contents. */
export interface WebhookRequestItem {
  businessUnit: string;
  posts: {
    platforms: string[];
    post: string;
    mediaUrls?: string[];
    youTubeOptions?: { title: string; visibility: 'private' | 'public' | 'unlisted' };
  }[];
}

/** Request item for publish-to-social-media Edge Function; profileKey = bu.profileCode. */
export interface SocialPublishRequestItem {
  profileKey: string;
  businessUnit?: string; // optional, for display/logging
  posts: {
    platforms: string[];
    post: string;
    mediaUrls?: string[];
    youTubeOptions?: { title: string; visibility?: 'private' | 'public' | 'unlisted' };
  }[];
}

export type UserRole = 'super_admin' | 'admin' | 'editor' | 'viewer';

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
}

/** Profile row from Supabase public.profiles (matches auth user). */
export interface Profile {
  id: string;
  email: string;
  display_name: string;
  role: UserRole;
  created_at?: string;
  updated_at?: string;
}
