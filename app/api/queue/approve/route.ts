// The approval gate. A job finishes the pipeline as "waiting" — the Publisher
// holds it until the boss taps APPROVE (counts as done, totals recorded) or
// REJECT (marked failed, episode stays out of History stats).
// The actual logic lives in lib/approval.ts and is shared with Telegram.
import { NextRequest, NextResponse } from "next/server";
import { decideJob } from "@/lib/approval";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    const result = await decideJob(jobId, action, note, "dashboard");
    if (!result.ok) {
      const status = result.error === "job not found" ? 404 : 409;
      return NextResponse.json({ error: result.error }, { status });
    }
    return NextResponse.json({ ok: true, status: result.status, episodeId: result.episodeId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
