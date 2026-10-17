import { NextRequest, NextResponse } from "next/server";
import { runNextJob } from "@/lib/queue-runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Vercel Cron entry point — this is what keeps the factory running while you
 * sleep. Each invocation picks ONE queued job and completes it. Schedule lives
 * in vercel.json. Vercel automatically sends the CRON_SECRET bearer header.
 *
 * Note: on the Hobby plan cron runs at most once per day; Pro allows the
 * every-10-minutes schedule in vercel.json.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }
  const result = await runNextJob({});
  return NextResponse.json(result);
}
