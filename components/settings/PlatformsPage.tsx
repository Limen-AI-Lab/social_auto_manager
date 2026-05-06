import React from 'react';
import { 
  Linkedin, 
  Instagram, 
  Youtube, 
  Twitter, 
  Video, 
  Facebook,
  GripVertical,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';
import { PlatformConfig } from '../../types';

const PLATFORM_META: Record<string, { name: string; icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>; color: string }> = {
  linkedin: { name: 'LinkedIn', icon: Linkedin, color: '#0077b5' },
  instagram: { name: 'Instagram', icon: Instagram, color: '#E4405F' },
  youtube: { name: 'YouTube', icon: Youtube, color: '#FF0000' },
  twitter: { name: 'X (Twitter)', icon: Twitter, color: '#000000' },
  tiktok: { name: 'TikTok', icon: Video, color: '#000000' },
  facebook: { name: 'Facebook', icon: Facebook, color: '#1877F2' },
};

interface PlatformsPageProps {
  currentBusinessUnit?: string;
  platformConfig: PlatformConfig[];
  onPlatformConfigChange?: (config: PlatformConfig[]) => void;
}

const PlatformsPage: React.FC<PlatformsPageProps> = ({ currentBusinessUnit, platformConfig, onPlatformConfigChange }) => {
  const sortedConfig = [...platformConfig].sort((a, b) => a.order - b.order);

  const handleToggle = (platformId: string) => {
    if (!onPlatformConfigChange) return;
    const next = platformConfig.map((p) =>
      p.platform === platformId ? { ...p, enabled: !p.enabled } : p
    );
    onPlatformConfigChange(next);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-4xl">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Platforms</h2>
            <p className="text-sm text-slate-600">
              Enable or disable social media platforms and manage their display order
            </p>
          </div>

          <div className="space-y-3">
            {sortedConfig.map((entry, index) => {
              const meta = PLATFORM_META[entry.platform];
              if (!meta) return null;
              const IconComponent = meta.icon;
              return (
                <div
                  key={entry.platform}
                  className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 flex items-center gap-4 hover:shadow-md transition-shadow"
                >
                  <div className="cursor-move text-slate-400 hover:text-slate-600">
                    <GripVertical size={20} />
                  </div>
                  
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center`} style={{ backgroundColor: `${meta.color}15` }}>
                    <IconComponent size={24} style={{ color: meta.color }} />
                  </div>
                  
                  <div className="flex-1">
                    <h3 className="font-semibold text-slate-900">{meta.name}</h3>
                    <p className="text-xs text-slate-500">Order: {index + 1}</p>
                  </div>
                  
                  <button
                    type="button"
                    onClick={() => handleToggle(entry.platform)}
                    className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors"
                  >
                    {entry.enabled ? (
                      <>
                        <ToggleRight size={24} className="text-green-600" />
                        <span className="text-sm font-medium text-green-600">Enabled</span>
                      </>
                    ) : (
                      <>
                        <ToggleLeft size={24} className="text-slate-400" />
                        <span className="text-sm font-medium text-slate-400">Disabled</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> Platform settings can be configured globally or per business unit. 
              {currentBusinessUnit && ` Currently viewing settings for: ${currentBusinessUnit}`}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlatformsPage;
