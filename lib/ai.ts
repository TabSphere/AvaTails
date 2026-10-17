// Shared AI helpers used by both the staged routes and the auto-pipeline.
import OpenAI from "openai";
import sharp from "sharp";
import { SCRIPT_SYSTEM_PROMPT, IMAGE_STYLE_SUFFIX } from "./prompts";
import type { EpisodeScript } from "./types";

function openaiClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");
  return new OpenAI();
}

export async function generateScript(letter: string, animal: string, model?: string): Promise<EpisodeScript> {
  const openai = openaiClient();
  const completion = await openai.chat.completions.create({
    model: model || process.env.OPENAI_SCRIPT_MODEL || "gpt-4o-mini",
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
    throw new Error("Model returned an invalid script — try again");
  }
  script.scenes = script.scenes.slice(0, 6).map((s, i) => ({ ...s, id: i + 1 }));
  return script;
}

export async function generateVoice(text: string, voiceId?: string): Promise<Buffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY is not configured");
  const voice = voiceId || process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM"; // Rachel

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}`, {
    method: "POST",
    headers: { "xi-api-key": apiKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({
      text,
      model_id: process.env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2",
      voice_settings: { stability: 0.55, similarity_boost: 0.75, style: 0.45, use_speaker_boost: true },
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`ElevenLabs error ${res.status}: ${detail.slice(0, 300)}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

/** Generates an illustration, returned as a compressed JPEG buffer. */
export async function generateImage(prompt: string, model?: string): Promise<Buffer> {
  const openai = openaiClient();
  const usedModel = model || process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
  const fullPrompt = `${prompt}\n\nStyle: ${IMAGE_STYLE_SUFFIX}`;

  let b64: string | undefined;
  try {
    if (usedModel === "dall-e-3") {
      const res = await openai.images.generate({
        model: usedModel,
        prompt: fullPrompt,
        size: "1024x1792",
        response_format: "b64_json",
      });
      b64 = res.data?.[0]?.b64_json;
    } else {
      const res = await openai.images.generate({
        model: usedModel,
        prompt: fullPrompt,
        size: "1024x1536",
        quality: "medium",
      });
      b64 = res.data?.[0]?.b64_json;
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/verify|organization/i.test(msg)) {
      throw new Error(`${msg} — set OPENAI_IMAGE_MODEL=dall-e-3 as a fallback`);
    }
    throw e;
  }
  if (!b64) throw new Error("Image API returned no data");

  return sharp(Buffer.from(b64, "base64")).jpeg({ quality: 82 }).toBuffer();
}
