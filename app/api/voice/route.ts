import { NextRequest, NextResponse } from "next/server";
import { generateVoice } from "@/lib/ai";

export const runtime = "nodejs";
export const maxDuration = 60;

/** ElevenLabs text-to-speech: one scene's narration -> mp3 (base64 data URL). */
export async function POST(req: NextRequest) {
  try {
    const { text, voiceId } = (await req.json()) as { text?: string; voiceId?: string };
    if (!text) {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }
    const buf = await generateVoice(text, voiceId);
    return NextResponse.json({ audio: `data:audio/mpeg;base64,${buf.toString("base64")}` });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `Voice generation failed: ${msg}` }, { status: 500 });
  }
}
