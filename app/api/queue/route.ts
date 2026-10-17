import { NextRequest, NextResponse } from "next/server";
import { readQueue, enqueueJobs } from "@/lib/queue";
import { blobEnabled } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — full queue state for the Factory Floor (polled by the UI). */
export async function GET() {
  const state = await readQueue();
  return NextResponse.json({ ...state, storage: blobEnabled() ? "blob" : "none" });
}

/** POST — enqueue jobs. Body: { jobs: [{ letter, animal }] } */
export async function POST(req: NextRequest) {
  try {
    if (!blobEnabled()) {
      return NextResponse.json(
        { error: "The queue needs Vercel Blob storage — attach a Blob store and redeploy." },
        { status: 400 }
      );
    }
    const { jobs } = (await req.json()) as { jobs?: Array<{ letter: string; animal: string }> };
    if (!Array.isArray(jobs) || jobs.length === 0) {
      return NextResponse.json({ error: "jobs[] is required" }, { status: 400 });
    }
    const clean = jobs
      .map((j) => ({ letter: String(j.letter || "").trim().slice(0, 1), animal: String(j.animal || "").trim().slice(0, 40) }))
      .filter((j) => j.letter && j.animal)
      .slice(0, 50);
    if (!clean.length) {
      return NextResponse.json({ error: "no valid jobs" }, { status: 400 });
    }
    const created = await enqueueJobs(clean);
    return NextResponse.json({ enqueued: created.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `Enqueue failed: ${msg}` }, { status: 500 });
  }
}
