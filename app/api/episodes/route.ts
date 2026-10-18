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
 * Body: { letter, animal, channel?, settings }
 * Response: NDJSON stream of ProgressEvent, ending with type "episode" or "error".
 */
export async function POST(req: NextRequest) {
  let letter = "", animal = "", channel = "avatails", settings: FactorySettings = {};
  try {
    const body = await req.json();
    letter = String(body.letter || "").trim();
    animal = String(body.animal || "").trim();
    channel = body.channel === "wildtails" ? "wildtails" : "avatails";
    settings = body.settings || {};
  } catch {
    /* handled below */
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: ProgressEvent) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      try {
        if (!animal) throw new Error("animal is required");
        // WildTails jobs don't need a letter — auto-derive from the animal.
        if (!letter) letter = animal[0].toUpperCase();
        const episode = await runEpisode(letter, animal, settings, send, channel);
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
