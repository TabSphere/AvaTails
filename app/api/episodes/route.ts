import { NextRequest } from "next/server";
import { runEpisode } from "@/lib/pipeline";
import { listEpisodes, blobEnabled } from "@/lib/storage";
import type { FactorySettings, ProgressEvent } from "@/lib/types";

export const runtime = "nodejs";
// Full pipeline: script + 6 voices + 6 images + render. Needs room to breathe —
// Vercel Pro allows 300s; Hobby (60s) may be tight. Local dev has no cap.
export const maxDuration = 300;

/**
 * POST — one-click episode factory.
 * Body: { letter, animal, settings }
 * Response: NDJSON stream of ProgressEvent, ending with type "episode" or "error".
 */
export async function POST(req: NextRequest) {
  let letter = "", animal = "", settings: FactorySettings = {};
  try {
    const body = await req.json();
    letter = String(body.letter || "").trim();
    animal = String(body.animal || "").trim();
    settings = body.settings || {};
  } catch {
    /* handled below */
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: ProgressEvent) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      try {
        if (!letter || !animal) throw new Error("letter and animal are required");
        const episode = await runEpisode(letter, animal, settings, send);
        send({ type: "episode", message: "done", episode });
      } catch (e) {
        send({ type: "error", message: e instanceof Error ? e.message : String(e) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-cache" },
  });
}

/** GET — episode history (newest first). Empty when blob storage is off. */
export async function GET() {
  const episodes = await listEpisodes();
  return Response.json({ episodes, storage: blobEnabled() ? "blob" : "none" });
}
