import React, { useState, useCallback, useEffect } from 'react';
import { Upload, X, FileVideo, Sparkles } from 'lucide-react';
import { BusinessUnit } from '../types';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadStart: (file: File, context: string, selectedBusinessUnitIds: string[]) => void;
  isProcessing: boolean;
  businessUnits: BusinessUnit[];
  uploadProgress?: number;
  generationProgress?: Record<string, number>;
}

const UploadModal: React.FC<UploadModalProps> = ({ 
  isOpen, 
  onClose, 
  onUploadStart, 
  isProcessing,
  businessUnits,
  uploadProgress = 0,
  generationProgress = {}
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [context, setContext] = useState('');
  const [selectedBusinessUnitIds, setSelectedBusinessUnitIds] = useState<string[]>([]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('video/')) {
        setSelectedFile(file);
      } else {
        alert("Please upload a video file.");
      }
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleBusinessUnitToggle = (buId: string) => {
    setSelectedBusinessUnitIds(prev => 
      prev.includes(buId)
        ? prev.filter(id => id !== buId)
        : [...prev, buId]
    );
  };

  const handleSubmit = () => {
    if (selectedFile && selectedBusinessUnitIds.length > 0) {
      onUploadStart(selectedFile, context, selectedBusinessUnitIds);
    }
  };

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen && !isProcessing) {
      setSelectedFile(null);
      setContext('');
      setSelectedBusinessUnitIds([]);
      setDragActive(false);
    }
  }, [isOpen, isProcessing]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h3 className="font-semibold text-slate-800">New Content Asset</h3>
          {!isProcessing && (
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
              <X size={20} />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="p-6">
          {isProcessing ? (
            <div className="space-y-6">
              {/* Upload Progress */}
              {uploadProgress < 50 && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-slate-700">Uploading video...</span>
                    <span className="text-sm text-slate-500">{Math.round(uploadProgress)}%</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Generation Progress */}
              {uploadProgress >= 50 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-center mb-4">
                    <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center relative">
                      <Sparkles size={24} className="animate-pulse" />
                      <div className="absolute inset-0 border-4 border-blue-100 rounded-full border-t-blue-600 animate-spin"></div>
                    </div>
                  </div>
                  <h4 className="text-lg font-bold text-slate-900 text-center mb-4">Generating Content</h4>
                  
                  <div className="space-y-3">
                    {selectedBusinessUnitIds.map((buId) => {
                      const bu = businessUnits.find(b => b.id === buId);
                      const progress = generationProgress[buId] || 0;
                      return (
                        <div key={buId} className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-slate-700">
                              {bu?.label ?? buId}
                            </span>
                            <span className="text-sm text-slate-500">{Math.round(progress)}%</span>
                          </div>
                          <div className="w-full bg-slate-200 rounded-full h-2">
                            <div 
                              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Dropzone */}
              {!selectedFile ? (
                <div 
                  className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200
                    ${dragActive ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-slate-400 bg-slate-50'}
                  `}
                  onDragEnter={handleDrag} 
                  onDragLeave={handleDrag} 
                  onDragOver={handleDrag} 
                  onDrop={handleDrop}
                >
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 bg-white rounded-full shadow-sm flex items-center justify-center mb-3 text-blue-600">
                      <Upload size={24} />
                    </div>
                    <p className="text-sm font-medium text-slate-900">Drag video here or click to upload</p>
                    <p className="text-xs text-slate-500 mt-1">MP4, MOV up to 500MB</p>
                    <input 
                      type="file" 
                      accept="video/*"
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      onChange={handleFileChange}
                    />
                  </div>
                </div>
              ) : (
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center">
                      <FileVideo size={20} />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-medium text-slate-900 truncate max-w-[200px]">{selectedFile.name}</p>
                      <p className="text-xs text-slate-500">{(selectedFile.size / (1024*1024)).toFixed(1)} MB</p>
                    </div>
                  </div>
                  <button onClick={() => setSelectedFile(null)} className="text-slate-400 hover:text-red-500 p-1">
                    <X size={18} />
                  </button>
                </div>
              )}

              {/* Business Unit Selection */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Select Business Units <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2 border border-slate-300 rounded-lg p-3 bg-slate-50">
                  {businessUnits.map((bu) => (
                    <label 
                      key={bu.id}
                      className="flex items-center gap-2 cursor-pointer hover:bg-slate-100 rounded px-2 py-1.5 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedBusinessUnitIds.includes(bu.id)}
                        onChange={() => handleBusinessUnitToggle(bu.id)}
                        className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-slate-700 capitalize">{bu.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Context Input */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  What is this video about? <span className="text-slate-400 font-normal">(Optional context for AI)</span>
                </label>
                <textarea 
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-slate-400"
                  rows={3}
                  placeholder="e.g., Explaining the new digital nomad visa requirements for Cape Town..."
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button 
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSubmit}
                  disabled={!selectedFile || selectedBusinessUnitIds.length === 0}
                  className={`px-6 py-2 text-sm font-medium text-white rounded-lg transition-all shadow-sm
                    ${!selectedFile || selectedBusinessUnitIds.length === 0 ? 'bg-slate-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/20'}
                  `}
                >
                  Generate Content
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UploadModal;
