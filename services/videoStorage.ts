import { getSupabase, BUCKET_VIDEOS, BUCKET_THUMBNAILS } from '../lib/supabase';

/**
 * Uploads a video file to Supabase Storage (bucket: videos).
 * Returns the public URL. Throws with a user-friendly message if Supabase is not configured or upload fails (e.g. file too large).
 * The actual file size limit is set in Supabase Dashboard (Storage → Settings). Free plan max 50 MB; Pro/Team up to 500 GB.
 */
export async function uploadVideo(file: File): Promise<string> {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Settings > Profile Key.');
  }

  const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
  const ext = file.name.split('.').pop() || 'mp4';
  const path = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;

  const { data, error } = await supabase.storage
    .from(BUCKET_VIDEOS)
    .upload(path, file, {
      contentType: file.type || 'video/mp4',
      upsert: false,
    });

  if (error) {
    console.error('[videoStorage] upload error:', error);
    const msg = String(error.message || '');
    if (msg.includes('exceeded the maximum allowed size') || msg.includes('maximum allowed size')) {
      throw new Error(
        `Video exceeds the storage size limit. Your file is ${sizeMB} MB. Supabase Free plan allows 50 MB per file; upgrade to Pro or increase the limit in Dashboard → Storage → Settings.`
      );
    }
    throw new Error(
      `Video upload failed: ${error.message}. Check Supabase config (Settings > Profile Key) and storage bucket policies.`
    );
  }

  const { data: urlData } = supabase.storage.from(BUCKET_VIDEOS).getPublicUrl(data.path);
  return urlData.publicUrl;
}

/**
 * Uploads a thumbnail image (e.g. first frame) to Supabase Storage (bucket: thumbnails).
 * Accepts a data URL from canvas.toDataURL() or a Blob.
 */
export async function uploadThumbnail(
  dataUrlOrBlob: string | Blob,
  projectId: string
): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  let blob: Blob;
  let contentType = 'image/jpeg';
  if (typeof dataUrlOrBlob === 'string') {
    const res = await fetch(dataUrlOrBlob);
    blob = await res.blob();
    contentType = blob.type || 'image/jpeg';
  } else {
    blob = dataUrlOrBlob;
    contentType = blob.type || 'image/jpeg';
  }

  const ext = contentType.includes('png') ? 'png' : 'jpg';
  const path = `${projectId}-${Date.now()}.${ext}`;

  const { data, error } = await supabase.storage
    .from(BUCKET_THUMBNAILS)
    .upload(path, blob, {
      contentType,
      upsert: true,
    });

  if (error) {
    console.error('[videoStorage] thumbnail upload error:', error);
    return null;
  }

  const { data: urlData } = supabase.storage.from(BUCKET_THUMBNAILS).getPublicUrl(data.path);
  return urlData.publicUrl;
}
