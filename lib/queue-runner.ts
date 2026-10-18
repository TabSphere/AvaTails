// The queue runner: picks the next queued job and drives the agent team
// through it, writing status to the queue so the Factory Floor stays live.
// Used by both the manual "run next job" button and the Vercel Cron trigger.
import { runEpisode } from "./pipeline";
import { nextQueuedJob, updateJob } from "./queue";
import { blobEnabled } from "./storage";
import type { FactorySettings } from "./types";

export interface RunResult {
  ran: boolean;
  jobId?: string;
  episodeId?: string;
  error?: string;
}

export async function runNextJob(settings: FactorySettings): Promise<RunResult> {
  if (!blobEnabled()) {
    return { ran: false, error: "Queue needs Vercel Blob storage (BLOB_READ_WRITE_TOKEN)" };
  }
  const job = await nextQueuedJob();
  if (!job) return { ran: false };

  await updateJob(job.id, { status: "running", progress: 0, logTail: ["Chief of Staff picked up the job 👔"] });

  try {
    const episode = await runEpisode(job.letter, job.animal, settings, (ev) => {
      // Persist stage changes + tail of the log; blob writes stay infrequent.
      if (ev.type === "progress") {
        const tail = [...(job.logTail || []), ev.message];
        job.logTail = tail;
        void updateJob(job.id, {
          stage: ev.stage,
          agents: ev.agents as never,
          progress: ev.progress,
          logTail: tail,
        }).catch(() => {});
      }
    }, job.channel);
    // Approval gate: the episode is produced, but nothing counts as "done"
    // until the boss approves it (POST /api/queue/approve). The Publisher
    // stands by, waving, until then.
    await updateJob(job.id, {
      status: "waiting",
      stage: "awaiting your approval",
      progress: 100,
      agents: ["publisher"] as never,
      episodeId: episode.id,
      costUSD: episode.costUSD,
      logTail: [...(job.logTail || []), "✋ Episode ready — Publisher needs your OK"],
    });
    return { ran: true, jobId: job.id, episodeId: episode.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await updateJob(job.id, {
      status: "failed",
      agents: [],
      error: msg,
      finishedAt: new Date().toISOString(),
    });
    return { ran: true, jobId: job.id, error: msg };
  }
}
