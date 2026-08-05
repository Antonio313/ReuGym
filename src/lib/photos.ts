import { nanoid } from 'nanoid';
import { supabase } from '@/lib/supabase';

const BUCKET = 'progress-photos';

// Uploads a single progress photo and returns its storage path (not a URL —
// the bucket is private, so display URLs are generated on demand via
// getSignedPhotoUrl). Path is scoped by user and body-stat entry.
export async function uploadProgressPhoto(userId: string, statId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const path = `${userId}/${statId}/${nanoid()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || 'image/jpeg',
    upsert: false,
  });
  if (error) throw error;
  return path;
}

export async function deleteProgressPhoto(path: string): Promise<void> {
  await supabase.storage.from(BUCKET).remove([path]);
}

export async function getSignedPhotoUrl(path: string, expiresInSeconds = 3600): Promise<string | null> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresInSeconds);
  if (error || !data) return null;
  return data.signedUrl;
}

export async function getSignedPhotoUrls(paths: string[], expiresInSeconds = 3600): Promise<Map<string, string>> {
  const entries = await Promise.all(
    paths.map(async (path) => [path, await getSignedPhotoUrl(path, expiresInSeconds)] as const),
  );
  const map = new Map<string, string>();
  for (const [path, url] of entries) {
    if (url) map.set(path, url);
  }
  return map;
}
