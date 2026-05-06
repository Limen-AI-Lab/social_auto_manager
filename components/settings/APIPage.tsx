import React, { useState } from 'react';
import { CheckCircle2, XCircle, Save, TestTube, Webhook } from 'lucide-react';
import { BusinessUnit } from '../../types';
import { WEBHOOK_URL_TEST, WEBHOOK_URL_PROD } from '../../constants/webhook';
import ProfileKeyField from '../ProfileKeyField';

interface APIPageProps {
  businessUnits: BusinessUnit[];
  /** Business unit id for the selected BU. */
  currentBusinessUnit: string;
  onSaveProfileCode?: (buId: string, profileCode: string) => void;
  onShowToast?: (message: string) => void;
  webhookUrl?: string;
  onWebhookUrlChange?: (value: string) => void;
  webhookPayloadField?: string;
  onWebhookPayloadFieldChange?: (value: string) => void;
  webhookVideoField?: string;
  onWebhookVideoFieldChange?: (value: string) => void;
  webhookMode?: 'test' | 'prod';
  onWebhookModeChange?: (mode: 'test' | 'prod') => void;
}

const APIPage: React.FC<APIPageProps> = ({
  businessUnits,
  currentBusinessUnit,
  onSaveProfileCode,
  onShowToast,
  webhookUrl = '',
  onWebhookUrlChange,
  webhookPayloadField = 'payload',
  onWebhookPayloadFieldChange,
  webhookVideoField = 'video',
  onWebhookVideoFieldChange,
  webhookMode = 'test',
  onWebhookModeChange,
}) => {
  const [localProfileCode, setLocalProfileCode] = useState('');
  const [headerStatus, setHeaderStatus] = useState<boolean | null>(null);

  const currentBU = businessUnits.find((bu) => bu.id === currentBusinessUnit);
  const currentProfileCode = currentBU
    ? (localProfileCode !== '' ? localProfileCode : (currentBU.profileCode ?? ''))
    : '';

  const handleSave = () => {
    if (!currentBU) return;
    const value = currentProfileCode.trim();
    onSaveProfileCode?.(currentBU.id, value);
    setLocalProfileCode('');
  };

  const handleTestSuccess = (profileKey: string) => {
    if (!currentBU) return;
    onSaveProfileCode?.(currentBU.id, profileKey);
    setLocalProfileCode('');
  };

  React.useEffect(() => {
    setLocalProfileCode('');
  }, [currentBusinessUnit]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-4xl space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Profile Key Configuration</h2>
            <p className="text-sm text-slate-600">
              Configure Profile Key per Business Unit. Select a Business Unit on the left to configure.
            </p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-1">
                  {currentBU ? `${currentBU.label} — Profile Key` : 'Select Business Unit'}
                </h3>
                <p className="text-sm text-slate-600">
                  {currentBU
                    ? 'Configure Profile Key for this Business Unit (used when publishing to social media)'
                    : 'Click a Business Unit in the left list to configure its Profile Key'}
                </p>
              </div>
              {currentBU && headerStatus !== null && (
                <div className="flex items-center gap-2">
                  {headerStatus ? (
                    <>
                      <CheckCircle2 size={20} className="text-green-600" />
                      <span className="text-sm font-medium text-green-600">Connection successful</span>
                    </>
                  ) : (
                    <>
                      <XCircle size={20} className="text-slate-400" />
                      <span className="text-sm font-medium text-slate-400">Disconnected</span>
                    </>
                  )}
                </div>
              )}
            </div>

            {currentBU && (
              <div className="space-y-4">
                <ProfileKeyField
                  value={currentProfileCode}
                  onChange={setLocalProfileCode}
                  label="Profile Key"
                  placeholder={`Enter Profile Key for ${currentBU.label}`}
                  buId={currentBU.id}
                  onTestSuccess={handleTestSuccess}
                  onShowToast={onShowToast}
                  onStatusChange={setHeaderStatus}
                  variant="full"
                  showStatusInline={false}
                  extraButtons={
                    <button
                      type="button"
                      onClick={handleSave}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                    >
                      <Save size={16} />
                      Save
                    </button>
                  }
                />
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <Webhook size={20} className="text-slate-600" />
              <h3 className="text-lg font-bold text-slate-900">Distribution Webhook</h3>
            </div>
            <p className="text-sm text-slate-600 mb-4">
              When you click &quot;Publish Selected&quot; in the editor, the app sends the video (binary) and selected platform metadata to the endpoint below. Choose Test or Prod to switch endpoints.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Mode</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => onWebhookModeChange?.('test')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-colors ${webhookMode === 'test' ? 'bg-amber-100 text-amber-800 border-2 border-amber-400' : 'bg-slate-100 text-slate-600 border-2 border-transparent hover:bg-slate-200'}`}
                  >
                    <TestTube size={18} />
                    Test
                  </button>
                  <button
                    type="button"
                    onClick={() => onWebhookModeChange?.('prod')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-colors ${webhookMode === 'prod' ? 'bg-green-100 text-green-800 border-2 border-green-500' : 'bg-slate-100 text-slate-600 border-2 border-transparent hover:bg-slate-200'}`}
                  >
                    <CheckCircle2 size={18} />
                    Prod
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Active endpoint</label>
                <input
                  type="text"
                  readOnly
                  value={webhookMode === 'test' ? WEBHOOK_URL_TEST : WEBHOOK_URL_PROD}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-600 font-mono text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Payload field name</label>
                  <input
                    type="text"
                    value={webhookPayloadField}
                    onChange={(e) => onWebhookPayloadFieldChange?.(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    placeholder="payload"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Video field name</label>
                  <input
                    type="text"
                    value={webhookVideoField}
                    onChange={(e) => onWebhookVideoFieldChange?.(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    placeholder="video"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default APIPage;
