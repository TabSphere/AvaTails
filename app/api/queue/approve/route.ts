import { NextRequest, NextResponse } from "next/server";
import { readQueue, updateJob, recordFinished } from "@/lib/queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The approval gate. A job finishes the pipeline as "waiting" — the Publisher
 * holds it until the boss taps APPROVE (counts as done, totals recorded) or
 * REJECT (failed with the boss's note, episode stays out of History stats).
 * Body: { jobId: string, action: "approve" | "reject", note?: string }
 */
export async function POST(req: NextRequest) {
  try {
    const { jobId, action, note } = (await req.json()) as {
      jobId?: string;
      action?: string;
      note?: string;
    };
    if (!jobId || (action !== "approve" && action !== "reject")) {
      return NextResponse.json({ error: "jobId and action (approve|reject) are required" }, { status: 400 });
    }
    const state = await readQueue();
    const job = state.jobs.find((j) => j.id === jobId);
    if (!job) return NextResponse.json({ error: "job not found" }, { status: 404 });
    if (job.status !== "waiting") {
      return NextResponse.json({ error: `job is ${job.status}, not waiting for approval` }, { status: 409 });
    }

    if (action === "approve") {
      await updateJob(jobId, {
        status: "done",
        agents: [],
        finishedAt: new Date().toISOString(),
        logTail: [...(job.logTail || []), "✅ Approved by the boss — shipped!"],
      });
      await recordFinished({ costUSD: job.costUSD || 0 });
      return NextResponse.json({ ok: true, status: "done", episodeId: job.episodeId });
    }

    await updateJob(jobId, {
      status: "failed",
      agents: [],
      error: note ? `Rejected: ${String(note).slice(0, 140)}` : "Rejected by the boss",
      finishedAt: new Date().toISOString(),
      logTail: [...(job.logTail || []), `❌ Rejected${note ? ` — ${String(note).slice(0, 80)}` : ""}`],
    });
    return NextResponse.json({ ok: true, status: "failed" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
