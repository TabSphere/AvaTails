import { NextRequest, NextResponse } from "next/server";
import { generateScript } from "@/lib/ai";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { letter, animal, model } = (await req.json()) as {
      letter?: string;
      animal?: string;
      model?: string;
    };
    if (!letter || !animal) {
      return NextResponse.json({ error: "letter and animal are required" }, { status: 400 });
    }
    const script = await generateScript(letter, animal, model);
    return NextResponse.json({ script });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `Script generation failed: ${msg}` }, { status: 500 });
  }
}
