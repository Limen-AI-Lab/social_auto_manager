import type { PlatformPromptConfig, DomainPromptOverrides } from '../types';

export const SAMA_GLOBAL_PROMPT_CONFIG_KEY = 'sama_global_prompt_config';
export const SAMA_DOMAIN_PROMPT_CONFIG_KEY = 'sama_domain_prompt_config';

/** Default prompt config for a platform (Global Default initial values). */
export function getDefaultPlatformPromptConfig(
  platform: string
): PlatformPromptConfig {
  const base: PlatformPromptConfig = {
    platform: platform as PlatformPromptConfig['platform'],
    titleMaxLength: platform === 'twitter' ? 280 : 100,
    titleTone: 'professional',
    bodyMaxLength: platform === 'twitter' ? 280 : 2200,
    bodyTone: 'professional',
    bodyIncludeCta: true,
    bodyCtaOptions: 'Link in Bio / Book consultation',
    hashtagAlwaysInclude: [],
    hashtagPool: [],
    hashtagAiSelectMin: 3,
    hashtagAiSelectMax: 5,
    hashtagAiGenerated: 3,
    hashtagTotalMax: 8,
  };
  switch (platform) {
    case 'linkedin':
      return {
        ...base,
        titlePrompt: 'Write a compelling headline that hooks professionals. Focus on ROI and risk management benefits.',
        bodyPrompt: 'Educate professionals. Use data-driven insights. Structure with hook, 3 key points, CTA.',
      };
    case 'instagram':
    case 'tiktok':
    case 'twitter':
      return {
        ...base,
        titlePrompt: '',
        bodyPrompt:
          platform === 'twitter'
            ? 'Write concise, punchy copy. Use line breaks. Max 280 characters. Include 2-3 relevant hashtags.'
            : 'Visual storytelling, emotive tone. Use hook, story, CTA. Emoji-friendly.',
      };
    case 'youtube':
      return {
        ...base,
        titlePrompt: 'Write a clear, searchable video title. Include key topic and hook. Max 100 characters.',
        bodyPrompt: 'Video description: hook, key points, timestamps if applicable, CTA. Suited for video.',
      };
    case 'facebook':
      return {
        ...base,
        titlePrompt: 'Write an engaging headline for community. Focus on value and conversation.',
        bodyPrompt: 'Community-focused, informative. Use hook, value, question or CTA to encourage engagement.',
      };
    default:
      return { ...base, titlePrompt: 'Write a compelling headline.', bodyPrompt: 'Write the main post body.' };
  }
}
export function loadGlobalPromptConfig(): Record<string, PlatformPromptConfig> {
  try {
    const raw = localStorage.getItem(SAMA_GLOBAL_PROMPT_CONFIG_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, PlatformPromptConfig>;
    }
  } catch (_) {}
  return {};
}

export function saveGlobalPromptConfig(data: Record<string, PlatformPromptConfig>): void {
  try {
    localStorage.setItem(SAMA_GLOBAL_PROMPT_CONFIG_KEY, JSON.stringify(data));
  } catch (_) {}
}

export function loadDomainPromptConfig(buType: string): Record<string, DomainPromptOverrides> {
  try {
    const raw = localStorage.getItem(SAMA_DOMAIN_PROMPT_CONFIG_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && parsed[buType]) {
      return parsed[buType] as Record<string, DomainPromptOverrides>;
    }
  } catch (_) {}
  return {};
}

export function loadDomainPromptConfigByBusinessUnit(): Record<string, Record<string, DomainPromptOverrides>> {
  try {
    const raw = localStorage.getItem(SAMA_DOMAIN_PROMPT_CONFIG_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, Record<string, DomainPromptOverrides>>;
    }
  } catch (_) {}
  return {};
}

export function saveDomainPromptConfig(
  buType: string,
  data: Record<string, DomainPromptOverrides>
): void {
  try {
    const all = loadDomainPromptConfigByBusinessUnit();
    all[buType] = data;
    localStorage.setItem(SAMA_DOMAIN_PROMPT_CONFIG_KEY, JSON.stringify(all));
  } catch (_) {}
}
