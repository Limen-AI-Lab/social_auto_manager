import React, { useState, useEffect, useCallback } from 'react';
import {
  Linkedin,
  Instagram,
  Youtube,
  Twitter,
  Video,
  Facebook,
  Save,
} from 'lucide-react';
import { PlatformConfig, PlatformPromptConfig, DomainPromptOverrides } from '../../types';
import PlatformMatrixGrid from '../ContentMatrix/PlatformMatrixGrid';
import {
  loadGlobalPromptConfig,
  saveGlobalPromptConfig,
  loadDomainPromptConfig,
  saveDomainPromptConfig,
  getDefaultPlatformPromptConfig,
} from '../../services/promptConfig';

const PLATFORMS: {
  id: string;
  label: string;
  sublabel: string;
  Icon: React.ComponentType<{ size?: number; className?: string }>;
  iconBg: string;
  iconColor?: string;
}[] = [
  { id: 'linkedin', label: 'LinkedIn', sublabel: 'Professional Tone', Icon: Linkedin, iconBg: 'bg-blue-100', iconColor: 'text-[#0077b5]' },
  { id: 'instagram', label: 'Instagram', sublabel: 'Visual & Storytelling', Icon: Instagram, iconBg: 'bg-pink-100', iconColor: 'text-[#E4405F]' },
  { id: 'youtube', label: 'YouTube', sublabel: 'Video', Icon: Youtube, iconBg: 'bg-red-100', iconColor: 'text-[#FF0000]' },
  { id: 'twitter', label: 'X (Twitter)', sublabel: 'Concise Updates', Icon: Twitter, iconBg: 'bg-slate-100', iconColor: 'text-slate-800' },
  { id: 'tiktok', label: 'TikTok', sublabel: 'Viral Trends', Icon: Video, iconBg: 'bg-black', iconColor: 'text-white' },
  { id: 'facebook', label: 'Facebook', sublabel: 'Community & Engagement', Icon: Facebook, iconBg: 'bg-blue-100', iconColor: 'text-[#1877F2]' },
];

const TONE_OPTIONS = ['professional', 'casual', 'urgent', 'friendly', 'authoritative'];

function isTitleApplicable(platformId: string): boolean {
  return !['instagram', 'tiktok', 'twitter'].includes(platformId);
}

interface PromptsPageProps {
  /** Business unit id for loading/saving domain prompt config. */
  currentBusinessUnit: string;
  platformConfig?: PlatformConfig[];
  onShowToast?: (message: string) => void;
}

const PromptsPage: React.FC<PromptsPageProps> = ({ currentBusinessUnit, platformConfig = [], onShowToast }) => {
  const [activeTab, setActiveTab] = useState<'global' | 'domain'>('global');

  // Global Default: not tied to BU; load once on mount
  const [globalConfig, setGlobalConfig] = useState<Record<string, PlatformPromptConfig>>({});
  const [globalSaved, setGlobalSaved] = useState<Record<string, PlatformPromptConfig>>({});

  // Domain Specific: per BU; load when BU changes
  const [domainConfig, setDomainConfig] = useState<Record<string, DomainPromptOverrides>>({});
  const [domainSaved, setDomainSaved] = useState<Record<string, DomainPromptOverrides>>({});

  const enabledPlatforms = platformConfig
    .filter((p) => p.enabled)
    .sort((a, b) => a.order - b.order)
    .map((p) => p.platform);
  const columns =
    enabledPlatforms.length > 0
      ? enabledPlatforms.map((id) => {
          const meta = PLATFORMS.find((m) => m.id === id);
          if (!meta) return { platform: id, label: id, icon: null };
          return {
            platform: id,
            label: meta.label,
            icon: (
              <meta.Icon
                size={20}
                className={meta.iconColor ?? 'text-slate-800'}
              />
            ),
          };
        })
      : PLATFORMS.map(({ id, label, Icon, iconColor }) => ({
          platform: id,
          label,
          icon: <Icon size={20} className={iconColor ?? 'text-slate-800'} />,
        }));

  const loadGlobal = useCallback(() => {
    const loaded = loadGlobalPromptConfig();
    const merged: Record<string, PlatformPromptConfig> = {};
    PLATFORMS.forEach(({ id }) => {
      const defaultC = getDefaultPlatformPromptConfig(id);
      merged[id] = { ...defaultC, ...loaded[id], platform: id as PlatformPromptConfig['platform'] };
    });
    setGlobalConfig(merged);
    setGlobalSaved(merged);
  }, []);

  const loadDomain = useCallback(() => {
    const loaded = loadDomainPromptConfig(currentBusinessUnit);
    setDomainConfig(loaded);
    setDomainSaved(loaded);
  }, [currentBusinessUnit]);

  useEffect(() => {
    loadGlobal();
  }, [loadGlobal]);

  useEffect(() => {
    loadDomain();
  }, [loadDomain]);

  const getGlobalPlatform = (platformId: string): PlatformPromptConfig => {
    return (
      globalConfig[platformId] ?? {
        ...getDefaultPlatformPromptConfig(platformId),
        platform: platformId as PlatformPromptConfig['platform'],
      }
    );
  };

  const updateGlobal = (platformId: string, patch: Partial<PlatformPromptConfig>) => {
    setGlobalConfig((prev) => ({
      ...prev,
      [platformId]: { ...getGlobalPlatform(platformId), ...patch },
    }));
  };

  const getDomainPlatform = (platformId: string): DomainPromptOverrides => {
    return domainConfig[platformId] ?? { platform: platformId as DomainPromptOverrides['platform'] };
  };

  const updateDomain = (platformId: string, patch: Partial<DomainPromptOverrides>) => {
    setDomainConfig((prev) => ({
      ...prev,
      [platformId]: { ...getDomainPlatform(platformId), ...patch },
    }));
  };

  const handleCancelGlobal = () => {
    setGlobalConfig({ ...globalSaved });
  };

  const handleSaveGlobal = () => {
    saveGlobalPromptConfig(globalConfig);
    setGlobalSaved(globalConfig);
    onShowToast?.('Saved');
  };

  const handleCancelDomain = () => {
    setDomainConfig({ ...domainSaved });
  };

  const handleSaveDomain = () => {
    saveDomainPromptConfig(currentBusinessUnit, domainConfig);
    setDomainSaved(domainConfig);
    onShowToast?.('Saved');
  };

  const globalRows = [
    {
      id: 'title',
      label: 'Title / Headline',
      sublabel: 'Hook the audience',
      renderCell: (_i: number, platformId: string) => {
        const c = getGlobalPlatform(platformId);
        if (!isTitleApplicable(platformId)) {
          return (
            <div className="h-24 flex items-center justify-center bg-slate-50 rounded-lg border border-slate-100 border-dashed text-slate-400 text-xs italic">
              Not Applicable (Caption Only)
            </div>
          );
        }
        return (
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Prompt</label>
            <textarea
              value={c.titlePrompt ?? ''}
              onChange={(e) => updateGlobal(platformId, { titlePrompt: e.target.value })}
              placeholder="Write a compelling headline..."
              className="w-full h-20 p-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
            />
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] text-slate-500">Max Length</span>
              <input
                type="number"
                value={c.titleMaxLength ?? 100}
                onChange={(e) => updateGlobal(platformId, { titleMaxLength: parseInt(e.target.value, 10) || 100 })}
                className="w-16 px-2 py-1 text-xs border border-slate-200 rounded"
              />
              <span className="text-[10px] text-slate-500">characters</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-500">Tone</span>
              <select
                value={c.titleTone ?? 'professional'}
                onChange={(e) => updateGlobal(platformId, { titleTone: e.target.value })}
                className="text-xs border border-slate-200 rounded px-2 py-1"
              >
                {TONE_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        );
      },
    },
    {
      id: 'body',
      label: 'Body / Caption',
      sublabel: 'Main content text',
      stubClassName: 'pt-8',
      renderCell: (_i: number, platformId: string) => {
        const c = getGlobalPlatform(platformId);
        return (
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Prompt</label>
            <textarea
              value={c.bodyPrompt ?? ''}
              onChange={(e) => updateGlobal(platformId, { bodyPrompt: e.target.value })}
              placeholder="Write the main post body..."
              className="w-full h-24 p-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
            />
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] text-slate-500">Max Length</span>
              <input
                type="number"
                value={c.bodyMaxLength ?? 2200}
                onChange={(e) => updateGlobal(platformId, { bodyMaxLength: parseInt(e.target.value, 10) || 2200 })}
                className="w-16 px-2 py-1 text-xs border border-slate-200 rounded"
              />
              <span className="text-[10px] text-slate-500">characters</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-500">Tone</span>
              <select
                value={c.bodyTone ?? 'professional'}
                onChange={(e) => updateGlobal(platformId, { bodyTone: e.target.value })}
                className="text-xs border border-slate-200 rounded px-2 py-1"
              >
                {TONE_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={c.bodyIncludeCta ?? true}
                onChange={(e) => updateGlobal(platformId, { bodyIncludeCta: e.target.checked })}
                className="rounded border-slate-300"
              />
              <span className="text-[10px] text-slate-500">Include CTA</span>
              <input
                type="text"
                value={c.bodyCtaOptions ?? ''}
                onChange={(e) => updateGlobal(platformId, { bodyCtaOptions: e.target.value })}
                placeholder="Link in Bio / Book consultation"
                className="flex-1 min-w-0 text-xs border border-slate-200 rounded px-2 py-1"
              />
            </div>
          </div>
        );
      },
    },
    {
      id: 'hashtags',
      label: 'Hashtags',
      sublabel: 'Discoverability',
      stubClassName: 'pt-8',
      renderCell: (_i: number, platformId: string) => {
        const c = getGlobalPlatform(platformId);
        const alwaysInclude = c.hashtagAlwaysInclude ?? [];
        const pool = c.hashtagPool ?? [];
        const addTag = (list: string[], key: 'hashtagAlwaysInclude' | 'hashtagPool') => {
          const raw = prompt('Enter tag (with or without #)');
          if (!raw?.trim()) return;
          const tag = raw.trim().startsWith('#') ? raw.trim() : `#${raw.trim()}`;
          updateGlobal(platformId, { [key]: [...list, tag] });
        };
        return (
          <div className="space-y-3 text-xs">
            <div>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                ALWAYS INCLUDE
              </div>
              <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 border border-slate-200 rounded-lg min-h-[36px]">
                {alwaysInclude.map((tag, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs"
                  >
                    {tag}
                  </span>
                ))}
                <button
                  type="button"
                  onClick={() => addTag(alwaysInclude, 'hashtagAlwaysInclude')}
                  className="text-slate-500 hover:text-blue-600 text-xs"
                >
                  + add tag
                </button>
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">TAG POOL</div>
              <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 border border-slate-200 rounded-lg min-h-[36px]">
                {pool.map((tag, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded text-xs"
                  >
                    {tag}
                  </span>
                ))}
                <button
                  type="button"
                  onClick={() => addTag(pool, 'hashtagPool')}
                  className="text-slate-500 hover:text-blue-600 text-xs"
                >
                  + add tag
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-500">AI selects</span>
              <input
                type="number"
                value={c.hashtagAiSelectMin ?? 3}
                onChange={(e) => updateGlobal(platformId, { hashtagAiSelectMin: parseInt(e.target.value, 10) || 0 })}
                className="w-10 px-1 py-0.5 text-xs border border-slate-200 rounded"
              />
              <span className="text-[10px]">-</span>
              <input
                type="number"
                value={c.hashtagAiSelectMax ?? 5}
                onChange={(e) => updateGlobal(platformId, { hashtagAiSelectMax: parseInt(e.target.value, 10) || 0 })}
                className="w-10 px-1 py-0.5 text-xs border border-slate-200 rounded"
              />
              <span className="text-[10px] text-slate-500">tags from pool</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase">AI GENERATED</span>
              <input
                type="checkbox"
                checked={(c.hashtagAiGenerated ?? 0) > 0}
                onChange={(e) =>
                  updateGlobal(platformId, {
                    hashtagAiGenerated: e.target.checked ? (c.hashtagAiGenerated ?? 3) : 0,
                  })
                }
                className="rounded border-slate-300"
              />
              <span className="text-[10px] text-slate-500">Enable</span>
              <input
                type="number"
                value={c.hashtagAiGenerated ?? 3}
                onChange={(e) => updateGlobal(platformId, { hashtagAiGenerated: parseInt(e.target.value, 10) || 0 })}
                className="w-10 px-1 py-0.5 text-xs border border-slate-200 rounded"
              />
              <span className="text-[10px] text-slate-500">new tags</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-500">Total max:</span>
              <input
                type="number"
                value={c.hashtagTotalMax ?? 8}
                onChange={(e) => updateGlobal(platformId, { hashtagTotalMax: parseInt(e.target.value, 10) || 8 })}
                className="w-10 px-1 py-0.5 text-xs border border-slate-200 rounded"
              />
              <span className="text-[10px] text-slate-500">hashtags per post</span>
            </div>
          </div>
        );
      },
    },
  ];

  const domainRows = [
    {
      id: 'title',
      label: 'Title / Headline',
      sublabel: 'Override (optional)',
      renderCell: (_i: number, platformId: string) => {
        if (!isTitleApplicable(platformId)) {
          return (
            <div className="h-24 flex items-center justify-center bg-slate-50 rounded-lg border border-slate-100 border-dashed text-slate-400 text-xs italic">
              Not Applicable (Caption Only)
            </div>
          );
        }
        const c = getDomainPlatform(platformId);
        return (
          <div className="space-y-2">
            <textarea
              value={c.titlePrompt ?? ''}
              onChange={(e) => updateDomain(platformId, { titlePrompt: e.target.value })}
              placeholder="Override title prompt (optional)"
              className="w-full h-20 p-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
            />
          </div>
        );
      },
    },
    {
      id: 'body',
      label: 'Body / Caption',
      sublabel: 'Override (optional)',
      stubClassName: 'pt-8',
      renderCell: (_i: number, platformId: string) => {
        const c = getDomainPlatform(platformId);
        return (
          <div className="space-y-2">
            <textarea
              value={c.bodyPrompt ?? ''}
              onChange={(e) => updateDomain(platformId, { bodyPrompt: e.target.value })}
              placeholder="Override body prompt (optional)"
              className="w-full h-24 p-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
            />
          </div>
        );
      },
    },
    {
      id: 'hashtags',
      label: 'Hashtags',
      sublabel: 'Preset per BU',
      stubClassName: 'pt-8',
      renderCell: (_i: number, platformId: string) => {
        const c = getDomainPlatform(platformId);
        const alwaysInclude = c.hashtagAlwaysInclude ?? [];
        const pool = c.hashtagPool ?? [];
        const addTag = (list: string[], key: 'hashtagAlwaysInclude' | 'hashtagPool') => {
          const raw = prompt('Enter tag (with or without #)');
          if (!raw?.trim()) return;
          const tag = raw.trim().startsWith('#') ? raw.trim() : `#${raw.trim()}`;
          updateDomain(platformId, { [key]: [...list, tag] });
        };
        return (
          <div className="space-y-3 text-xs">
            <div>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                ALWAYS INCLUDE
              </div>
              <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 border border-slate-200 rounded-lg min-h-[36px]">
                {alwaysInclude.map((tag, idx) => (
                  <span key={idx} className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                    {tag}
                  </span>
                ))}
                <button
                  type="button"
                  onClick={() => addTag(alwaysInclude, 'hashtagAlwaysInclude')}
                  className="text-slate-500 hover:text-blue-600 text-xs"
                >
                  + add tag
                </button>
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">TAG POOL</div>
              <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 border border-slate-200 rounded-lg min-h-[36px]">
                {pool.map((tag, idx) => (
                  <span key={idx} className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded text-xs">
                    {tag}
                  </span>
                ))}
                <button
                  type="button"
                  onClick={() => addTag(pool, 'hashtagPool')}
                  className="text-slate-500 hover:text-blue-600 text-xs"
                >
                  + add tag
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-500">AI selects</span>
              <input
                type="number"
                value={c.hashtagAiSelectMin ?? 3}
                onChange={(e) => updateDomain(platformId, { hashtagAiSelectMin: parseInt(e.target.value, 10) })}
                className="w-10 px-1 py-0.5 text-xs border border-slate-200 rounded"
              />
              <span>-</span>
              <input
                type="number"
                value={c.hashtagAiSelectMax ?? 5}
                onChange={(e) => updateDomain(platformId, { hashtagAiSelectMax: parseInt(e.target.value, 10) })}
                className="w-10 px-1 py-0.5 text-xs border border-slate-200 rounded"
              />
              <span className="text-[10px] text-slate-500">tags from pool</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-500">Generate up to</span>
              <input
                type="number"
                value={c.hashtagAiGenerated ?? 3}
                onChange={(e) => updateDomain(platformId, { hashtagAiGenerated: parseInt(e.target.value, 10) })}
                className="w-10 px-1 py-0.5 text-xs border border-slate-200 rounded"
              />
              <span className="text-[10px] text-slate-500">new tags. Total max:</span>
              <input
                type="number"
                value={c.hashtagTotalMax ?? 8}
                onChange={(e) => updateDomain(platformId, { hashtagTotalMax: parseInt(e.target.value, 10) })}
                className="w-10 px-1 py-0.5 text-xs border border-slate-200 rounded"
              />
            </div>
          </div>
        );
      },
    },
  ];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-8 pt-6 pb-0 border-b border-slate-200 bg-slate-50">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('global')}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              activeTab === 'global'
                ? 'font-bold text-blue-600 bg-white border-t border-x border-slate-200 shadow-sm relative top-[1px]'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Global Default
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('domain')}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              activeTab === 'domain'
                ? 'font-bold text-blue-600 bg-white border-t border-x border-slate-200 shadow-sm relative top-[1px]'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Domain Specific
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        {activeTab === 'global' && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Set default prompts per platform. These do not change when switching Business Unit.
            </p>
            <div className="overflow-x-auto">
              <PlatformMatrixGrid
                firstColumnHeader="Content Element"
                columns={columns}
                rows={globalRows}
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <button
                type="button"
                onClick={handleCancelGlobal}
                className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveGlobal}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-500"
              >
                <Save size={16} />
                Save Changes
              </button>
            </div>
          </div>
        )}

        {activeTab === 'domain' && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Optional overrides and preset hashtags for this Business Unit. Empty = use Global Default.
            </p>
            <div className="overflow-x-auto">
              <PlatformMatrixGrid
                firstColumnHeader="Content Element"
                columns={columns}
                rows={domainRows}
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <button
                type="button"
                onClick={handleCancelDomain}
                className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveDomain}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-500"
              >
                <Save size={16} />
                Save Changes
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PromptsPage;
