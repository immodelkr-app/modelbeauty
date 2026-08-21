// ============================================================
// 유튜브 채널(@IM_MODEL_BEAUTY) 영상 연동
// #모델뷰티 해시태그가 제목/설명에 포함된 영상만 홈 화면에 노출
// ============================================================

const CHANNEL_ID = "UCxRR2d4fu-sWhFe5rLKqKbg"; // 모델뷰티 크루 (youtube.com/@IM_MODEL_BEAUTY)
const UPLOADS_PLAYLIST_ID = "UU" + CHANNEL_ID.slice(2);
const HASHTAG = "#모델뷰티";

export interface YoutubeVideo {
  videoId: string;
  title: string;
  thumbnailUrl: string;
  publishedAt: string;
}

interface PlaylistItemSnippet {
  title?: string;
  description?: string;
  publishedAt?: string;
  resourceId?: { videoId?: string };
  thumbnails?: {
    high?: { url: string };
    medium?: { url: string };
    default?: { url: string };
  };
}

export async function getModelBeautyYoutubeVideos(limit = 8): Promise<YoutubeVideo[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return [];

  try {
    const url = new URL("https://www.googleapis.com/youtube/v3/playlistItems");
    url.searchParams.set("part", "snippet");
    url.searchParams.set("playlistId", UPLOADS_PLAYLIST_ID);
    url.searchParams.set("maxResults", "50");
    url.searchParams.set("key", apiKey);

    const res = await fetch(url.toString(), { next: { revalidate: 3600 } });
    if (!res.ok) {
      console.error("[getModelBeautyYoutubeVideos] YouTube API 오류:", res.status, await res.text().catch(() => ""));
      return [];
    }
    const data = await res.json();

    const items: YoutubeVideo[] = (data.items ?? [])
      .filter((item: { snippet?: PlaylistItemSnippet }) => {
        const s = item.snippet;
        const text = `${s?.title ?? ""} ${s?.description ?? ""}`;
        return text.includes(HASHTAG);
      })
      .map((item: { snippet?: PlaylistItemSnippet }) => {
        const s = item.snippet;
        return {
          videoId: s?.resourceId?.videoId ?? "",
          title: s?.title ?? "",
          thumbnailUrl: s?.thumbnails?.high?.url ?? s?.thumbnails?.medium?.url ?? s?.thumbnails?.default?.url ?? "",
          publishedAt: s?.publishedAt ?? "",
        };
      })
      .filter((v: YoutubeVideo) => v.videoId);

    items.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

    return items.slice(0, limit);
  } catch (err) {
    console.error("[getModelBeautyYoutubeVideos]", err);
    return [];
  }
}
