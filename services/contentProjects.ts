import { getSupabase } from '../lib/supabase';
import { ContentProject, PlatformContent, UserRole } from '../types';

interface ContentProjectRow {
  id: string;
  owner_id: string;
  video_name: string;
  upload_date: string;
  business_unit: string;
  status: string;
  thumbnail_url: string;
  source_cover_url: string | null;
  video_url: string | null;
  generated_content: PlatformContent[];
  created_at: string | null;
  updated_at: string;
}

function rowToProject(row: ContentProjectRow): ContentProject {
  return {
    id: row.id,
    videoName: row.video_name,
    uploadDate: row.upload_date,
    businessUnit: row.business_unit,
    status: row.status as ContentProject['status'],
    thumbnailUrl: row.thumbnail_url ?? '',
    sourceCoverUrl: row.source_cover_url ?? undefined,
    videoUrl: row.video_url ?? undefined,
    generatedContent: Array.isArray(row.generated_content) ? row.generated_content : [],
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  };
}

export interface FetchProjectsOptions {
  role: UserRole;
  /** null = full access (super_admin/admin); empty array = no visible BUs */
  allowedBuIds: string[] | null;
}

/**
 * Fetch content projects visible to the current user (RLS enforces). Returns [] if Supabase is not configured or error.
 * - super_admin/admin or allowedBuIds === null: no filter (RLS returns all visible rows).
 * - editor/viewer: filter by business_unit in allowedBuIds; empty array returns [].
 */
export async function fetchProjects(options: FetchProjectsOptions): Promise<ContentProject[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { role, allowedBuIds } = options;
  const fullAccess = role === 'super_admin' || role === 'admin' || allowedBuIds === null;
  let query = supabase.from('content_projects').select('*').order('created_at', { ascending: false });
  if (!fullAccess) {
    if (allowedBuIds.length === 0) return [];
    query = query.in('business_unit', allowedBuIds);
  }
  const { data, error } = await query;
  if (error) {
    console.error('[contentProjects] fetch error', error);
    return [];
  }
  return (data ?? []).map((row) => rowToProject(row as ContentProjectRow));
}

/**
 * Insert or update a content project. ownerId must match the authenticated user (RLS enforces).
 */
export async function upsertProject(ownerId: string, project: ContentProject): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  const row = {
    id: project.id,
    owner_id: ownerId,
    video_name: project.videoName,
    upload_date: project.uploadDate,
    business_unit: project.businessUnit,
    status: project.status,
    thumbnail_url: project.thumbnailUrl ?? '',
    source_cover_url: project.sourceCoverUrl ?? null,
    video_url: project.videoUrl ?? null,
    generated_content: project.generatedContent ?? [],
    created_at: project.createdAt ?? new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from('content_projects').upsert(row, {
    onConflict: 'id',
  });
  if (error) {
    console.error('[contentProjects] upsert error', error);
    return false;
  }
  return true;
}

/**
 * Update generated content (and optionally status) for a project.
 */
export async function updateProjectContent(
  ownerId: string,
  projectId: string,
  generatedContent: PlatformContent[],
  status?: ContentProject['status']
): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  const payload: { generated_content: PlatformContent[]; updated_at: string; status?: string } = {
    generated_content: generatedContent,
    updated_at: new Date().toISOString(),
  };
  if (status) payload.status = status;
  const { error } = await supabase
    .from('content_projects')
    .update(payload)
    .eq('id', projectId);
  if (error) {
    console.error('[contentProjects] update content error', error);
    return false;
  }
  return true;
}

/**
 * Delete a content project by id. ownerId must match the authenticated user (RLS enforces).
 */
export async function deleteProject(ownerId: string, projectId: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  const { error } = await supabase
    .from('content_projects')
    .delete()
    .eq('id', projectId);
  if (error) {
    console.error('[contentProjects] delete error', error);
    return false;
  }
  return true;
}
