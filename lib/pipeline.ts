// The auto-pipeline: one call turns "A + Alligator" into a finished episode.
// Streams agent-tagged progress via a callback; persists to Vercel Blob when configured.
import crypto from "crypto";
import { generateScript, generateVoice, generateImage } from "./ai";
import { renderEpisode } from "./ffmpeg";
import { blobEnabled, saveEpisode, saveBuffer } from "./storage";
import { estimateEpisodeCost } from "./cost";
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
  onProgress: ProgressFn,
  channel?: string
): Promise<Episode> {
  const say = (stage: string, message: string, progress: number, agents?: string[]) =>
    onProgress({ type: "progress", stage, message, progress, agents });

  const episode: Episode = {
    id: crypto.randomBytes(6).toString("hex"),
    letter: letter.toUpperCase(),
    animal,
    channel: channel || "avatails",
    script: { title: "", description: "", tags: [], scenes: [] },
    scenes: [],
    createdAt: new Date().toISOString(),
    status: "done",
  };

  // Narration pace per channel: toddlers need slow, warm delivery;
  // the WildTails nature host stays brisk but never rushed.
  const voiceSpeed = episode.channel === "wildtails" ? 0.95 : 0.88;

  try {
    // ── Stage 1: script (agent: writer) ────────────────────────────────
    const draftMsg =
      episode.channel === "wildtails"
        ? `Scriptwriter is digging up wild facts about the ${animal}…`
        : `Scriptwriter is drafting: ${episode.letter} is for ${animal}…`;
    say("script", draftMsg, 5, ["writer"]);
    episode.script = await generateScript(letter, animal, settings.scriptModel, episode.channel);
    episode.scenes = episode.script.scenes.map((s) => ({ ...s }));
    say("script", `Script ready — ${episode.scenes.length} scenes: "${episode.script.title}"`, 15);

    // ── Stage 2: voice + visuals, in parallel (agents: voice, artist) ──
    say("assets", "Voice Artist + Illustrator are producing all scenes in parallel…", 20, ["voice", "artist"]);
    const sceneInputs: RenderInput[] = new Array(episode.scenes.length);
    let done = 0;
    await Promise.all(
      episode.scenes.map(async (scene, i) => {
        const [audio, image] = await Promise.all([
          generateVoice(scene.line, settings.voiceId, voiceSpeed),
          generateImage(scene.imagePrompt, settings.imageModel, episode.channel),
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
        say(
          "assets",
          `Scene ${scene.id} voiced + illustrated (${done}/${episode.scenes.length})`,
          20 + Math.round((done / episode.scenes.length) * 40),
          ["voice", "artist"]
        );
      })
    );

    // ── Stage 3: render (agent: editor) ────────────────────────────────
    say("render", "Video Editor is assembling: captions, transitions, music…", 65, ["editor"]);
    const music = settings.musicUrl ? await resolveToBuffer(settings.musicUrl) : null;
    const video = await renderEpisode(
      sceneInputs,
      { transitions: settings.transitions ?? true, music },
      blobEnabled() ? Number.POSITIVE_INFINITY : undefined
    );
    say("render", `Video rendered — ${(video.byteLength / 1024 / 1024).toFixed(1)} MB`, 90);

    // ── Stage 4: persist / deliver (agent: publisher) ──────────────────
    episode.costUSD = estimateEpisodeCost({
      voiceChars: episode.scenes.reduce((a, s) => a + s.line.length, 0),
      imageCount: episode.scenes.length,
      imageModel: settings.imageModel,
    }).totalUSD;
    if (blobEnabled()) {
      say("save", "Publisher is filing the episode…", 95, ["publisher"]);
      await saveEpisode(episode, video);
    } else {
      episode.videoUrl = `data:video/mp4;base64,${video.toString("base64")}`;
      episode.bytes = video.byteLength;
    }
    say("save", `Episode complete (est. cost $${episode.costUSD.toFixed(3)})`, 100);
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
