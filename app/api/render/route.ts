import { NextRequest, NextResponse } from "next/server";
import { renderEpisode } from "@/lib/ffmpeg";
import type { RenderScene } from "@/lib/types";

export const runtime = "nodejs";
// Video assembly is CPU-bound; allow the maximum execution time.
// Vercel Hobby caps at 60s — deploy on Pro (or run locally) for full-length episodes.
export const maxDuration = 300;

/**
 * Final stage: scenes (image + voice + caption) -> finished vertical MP4.
 * Returns the video as a base64 data URL plus a byte count.
 */
export async function POST(req: NextRequest) {
  try {
    const { scenes } = (await req.json()) as { scenes?: RenderScene[] };
    if (!Array.isArray(scenes) || scenes.length === 0) {
      return NextResponse.json({ error: "scenes[] is required" }, { status: 400 });
    }
    for (let i = 0; i < scenes.length; i++) {
      const s = scenes[i];
      if (!s.image || !s.audio) {
        return NextResponse.json({ error: `scene ${i + 1} is missing image or audio` }, { status: 400 });
      }
    }

    const video = await renderEpisode(scenes);
    return NextResponse.json({
      video: `data:video/mp4;base64,${video.toString("base64")}`,
      bytes: video.byteLength,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `Render failed: ${msg}` }, { status: 500 });
  }
}
