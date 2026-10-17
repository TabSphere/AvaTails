import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

/** ElevenLabs text-to-speech: one scene's narration -> mp3 (base64 data URL). */
export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    const voiceId = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM"; // Rachel — warm, friendly
    if (!apiKey) {
      return NextResponse.json({ error: "ELEVENLABS_API_KEY is not configured" }, { status: 500 });
    }
    const { text } = (await req.json()) as { text?: string };
    if (!text) {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }

    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: process.env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2",
        voice_settings: { stability: 0.55, similarity_boost: 0.75, style: 0.45, use_speaker_boost: true },
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      return NextResponse.json({ error: `ElevenLabs error ${res.status}: ${detail.slice(0, 300)}` }, { status: 502 });
    }

    const buf = Buffer.from(await res.arrayBuffer());
    return NextResponse.json({ audio: `data:audio/mpeg;base64,${buf.toString("base64")}` });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `Voice generation failed: ${msg}` }, { status: 500 });
  }
}
