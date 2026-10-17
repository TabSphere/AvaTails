import { NextRequest, NextResponse } from "next/server";
import { runNextJob } from "@/lib/queue-runner";
import type { FactorySettings } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Manual trigger: "run the next job now" button. Same worker the cron uses.
 * Body may carry FactorySettings overrides (voice, models, transitions, music).
 */
export async function POST(req: NextRequest) {
  try {
    let settings: FactorySettings = {};
    try {
      const body = await req.json();
      settings = body?.settings || {};
    } catch {
      /* empty body is fine */
    }
    const result = await runNextJob(settings);
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ran: false, error: msg }, { status: 500 });
  }
}
