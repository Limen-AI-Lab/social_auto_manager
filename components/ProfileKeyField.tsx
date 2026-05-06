import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, CheckCircle2, XCircle, TestTube, Loader2 } from 'lucide-react';
import { testProfileConnection } from '../services/socialPublish';
import {
  loadConnectionStatus,
  saveConnectionStatus,
  clearConnectionStatus,
} from './profileKeyStorage';

export interface ProfileKeyFieldProps {
  value: string;
  onChange: (value: string) => void;
  label: React.ReactNode;
  placeholder?: string;
  /** BU id for localStorage persistence; null = in-memory only (e.g. add mode) */
  buId?: string | null;
  /** Called when test succeeds; APIPage uses to save profileCode */
  onTestSuccess?: (profileKey: string) => void;
  onShowToast?: (message: string) => void;
  /** Called when test result changes; APIPage uses for header status */
  onStatusChange?: (lastTestSuccess: boolean | null) => void;
  /** Compact: input+Test inline. Full: input full width, Test in next row */
  variant?: 'compact' | 'full';
  /** Extra buttons to render before Test (e.g. Save in APIPage) */
  extraButtons?: React.ReactNode;
  /** When false, status is shown in parent (e.g. APIPage header); skip inline status */
  showStatusInline?: boolean;
  /** When provided, Test button is not rendered inline; parent receives it to render elsewhere (e.g. in footer) */
  onTestButtonReady?: (button: React.ReactNode) => void;
}

const ProfileKeyField: React.FC<ProfileKeyFieldProps> = ({
  value,
  onChange,
  label,
  placeholder = 'Enter Profile Key for this unit',
  buId = null,
  onTestSuccess,
  onShowToast,
  onStatusChange,
  variant = 'full',
  extraButtons,
  showStatusInline = true,
  onTestButtonReady,
}) => {
  const [showValue, setShowValue] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [testConnectionError, setTestConnectionError] = useState<string | null>(null);
  const [lastTestSuccess, setLastTestSuccess] = useState<boolean | null>(null);

  // Load persisted status when buId changes
  useEffect(() => {
    if (buId) {
      const persisted = loadConnectionStatus(buId);
      setLastTestSuccess(persisted);
      onStatusChange?.(persisted);
    } else {
      setLastTestSuccess(null);
      onStatusChange?.(null);
    }
    setTestConnectionError(null);
  }, [buId]); // eslint-disable-line react-hooks/exhaustive-deps -- onStatusChange intentionally excluded

  const handleTestConnection = async () => {
    const trimmed = value.trim();
    if (!trimmed) {
      setTestConnectionError('Enter a Profile Key first');
      setLastTestSuccess(null);
      if (buId) clearConnectionStatus(buId);
      onStatusChange?.(null);
      return;
    }
    setTestConnectionError(null);
    setIsTestingConnection(true);
    try {
      const result = await testProfileConnection(trimmed);
      if (result.success) {
        setLastTestSuccess(true);
        if (buId) saveConnectionStatus(buId, 'success');
        onStatusChange?.(true);
        onTestSuccess?.(trimmed);
        onShowToast?.('Connection successful. Profile Key saved.');
      } else {
        setLastTestSuccess(false);
        if (buId) saveConnectionStatus(buId, 'failed');
        onStatusChange?.(false);
        setTestConnectionError(result.error ?? 'Connection failed');
      }
    } catch (err) {
      setLastTestSuccess(false);
      if (buId) saveConnectionStatus(buId, 'failed');
      onStatusChange?.(false);
      setTestConnectionError((err as Error).message ?? 'Connection failed');
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleChange = (v: string) => {
    onChange(v);
    setLastTestSuccess(null);
    if (buId) clearConnectionStatus(buId);
    onStatusChange?.(null);
  };

  const inputClasses =
    'px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm';
  const compactInputClasses = 'px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm font-mono';

  const isCompact = variant === 'compact';

  const testButton = (
    <button
      type="button"
      onClick={handleTestConnection}
      disabled={isTestingConnection || !value.trim()}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed bg-slate-100 hover:bg-slate-200 text-slate-700 ${isCompact && !onTestButtonReady ? 'shrink-0 py-2.5' : ''}`}
    >
      {isTestingConnection ? (
        <Loader2 size={16} className="animate-spin" />
      ) : (
        <TestTube size={16} />
      )}
      {isTestingConnection ? 'Testing...' : 'Test Connection'}
    </button>
  );

  useEffect(() => {
    if (onTestButtonReady) onTestButtonReady(testButton);
  }, [onTestButtonReady, value.trim(), isTestingConnection]); // eslint-disable-line react-hooks/exhaustive-deps -- testButton is recreated each render

  const showTestInline = !onTestButtonReady;

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
      <div className={isCompact && showTestInline ? 'flex items-center gap-2' : undefined}>
        <div className={`relative ${isCompact && showTestInline ? 'flex-1 min-w-0' : ''}`}>
          <input
            type={showValue ? 'text' : 'password'}
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            className={`w-full ${isCompact ? compactInputClasses : inputClasses}`}
            placeholder={placeholder}
          />
          <button
            type="button"
            onClick={() => setShowValue(!showValue)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
          >
            {showValue ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        {isCompact && showTestInline && testButton}
      </div>
      {!isCompact && (
        <div className="flex items-center gap-3 pt-2">
          {extraButtons}
          {testButton}
        </div>
      )}
      {showStatusInline && lastTestSuccess !== null && (
        <div className="flex items-center gap-2">
          {lastTestSuccess ? (
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
      {testConnectionError && (
        <p className="text-sm text-red-600" role="alert">
          {testConnectionError}
        </p>
      )}
    </div>
  );
};

export default ProfileKeyField;
