import React, { useState, useEffect, useRef } from 'react';
import { X, Trash2, Upload } from 'lucide-react';
import { BusinessUnit } from '../types';
import ProfileKeyField from './ProfileKeyField';

export type BusinessUnitModalMode = 'add' | 'edit';

interface BusinessUnitModalProps {
  mode: BusinessUnitModalMode;
  initialData?: BusinessUnit | null;
  existingBusinessUnits?: BusinessUnit[];
  onSave: (data: Omit<BusinessUnit, 'id'> | Partial<BusinessUnit>) => void | Promise<boolean | void>;
  onDelete?: (id: string) => void | Promise<boolean | void>;
  onClose: () => void;
}

const BusinessUnitModal: React.FC<BusinessUnitModalProps> = ({
  mode,
  initialData,
  onSave,
  onDelete,
  onClose,
}) => {
  const [label, setLabel] = useState('');
  const [profileCode, setProfileCode] = useState('');
  const [logo, setLogo] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testConnectionButton, setTestConnectionButton] = useState<React.ReactNode>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (mode === 'edit' && initialData) {
      setLabel(initialData.label);
      setProfileCode(initialData.profileCode ?? '');
      setLogo(initialData.logo ?? '');
    } else {
      setLabel('');
      setProfileCode('');
      setLogo('');
    }
    setShowDeleteConfirm(false);
  }, [mode, initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedLabel = label.trim();
    if (!trimmedLabel) return;
    setSaving(true);
    try {
      let result: boolean | void = true;
      if (mode === 'add') {
        result = await onSave({
          label: trimmedLabel,
          icon: 'Building2',
          profileCode: profileCode.trim(),
          ...(logo.trim() && { logo: logo.trim() }),
        });
      } else if (initialData) {
        result = await onSave({
          label: trimmedLabel,
          ...(profileCode.trim() !== '' && { profileCode: profileCode.trim() }),
          ...(logo.trim() !== '' && { logo: logo.trim() }),
        });
      }
      if (result !== false) onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!initialData || !onDelete) return;
    setSaving(true);
    try {
      const result = await onDelete(initialData.id);
      if (result !== false) {
        setShowDeleteConfirm(false);
        onClose();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (showDeleteConfirm) setShowDeleteConfirm(false);
      else onClose();
    }
  };

  const isValid = mode === 'add' ? !!label.trim() && !!profileCode.trim() : !!label.trim();

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') setLogo(reader.result);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleClearLogo = () => {
    setLogo('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="business-unit-modal-title"
    >
      <div
        className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 id="business-unit-modal-title" className="text-lg font-bold text-slate-900">
            {mode === 'add' ? 'Add Business Unit' : 'Edit Business Unit'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {showDeleteConfirm ? (
          <div className="p-6 space-y-4">
            <p className="text-sm text-slate-600">
              Are you sure you want to delete this business unit? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 rounded-lg font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={saving}
                className="px-4 py-2 rounded-lg font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                <Trash2 size={16} />
                {saving ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Legal Services"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                required
              />
            </div>
            <ProfileKeyField
              value={profileCode}
              onChange={setProfileCode}
              label={
                <>
                  Profile Key {mode === 'add' ? <span className="text-red-500">*</span> : <span className="text-slate-400 font-normal">(optional)</span>}
                </>
              }
              placeholder="Enter Profile Key for this unit"
              buId={mode === 'edit' && initialData ? initialData.id : null}
              variant="compact"
              onTestButtonReady={setTestConnectionButton}
            />
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Logo <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleLogoFileChange}
                className="hidden"
                aria-label="Upload logo"
              />
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors text-sm font-medium"
                >
                  <Upload size={16} />
                  Upload logo
                </button>
                {logo && (
                  <>
                    <img
                      src={logo}
                      alt="Logo preview"
                      className="w-10 h-10 rounded object-cover border border-slate-200"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleClearLogo}
                      className="text-sm text-slate-500 hover:text-slate-700 font-medium"
                    >
                      Remove
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
              {mode === 'edit' && onDelete && (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium text-red-600 hover:bg-red-50 border border-red-200 transition-colors mr-auto"
                >
                  <Trash2 size={16} />
                  Delete
                </button>
              )}
              <div className="flex gap-3 ml-auto">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                {testConnectionButton}
                <button
                  type="submit"
                  disabled={!isValid || saving}
                  className="px-4 py-2 rounded-lg font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default BusinessUnitModal;
