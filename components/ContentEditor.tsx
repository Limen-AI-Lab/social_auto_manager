import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { PlatformContent } from '../types';
import { getPlatformCoverSpec } from '../constants/platformCoverSpecs';
import PlatformMatrixGrid from './ContentMatrix/PlatformMatrixGrid';
import { regenerateSinglePlatform } from '../services/geminiService';
import { validateCaptionFormat, type ValidateCaptionFormatResult } from '../lib/captionFormat';
import { 
  Linkedin, 
  Facebook, 
  Twitter, 
  Instagram, 
  Youtube, 
  Video, 
  Send, 
  RotateCw,
  Check,
  ChevronLeft,
  Save,
  Image as ImageIcon,
  CheckCircle2,
  Wrench
} from 'lucide-react';

export interface RegeneratePayload {
  /** In-memory video file (when project was just uploaded in this session). */
  file?: File;
  /** Persisted video URL (e.g. Supabase Storage); used when opening an existing project without a File. */
  videoUrl?: string;
  context: string;
  buId: string;
  buLabel: string;
  language: string;
}

interface ContentEditorProps {
  initialContent: PlatformContent[];
  enabledPlatformIds?: string[];
  videoName: string;
  sourceCoverUrl?: string;
  showBackButton?: boolean;
  onBack: () => void;
  onSave: (updatedContent: PlatformContent[]) => void;
  onPublish?: (updatedContent: PlatformContent[]) => void;
  /** When false, only Save Draft is shown; Publish is hidden. Editor can save draft only; admin can publish. */
  canPublish?: boolean;
  /** When provided, per-column Regenerate is available for caption cells. */
  regeneratePayload?: RegeneratePayload;
  /** Optional callback for toast messages (e.g. "No format issues found.", regenerate error). */
  onShowToast?: (message: string) => void;
}

const ContentEditor: React.FC<ContentEditorProps> = ({
  initialContent,
  enabledPlatformIds = [],
  videoName,
  sourceCoverUrl,
  showBackButton = true,
  onBack,
  onSave,
  onPublish,
  canPublish = true,
  regeneratePayload,
  onShowToast,
}) => {
  const [matrix, setMatrix] = useState<PlatformContent[]>(initialContent);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishBtnHover, setPublishBtnHover] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const replaceTargetIndexRef = useRef<number | null>(null);

  /** Which caption column has the Regenerate popover open (visible index). */
  const [regeneratePopoverIndex, setRegeneratePopoverIndex] = useState<number | null>(null);
  /** User prompt input for the open popover (single shared value; cleared on confirm). */
  const [regenerateUserPrompt, setRegenerateUserPrompt] = useState('');
  /** Which caption column is currently regenerating (loading). */
  const [regenerateLoadingIndex, setRegenerateLoadingIndex] = useState<number | null>(null);
  /** Per visible index: validation result when Check found errors (enables Correct and highlight). */
  const [captionErrorsByVisibleIndex, setCaptionErrorsByVisibleIndex] = useState<Record<number, ValidateCaptionFormatResult>>({});
  const regeneratePopoverRef = useRef<HTMLDivElement>(null);
  /** Per-column refs for caption textarea and mirror (sync scroll and mirror height). */
  const captionHighlightRefs = useRef<Record<number, { textarea: HTMLTextAreaElement | null; mirrorWrapper: HTMLDivElement | null; mirrorInner: HTMLDivElement | null }>>({});

  // Persisted: show "Published" / "Publish Again" when all selected platforms are already published
  const selectedForPublish = enabledPlatformIds.length > 0
    ? matrix.filter((m) => m.selected && enabledPlatformIds.includes(m.platform))
    : matrix.filter((m) => m.selected);
  const isFullyPublished = selectedForPublish.length > 0 && selectedForPublish.every((m) => m.status === 'published');

  useEffect(() => {
    setMatrix(initialContent);
  }, [initialContent]);

  useEffect(() => {
    if (regeneratePopoverIndex === null) return;
    const onDocClick = (e: MouseEvent) => {
      if (regeneratePopoverRef.current && !regeneratePopoverRef.current.contains(e.target as Node)) {
        setRegeneratePopoverIndex(null);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [regeneratePopoverIndex]);

  // Sync caption error mirror height with textarea scrollHeight and keep refs in sync
  useLayoutEffect(() => {
    const indices = Object.keys(captionErrorsByVisibleIndex).map(Number);
    indices.forEach((idx) => {
      const r = captionHighlightRefs.current[idx];
      if (!r) return;
      if (r.textarea && r.mirrorInner) {
        r.mirrorInner.style.minHeight = `${r.textarea.scrollHeight}px`;
      }
    });
  }, [captionErrorsByVisibleIndex, matrix]);

  // Visible columns: only enabled platforms that exist in matrix, in enabledPlatformIds order. If no filter, show all.
  const visibleColumns = enabledPlatformIds.length > 0
    ? enabledPlatformIds.filter((id) => matrix.some((m) => m.platform === id)).map((id) => matrix.find((m) => m.platform === id)!)
    : matrix;

  const getMatrixIndex = (visibleIndex: number): number => {
    if (enabledPlatformIds.length === 0) return visibleIndex;
    const platformId = visibleColumns[visibleIndex]?.platform;
    return platformId != null ? matrix.findIndex((m) => m.platform === platformId) : -1;
  };

  const handleTextChange = (visibleIndex: number, field: 'title' | 'content' | 'hashtags', value: string) => {
    const index = getMatrixIndex(visibleIndex);
    if (index < 0) return;
    const updated = [...matrix];
    if (field === 'hashtags') {
      updated[index].hashtags = value.split(' ').filter(t => t.startsWith('#'));
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    setMatrix(updated);
  };

  const toggleSelection = (visibleIndex: number) => {
    const index = getMatrixIndex(visibleIndex);
    if (index < 0) return;
    const updated = matrix.map((m, i) =>
      i === index ? { ...m, selected: !m.selected } : m
    );
    setMatrix(updated);
    onSave(updated);
  };

  const handlePublish = () => {
    const selectedInVisible = enabledPlatformIds.length > 0
      ? matrix.filter((m) => m.selected && enabledPlatformIds.includes(m.platform)).length
      : matrix.filter((m) => m.selected).length;
    if (selectedInVisible === 0) {
      alert("Please select at least one platform to publish.");
      return;
    }

    setIsPublishing(true);
    setTimeout(() => {
      setIsPublishing(false);
      const updated = matrix.map(m => m.selected ? { ...m, status: 'published' as const } : m);
      setMatrix(updated);
      onSave(updated);
      onPublish?.(updated);
    }, 2000);
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'linkedin': return <Linkedin className="text-[#0077b5]" size={20} />;
      case 'facebook': return <Facebook className="text-[#1877F2]" size={20} />;
      case 'twitter': return <Twitter className="text-black" size={20} />;
      case 'instagram': return <Instagram className="text-[#E4405F]" size={20} />;
      case 'tiktok': return <Video className="text-black" size={20} />;
      case 'youtube': return <Youtube className="text-[#FF0000]" size={20} />;
      default: return <Video size={20} />;
    }
  };

  const getPlatformName = (p: string) => {
    if (p === 'youtube') return 'YouTube';
    return p.charAt(0).toUpperCase() + p.slice(1);
  };

  const isTitleApplicable = (p: string) => {
    return !['instagram', 'tiktok', 'twitter'].includes(p);
  };

  const getCaptionMaxLength = (p: string) => (p === 'twitter' ? 280 : 2200);

  /** Parse combined caption string: last line that is only #-tokens becomes hashtags; rest is content. Enforce maxLen. */
  const parseCaptionWithHashtags = (raw: string, maxLen: number): { content: string; hashtags: string[] } => {
    let trimmed = raw;
    if (trimmed.length > maxLen) trimmed = trimmed.slice(0, maxLen);
    const lines = trimmed.split(/\n/);
    const lastLine = lines[lines.length - 1]?.trim() ?? '';
    const tokens = lastLine ? lastLine.split(/\s+/) : [];
    const allHashtags = tokens.length > 0 && tokens.every((t) => t.startsWith('#'));
    if (allHashtags && tokens.length > 0) {
      const hashtags = tokens.filter((t) => t.startsWith('#'));
      const content = lines.slice(0, -1).join('\n').trimEnd();
      return { content, hashtags };
    }
    return { content: trimmed, hashtags: [] };
  };

  const handleCaptionChange = (visibleIndex: number, rawValue: string) => {
    const index = getMatrixIndex(visibleIndex);
    if (index < 0) return;
    const col = visibleColumns[visibleIndex];
    const maxLen = getCaptionMaxLength(col.platform);
    const { content, hashtags } = parseCaptionWithHashtags(rawValue, maxLen);
    const updated = [...matrix];
    updated[index] = { ...updated[index], content, hashtags };
    setMatrix(updated);
    // Clear validation errors when user edits
    setCaptionErrorsByVisibleIndex((prev) => {
      const next = { ...prev };
      delete next[visibleIndex];
      return next;
    });
  };

  const handleRegenerateConfirm = async (visibleIndex: number) => {
    if (!regeneratePayload) return;
    const index = getMatrixIndex(visibleIndex);
    if (index < 0) return;
    const col = visibleColumns[visibleIndex];
    setRegenerateLoadingIndex(visibleIndex);
    setRegeneratePopoverIndex(null);
    const userPrompt = regenerateUserPrompt.trim() || undefined;
    setRegenerateUserPrompt('');
    try {
      const result = await regenerateSinglePlatform(
        { file: regeneratePayload.file, videoUrl: regeneratePayload.videoUrl },
        regeneratePayload.context,
        regeneratePayload.buId,
        regeneratePayload.buLabel,
        regeneratePayload.language,
        col.platform,
        userPrompt
      );
      const updated = [...matrix];
      updated[index] = { ...updated[index], title: result.title, content: result.content, hashtags: result.hashtags };
      setMatrix(updated);
      onSave(updated);
      onShowToast?.('Caption regenerated.');
    } catch (e) {
      onShowToast?.(e instanceof Error ? e.message : 'Regenerate failed.');
    } finally {
      setRegenerateLoadingIndex(null);
    }
  };

  const handleCheck = (visibleIndex: number) => {
    const col = visibleColumns[visibleIndex];
    const combined = col.content + (col.hashtags.length ? '\n\n' + col.hashtags.join(' ') : '');
    const result = validateCaptionFormat(combined);
    if (result.errors.length === 0) {
      onShowToast?.('No format issues found.');
      setCaptionErrorsByVisibleIndex((prev) => {
        const next = { ...prev };
        delete next[visibleIndex];
        return next;
      });
      return;
    }
    setCaptionErrorsByVisibleIndex((prev) => ({ ...prev, [visibleIndex]: result }));
  };

  const handleCorrect = (visibleIndex: number) => {
    const result = captionErrorsByVisibleIndex[visibleIndex];
    if (!result || result.errors.length === 0) return;
    const index = getMatrixIndex(visibleIndex);
    if (index < 0) return;
    const col = visibleColumns[visibleIndex];
    const maxLen = getCaptionMaxLength(col.platform);
    const { content, hashtags } = parseCaptionWithHashtags(result.correctedText, maxLen);
    const updated = [...matrix];
    updated[index] = { ...updated[index], content, hashtags };
    setMatrix(updated);
    onSave(updated);
    setCaptionErrorsByVisibleIndex((prev) => {
      const next = { ...prev };
      delete next[visibleIndex];
      return next;
    });
    onShowToast?.('Format corrections applied.');
  };

  const handleCaptionScroll = (visibleIndex: number, e: React.UIEvent<HTMLTextAreaElement>) => {
    const r = captionHighlightRefs.current[visibleIndex];
    if (r?.mirrorWrapper) r.mirrorWrapper.scrollTop = (e.target as HTMLTextAreaElement).scrollTop;
  };

  const triggerReplaceAsset = (visibleIndex: number) => {
    const index = getMatrixIndex(visibleIndex);
    if (index >= 0) replaceTargetIndexRef.current = index;
    coverInputRef.current?.click();
  };

  const handleCoverFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const index = replaceTargetIndexRef.current;
    e.target.value = '';
    replaceTargetIndexRef.current = null;
    if (!file || !file.type.startsWith('image/') || index == null || index < 0 || index >= matrix.length) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const updated = [...matrix];
      updated[index] = { ...updated[index], coverUrl: dataUrl };
      setMatrix(updated);
      onSave(updated);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex-1 bg-white flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between bg-white z-20 shadow-sm">
        <div className="flex items-center gap-4">
          {showBackButton && (
            <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full text-slate-500">
              <ChevronLeft size={20} />
            </button>
          )}
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              {videoName}
              <span className="text-xs font-normal px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full border border-blue-100">Draft</span>
            </h2>
            <p className="text-xs text-slate-500">Last edited just now</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onSave(matrix)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <Save size={16} />
            Save Draft
          </button>
          {canPublish && (
            <button 
              onClick={handlePublish}
              disabled={isPublishing}
              onMouseEnter={() => setPublishBtnHover(true)}
              onMouseLeave={() => setPublishBtnHover(false)}
              className={`flex items-center gap-2 px-6 py-2 text-sm font-medium text-white rounded-lg transition-all shadow-md
                ${isFullyPublished 
                  ? 'bg-green-600 hover:bg-green-500' 
                  : isPublishing 
                    ? 'bg-blue-400 cursor-not-allowed' 
                    : 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/20'
                }`}
            >
              {isFullyPublished ? (
                publishBtnHover ? (
                  <>
                    <Send size={18} /> Publish Again
                  </>
                ) : (
                  <>
                    <Check size={18} /> Published
                  </>
                )
              ) : isPublishing ? (
                <>
                  <RotateCw size={18} className="animate-spin" /> Publishing...
                </>
              ) : (
                <>
                  <Send size={18} /> Publish Selected
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Column Matrix View */}
      <input
        ref={coverInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleCoverFileChange}
      />
      <div className="flex-1 overflow-auto bg-slate-50/50 p-6">
        <PlatformMatrixGrid
          firstColumnHeader="Content Element"
          columns={visibleColumns.map((col) => ({
            platform: col.platform,
            label: getPlatformName(col.platform),
            icon: getPlatformIcon(col.platform),
          }))}
          renderHeaderCell={(i) => {
            const col = visibleColumns[i];
            return (
              <>
                <input
                  type="checkbox"
                  checked={col.selected}
                  onChange={() => toggleSelection(i)}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                />
                <div className="flex items-center gap-2">
                  {getPlatformIcon(col.platform)}
                  <span className="font-bold text-slate-800">{getPlatformName(col.platform)}</span>
                </div>
              </>
            );
          }}
          rows={[
            {
              id: 'title',
              label: 'Title / Headline',
              sublabel: 'Hook the audience',
              renderCell: (i) => {
                const col = visibleColumns[i];
                if (!isTitleApplicable(col.platform)) {
                  return (
                    <div className="h-24 flex items-center justify-center bg-slate-50 rounded-lg border border-slate-100 border-dashed text-slate-400 text-xs italic">
                      Not Applicable (Caption Only)
                    </div>
                  );
                }
                return (
                  <>
                    <textarea
                      value={col.title}
                      onChange={(e) => handleTextChange(i, 'title', e.target.value)}
                      className="w-full h-24 p-3 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none font-medium"
                      placeholder="Enter headline..."
                    />
                    <div className="text-right text-[10px] text-slate-400 mt-1">{col.title.length}/100</div>
                  </>
                );
              },
            },
            {
              id: 'caption',
              label: 'Caption / Body',
              sublabel: 'Main content text; put hashtags on the last line',
              stubClassName: 'pt-8',
              renderCell: (i) => {
                const col = visibleColumns[i];
                const maxLen = getCaptionMaxLength(col.platform);
                const combined = col.content + (col.hashtags.length ? '\n\n' + col.hashtags.join(' ') : '');
                const combinedLen = combined.length;
                const validation = captionErrorsByVisibleIndex[i];
                const hasErrors = validation && validation.errors.length > 0;
                const isRegenerating = regenerateLoadingIndex === i;
                const isPopoverOpen = regeneratePopoverIndex === i;
                const canRegenerate = Boolean(regeneratePayload);

                // Build highlight segments for error overlay
                const errorRanges = validation?.errors ?? [];
                const sortedRanges = [...errorRanges].sort((a, b) => a.start - b.start);
                const segments: { text: string; isError: boolean }[] = [];
                let pos = 0;
                for (const r of sortedRanges) {
                  if (r.start > pos) segments.push({ text: combined.slice(pos, r.start), isError: false });
                  segments.push({ text: combined.slice(r.start, r.end), isError: true });
                  pos = r.end;
                }
                if (pos < combined.length) segments.push({ text: combined.slice(pos), isError: false });

                const textareaMirrorClasses = 'p-3 text-sm leading-relaxed whitespace-pre-wrap break-words font-sans box-border';
                const setCaptionRef = (slot: 'textarea' | 'mirrorWrapper' | 'mirrorInner') => (el: HTMLTextAreaElement | HTMLDivElement | null) => {
                  if (!captionHighlightRefs.current[i]) captionHighlightRefs.current[i] = { textarea: null, mirrorWrapper: null, mirrorInner: null };
                  (captionHighlightRefs.current[i] as Record<string, HTMLTextAreaElement | HTMLDivElement | null>)[slot] = el;
                };
                return (
                  <div className="flex flex-col gap-1 relative">
                    <div className="relative h-[48rem]">
                      {hasErrors && segments.length > 0 && (
                        <div
                          ref={setCaptionRef('mirrorWrapper')}
                          className="absolute inset-0 overflow-auto pointer-events-none z-0 rounded-lg border border-slate-200 box-border"
                          aria-hidden
                        >
                          <div
                            ref={setCaptionRef('mirrorInner')}
                            className={`${textareaMirrorClasses} text-transparent select-none min-w-0`}
                          >
                            {segments.map((seg, idx) =>
                              seg.isError ? (
                                <mark key={idx} className="bg-amber-200/80 text-transparent rounded-sm">
                                  {seg.text}
                                </mark>
                              ) : (
                                <span key={idx}>{seg.text}</span>
                              )
                            )}
                          </div>
                        </div>
                      )}
                      <textarea
                        ref={setCaptionRef('textarea')}
                        value={combined}
                        onChange={(e) => handleCaptionChange(i, e.target.value)}
                        onScroll={(e) => hasErrors && handleCaptionScroll(i, e)}
                        className={`w-full h-full min-h-0 absolute inset-0 resize-none border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all ${textareaMirrorClasses} z-10 ${hasErrors ? 'bg-transparent' : 'bg-slate-50'} text-slate-600`}
                        placeholder="Write your caption... Put hashtags on the last line."
                      />
                    </div>
                    <div className={`text-right text-[10px] ${combinedLen > maxLen ? 'text-red-500' : 'text-slate-400'}`}>
                      {combinedLen}/{maxLen}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="relative" ref={i === regeneratePopoverIndex ? regeneratePopoverRef : undefined}>
                        <button
                          type="button"
                          disabled={!canRegenerate || isRegenerating}
                          title={
                            !canRegenerate
                              ? 'Regenerate is only available when you opened this project right after uploading the video in this session. Re-open from the upload flow or open a just-created project to use it.'
                              : undefined
                          }
                          onClick={() => setRegeneratePopoverIndex(isPopoverOpen ? null : i)}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {isRegenerating ? <RotateCw size={12} className="animate-spin" /> : <RotateCw size={12} />}
                          Regenerate
                        </button>
                        {isPopoverOpen && (
                          <div
                            className="absolute left-0 top-full z-30 mt-1 w-72 p-3 bg-white border border-slate-200 rounded-lg shadow-lg"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <textarea
                              value={regenerateUserPrompt}
                              onChange={(e) => setRegenerateUserPrompt(e.target.value)}
                              placeholder="Optional instruction for regeneration (e.g. make it shorter, more formal)"
                              className="w-full min-h-[60px] p-2 text-sm text-slate-700 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-y"
                              rows={2}
                            />
                            <div className="flex justify-end gap-2 mt-2">
                              <button
                                type="button"
                                onClick={() => setRegeneratePopoverIndex(null)}
                                className="px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRegenerateConfirm(i)}
                                className="px-2 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 rounded"
                              >
                                Regenerate
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => (hasErrors ? handleCorrect(i) : handleCheck(i))}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
                      >
                        {hasErrors ? <Wrench size={12} /> : <CheckCircle2 size={12} />}
                        {hasErrors ? 'Correct' : 'Check'}
                      </button>
                    </div>
                  </div>
                );
              },
            },
            {
              id: 'visual',
              label: 'Visual Asset',
              sublabel: 'Thumbnail/Video',
              renderCell: (i) => {
                const col = visibleColumns[i];
                const spec = getPlatformCoverSpec(col.platform);
                const coverUrl = col.coverUrl ?? sourceCoverUrl;
                const hasImage = Boolean(coverUrl);
                return (
                  <div className="w-full flex justify-center items-center">
                    <div
                      className="group relative flex-shrink-0 bg-slate-100 rounded-lg border border-slate-200 overflow-hidden cursor-pointer hover:border-blue-300 transition-all"
                      style={{ width: 272, aspectRatio: spec.aspectRatio }}
                      onClick={() => triggerReplaceAsset(i)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && triggerReplaceAsset(i)}
                      aria-label={`Replace cover for ${getPlatformName(col.platform)}`}
                    >
                      {hasImage ? (
                        <img src={coverUrl} alt="Cover" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                          <ImageIcon size={24} className="mb-1" />
                          <span className="text-xs">No cover</span>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-white/80 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-opacity">
                        <ImageIcon size={20} className="text-blue-600 mb-1" />
                        <span className="text-xs font-medium text-blue-600">Replace Asset</span>
                        <span className="text-[10px] text-slate-500 mt-0.5">{spec.width}×{spec.height}</span>
                      </div>
                    </div>
                  </div>
                );
              },
            },
          ]}
        />
      </div>
    </div>
  );
};

export default ContentEditor;
