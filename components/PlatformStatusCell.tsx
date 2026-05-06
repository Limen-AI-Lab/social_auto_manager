import React from 'react';
import { PlatformContent } from '../types';
import {
  Linkedin,
  Facebook,
  Twitter,
  Instagram,
  Youtube,
  Video,
} from 'lucide-react';

interface PlatformStatusCellProps {
  generatedContent: PlatformContent[];
  projectStatus?: 'processing' | 'ready' | 'published' | 'failed';
}

const getPlatformIcon = (platform: string, size = 20) => {
  switch (platform) {
    case 'linkedin':
      return <Linkedin className="text-[#0077b5]" size={size} />;
    case 'facebook':
      return <Facebook className="text-[#1877F2]" size={size} />;
    case 'twitter':
      return <Twitter className="text-black" size={size} />;
    case 'instagram':
      return <Instagram className="text-[#E4405F]" size={size} />;
    case 'tiktok':
      return <Video className="text-black" size={size} />;
    case 'youtube':
      return <Youtube className="text-[#FF0000]" size={size} />;
    default:
      return <Video size={size} />;
  }
};

const getDotColor = (
  platformStatus: PlatformContent['status'],
  projectStatus: PlatformStatusCellProps['projectStatus']
) => {
  if (projectStatus === 'failed') return 'bg-red-500';
  switch (platformStatus) {
    case 'published':
      return 'bg-green-500';
    case 'scheduled':
      return 'bg-amber-500';
    case 'draft':
    default:
      return 'bg-slate-400';
  }
};

const PlatformStatusCell: React.FC<PlatformStatusCellProps> = ({
  generatedContent,
  projectStatus,
}) => {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {generatedContent.map((pc) => (
        <div
          key={pc.platform}
          className="relative inline-flex flex-shrink-0"
          title={`${pc.platform}: ${pc.status}`}
        >
          {getPlatformIcon(pc.platform)}
          <span
            className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-white ${getDotColor(pc.status, projectStatus)}`}
            aria-hidden
          />
        </div>
      ))}
    </div>
  );
};

export default PlatformStatusCell;
