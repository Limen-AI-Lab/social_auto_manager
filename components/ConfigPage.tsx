import React, { useState, useEffect } from 'react';
import { Plus, ArrowLeft, FileText, Globe, Key, Users } from 'lucide-react';
import { BusinessUnit, SettingsPage, PlatformConfig } from '../types';
import { useAuth } from '../context/AuthContext';
import PromptsPage from './settings/PromptsPage';
import PlatformsPage from './settings/PlatformsPage';
import APIPage from './settings/APIPage';
import TeamPage from './settings/TeamPage';
import { BusinessUnitsSection, SettingsSection } from './SettingsSidebar';
import BusinessUnitModal from './BusinessUnitModal';

interface ConfigPageProps {
  onBack: () => void;
  currentBusinessUnit: string;
  businessUnits: BusinessUnit[];
  canManageBusinessUnits?: boolean;
  onSwitchBusinessUnit: (buId: string) => void;
  onAddBusinessUnit: (unit: Omit<BusinessUnit, 'id'>) => void | Promise<boolean>;
  onDeleteBusinessUnit: (id: string) => void | Promise<boolean>;
  onUpdateBusinessUnit: (id: string, updates: Partial<BusinessUnit>) => void | Promise<boolean>;
  onSaveProfileCode?: (buId: string, profileCode: string) => void;
  onShowToast?: (message: string) => void;
  platformConfig?: PlatformConfig[];
  onPlatformConfigChange?: (config: PlatformConfig[]) => void;
  webhookUrl?: string;
  onWebhookUrlChange?: (value: string) => void;
  webhookPayloadField?: string;
  onWebhookPayloadFieldChange?: (value: string) => void;
  webhookVideoField?: string;
  onWebhookVideoFieldChange?: (value: string) => void;
  webhookMode?: 'test' | 'prod';
  onWebhookModeChange?: (mode: 'test' | 'prod') => void;
}


const ConfigPage: React.FC<ConfigPageProps> = ({
  onBack,
  currentBusinessUnit,
  businessUnits,
  canManageBusinessUnits = false,
  onSwitchBusinessUnit,
  onAddBusinessUnit,
  onDeleteBusinessUnit,
  onUpdateBusinessUnit,
  onSaveProfileCode,
  onShowToast,
  platformConfig = [],
  onPlatformConfigChange,
  webhookUrl = '',
  onWebhookUrlChange,
  webhookPayloadField = 'payload',
  onWebhookPayloadFieldChange,
  webhookVideoField = 'video',
  onWebhookVideoFieldChange,
  webhookMode = 'test',
  onWebhookModeChange,
}) => {
  const { role } = useAuth();
  const [currentPage, setCurrentPage] = useState<SettingsPage>('prompts');
  const [modalMode, setModalMode] = useState<'add' | 'edit' | null>(null);
  const [editingUnit, setEditingUnit] = useState<BusinessUnit | null>(null);

  const isSuperAdmin = role === 'super_admin';
  const settingsPages: { id: SettingsPage; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
    { id: 'prompts', label: 'Prompts', icon: FileText },
    { id: 'platforms', label: 'Platforms', icon: Globe },
    ...((isSuperAdmin || role === 'admin') ? [{ id: 'api' as const, label: 'Profile Key', icon: Key }] : []),
    { id: 'team', label: 'Team', icon: Users },
  ];

  useEffect(() => {
    if (currentPage === 'api' && role !== 'super_admin' && role !== 'admin') setCurrentPage('prompts');
  }, [currentPage, role]);

  // Allow selecting Business Unit on prompts, platforms, and Profile Key (Profile Key page configures key per BU)
  const canSelectBusinessUnit = currentPage === 'prompts' || currentPage === 'platforms' || currentPage === 'api';

  const handlePageChange = (page: SettingsPage) => {
    setCurrentPage(page);
  };

  const handleOpenAddModal = () => {
    setEditingUnit(null);
    setModalMode('add');
  };

  const handleOpenEditModal = (unit: BusinessUnit) => {
    setEditingUnit(unit);
    setModalMode('edit');
  };

  const handleModalSave = async (data: Omit<BusinessUnit, 'id'> | Partial<BusinessUnit>) => {
    let ok = true;
    if (modalMode === 'add' && 'label' in data && data.label) {
      ok = (await onAddBusinessUnit({
        label: data.label,
        icon: data.icon ?? 'Building2',
        profileCode: data.profileCode,
        logo: data.logo,
      })) ?? true;
    } else if (modalMode === 'edit' && editingUnit) {
      ok = (await onUpdateBusinessUnit(editingUnit.id, data)) ?? true;
    }
    return ok;
  };

  const handleModalDelete = async (id: string) => {
    return (await onDeleteBusinessUnit(id)) ?? true;
  };

  const handleModalClose = () => {
    setModalMode(null);
    setEditingUnit(null);
  };

  const renderContent = () => {
    switch (currentPage) {
      case 'prompts':
        return <PromptsPage currentBusinessUnit={currentBusinessUnit} platformConfig={platformConfig} onShowToast={onShowToast} />;
      case 'platforms':
        return <PlatformsPage currentBusinessUnit={currentBusinessUnit} platformConfig={platformConfig} onPlatformConfigChange={onPlatformConfigChange} />;
      case 'api':
        return (
          <APIPage
            businessUnits={businessUnits}
            currentBusinessUnit={currentBusinessUnit}
            onSaveProfileCode={onSaveProfileCode}
            onShowToast={onShowToast}
            webhookUrl={webhookUrl}
            onWebhookUrlChange={onWebhookUrlChange}
            webhookPayloadField={webhookPayloadField}
            onWebhookPayloadFieldChange={onWebhookPayloadFieldChange}
            webhookVideoField={webhookVideoField}
            onWebhookVideoFieldChange={onWebhookVideoFieldChange}
            webhookMode={webhookMode}
            onWebhookModeChange={onWebhookModeChange}
          />
        );
      case 'team':
        return <TeamPage />;
      default:
        return <PromptsPage currentBusinessUnit={currentBusinessUnit} />;
    }
  };

  return (
    <div className="flex flex-col h-screen w-full bg-slate-50 text-slate-900">
      {/* Top Global Header */}
      <div className="px-8 pt-4 pb-3 border-b border-slate-200 bg-white flex items-center justify-between flex-shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-slate-600 hover:text-slate-900 font-medium transition-colors text-sm"
        >
          <ArrowLeft size={16} />
          <span>Back to Dashboard</span>
        </button>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">
            S
          </div>
          <span className="text-slate-900 font-bold text-xl tracking-tight">SAMA</span>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <div className="w-64 bg-white border-r border-slate-200 flex flex-col flex-shrink-0">
          {/* Business Units Section - Scrollable */}
          <BusinessUnitsSection
            businessUnits={businessUnits}
            currentBusinessUnit={currentBusinessUnit}
            canSelectBusinessUnit={canSelectBusinessUnit}
            canManageBusinessUnits={canManageBusinessUnits}
            onSwitchBusinessUnit={onSwitchBusinessUnit}
            onOpenEditModal={handleOpenEditModal}
            onDeleteBusinessUnit={onDeleteBusinessUnit}
            onUpdateBusinessUnit={onUpdateBusinessUnit}
            darkMode={false}
          />

          {/* Add Business Unit - only for super_admin */}
          {canManageBusinessUnits && (
            <div className="px-6 mt-2">
              <button
                onClick={handleOpenAddModal}
                className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-slate-300 rounded-lg text-slate-500 hover:text-slate-700 hover:border-slate-400 hover:bg-slate-50 transition-all text-sm font-medium"
              >
                <Plus size={16} />
                Add Unit
              </button>
            </div>
          )}

          {/* Settings Section - Fixed at bottom */}
          <SettingsSection
            settingsPages={settingsPages}
            currentPage={currentPage}
            onPageChange={handlePageChange}
            darkMode={false}
          />
        </div>

        {/* Right Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {renderContent()}
        </div>
      </div>

      {modalMode && (
        <BusinessUnitModal
          mode={modalMode}
          initialData={editingUnit}
          existingBusinessUnits={businessUnits}
          onSave={handleModalSave}
          onDelete={modalMode === 'edit' ? handleModalDelete : undefined}
          onClose={handleModalClose}
        />
      )}
    </div>
  );
};

export default ConfigPage;
