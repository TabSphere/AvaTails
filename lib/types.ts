// AvaTails — internal data contracts shared by the pipeline stages

export interface Scene {
  id: number;
  /** Spoken narration for this scene (also shown as on-screen caption). Max ~12 words. */
  line: string;
  /** Prompt used to generate this scene's illustration. */
  imagePrompt: string;
}

export interface EpisodeScript {
  title: string;
  description: string;
  tags: string[];
  scenes: Scene[];
}

/** Per-request overrides coming from the Settings tab. */
export interface FactorySettings {
  scriptModel?: string;
  imageModel?: string;
  voiceId?: string;
  /** Crossfade transitions between scenes. */
  transitions?: boolean;
  /** Background music: blob URL or data URL (mp3). Optional. */
  musicUrl?: string | null;
}

/** A scene after assets exist. Uses blob URLs when storage is on, else data URLs. */
export interface EpisodeSceneAsset extends Scene {
  imageUrl?: string;
  audioUrl?: string;
}

export interface Episode {
  id: string;
  letter: string;
  animal: string;
  /** Which channel this episode was produced for: "avatails" (default) | "wildtails". */
  channel?: string;
  script: EpisodeScript;
  scenes: EpisodeSceneAsset[];
  videoUrl?: string;
  bytes?: number;
  /** Estimated generation cost in USD (see lib/cost.ts). */
  costUSD?: number;
  createdAt: string;
  status: "done" | "failed";
  error?: string;
}

/** NDJSON progress event streamed by /api/episodes and the queue runner. */
export interface ProgressEvent {
  type: "progress" | "episode" | "error";
  stage?: string;
  /** Agents currently working (drives the Factory Floor status lights). */
  agents?: string[];
  message: string;
  /** 0–100 */
  progress?: number;
  episode?: Episode;
}

/** A scene ready for the render engine (binary in). */
export interface RenderInput {
  caption: string;
  image: Buffer;
  audio: Buffer;
}

export interface RenderOptions {
  transitions?: boolean;
  music?: Buffer | null;
}
