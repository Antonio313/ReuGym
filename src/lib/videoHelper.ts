type VideoInfo =
  | { platform: 'youtube'; embedUrl: string; originalUrl: string }
  | { platform: 'tiktok'; originalUrl: string }
  | null;

export function parseVideoUrl(raw: string): VideoInfo {
  const url = raw.trim();
  if (!url) return null;

  if (url.includes('tiktok.com')) {
    return { platform: 'tiktok', originalUrl: url };
  }

  // Extract YouTube video ID from various URL forms
  let videoId: string | null = null;

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace('www.', '');

    if (host === 'youtu.be') {
      videoId = parsed.pathname.slice(1).split('?')[0];
    } else if (host === 'youtube.com') {
      if (parsed.pathname.startsWith('/shorts/')) {
        videoId = parsed.pathname.replace('/shorts/', '').split('/')[0];
      } else if (parsed.pathname.startsWith('/embed/')) {
        videoId = parsed.pathname.replace('/embed/', '').split('/')[0];
      } else {
        videoId = parsed.searchParams.get('v');
      }
    }
  } catch {
    return null;
  }

  if (videoId) {
    return {
      platform: 'youtube',
      embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}`,
      originalUrl: url,
    };
  }

  return null;
}
