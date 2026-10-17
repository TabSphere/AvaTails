import { NextRequest, NextResponse } from "next/server";
import { saveBuffer, blobEnabled } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Upload a background-music track once; the returned blob URL is stored in
 * browser settings and reused for every episode. Requires Vercel Blob.
 */
export async function POST(req: NextRequest) {
  try {
    if (!blobEnabled()) {
      return NextResponse.json(
        { error: "Music upload needs Vercel Blob storage (BLOB_READ_WRITE_TOKEN)" },
        { status: 400 }
      );
    }
    const { music } = (await req.json()) as { music?: string };
    if (!music || !music.startsWith("data:audio")) {
      return NextResponse.json({ error: "music (audio data URL) is required" }, { status: 400 });
    }
    const buf = Buffer.from(music.replace(/^data:[^;]+;base64,/, ""), "base64");
    if (buf.byteLength > 8 * 1024 * 1024) {
      return NextResponse.json({ error: "Music file too large (max 8MB)" }, { status: 400 });
    }
    const url = await saveBuffer("assets/music.mp3", buf, "audio/mpeg");
    return NextResponse.json({ musicUrl: url });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `Music upload failed: ${msg}` }, { status: 500 });
  }
}
