// Shared AI helpers used by both the staged routes and the auto-pipeline.
import OpenAI from "openai";
import sharp from "sharp";
import { scriptPromptFor, imageSuffixFor } from "./prompts";
import type { EpisodeScript } from "./types";

function openaiClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");
  return new OpenAI();
}

export async function generateScript(
  letter: string,
  animal: string,
  model?: string,
  channel?: string
): Promise<EpisodeScript> {
  const openai = openaiClient();
  const userMsg =
    channel === "wildtails"
      ? `Animal: ${animal}.`
      : `Letter: ${letter.toUpperCase()}. Animal: ${animal}.`;
  const completion = await openai.chat.completions.create({
    model: model || process.env.OPENAI_SCRIPT_MODEL || "gpt-4o-mini",
    response_format: { type: "json_object" },
    temperature: 0.8,
    messages: [
      { role: "system", content: scriptPromptFor(channel) },
      { role: "user", content: userMsg },
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

// ElevenLabs pay-as-you-go allows max 3 concurrent TTS requests; the pipeline
// builds all scenes in parallel, so voice calls are serialized (max 2 at once)
// and 429 rate limits are retried with backoff.
let voiceInFlight = 0;
const voiceWaiters: Array<() => void> = [];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function acquireVoiceSlot(): Promise<void> {
  if (voiceInFlight < 2) {
    voiceInFlight++;
    return;
  }
  await new Promise<void>((resolve) => voiceWaiters.push(resolve));
  voiceInFlight++;
}
function releaseVoiceSlot(): void {
  voiceInFlight--;
  const next = voiceWaiters.shift();
  if (next) next();
}

export async function generateVoice(text: string, voiceId?: string): Promise<Buffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY is not configured");
  const voice = voiceId || process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM"; // Rachel

  await acquireVoiceSlot();
  try {
    for (let attempt = 1; attempt <= 4; attempt++) {
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}`, {
        method: "POST",
        headers: { "xi-api-key": apiKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
        body: JSON.stringify({
          text,
          model_id: process.env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2",
          voice_settings: { stability: 0.55, similarity_boost: 0.75, style: 0.45, use_speaker_boost: true },
        }),
      });
      if (res.ok) return Buffer.from(await res.arrayBuffer());
      const detail = await res.text();
      if (res.status === 429 && attempt < 4) {
        await sleep(5000 * attempt); // 5s, 10s, 15s backoff
        continue;
      }
      throw new Error(`ElevenLabs error ${res.status}: ${detail.slice(0, 300)}`);
    }
    throw new Error("ElevenLabs error 429: rate limit persisted after retries");
  } finally {
    releaseVoiceSlot();
  }
}

/** Generates an illustration, returned as a compressed JPEG buffer. */
export async function generateImage(prompt: string, model?: string, channel?: string): Promise<Buffer> {
  const openai = openaiClient();
  const usedModel = model || process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
  const fullPrompt = `${prompt}\n\nStyle: ${imageSuffixFor(channel)}`;

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
