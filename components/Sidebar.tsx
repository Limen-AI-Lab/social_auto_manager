import React from 'react';
import { 
  Building2, 
  Plane, 
  ShieldCheck, 
  TestTube,
  LayoutGrid, 
  Settings, 
  LogOut,
  PlusCircle,
  History,
  Sparkles,
  Layers,
  Check,
  FileText,
  Send
} from 'lucide-react';
import { BusinessUnitFilter, BusinessUnit, AppView } from '../types';
import { useAuth } from '../context/AuthContext';

interface SidebarProps {
  currentBusinessUnitFilter: BusinessUnitFilter;
  currentView: AppView;
  editorSourceView?: AppView | null;
  disableBusinessUnitSwitch?: boolean;
  businessUnits: BusinessUnit[];
  /** When set (editor/viewer), only these BU ids are shown; null = show all (super_admin/admin) */
  allowedBuIds?: string[] | null;
  onSwitchBusinessUnit: (bu: BusinessUnitFilter) => void;
  onNavigate: (view: AppView) => void;
  onNewPost: () => void;
}

// Icon mapping function
const getIconComponent = (iconName: string): React.ComponentType<{ size?: number; className?: string }> => {
  const iconMap: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
    Building2,
    Plane,
    ShieldCheck,
    TestTube,
  };
  return iconMap[iconName] || Building2;
};

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  editor: 'Editor',
  viewer: 'Viewer',
};

const ROLE_BADGE_CLASS: Record<string, string> = {
  super_admin: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
  admin: 'bg-red-500/20 text-red-400 border-red-500/40',
  editor: 'bg-blue-500/20 text-blue-400 border-blue-500/40',
  viewer: 'bg-slate-500/20 text-slate-400 border-slate-500/40',
};

const Sidebar: React.FC<SidebarProps> = ({ 
  currentBusinessUnitFilter, 
  currentView, 
  editorSourceView = null,
  disableBusinessUnitSwitch = false,
  businessUnits, 
  allowedBuIds = null,
  onSwitchBusinessUnit, 
  onNavigate, 
  onNewPost 
}) => {
  const { role, profile, user, isAuthConfigured, signOut } = useAuth();
  const canAccessSettings = role === 'super_admin' || role === 'admin';

  // For editor/viewer, only show BUs they have access to; otherwise show all
  const visibleBusinessUnits = allowedBuIds === null
    ? businessUnits
    : businessUnits.filter((bu) => allowedBuIds.includes(bu.id));

  // Menu items configuration
  const menuItems: { id: AppView; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutGrid },
    { id: 'recent-generated', label: 'Recent Generated', icon: Sparkles },
    { id: 'distribution-history', label: 'Distribution History', icon: History },
    { id: 'daily-report', label: 'Daily Report', icon: FileText },
    { id: 'simple-post', label: 'Simple Post', icon: Send },
  ];

  return (
    <div className="w-64 h-screen bg-[#0F172A] text-slate-300 flex flex-col border-r border-slate-800 flex-shrink-0">
      {/* Brand */}
      <div className="p-6 flex items-center gap-3">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">
          S
        </div>
        <span className="text-white font-bold text-xl tracking-tight">SAMA</span>
      </div>

      {/* BUSINESS UNITS Section - fills space down to MENU, internal scroll + bottom fade */}
      <div className="px-4 flex-1 flex flex-col min-h-0">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 px-2 flex-shrink-0">BUSINESS UNITS</h3>
        <div className="relative flex-1 min-h-0">
          <div className="absolute inset-0 space-y-2 overflow-y-auto pr-1">
            {/* All Units Option - disabled only when disableBusinessUnitSwitch (e.g. Recent Generated) */}
            <button
            onClick={() => !disableBusinessUnitSwitch && onSwitchBusinessUnit('all')}
            disabled={disableBusinessUnitSwitch}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
              disableBusinessUnitSwitch
                ? 'text-slate-500 cursor-not-allowed opacity-70'
                : currentBusinessUnitFilter === 'all' 
                  ? 'bg-slate-800 text-white' 
                  : 'hover:bg-slate-800/50 hover:text-white text-slate-400'
            }`}
            >
              <Layers size={20} />
              <span className="text-sm font-medium">All Units</span>
            </button>

            {/* Individual Business Units - remain clickable when disableBusinessUnitSwitch (Recent Generated) */}
            {visibleBusinessUnits.map((bu) => {
            const IconComponent = getIconComponent(bu.icon);
            const isSelected = currentBusinessUnitFilter === bu.id;
              return (
                <div
                  key={bu.id}
                  className={`relative rounded-lg transition-all duration-200 ${
                    isSelected ? 'bg-[#222E3C] shadow-lg' : 'hover:bg-slate-800/50'
                  }`}
                >
                  <button
                    onClick={() => onSwitchBusinessUnit(bu.id)}
                    className="w-full flex items-center gap-3 px-4 py-3"
                  >
                    {isSelected && (
                      <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0" />
                    )}
                    {bu.logo ? (
                      <img
                        src={bu.logo}
                        alt=""
                        className="w-5 h-5 rounded object-cover flex-shrink-0"
                      />
                    ) : (
                      (!isSelected && <IconComponent size={18} className="text-slate-400 flex-shrink-0" />)
                    )}
                    <div className="flex-1 text-left">
                      <div className={`text-sm font-medium ${isSelected ? 'text-white' : 'text-slate-400'}`}>
                        {bu.label}
                      </div>
                    </div>
                    {isSelected && (
                      <Check size={16} className="text-slate-400 flex-shrink-0" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
          {/* Bottom fade gradient so list fades into sidebar background */}
          <div
            className="absolute bottom-0 left-0 right-0 h-[60px] pointer-events-none flex-shrink-0"
            style={{ background: 'linear-gradient(to bottom, transparent, #0F172A)' }}
            aria-hidden
          />
        </div>
      </div>

      {/* Bottom block: Menu + New Content + Settings/Sign Out - stable at bottom */}
      <div className="flex-shrink-0">
      {/* Divider and spacing between BUSINESS UNITS and MENU */}
      <div className="border-t border-slate-800 mt-3 mb-3 mx-4" aria-hidden />
      {/* MENU Section */}
      <div className="px-4">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 px-2">MENU</h3>
        <div className="space-y-1">
          {menuItems.map((item) => {
            const IconComponent = item.icon;
            const isActive = currentView === item.id || (currentView === 'editor' && item.id === (editorSourceView ?? 'dashboard'));
            return (
              <button 
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white' 
                    : 'hover:bg-slate-800/50 hover:text-white text-slate-400'
                }`}
              >
                <IconComponent size={20} />
                <span className="text-sm font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="p-4">
        <button 
          onClick={onNewPost}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-lg font-medium transition-all shadow-lg shadow-blue-900/20 mb-2"
        >
          <PlusCircle size={18} />
          <span>New Content</span>
        </button>
        <div className="pt-2">
          {isAuthConfigured && (profile || user) && (
            <div className="mb-4 px-3 py-2 rounded-md bg-slate-800/50 border border-slate-700/50">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-white truncate" title={profile?.display_name || user?.email?.split('@')[0] || ''}>
                  {profile?.display_name || user?.email?.split('@')[0] || 'User'}
                </span>
                <span className={`shrink-0 px-1.5 py-0.5 text-[10px] font-medium rounded border ${ROLE_BADGE_CLASS[role] || ROLE_BADGE_CLASS.viewer}`}>
                  {ROLE_LABELS[role] || role}
                </span>
              </div>
              <div className="text-xs text-slate-400 truncate mt-0.5" title={profile?.email || user?.email || ''}>
                {profile?.email || user?.email || ''}
              </div>
            </div>
          )}
          {canAccessSettings && (
            <button 
              onClick={() => onNavigate('settings')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                currentView === 'settings'
                  ? 'bg-blue-600 text-white' 
                  : 'hover:bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <Settings size={18} />
              <span className="text-sm">Settings</span>
            </button>
          )}
          {isAuthConfigured && (
            <button
              type="button"
              onClick={() => signOut()}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white transition-colors mt-1"
            >
              <LogOut size={18} />
              <span className="text-sm">Sign Out</span>
            </button>
          )}
        </div>
      </div>
      </div>
    </div>
  );
};

export default Sidebar;
