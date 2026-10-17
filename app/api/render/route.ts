import { NextRequest, NextResponse } from "next/server";
import { renderEpisode } from "@/lib/ffmpeg";
import type { RenderInput } from "@/lib/types";

export const runtime = "nodejs";
// Video assembly is CPU-bound; allow the maximum execution time.
// Vercel Hobby caps at 60s — deploy on Pro (or run locally) for full episodes.
export const maxDuration = 300;

interface RenderScenePayload {
  caption: string;
  image: string; // data URL
  audio: string; // data URL
}

const dataUrlToBuffer = (dataUrl: string): Buffer =>
  Buffer.from(dataUrl.replace(/^data:[^;]+;base64,/, ""), "base64");

/**
 * Manual render stage: scenes (image + voice + caption) -> finished vertical MP4.
 * Optional: transitions (default true) and music (mp3 data URL).
 */
export async function POST(req: NextRequest) {
  try {
    const { scenes, transitions, music } = (await req.json()) as {
      scenes?: RenderScenePayload[];
      transitions?: boolean;
      music?: string;
    };
    if (!Array.isArray(scenes) || scenes.length === 0) {
      return NextResponse.json({ error: "scenes[] is required" }, { status: 400 });
    }
    const inputs: RenderInput[] = scenes.map((s, i) => {
      if (!s.image || !s.audio) throw new Error(`scene ${i + 1} is missing image or audio`);
      return { caption: s.caption || "", image: dataUrlToBuffer(s.image), audio: dataUrlToBuffer(s.audio) };
    });

    const video = await renderEpisode(inputs, {
      transitions: transitions ?? true,
      music: music ? dataUrlToBuffer(music) : null,
    });
    return NextResponse.json({
      video: `data:video/mp4;base64,${video.toString("base64")}`,
      bytes: video.byteLength,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `Render failed: ${msg}` }, { status: 500 });
  }
}
