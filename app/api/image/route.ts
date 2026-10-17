import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import sharp from "sharp";
import { IMAGE_STYLE_SUFFIX } from "@/lib/prompts";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * Scene illustration -> compressed JPEG data URL.
 * JPEG (not PNG) keeps the final /api/render request under the 4.5MB
 * serverless body limit when 6 scenes are sent at once.
 */
export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "OPENAI_API_KEY is not configured" }, { status: 500 });
    }
    const { prompt } = (await req.json()) as { prompt?: string };
    if (!prompt) {
      return NextResponse.json({ error: "prompt is required" }, { status: 400 });
    }

    const openai = new OpenAI();
    const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
    const fullPrompt = `${prompt}\n\nStyle: ${IMAGE_STYLE_SUFFIX}`;

    let b64: string | undefined;
    if (model === "dall-e-3") {
      const res = await openai.images.generate({
        model,
        prompt: fullPrompt,
        size: "1024x1792",
        response_format: "b64_json",
      });
      b64 = res.data?.[0]?.b64_json;
    } else {
      // gpt-image-1 always returns base64; "medium" keeps cost + latency low
      const res = await openai.images.generate({
        model,
        prompt: fullPrompt,
        size: "1024x1536",
        quality: "medium",
      });
      b64 = res.data?.[0]?.b64_json;
    }
    if (!b64) {
      return NextResponse.json({ error: "Image API returned no data" }, { status: 502 });
    }

    const jpeg = await sharp(Buffer.from(b64, "base64")).jpeg({ quality: 82 }).toBuffer();
    return NextResponse.json({ image: `data:image/jpeg;base64,${jpeg.toString("base64")}` });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const hint =
      /verify|organization/i.test(msg)
        ? " (your OpenAI org may need verification for gpt-image-1 — set OPENAI_IMAGE_MODEL=dall-e-3 as fallback)"
        : "";
    return NextResponse.json({ error: `Image generation failed: ${msg}${hint}` }, { status: 500 });
  }
}
