// Optional persistence via Vercel Blob. When BLOB_READ_WRITE_TOKEN is set,
// every episode's assets + video + metadata are stored and listed in History.
// Without it the app still works fully — results are returned as data URLs.
import { put, list } from "@vercel/blob";
import type { Episode } from "./types";

export const blobEnabled = (): boolean => Boolean(process.env.BLOB_READ_WRITE_TOKEN);

const INDEX_PATH = "episodes/index.json";

export async function saveBuffer(key: string, buf: Buffer, contentType: string): Promise<string> {
  const blob = await put(key, buf, { access: "public", contentType, addRandomSuffix: false, allowOverwrite: true });
  return blob.url;
}

interface EpisodeIndexEntry {
  id: string;
  letter: string;
  animal: string;
  title: string;
  videoUrl?: string;
  thumbUrl?: string;
  createdAt: string;
  status: "done" | "failed";
}

async function readIndex(): Promise<EpisodeIndexEntry[]> {
  try {
    const { blobs } = await list({ prefix: INDEX_PATH, limit: 1 });
    const hit = blobs.find((b) => b.pathname === INDEX_PATH);
    if (!hit) return [];
    const res = await fetch(hit.url, { cache: "no-store" });
    if (!res.ok) return [];
    return (await res.json()) as EpisodeIndexEntry[];
  } catch {
    return [];
  }
}

/** Persist a finished (or failed) episode: video, metadata, and the history index. */
export async function saveEpisode(episode: Episode, video: Buffer | null): Promise<Episode> {
  if (!blobEnabled()) return episode;
  const base = `episodes/${episode.id}`;

  if (video) {
    episode.videoUrl = await saveBuffer(`${base}/video.mp4`, video, "video/mp4");
    episode.bytes = video.byteLength;
  }

  await saveBuffer(`${base}/meta.json`, Buffer.from(JSON.stringify(episode, null, 2)), "application/json");

  const index = await readIndex();
  const entry: EpisodeIndexEntry = {
    id: episode.id,
    letter: episode.letter,
    animal: episode.animal,
    title: episode.script.title,
    videoUrl: episode.videoUrl,
    thumbUrl: episode.scenes.find((s) => s.imageUrl)?.imageUrl,
    createdAt: episode.createdAt,
    status: episode.status,
  };
  const next = [entry, ...index.filter((e) => e.id !== episode.id)].slice(0, 200);
  await saveBuffer(INDEX_PATH, Buffer.from(JSON.stringify(next)), "application/json");
  return episode;
}

/** History tab: newest episodes first. */
export async function listEpisodes(): Promise<EpisodeIndexEntry[]> {
  if (!blobEnabled()) return [];
  return readIndex();
}
