import React from 'react';
import { Edit2, FileText, Globe, Key, Users, Building2, Plane, ShieldCheck, TestTube } from 'lucide-react';
import { BusinessUnit, SettingsPage } from '../types';

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

interface BusinessUnitsSectionProps {
  businessUnits: BusinessUnit[];
  currentBusinessUnit: string;
  canSelectBusinessUnit: boolean;
  canManageBusinessUnits?: boolean;
  onSwitchBusinessUnit: (buId: string) => void;
  onOpenEditModal?: (unit: BusinessUnit) => void;
  onDeleteBusinessUnit: (id: string) => void;
  onUpdateBusinessUnit: (id: string, updates: Partial<BusinessUnit>) => void;
  darkMode?: boolean;
}

export const BusinessUnitsSection: React.FC<BusinessUnitsSectionProps> = ({
  businessUnits,
  currentBusinessUnit,
  canSelectBusinessUnit,
  canManageBusinessUnits = false,
  onSwitchBusinessUnit,
  onOpenEditModal,
  onDeleteBusinessUnit,
  onUpdateBusinessUnit,
  darkMode = false
}) => {
  const titleClass = darkMode 
    ? 'text-xs font-bold text-slate-400 uppercase tracking-wider mb-4'
    : 'text-xs font-bold text-slate-500 uppercase tracking-wider mb-4';

  const selectedBgClass = darkMode
    ? 'bg-slate-800 border-l-4 border-blue-500'
    : 'bg-blue-50 border-l-4 border-blue-600';

  const hoverClass = darkMode
    ? 'hover:bg-slate-800 text-slate-300 hover:text-white'
    : 'hover:bg-slate-50 text-slate-600 hover:text-slate-900';

  const textClass = darkMode
    ? (canSelectBusinessUnit ? 'text-slate-300' : 'text-slate-500 opacity-60')
    : (canSelectBusinessUnit ? 'text-slate-600' : 'text-slate-400 opacity-60');

  const selectedTextClass = darkMode
    ? 'text-white font-semibold'
    : 'text-slate-900 font-semibold';

  return (
    <div className="flex-1 overflow-y-auto">
      <div className={darkMode ? 'p-6 pb-4' : 'p-6 pb-4'}>
        <h2 className={titleClass}>BUSINESS UNITS</h2>
        
        <div className="space-y-1">
          {businessUnits.map((bu) => {
            const IconComponent = getIconComponent(bu.icon);
            const isSelected = canSelectBusinessUnit && currentBusinessUnit === bu.id;
            const iconClassName = isSelected ? (darkMode ? 'text-white' : 'text-slate-700') : (canSelectBusinessUnit ? (darkMode ? 'text-slate-400' : 'text-slate-400') : (darkMode ? 'text-slate-500' : 'text-slate-300'));

            return (
              <div
                key={bu.id}
                className={`group flex items-center gap-2 ${
                  isSelected
                    ? selectedBgClass
                    : canSelectBusinessUnit
                    ? `${hoverClass} border-l-4 border-transparent`
                    : `${textClass} border-l-4 border-transparent`
                } rounded-lg transition-colors`}
              >
                <button
                  onClick={() => canSelectBusinessUnit && onSwitchBusinessUnit(bu.id)}
                  disabled={!canSelectBusinessUnit}
                  className={`flex-1 flex items-center gap-3 px-3 py-2.5 font-medium text-sm ${
                    !canSelectBusinessUnit ? 'cursor-not-allowed' : ''
                  }`}
                >
                  {bu.logo ? (
                    <img
                      src={bu.logo}
                      alt=""
                      className="w-[18px] h-[18px] rounded object-cover flex-shrink-0"
                    />
                  ) : (
                    <IconComponent size={18} className={iconClassName} />
                  )}
                  <div className="flex-1 text-left">
                    <div className={isSelected ? selectedTextClass : textClass}>
                      {bu.label}
                    </div>
                  </div>
                </button>
                {canManageBusinessUnits && onOpenEditModal && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity pr-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenEditModal(bu);
                      }}
                      className={`p-1 rounded transition-colors ${
                        darkMode ? 'hover:bg-slate-700 text-slate-400 hover:text-slate-200' : 'hover:bg-slate-200 text-slate-500 hover:text-slate-700'
                      }`}
                      title="Edit"
                    >
                      <Edit2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

interface SettingsSectionProps {
  settingsPages: { id: SettingsPage; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[];
  currentPage: SettingsPage;
  onPageChange: (page: SettingsPage) => void;
  darkMode?: boolean;
}

export const SettingsSection: React.FC<SettingsSectionProps> = ({
  settingsPages,
  currentPage,
  onPageChange,
  darkMode = false
}) => {
  const titleClass = darkMode 
    ? 'text-xs font-bold text-slate-400 uppercase tracking-wider mb-4'
    : 'text-xs font-bold text-slate-500 uppercase tracking-wider mb-4';

  const borderClass = darkMode
    ? 'border-t border-slate-700'
    : 'border-t border-slate-200';

  const bgClass = darkMode
    ? 'bg-[#0F172A]'
    : 'bg-white';

  return (
    <div className={`px-6 mt-6 pt-6 pb-6 ${borderClass} flex-shrink-0 ${bgClass}`}>
      <h2 className={titleClass}>SETTINGS</h2>
      
      <div className="space-y-1">
        {settingsPages.map((page) => {
          const IconComponent = page.icon;
          const isActive = currentPage === page.id;
          
          return (
            <button
              key={page.id}
              onClick={() => onPageChange(page.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium text-sm transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : darkMode
                  ? 'hover:bg-slate-800 text-slate-300 hover:text-white'
                  : 'hover:bg-slate-50 text-slate-600 hover:text-slate-900'
              }`}
            >
              <IconComponent size={18} className={isActive ? 'text-white' : (darkMode ? 'text-slate-400' : 'text-slate-400')} />
              <span>{page.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
