// The auto-pipeline: one call turns "A + Alligator" into a finished episode.
// Streams progress via a callback; persists to Vercel Blob when configured.
import crypto from "crypto";
import { generateScript, generateVoice, generateImage } from "./ai";
import { renderEpisode } from "./ffmpeg";
import { blobEnabled, saveEpisode, saveBuffer } from "./storage";
import type { Episode, FactorySettings, ProgressEvent, RenderInput } from "./types";

type ProgressFn = (e: ProgressEvent) => void;

const dataUrlToBuffer = (dataUrl: string): Buffer =>
  Buffer.from(dataUrl.replace(/^data:[^;]+;base64,/, ""), "base64");

async function resolveToBuffer(ref: string): Promise<Buffer> {
  if (ref.startsWith("data:")) return dataUrlToBuffer(ref);
  const res = await fetch(ref);
  if (!res.ok) throw new Error(`Failed to fetch asset (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}

export async function runEpisode(
  letter: string,
  animal: string,
  settings: FactorySettings,
  onProgress: ProgressFn
): Promise<Episode> {
  const say = (stage: string, message: string, progress: number) =>
    onProgress({ type: "progress", stage, message, progress });

  const episode: Episode = {
    id: crypto.randomBytes(6).toString("hex"),
    letter: letter.toUpperCase(),
    animal,
    script: { title: "", description: "", tags: [], scenes: [] },
    scenes: [],
    createdAt: new Date().toISOString(),
    status: "done",
  };

  try {
    // ── Stage 1: script ────────────────────────────────────────────────
    say("script", `Writing script: ${episode.letter} is for ${animal}…`, 5);
    episode.script = await generateScript(letter, animal, settings.scriptModel);
    episode.scenes = episode.script.scenes.map((s) => ({ ...s }));
    say("script", `Script ready — ${episode.scenes.length} scenes: "${episode.script.title}"`, 15);

    // ── Stage 2: voice + visuals, generated in parallel ────────────────
    say("assets", "Generating voiceovers and illustrations in parallel…", 20);
    const sceneInputs: RenderInput[] = new Array(episode.scenes.length);
    let done = 0;
    await Promise.all(
      episode.scenes.map(async (scene, i) => {
        const [audio, image] = await Promise.all([
          generateVoice(scene.line, settings.voiceId),
          generateImage(scene.imagePrompt, settings.imageModel),
        ]);
        if (blobEnabled()) {
          const base = `episodes/${episode.id}`;
          [scene.audioUrl, scene.imageUrl] = await Promise.all([
            saveBuffer(`${base}/voice-${scene.id}.mp3`, audio, "audio/mpeg"),
            saveBuffer(`${base}/scene-${scene.id}.jpg`, image, "image/jpeg"),
          ]);
        }
        sceneInputs[i] = { caption: scene.line, image, audio };
        done += 1;
        say("assets", `Scene ${scene.id} assets ready (${done}/${episode.scenes.length})`, 20 + Math.round((done / episode.scenes.length) * 40));
      })
    );

    // ── Stage 3: render ────────────────────────────────────────────────
    say("render", "Rendering video (captions, transitions, music)…", 65);
    const music = settings.musicUrl ? await resolveToBuffer(settings.musicUrl) : null;
    const video = await renderEpisode(
      sceneInputs,
      { transitions: settings.transitions ?? true, music },
      blobEnabled() ? Number.POSITIVE_INFINITY : undefined
    );
    say("render", `Video rendered — ${(video.byteLength / 1024 / 1024).toFixed(1)} MB`, 90);

    // ── Stage 4: persist / deliver ─────────────────────────────────────
    if (blobEnabled()) {
      say("save", "Saving episode to storage…", 95);
      await saveEpisode(episode, video);
    } else {
      episode.videoUrl = `data:video/mp4;base64,${video.toString("base64")}`;
      episode.bytes = video.byteLength;
    }
    say("save", "Episode complete! 🎉", 100);
    return episode;
  } catch (e) {
    episode.status = "failed";
    episode.error = e instanceof Error ? e.message : String(e);
    if (blobEnabled()) {
      try {
        await saveEpisode(episode, null);
      } catch {
        /* storage is best-effort */
      }
    }
    throw e;
  }
}
