// The job queue — persisted in Vercel Blob so agents keep working
// whether or not a browser tab is open. One JSON document, low write rate.
import { put, list } from "@vercel/blob";
import crypto from "crypto";
import { blobEnabled } from "./storage";
import type { AgentId } from "./agents";

export type JobStatus = "queued" | "running" | "done" | "failed";

export interface QueueJob {
  id: string;
  letter: string;
  animal: string;
  status: JobStatus;
  stage?: string;
  agents?: AgentId[];
  progress?: number;
  error?: string;
  episodeId?: string;
  costUSD?: number;
  createdAt: string;
  finishedAt?: string;
  logTail: string[];
}

export interface QueueState {
  jobs: QueueJob[];
  totalEpisodes: number;
  totalCostUSD: number;
  updatedAt: string;
}

const QUEUE_PATH = "queue/state.json";
const MAX_JOBS_KEPT = 200;
const LOG_TAIL = 12;

const emptyState = (): QueueState => ({
  jobs: [],
  totalEpisodes: 0,
  totalCostUSD: 0,
  updatedAt: new Date().toISOString(),
});

export async function readQueue(): Promise<QueueState> {
  if (!blobEnabled()) return emptyState();
  try {
    const { blobs } = await list({ prefix: QUEUE_PATH, limit: 1 });
    const hit = blobs.find((b) => b.pathname === QUEUE_PATH);
    if (!hit) return emptyState();
    const res = await fetch(hit.url, { cache: "no-store" });
    if (!res.ok) return emptyState();
    return (await res.json()) as QueueState;
  } catch {
    return emptyState();
  }
}

async function writeQueue(state: QueueState): Promise<void> {
  if (!blobEnabled()) return;
  state.updatedAt = new Date().toISOString();
  state.jobs = state.jobs.slice(0, MAX_JOBS_KEPT);
  await put(QUEUE_PATH, Buffer.from(JSON.stringify(state)), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

export async function enqueueJobs(items: Array<{ letter: string; animal: string }>): Promise<QueueJob[]> {
  const state = await readQueue();
  const jobs: QueueJob[] = items.map((it) => ({
    id: crypto.randomBytes(5).toString("hex"),
    letter: it.letter.toUpperCase(),
    animal: it.animal,
    status: "queued",
    createdAt: new Date().toISOString(),
    logTail: [],
  }));
  // Order: existing queued → new batch → running → finished
  const existingQueued = state.jobs.filter((j) => j.status === "queued");
  const running = state.jobs.filter((j) => j.status === "running");
  const finished = state.jobs.filter((j) => j.status === "done" || j.status === "failed");
  state.jobs = [...existingQueued, ...jobs, ...running, ...finished];
  await writeQueue(state);
  return jobs;
}

export async function updateJob(id: string, patch: Partial<QueueJob>): Promise<void> {
  const state = await readQueue();
  const job = state.jobs.find((j) => j.id === id);
  if (!job) return;
  Object.assign(job, patch);
  if (patch.logTail) job.logTail = patch.logTail.slice(-LOG_TAIL);
  await writeQueue(state);
}

export async function nextQueuedJob(): Promise<QueueJob | null> {
  const state = await readQueue();
  return state.jobs.find((j) => j.status === "queued") || null;
}

export async function recordFinished(state: { costUSD: number }): Promise<void> {
  const q = await readQueue();
  q.totalEpisodes += 1;
  q.totalCostUSD = Math.round((q.totalCostUSD + state.costUSD) * 1000) / 1000;
  await writeQueue(q);
}
