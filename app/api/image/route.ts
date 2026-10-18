import { NextRequest, NextResponse } from "next/server";
import { generateImage } from "@/lib/ai";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * Scene illustration -> compressed JPEG data URL.
 * JPEG (not PNG) keeps multi-scene requests under the serverless body limit.
 */
export async function POST(req: NextRequest) {
  try {
    const { prompt, model, channel } = (await req.json()) as {
      prompt?: string;
      model?: string;
      channel?: string;
    };
    if (!prompt) {
      return NextResponse.json({ error: "prompt is required" }, { status: 400 });
    }
    const jpeg = await generateImage(prompt, model, channel);
    return NextResponse.json({ image: `data:image/jpeg;base64,${jpeg.toString("base64")}` });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `Image generation failed: ${msg}` }, { status: 500 });
  }
}
