// Shared approval-gate logic — used by both the dashboard approve button
// (/api/queue/approve) and the Telegram webhook (/api/telegram/webhook),
// so a decision made in either place behaves identically.
// Approving also schedules the episode on the connected YouTube channel.
import { list } from "@vercel/blob";
import { readQueue, updateJob, recordFinished } from "./queue";
import { getConnection, publishEpisode } from "./youtube";
import { blobEnabled } from "./storage";

export interface DecideResult {
  ok: boolean;
  status?: "done" | "failed";
  episodeId?: string;
  jobTitle?: string;
  youtubeUrl?: string;
  publishAt?: string;
  error?: string;
}

interface EpisodeMeta {
  videoUrl?: string;
  script?: { title?: string; description?: string; tags?: string[] };
}

/** Reads an episode's metadata from blob storage (for the YouTube upload). */
async function readEpisodeMeta(episodeId: string): Promise<EpisodeMeta | null> {
  try {
    const metaPath = `episodes/${episodeId}/meta.json`;
    const { blobs } = await list({ prefix: metaPath, limit: 1 });
    const hit = blobs.find((b) => b.pathname === metaPath);
    if (!hit) return null;
    const res = await fetch(`${hit.url}?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as EpisodeMeta;
  } catch {
    return null;
  }
}

export async function decideJob(
  jobId: string,
  action: "approve" | "reject",
  note?: string,
  decidedBy?: string
): Promise<DecideResult> {
  const state = await readQueue();
  const job = state.jobs.find((j) => j.id === jobId);
  if (!job) return { ok: false, error: "job not found" };
  if (job.status !== "waiting") {
    return { ok: false, error: `job is ${job.status}, not waiting for approval` };
  }
  const who = decidedBy ? ` by ${decidedBy}` : "";
  const title = job.channel === "wildtails" ? `${job.animal} — Wild Facts` : `${job.letter} is for ${job.animal}`;

  if (action !== "approve") {
    await updateJob(jobId, {
      status: "failed",
      agents: [],
      error: note ? `Rejected: ${String(note).slice(0, 140)}` : "Rejected",
      finishedAt: new Date().toISOString(),
      logTail: [...(job.logTail || []), `Rejected${who}${note ? ` — ${String(note).slice(0, 80)}` : ""}`],
    });
    return { ok: true, status: "failed", jobTitle: title };
  }

  // ── Approve: count it, then schedule on YouTube when connected ──
  await updateJob(jobId, {
    status: "done",
    agents: [],
    finishedAt: new Date().toISOString(),
    logTail: [...(job.logTail || []), `Approved${who} — shipped`],
  });
  await recordFinished({ costUSD: job.costUSD || 0 });

  const result: DecideResult = { ok: true, status: "done", episodeId: job.episodeId, jobTitle: title };

  // Best-effort YouTube scheduling — a publish failure never un-approves the job.
  const channel = job.channel || "avatails";
  try {
    if (blobEnabled() && job.episodeId && (await getConnection(channel))) {
      const meta = await readEpisodeMeta(job.episodeId);
      if (meta?.videoUrl) {
        const pub = await publishEpisode({
          channel,
          videoUrl: meta.videoUrl,
          title: meta.script?.title || title,
          description: meta.script?.description || "",
          tags: meta.script?.tags || [],
          madeForKids: channel !== "wildtails",
        });
        result.youtubeUrl = pub.watchUrl;
        result.publishAt = pub.publishAt;
        const when = new Date(pub.publishAt).toUTCString();
        const cur = await readQueue();
        const curJob = cur.jobs.find((j) => j.id === jobId);
        await updateJob(jobId, {
          logTail: [...(curJob?.logTail || []), `Scheduled on YouTube — goes public ${when}`],
        });
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const cur = await readQueue();
    const curJob = cur.jobs.find((j) => j.id === jobId);
    await updateJob(jobId, {
      logTail: [...(curJob?.logTail || []), `YouTube scheduling failed: ${msg.slice(0, 140)}`],
    }).catch(() => {});
  }
  return result;
}
