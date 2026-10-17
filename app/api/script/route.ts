import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { SCRIPT_SYSTEM_PROMPT } from "@/lib/prompts";
import type { EpisodeScript } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "OPENAI_API_KEY is not configured" }, { status: 500 });
    }
    const { letter, animal } = (await req.json()) as { letter?: string; animal?: string };
    if (!letter || !animal) {
      return NextResponse.json({ error: "letter and animal are required" }, { status: 400 });
    }

    const openai = new OpenAI();
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_SCRIPT_MODEL || "gpt-4o-mini",
      response_format: { type: "json_object" },
      temperature: 0.8,
      messages: [
        { role: "system", content: SCRIPT_SYSTEM_PROMPT },
        { role: "user", content: `Letter: ${letter.toUpperCase()}. Animal: ${animal}.` },
      ],
    });

    const raw = completion.choices[0]?.message?.content || "{}";
    const script = JSON.parse(raw) as EpisodeScript;
    if (!Array.isArray(script.scenes) || script.scenes.length === 0) {
      return NextResponse.json({ error: "Model returned an invalid script — try again" }, { status: 502 });
    }
    script.scenes = script.scenes.slice(0, 6).map((s, i) => ({ ...s, id: i + 1 }));
    return NextResponse.json({ script });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `Script generation failed: ${msg}` }, { status: 500 });
  }
}
