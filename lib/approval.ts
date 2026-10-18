// Shared approval-gate logic — used by both the dashboard approve button
// (/api/queue/approve) and the Telegram webhook (/api/telegram/webhook),
// so a decision made in either place behaves identically.
import { readQueue, updateJob, recordFinished } from "./queue";

export interface DecideResult {
  ok: boolean;
  status?: "done" | "failed";
  episodeId?: string;
  jobTitle?: string;
  error?: string;
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

  if (action === "approve") {
    await updateJob(jobId, {
      status: "done",
      agents: [],
      finishedAt: new Date().toISOString(),
      logTail: [...(job.logTail || []), `Approved${who} — shipped`],
    });
    await recordFinished({ costUSD: job.costUSD || 0 });
    return { ok: true, status: "done", episodeId: job.episodeId, jobTitle: title };
  }

  await updateJob(jobId, {
    status: "failed",
    agents: [],
    error: note ? `Rejected: ${String(note).slice(0, 140)}` : "Rejected",
    finishedAt: new Date().toISOString(),
    logTail: [...(job.logTail || []), `Rejected${who}${note ? ` — ${String(note).slice(0, 80)}` : ""}`],
  });
  return { ok: true, status: "failed", jobTitle: title };
}
