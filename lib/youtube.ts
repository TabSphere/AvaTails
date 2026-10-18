// YouTube channel connections — OAuth per channel, tokens in Vercel Blob,
// scheduled uploads on approval.
//
// One-time Google Cloud setup:
//   1. console.cloud.google.com -> create project -> enable "YouTube Data API v3".
//   2. OAuth consent screen: External, add your Gmail as a test user.
//   3. Credentials -> Create OAuth client ID (Web application).
//      Authorized redirect URI: https://avatails.vercel.app/api/youtube/callback
//   4. Vercel env vars: YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET.
//   5. Visit /api/youtube/connect?channel=avatails and ...?channel=wildtails
//      while logged into each YouTube account.
// Note: in OAuth "testing" mode refresh tokens expire after 7 days — publish
// the consent screen (no verification needed for upload scope self-use) to keep
// connections permanent.
import { put, list } from "@vercel/blob";
import { blobEnabled } from "./storage";

const TOKENS_PATH = "youtube/tokens.json";
const SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.readonly",
].join(" ");

export interface ChannelConnection {
  refreshToken: string;
  channelTitle?: string;
  connectedAt: string;
  /** Next scheduled publish slot (ISO). Bumped +24h after each scheduled upload. */
  nextSlotISO?: string;
}

interface TokenStore {
  channels: Record<string, ChannelConnection>;
}

export const youtubeEnabled = (): boolean =>
  Boolean(process.env.YOUTUBE_CLIENT_ID && process.env.YOUTUBE_CLIENT_SECRET && blobEnabled());

async function readTokens(): Promise<TokenStore> {
  try {
    const { blobs } = await list({ prefix: TOKENS_PATH, limit: 1 });
    const hit = blobs.find((b) => b.pathname === TOKENS_PATH);
    if (!hit) return { channels: {} };
    const res = await fetch(`${hit.url}?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return { channels: {} };
    return (await res.json()) as TokenStore;
  } catch {
    return { channels: {} };
  }
}

async function writeTokens(store: TokenStore): Promise<void> {
  await put(TOKENS_PATH, Buffer.from(JSON.stringify(store, null, 2)), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 0,
  });
}

export async function getConnection(channel: string): Promise<ChannelConnection | null> {
  const store = await readTokens();
  return store.channels[channel] || null;
}

export async function listConnections(): Promise<Record<string, Omit<ChannelConnection, "refreshToken">>> {
  const store = await readTokens();
  const out: Record<string, Omit<ChannelConnection, "refreshToken">> = {};
  for (const [k, v] of Object.entries(store.channels)) {
    out[k] = { channelTitle: v.channelTitle, connectedAt: v.connectedAt, nextSlotISO: v.nextSlotISO };
  }
  return out;
}

/** Builds the Google consent URL. `redirectUri` must match the OAuth client config. */
export function consentUrl(channel: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: process.env.YOUTUBE_CLIENT_ID as string,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent", // forces a refresh_token every time
    state: channel,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/** Exchanges the OAuth code and stores the refresh token for the channel. */
export async function completeOAuth(channel: string, code: string, redirectUri: string): Promise<ChannelConnection> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.YOUTUBE_CLIENT_ID as string,
      client_secret: process.env.YOUTUBE_CLIENT_SECRET as string,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.refresh_token) {
    throw new Error(`OAuth exchange failed: ${JSON.stringify(data).slice(0, 200)}`);
  }

  // Best-effort channel title for the dashboard.
  let channelTitle: string | undefined;
  try {
    const ch = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", {
      headers: { Authorization: `Bearer ${data.access_token}` },
    }).then((r) => r.json());
    channelTitle = ch?.items?.[0]?.snippet?.title;
  } catch {
    /* title is cosmetic */
  }

  const store = await readTokens();
  const conn: ChannelConnection = {
    refreshToken: data.refresh_token,
    channelTitle,
    connectedAt: new Date().toISOString(),
    nextSlotISO: store.channels[channel]?.nextSlotISO,
  };
  store.channels[channel] = conn;
  await writeTokens(store);
  return conn;
}

async function accessToken(refreshToken: string): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.YOUTUBE_CLIENT_ID as string,
      client_secret: process.env.YOUTUBE_CLIENT_SECRET as string,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(`Token refresh failed: ${JSON.stringify(data).slice(0, 200)}`);
  }
  return data.access_token as string;
}

export interface PublishInput {
  channel: string;
  videoUrl: string;
  title: string;
  description: string;
  tags: string[];
  madeForKids: boolean;
}

export interface PublishResult {
  videoId: string;
  publishAt: string;
  watchUrl: string;
}

/**
 * Uploads the episode as a PRIVATE scheduled video at the channel's next slot
 * (default: tomorrow 16:00 UTC, then +24h each time). YouTube flips it public
 * automatically at publishAt.
 */
export async function publishEpisode(input: PublishInput): Promise<PublishResult> {
  const conn = await getConnection(input.channel);
  if (!conn) throw new Error(`YouTube channel "${input.channel}" is not connected`);

  // Compute the slot before spending the upload.
  const now = Date.now();
  let slot = conn.nextSlotISO ? new Date(conn.nextSlotISO).getTime() : NaN;
  if (!Number.isFinite(slot) || slot < now + 60 * 60 * 1000) {
    const d = new Date(now + 24 * 60 * 60 * 1000);
    d.setUTCHours(16, 0, 0, 0);
    slot = d.getTime();
  }
  const publishAt = new Date(slot).toISOString();

  const videoRes = await fetch(input.videoUrl);
  if (!videoRes.ok) throw new Error(`Could not fetch episode video (${videoRes.status})`);
  const video = Buffer.from(await videoRes.arrayBuffer());

  const token = await accessToken(conn.refreshToken);

  // Resumable upload: metadata first, then the bytes.
  const init = await fetch(
    "https://upload.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": "video/mp4",
        "X-Upload-Content-Length": String(video.byteLength),
      },
      body: JSON.stringify({
        snippet: {
          title: input.title.slice(0, 100),
          description: input.description,
          tags: input.tags,
          categoryId: input.madeForKids ? "27" : "15", // 27 Education, 15 Pets & Animals
        },
        status: {
          privacyStatus: "private",
          publishAt,
          selfDeclaredMadeForKids: input.madeForKids,
        },
      }),
    }
  );
  if (!init.ok) {
    const detail = await init.text();
    throw new Error(`YouTube upload init failed (${init.status}): ${detail.slice(0, 200)}`);
  }
  const uploadUrl = init.headers.get("location");
  if (!uploadUrl) throw new Error("YouTube did not return an upload URL");

  const up = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "video/mp4", "Content-Length": String(video.byteLength) },
    body: new Uint8Array(video),
  });
  const upData = await up.json().catch(() => ({}));
  if (!up.ok || !upData.id) {
    throw new Error(`YouTube upload failed (${up.status}): ${JSON.stringify(upData).slice(0, 200)}`);
  }

  // Bump the channel's slot forward 24h for the next approved episode.
  const store = await readTokens();
  if (store.channels[input.channel]) {
    store.channels[input.channel].nextSlotISO = new Date(slot + 24 * 60 * 60 * 1000).toISOString();
    await writeTokens(store);
  }

  return {
    videoId: upData.id as string,
    publishAt,
    watchUrl: `https://youtube.com/watch?v=${upData.id}`,
  };
}
