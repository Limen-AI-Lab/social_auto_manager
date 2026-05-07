import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import UploadModal from './components/UploadModal';
import ContentEditor from './components/ContentEditor';
import ConfigPage from './components/ConfigPage';
import DistributionHistory from './components/DistributionHistory';
import DailyReport from './components/DailyReport';
import SimplePost from './components/SimplePost';
import { useAuth } from './context/AuthContext';
import { BusinessUnit, ContentProject, PlatformContent, PlatformConfig, BusinessUnitFilter, AppView } from './types';
import { generateSocialMatrix } from './services/geminiService';
import { publishToSocialMedia } from './services/socialPublish';
import { uploadVideo, uploadThumbnail } from './services/videoStorage';
import { fetchProjects, upsertProject, updateProjectContent, deleteProject } from './services/contentProjects';
import { fetchAllowedBusinessUnitIds } from './services/profileBusinessUnits';
import { fetchBusinessUnits, updateBusinessUnit, upsertBusinessUnit, deleteBusinessUnit, DEFAULT_BUSINESS_UNITS } from './services/businessUnits';
import { Building2, Plane, ShieldCheck, Sparkles } from 'lucide-react';

const SAMA_WEBHOOK_MODE_KEY = 'sama_webhook_mode';
function loadWebhookMode(): 'test' | 'prod' {
  try {
    const v = localStorage.getItem(SAMA_WEBHOOK_MODE_KEY);
    if (v === 'prod' || v === 'test') return v;
  } catch (_) {}
  return 'test';
}

const SAMA_PLATFORM_CONFIG_KEY = 'sama_platform_config';

const DEFAULT_PLATFORM_CONFIG: PlatformConfig[] = [
  { platform: 'linkedin', enabled: true, order: 1 },
  { platform: 'instagram', enabled: true, order: 2 },
  { platform: 'youtube', enabled: true, order: 3 },
  { platform: 'twitter', enabled: true, order: 4 },
  { platform: 'tiktok', enabled: true, order: 5 },
  { platform: 'facebook', enabled: true, order: 6 },
];

function loadPlatformConfigByBusinessUnit(): Record<string, PlatformConfig[]> {
  try {
    const raw = localStorage.getItem(SAMA_PLATFORM_CONFIG_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return { 'real-estate': parsed as PlatformConfig[] };
    }
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, PlatformConfig[]>;
    }
  } catch (_) {}
  return {};
}

function getEnabledPlatformIds(config: PlatformConfig[]): string[] {
  return config
    .filter((p) => p.enabled)
    .sort((a, b) => a.order - b.order)
    .map((p) => p.platform);
}

/** Ensure generated matrix has one row per enabled platform; add placeholder rows for any missing. */
function mergeGeneratedWithEnabledPlatforms(
  generatedMatrix: PlatformContent[],
  enabledPlatformIds: string[]
): PlatformContent[] {
  const byPlatform = new Map(generatedMatrix.map((m) => [m.platform, m]));
  return enabledPlatformIds.map((platformId) => {
    const existing = byPlatform.get(platformId);
    if (existing) return existing;
    return {
      platform: platformId as PlatformContent['platform'],
      title: '',
      content: '',
      hashtags: [],
      status: 'draft' as const,
      selected: true,
    };
  });
}

/** Extract first frame from video file as data URL, or null on failure. */
async function extractVideoFirstFrame(file: File): Promise<string | null> {
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.crossOrigin = 'anonymous';
  video.src = url;

  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve();
      video.onerror = () => reject(new Error('Video load failed'));
    });
    video.currentTime = 0.1;
    await new Promise<void>((resolve, reject) => {
      video.onseeked = () => resolve();
      video.onerror = () => reject(new Error('Seek failed'));
    });

    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return null;

    const maxSide = 1920;
    let cw = w;
    let ch = h;
    if (w > maxSide || h > maxSide) {
      if (w >= h) {
        cw = maxSide;
        ch = Math.round((h * maxSide) / w);
      } else {
        ch = maxSide;
        cw = Math.round((w * maxSide) / h);
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, cw, ch);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    return dataUrl;
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

const App: React.FC = () => {
  const { user, role, isAuthConfigured } = useAuth();
  const canPublish = isAuthConfigured ? (role === 'admin' || role === 'super_admin') : true;

  // Business Units: load from Supabase when auth; fallback to default list
  const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>(DEFAULT_BUSINESS_UNITS);
  /** null = full access (super_admin/admin) or not yet loaded; string[] = editor/viewer visible BU ids */
  const [allowedBuIds, setAllowedBuIds] = useState<string[] | null>(null);

  const [currentBusinessUnitFilter, setCurrentBusinessUnitFilter] = useState<BusinessUnitFilter>('all');
  const [view, setView] = useState<AppView>('dashboard');
  const [editorSourceView, setEditorSourceView] = useState<AppView | null>(null);
  const [distributionHistoryFilter, setDistributionHistoryFilter] = useState<'total' | 'ready' | 'failed' | 'published' | undefined>(undefined);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [generationProgress, setGenerationProgress] = useState<Record<string, number>>({});
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  // Distribution webhook (n8n): URL and multipart field names
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookPayloadField, setWebhookPayloadField] = useState('payload');
  const [webhookVideoField, setWebhookVideoField] = useState('video');
  const [webhookMode, setWebhookMode] = useState<'test' | 'prod'>(loadWebhookMode);
  // Store video File by project id so Publish can send binary
  const [videoFilesByProjectId, setVideoFilesByProjectId] = useState<Record<string, File>>({});
  // Platform config per business unit (enabled + order); persisted to localStorage
  const [platformConfigByBusinessUnit, setPlatformConfigByBusinessUnit] = useState<Record<string, PlatformConfig[]>>(loadPlatformConfigByBusinessUnit);

  useEffect(() => {
    if (!toastMessage) return;
    const t = setTimeout(() => setToastMessage(null), 3000);
    return () => clearTimeout(t);
  }, [toastMessage]);

  useEffect(() => {
    try {
      localStorage.setItem(SAMA_WEBHOOK_MODE_KEY, webhookMode);
    } catch (_) {}
  }, [webhookMode]);

  useEffect(() => {
    try {
      localStorage.setItem(SAMA_PLATFORM_CONFIG_KEY, JSON.stringify(platformConfigByBusinessUnit));
    } catch (_) {}
  }, [platformConfigByBusinessUnit]);

  // Projects: load from Supabase when auth configured and user present; otherwise keep mock for dev
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projects, setProjects] = useState<ContentProject[]>([
    {
      id: '1',
      videoName: 'Clifton Beach House Tour.mp4',
      uploadDate: '2023-10-24',
      businessUnit: 'real-estate',
      status: 'published',
      thumbnailUrl: 'https://picsum.photos/400/300?random=1',
      generatedContent: [
        {
          platform: 'linkedin',
          title: 'Luxury Beachfront Living: Clifton Beach House Tour',
          content: 'Experience the epitome of coastal luxury with this stunning Clifton Beach property. Featuring panoramic ocean views, modern architecture, and premium finishes throughout. Perfect for those seeking an exclusive lifestyle in one of Cape Town\'s most prestigious locations. #LuxuryRealEstate #CliftonBeach #CapeTownProperty',
          hashtags: ['#LuxuryRealEstate', '#CliftonBeach', '#CapeTownProperty', '#Beachfront', '#PropertyTour'],
          status: 'published',
          selected: true
        },
        {
          platform: 'instagram',
          title: '',
          content: '✨ Dream home alert! This Clifton Beach house is everything we\'ve been dreaming of 🌊\n\n📍 Clifton Beach, Cape Town\n🏖️ Direct beach access\n🌅 Breathtaking ocean views\n✨ Modern luxury finishes\n\nWho else is ready to make this their home? 💙\n\n#CliftonBeach #CapeTownHomes #LuxuryLiving #BeachfrontProperty #DreamHome #SouthAfrica',
          hashtags: ['#CliftonBeach', '#CapeTownHomes', '#LuxuryLiving', '#BeachfrontProperty', '#DreamHome'],
          status: 'published',
          selected: true
        },
        {
          platform: 'youtube',
          title: 'Luxury Clifton Beach House Tour | Cape Town Real Estate',
          content: '[HOOK: 0-3s]\n"Imagine waking up to this view every single day..."\n\n[MAIN CONTENT]\nWelcome to this stunning Clifton Beach property. Let\'s explore what makes this home truly special.\n\n[VISUAL CUE: Show exterior]\nThe property features contemporary architecture with floor-to-ceiling windows that maximize the ocean views.\n\n[VISUAL CUE: Show living area]\nThe open-plan living space flows seamlessly to the outdoor terrace, perfect for entertaining.\n\n[VISUAL CUE: Show master bedroom]\nThe master suite offers private balcony access and uninterrupted sea views.\n\n[CTA]\nInterested in viewing this property? Contact us for a private tour.\n\n[END SCREEN]\nSubscribe for more luxury property tours!',
          hashtags: ['#PropertyTour', '#CliftonBeach', '#LuxuryHomes', '#CapeTown', '#RealEstate'],
          status: 'published',
          selected: true
        },
        {
          platform: 'twitter',
          title: 'Luxury Clifton Beach House Tour - Cape Town Real Estate',
          content: '🏖️ Just toured this stunning Clifton Beach property!\n\n✨ Ocean views\n✨ Modern luxury\n✨ Direct beach access\n\nPerfect for those seeking an exclusive coastal lifestyle in Cape Town.\n\n#CapeTownRealEstate #CliftonBeach #LuxuryProperty',
          hashtags: ['#CapeTownRealEstate', '#CliftonBeach', '#LuxuryProperty', '#CapeTown'],
          status: 'published',
          selected: true
        }
      ]
    },
    {
      id: '2',
      videoName: 'Visa Policy Update Q4.mov',
      uploadDate: '2023-10-22',
      businessUnit: 'immigration',
      status: 'ready',
      thumbnailUrl: 'https://picsum.photos/400/300?random=2',
      generatedContent: [
        {
          platform: 'linkedin',
          title: 'Important Q4 Visa Policy Updates: What You Need to Know',
          content: 'Stay informed about the latest visa policy changes for Q4 2023. Our immigration experts break down the key updates affecting work permits, study visas, and permanent residency applications. Understanding these changes is crucial for anyone navigating South African immigration processes. Book a consultation to discuss how these updates may impact your application. #ImmigrationLaw #VisaUpdates #SouthAfrica',
          hashtags: ['#ImmigrationLaw', '#VisaUpdates', '#SouthAfrica', '#WorkPermit', '#Immigration'],
          status: 'draft',
          selected: true
        },
        {
          platform: 'facebook',
          title: 'Q4 Visa Policy Updates - Important Information',
          content: '📋 Important Visa Policy Updates for Q4 2023\n\nWe\'ve compiled the latest changes to help you stay informed:\n\n✅ Work permit processing times\n✅ Study visa requirements\n✅ Permanent residency updates\n✅ New documentation requirements\n\nOur team is here to help you navigate these changes. Have questions? Drop them in the comments or book a free consultation.\n\n#VisaUpdates #ImmigrationHelp #SouthAfrica',
          hashtags: ['#VisaUpdates', '#ImmigrationHelp', '#SouthAfrica', '#WorkPermit', '#StudyVisa'],
          status: 'draft',
          selected: true
        },
        {
          platform: 'youtube',
          title: 'Q4 2023 Visa Policy Updates Explained | South African Immigration',
          content: '[HOOK: 0-3s]\n"Big changes are coming to South African visa policies this quarter..."\n\n[MAIN CONTENT]\nLet\'s break down the Q4 2023 visa policy updates you need to know about.\n\n[VISUAL CUE: Show policy document]\nFirst, work permit processing times have been adjusted. Applications now take 8-12 weeks on average.\n\n[VISUAL CUE: Show checklist]\nStudy visa requirements have been updated. Make sure you have all the new documentation.\n\n[VISUAL CUE: Show timeline]\nPermanent residency applications have new eligibility criteria.\n\n[CTA]\nNeed help with your application? Book a consultation with our experts.\n\n[END SCREEN]\nSubscribe for more immigration updates!',
          hashtags: ['#VisaUpdates', '#Immigration', '#SouthAfrica', '#WorkPermit', '#StudyVisa'],
          status: 'draft',
          selected: true
        },
        {
          platform: 'twitter',
          title: 'Q4 Visa Policy Updates - South African Immigration',
          content: '📋 Q4 2023 Visa Policy Updates:\n\n✅ Work permits: 8-12 week processing\n✅ Study visas: New requirements\n✅ PR applications: Updated criteria\n\nStay informed and prepared. Need help? DM us.\n\n#VisaUpdates #Immigration #SouthAfrica',
          hashtags: ['#VisaUpdates', '#Immigration', '#SouthAfrica', '#WorkPermit'],
          status: 'draft',
          selected: true
        }
      ],
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() // 2 hours ago
    },
    {
      id: '3',
      videoName: 'Beach_Tour.mp4',
      uploadDate: '2023-10-23',
      businessUnit: 'real-estate',
      status: 'failed',
      thumbnailUrl: 'https://picsum.photos/400/300?random=3',
      generatedContent: [
        {
          platform: 'linkedin',
          title: 'Beach Tour Video',
          content: 'Failed content',
          hashtags: [],
          status: 'draft',
          selected: false
        }
      ],
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() // 1 day ago
    },
    {
      id: '4',
      videoName: 'Tax_Tips.mp4',
      uploadDate: '2023-10-25',
      businessUnit: 'insurance',
      status: 'processing',
      thumbnailUrl: 'https://picsum.photos/400/300?random=4',
      generatedContent: [
        {
          platform: 'linkedin',
          title: 'Tax Tips Video',
          content: 'Processing content',
          hashtags: [],
          status: 'draft',
          selected: false
        }
      ],
      createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString() // 1 hour ago
    }
  ]);

  const [currentProject, setCurrentProject] = useState<ContentProject | null>(null);

  // Load allowed BU ids for editor/viewer (null for super_admin/admin)
  useEffect(() => {
    if (!isAuthConfigured || !user?.id) return;
    if (role === 'super_admin' || role === 'admin') {
      setAllowedBuIds(null);
      return;
    }
    if (role === 'editor' || role === 'viewer') {
      fetchAllowedBusinessUnitIds(user.id).then((ids) => {
        setAllowedBuIds(ids);
      });
    }
  }, [isAuthConfigured, user?.id, role]);

  // When editor/viewer and allowedBuIds is set, ensure current filter is in allowed list (or 'all')
  useEffect(() => {
    if (allowedBuIds === null || allowedBuIds.length === 0) return;
    if (currentBusinessUnitFilter !== 'all' && !allowedBuIds.includes(currentBusinessUnitFilter)) {
      setCurrentBusinessUnitFilter('all');
    }
  }, [allowedBuIds, currentBusinessUnitFilter]);

  // Load projects from Supabase by role and visible BU
  useEffect(() => {
    if (!isAuthConfigured) {
      setProjectsLoading(false);
      return;
    }
    if (!user?.id) {
      setProjectsLoading(false);
      return;
    }
    const fullAccess = role === 'super_admin' || role === 'admin';
    if (!fullAccess && (role === 'editor' || role === 'viewer') && allowedBuIds === null) {
      // Still loading allowedBuIds for editor/viewer
      return;
    }
    fetchProjects({
      role,
      allowedBuIds: fullAccess ? null : (allowedBuIds ?? []),
    }).then((data) => {
      setProjects(data);
    }).catch((error: unknown) => {
      setToastMessage('Failed to load projects. Please refresh and try again.');
    }).finally(() => setProjectsLoading(false));
  }, [isAuthConfigured, user?.id, role, allowedBuIds]);

  // Load business units from Supabase when auth; optional localStorage cache on success
  const SAMA_BUSINESS_UNITS_CACHE_KEY = 'sama_business_units_cache';
  useEffect(() => {
    if (!isAuthConfigured || !user?.id) return;
    fetchBusinessUnits().then((list) => {
      setBusinessUnits(list);
      try {
        localStorage.setItem(SAMA_BUSINESS_UNITS_CACHE_KEY, JSON.stringify(list));
      } catch (_) {}
    });
  }, [isAuthConfigured, user?.id]);

  // Business Units CRUD operations; sync to Supabase when admin or super_admin
  const canManageBUs = role === 'super_admin' || role === 'admin';

  const handleAddBusinessUnit = async (unit: Omit<BusinessUnit, 'id'>): Promise<boolean> => {
    const newId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `unit-${Date.now()}`;
    const newUnit: BusinessUnit = {
      ...unit,
      id: newId,
    };
    setBusinessUnits((prev) => [...prev, newUnit]);
    setCurrentBusinessUnitFilter(newUnit.id);
    if (canManageBUs) {
      const ok = await upsertBusinessUnit(newUnit);
      if (!ok) {
        setBusinessUnits((prev) => prev.filter((u) => u.id !== newId));
        setToastMessage('Failed to save business unit. Please try again.');
        return false;
      }
    }
    return true;
  };

  const handleDeleteBusinessUnit = async (id: string): Promise<boolean> => {
    if (businessUnits.length <= 1) {
      alert('At least one business unit is required.');
      return false;
    }
    const unitToDelete = businessUnits.find((u) => u.id === id);
    const previousList = businessUnits;
    const previousFilter = currentBusinessUnitFilter;
    if (unitToDelete && currentBusinessUnitFilter === unitToDelete.id) {
      setCurrentBusinessUnitFilter('all');
    }
    setBusinessUnits((prev) => prev.filter((u) => u.id !== id));
    if (canManageBUs) {
      const ok = await deleteBusinessUnit(id);
      if (!ok) {
        setBusinessUnits(previousList);
        setCurrentBusinessUnitFilter(previousFilter);
        setToastMessage('Failed to delete business unit. Please try again.');
        return false;
      }
    }
    return true;
  };

  const handleUpdateBusinessUnit = async (id: string, updates: Partial<BusinessUnit>): Promise<boolean> => {
    const previous = businessUnits.find((u) => u.id === id);
    if (!previous) return false;
    setBusinessUnits((prev) =>
      prev.map((u) => (u.id === id ? { ...u, ...updates } : u))
    );
    if (canManageBUs) {
      const { id: _omit, ...safe } = updates;
      if (Object.keys(safe).length > 0) {
        const ok = await updateBusinessUnit(id, safe);
        if (!ok) {
          setBusinessUnits((prev) =>
            prev.map((u) => (u.id === id ? previous : u))
          );
          setToastMessage('Failed to save business unit. Please try again.');
          return false;
        }
      }
    }
    return true;
  };

  const handleSaveProfileCode = (buId: string, profileCode: string) => {
    setBusinessUnits((prev) =>
      prev.map((u) => (u.id === buId ? { ...u, profileCode } : u))
    );
    updateBusinessUnit(buId, { profileCode }).catch(() => {});
  };

  const handleUploadStart = async (file: File, context: string, selectedBusinessUnitIds: string[]) => {
    setIsProcessing(true);
    setUploadProgress(0);
    setGenerationProgress({});
    
    try {
      // Extract first frame in parallel with video upload
      const firstFramePromise = extractVideoFirstFrame(file);

      // Upload video to Supabase (or simulate progress if not configured)
      const uploadInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 50) {
            clearInterval(uploadInterval);
            return 50;
          }
          return prev + 2;
        });
      }, 100);

      const [uploadedVideoUrl, sourceCoverUrl] = await Promise.all([
        uploadVideo(file).catch((e: unknown) => {
          setToastMessage(e instanceof Error ? e.message : 'Video upload failed.');
          return null;
        }),
        firstFramePromise,
      ]);

      clearInterval(uploadInterval);
      setUploadProgress(50);

      if (!uploadedVideoUrl) {
        setIsProcessing(false);
        setUploadProgress(0);
        setGenerationProgress({});
        return;
      }

      // Start parallel generation for each selected Business Unit (by id)
      const generationPromises = selectedBusinessUnitIds.map(async (buId) => {
        const bu = businessUnits.find((b) => b.id === buId);
        if (!bu) return { buId, generatedMatrix: [] as PlatformContent[], success: false as const };
        setGenerationProgress(prev => ({ ...prev, [buId]: 50 }));

        try {
          const progressInterval = setInterval(() => {
            setGenerationProgress(prev => {
              const current = prev[buId] || 50;
              if (current >= 100) {
                clearInterval(progressInterval);
                return { ...prev, [buId]: 100 };
              }
              return { ...prev, [buId]: current + 5 };
            });
          }, 200);

          const enabledIds = getEnabledPlatformIds(platformConfigByBusinessUnit[buId] ?? DEFAULT_PLATFORM_CONFIG);
          const generatedMatrix = await generateSocialMatrix(file, context, bu.id, bu.label, 'en-ZA', enabledIds);
          
          clearInterval(progressInterval);
          setGenerationProgress(prev => ({ ...prev, [buId]: 100 }));

          return {
            buId,
            generatedMatrix,
            success: true
          };
        } catch (error) {
          console.error(`Failed to generate for ${bu.label}:`, error);
          setGenerationProgress(prev => ({ ...prev, [buId]: 100 }));
          return {
            buId,
            generatedMatrix: [] as PlatformContent[],
            success: false,
            error
          };
        }
      });

      // Wait for all generations to complete
      const results = await Promise.all(generationPromises);

      // Create ContentProject for each successful generation
      const newProjects: ContentProject[] = [];
      const now = new Date().toISOString();
      
      results.forEach((result) => {
        if (result.success && result.generatedMatrix.length > 0) {
          const enabledIds = getEnabledPlatformIds(platformConfigByBusinessUnit[result.buId] ?? DEFAULT_PLATFORM_CONFIG);
          const mergedContent = mergeGeneratedWithEnabledPlatforms(result.generatedMatrix, enabledIds);
          const id = `${Date.now()}-${result.buId}`;
          const newProject: ContentProject = {
            id,
            videoName: file.name,
            uploadDate: new Date().toISOString().split('T')[0],
            businessUnit: result.buId,
            status: 'ready',
            thumbnailUrl: sourceCoverUrl ?? `https://picsum.photos/400/300?random=${Date.now()}-${result.buId}`,
            sourceCoverUrl: sourceCoverUrl ?? undefined,
            videoUrl: uploadedVideoUrl ?? undefined,
            generatedContent: mergedContent,
            createdAt: now
          };
          newProjects.push(newProject);
        }
      });

      // Optionally upload first-frame thumbnail to Supabase and refresh project(s)
      if (sourceCoverUrl && newProjects.length > 0) {
        const firstId = newProjects[0].id;
        const newIds = new Set(newProjects.map((n) => n.id));
        uploadThumbnail(sourceCoverUrl, firstId).then((thumbUrl) => {
          if (thumbUrl) {
            setProjects((prev) =>
              prev.map((p) => (newIds.has(p.id) ? { ...p, thumbnailUrl: thumbUrl } : p))
            );
            setCurrentProject((c) =>
              c && newIds.has(c.id) ? { ...c, thumbnailUrl: thumbUrl } : c
            );
          }
        }).catch(() => {});
      }

      if (newProjects.length > 0) {
        setProjects([...newProjects, ...projects]);
        setCurrentProject(newProjects[0]);
        if (user?.id) {
          newProjects.forEach((p) => upsertProject(user.id, p).catch(() => {}));
        }
        // Store video File by project id for Publish (webhook binary)
        setVideoFilesByProjectId(prev => {
          const next = { ...prev };
          newProjects.forEach(p => { next[p.id] = file; });
          return next;
        });
      }

      // Close modal after a short delay to show completion
      setTimeout(() => {
        setIsUploadOpen(false);
        setIsProcessing(false);
        setUploadProgress(0);
        setGenerationProgress({});
        // Switch to dashboard to show all new projects
        setView('dashboard');
      }, 500);
    } catch (error) {
      console.error("Failed to process upload", error);
      alert("Failed to generate content. Please check console.");
      setIsProcessing(false);
      setUploadProgress(0);
      setGenerationProgress({});
    }
  };

  const handleDeleteProject = async (project: ContentProject) => {
    if (!user?.id) return;
    const ok = await deleteProject(user.id, project.id);
    if (ok) {
      setProjects((prev) => prev.filter((p) => p.id !== project.id));
      if (currentProject?.id === project.id) {
        setCurrentProject(null);
        setView(editorSourceView === 'distribution-history' ? 'distribution-history' : 'dashboard');
        setEditorSourceView(null);
      }
    }
  };

  const handleSaveContent = (updatedContent: PlatformContent[]) => {
    if (currentProject) {
      const updatedProject = { ...currentProject, generatedContent: updatedContent };
      setProjects(projects.map(p => p.id === updatedProject.id ? updatedProject : p));
      setCurrentProject(updatedProject);
      if (user?.id) {
        updateProjectContent(user.id, currentProject.id, updatedContent).catch(() => {});
      }
    }
  };

  const handlePublish = async (updatedContent: PlatformContent[], project?: ContentProject) => {
    const targetProject = project ?? currentProject;
    if (!targetProject) return;
    let videoUrl = targetProject.videoUrl;
    if (!videoUrl) {
      const file = videoFilesByProjectId[targetProject.id];
      if (file) {
        setToastMessage('Uploading video to Supabase...');
        const url = await uploadVideo(file).catch((e: unknown) => {
          setToastMessage(e instanceof Error ? e.message : 'Video upload failed.');
          return null;
        });
        if (url) {
          videoUrl = url;
          const updatedProject = { ...targetProject, videoUrl };
          setProjects(prev => prev.map(p => p.id === targetProject.id ? updatedProject : p));
          setCurrentProject(c => c?.id === targetProject.id ? updatedProject : c);
          if (user?.id) {
            await upsertProject(user.id, updatedProject);
          }
        }
      }
      if (!videoUrl) {
        setToastMessage('Video URL not available (upload to Supabase first or file too large); publish not sent.');
        return;
      }
    }
    const toPublish = updatedContent.filter((p) => p.selected);
    if (toPublish.length === 0) {
      setToastMessage('No platforms selected; nothing sent.');
      return;
    }
    const bu = businessUnits.find((b) => b.id === targetProject.businessUnit);
    const profileCode = bu?.profileCode?.trim();

    if (!profileCode) {
      setToastMessage('Configure Profile Key in Settings > Profile Key first.');
      return;
    }

    const socialRequests = [{
      profileKey: profileCode,
      businessUnit: bu?.label,
      posts: toPublish.map((p) => ({
        platforms: [p.platform],
        post: p.content + (p.hashtags?.length ? '\n\n' + p.hashtags.join(' ') : ''),
        mediaUrls: [videoUrl],
        ...(p.platform === 'youtube' ? { youTubeOptions: { title: p.title, visibility: 'public' as const } } : {}),
      })),
    }];
    console.log('[Publish] Sending to Edge Function (publish-to-social-media)', { projectId: targetProject.id });
    publishToSocialMedia({ requests: socialRequests })
      .then((result) => {
        if (result.success) {
          setToastMessage('Sent to social media.');
          const updated = updatedContent.map((p) => (p.selected ? { ...p, status: 'published' as const } : p));
          setProjects((prev) => prev.map((p) => (p.id === targetProject.id ? { ...p, generatedContent: updated } : p)));
          setCurrentProject((c) => (c?.id === targetProject.id ? { ...c, generatedContent: updated } : c));
          if (user?.id) {
            updateProjectContent(user.id, targetProject.id, updated, 'published').catch(() => {});
          }
        } else {
          setToastMessage(result.error ?? 'Publish failed.');
        }
      })
      .catch(() => setToastMessage('Publish to social media failed.'));
  };

  const filteredProjects = currentBusinessUnitFilter === 'all' 
    ? projects 
    : projects.filter(p => p.businessUnit === currentBusinessUnitFilter);

  // For editor/viewer, only show allowed BUs in upload and other flows; super_admin/admin see all
  const visibleBusinessUnits = allowedBuIds !== null
    ? businessUnits.filter((bu) => allowedBuIds.includes(bu.id))
    : businessUnits;

  // Get the most recent generated project
  const getRecentGeneratedProject = (): ContentProject | null => {
    if (filteredProjects.length === 0) return null;
    const sorted = [...filteredProjects].sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });
    return sorted[0];
  };

  const renderContent = () => {
    switch (view) {
      case 'settings': {
        const currentBusinessUnit = currentBusinessUnitFilter === 'all' ? 'real-estate' : currentBusinessUnitFilter;
        return (
          <ConfigPage 
            onBack={() => setView('dashboard')}
            currentBusinessUnit={currentBusinessUnit}
            businessUnits={businessUnits}
            canManageBusinessUnits={canManageBUs}
            onSwitchBusinessUnit={(bu) => setCurrentBusinessUnitFilter(bu)}
            onAddBusinessUnit={handleAddBusinessUnit}
            onDeleteBusinessUnit={handleDeleteBusinessUnit}
            onUpdateBusinessUnit={handleUpdateBusinessUnit}
            onSaveProfileCode={handleSaveProfileCode}
            onShowToast={(msg) => setToastMessage(msg)}
            platformConfig={platformConfigByBusinessUnit[currentBusinessUnit] ?? DEFAULT_PLATFORM_CONFIG}
            onPlatformConfigChange={(config) => setPlatformConfigByBusinessUnit((prev) => ({ ...prev, [currentBusinessUnit]: config }))}
            webhookUrl={webhookUrl}
            onWebhookUrlChange={setWebhookUrl}
            webhookPayloadField={webhookPayloadField}
            onWebhookPayloadFieldChange={setWebhookPayloadField}
            webhookVideoField={webhookVideoField}
            onWebhookVideoFieldChange={setWebhookVideoField}
            webhookMode={webhookMode}
            onWebhookModeChange={setWebhookMode}
          />
        );
      }
      case 'editor':
        return currentProject && (() => {
          const file = videoFilesByProjectId[currentProject.id];
          const bu = businessUnits.find((b) => b.id === currentProject.businessUnit);
          const hasVideo = file || currentProject.videoUrl;
          const regeneratePayload = hasVideo && bu
            ? { file, videoUrl: currentProject.videoUrl, context: '', buId: bu.id, buLabel: bu.label, language: 'en-ZA' as const }
            : undefined;
          return (
            <ContentEditor
              initialContent={currentProject.generatedContent}
              enabledPlatformIds={getEnabledPlatformIds(platformConfigByBusinessUnit[currentProject.businessUnit] ?? DEFAULT_PLATFORM_CONFIG)}
              videoName={currentProject.videoName}
              sourceCoverUrl={currentProject.sourceCoverUrl}
              onBack={() => {
                setView(editorSourceView ?? 'dashboard');
                setEditorSourceView(null);
              }}
              onSave={handleSaveContent}
              onPublish={handlePublish}
              canPublish={canPublish}
              regeneratePayload={regeneratePayload}
              onShowToast={setToastMessage}
            />
          );
        })();
      case 'distribution-history':
        return (
          <DistributionHistory 
            projects={filteredProjects}
            businessUnits={businessUnits}
            statusFilter={distributionHistoryFilter}
            onSelectProject={(p) => {
              setCurrentProject(p);
              setView('editor');
              setEditorSourceView('distribution-history');
            }}
            onDeleteProject={handleDeleteProject}
          />
        );
      case 'recent-generated': {
        // Initial state: no BU selected (filter is 'all') → show empty until user picks a business unit
        if (currentBusinessUnitFilter === 'all') {
          return (
            <div className="flex-1 bg-slate-50 p-8 overflow-y-auto flex items-center justify-center">
              <div className="text-center py-20 bg-white rounded-xl border border-slate-200 border-dashed max-w-md mx-auto px-8">
                <div className="mx-auto w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4 text-slate-400">
                  <Sparkles size={32} />
                </div>
                <h3 className="text-lg font-medium text-slate-900">Select a business unit</h3>
                <p className="text-slate-500 mt-2">
                  Choose a business unit in the sidebar to view its most recently generated content.
                </p>
              </div>
            </div>
          );
        }
        // Show this BU's most recent generated item only if it has ready/published content; otherwise empty state (no table)
        const recentProject = getRecentGeneratedProject();
        const hasContent = recentProject
          && recentProject.generatedContent
          && recentProject.generatedContent.length > 0
          && (recentProject.status === 'ready' || recentProject.status === 'published');
        if (hasContent && recentProject) {
          const file = videoFilesByProjectId[recentProject.id];
          const bu = businessUnits.find((b) => b.id === recentProject.businessUnit);
          const regeneratePayload = file && bu
            ? { file, context: '', buId: bu.id, buLabel: bu.label, language: 'en-ZA' as const }
            : undefined;
          return (
            <ContentEditor
              initialContent={recentProject.generatedContent}
              enabledPlatformIds={getEnabledPlatformIds(platformConfigByBusinessUnit[recentProject.businessUnit] ?? DEFAULT_PLATFORM_CONFIG)}
              videoName={recentProject.videoName}
              sourceCoverUrl={recentProject.sourceCoverUrl}
              showBackButton={false}
              onBack={() => setView('dashboard')}
              onSave={(updatedContent) => {
                const updatedProject = { ...recentProject, generatedContent: updatedContent };
                setProjects(projects.map(p => p.id === updatedProject.id ? updatedProject : p));
              }}
              onPublish={(content) => handlePublish(content, recentProject)}
              canPublish={canPublish}
              regeneratePayload={regeneratePayload}
              onShowToast={setToastMessage}
            />
          );
        }
        const buLabel = businessUnits.find(bu => bu.id === currentBusinessUnitFilter)?.label ?? currentBusinessUnitFilter;
        return (
          <div className="flex-1 bg-slate-50 p-8 overflow-y-auto flex items-center justify-center">
            <div className="text-center py-20 bg-white rounded-xl border border-slate-200 border-dashed max-w-md mx-auto px-8">
              <div className="mx-auto w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4 text-slate-400">
                <Sparkles size={32} />
              </div>
              <h3 className="text-lg font-medium text-slate-900">No recent generated content</h3>
              <p className="text-slate-500 mt-2">
                No content has been generated yet for {buLabel}. Upload a video to get started.
              </p>
            </div>
          </div>
        );
      }
      case 'daily-report':
        return (
          <DailyReport
            projects={projects}
            businessUnits={businessUnits}
            onShowToast={setToastMessage}
          />
        );
      case 'simple-post':
        return (
          <SimplePost
            businessUnits={businessUnits}
            onShowToast={setToastMessage}
          />
        );
      case 'dashboard':
      default:
        return (
          <Dashboard 
            projects={filteredProjects}
            businessUnits={businessUnits}
            currentBusinessUnitFilter={currentBusinessUnitFilter}
            onSelectProject={(p) => {
              setCurrentProject(p);
              setView('editor');
              setEditorSourceView('dashboard');
            }}
            onDeleteProject={handleDeleteProject}
            onNavigateToDistributionHistory={(filter) => {
              setDistributionHistoryFilter(filter);
              setView('distribution-history');
            }}
          />
        );
    }
  };

  return (
    <div className="flex h-screen w-full bg-slate-50 text-slate-900 font-sans">
      
      {view !== 'settings' && (
        <Sidebar 
          currentBusinessUnitFilter={currentBusinessUnitFilter} 
          currentView={view}
          editorSourceView={editorSourceView}
          disableBusinessUnitSwitch={view === 'recent-generated'}
          businessUnits={businessUnits}
          allowedBuIds={allowedBuIds}
          onSwitchBusinessUnit={(bu) => {
            if (view === 'editor') {
              setView(editorSourceView ?? 'dashboard');
              setEditorSourceView(null);
            }
            setCurrentBusinessUnitFilter(bu);
          }}
          onNavigate={(v) => {
            setView(v);
            if (view === 'editor') setEditorSourceView(null);
            // Keep current BU selection when switching to Recent Generated (All Units still shows empty state)
          }}
          onNewPost={() => setIsUploadOpen(true)}
        />
      )}

      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {projectsLoading && isAuthConfigured && user ? (
          <div className="flex-1 flex items-center justify-center bg-slate-50">
            <p className="text-slate-600">Loading projects...</p>
          </div>
        ) : (
          renderContent()
        )}
      </div>

      <UploadModal 
        isOpen={isUploadOpen} 
        onClose={() => !isProcessing && setIsUploadOpen(false)}
        onUploadStart={handleUploadStart}
        isProcessing={isProcessing}
        businessUnits={visibleBusinessUnits}
        uploadProgress={uploadProgress}
        generationProgress={generationProgress}
      />

      {toastMessage && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] px-4 py-2.5 bg-slate-800 text-white text-sm font-medium rounded-lg shadow-lg"
          role="status"
        >
          {toastMessage}
        </div>
      )}
    </div>
  );
};

export default App;
