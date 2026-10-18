// The queue runner: picks the next queued job and drives the agent team
// through it, writing status to the queue so the Factory Floor stays live.
// Used by both the manual "run next job" button and the Vercel Cron trigger.
import { runEpisode } from "./pipeline";
import { nextQueuedJob, updateJob } from "./queue";
import { blobEnabled } from "./storage";
import { notifyWaitingForApproval } from "./telegram";
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

  await updateJob(job.id, { status: "running", progress: 0, logTail: ["Chief of Staff picked up the job"] });

  // Progress writes are serialized into a chain. Fire-and-forget writes race
  // each other (read-modify-write on one JSON doc), and a slow stale write
  // landing last can resurrect an old status — e.g. a finished job flipping
  // back to "queued" and getting run (and billed) twice.
  let writeChain: Promise<void> = Promise.resolve();
  const flushWrites = () => writeChain;

  try {
    const episode = await runEpisode(job.letter, job.animal, settings, (ev) => {
      // Persist stage changes + tail of the log; blob writes stay infrequent.
      if (ev.type === "progress") {
        const tail = [...(job.logTail || []), ev.message];
        job.logTail = tail;
        const patch = {
          stage: ev.stage,
          agents: ev.agents as never,
          progress: ev.progress,
          logTail: tail,
        };
        writeChain = writeChain.then(() => updateJob(job.id, patch).catch(() => {}));
      }
    }, job.channel);
    // Let every in-flight progress write land before the final state.
    await flushWrites();
    // Approval gate: the episode is produced, but nothing counts as "done"
    // until the boss approves it (POST /api/queue/approve). The Publisher
    // stands by until then — and Telegram gets the review copy.
    await updateJob(job.id, {
      status: "waiting",
      stage: "awaiting your approval",
      progress: 100,
      agents: ["publisher"] as never,
      episodeId: episode.id,
      costUSD: episode.costUSD,
      logTail: [...(job.logTail || []), "Episode ready — waiting for your approval"],
    });
    // Best-effort Telegram delivery; never blocks or fails the job.
    await notifyWaitingForApproval({
      jobId: job.id,
      title: episode.script.title || `${job.letter} is for ${job.animal}`,
      channel: job.channel || "avatails",
      videoUrl: episode.videoUrl,
      costUSD: episode.costUSD,
    }).catch(() => {});
    return { ran: true, jobId: job.id, episodeId: episode.id };
  } catch (e) {
    await flushWrites();
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
