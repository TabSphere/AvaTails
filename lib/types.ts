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

/** A scene after voice + image assets have been generated. */
export interface RenderScene {
  caption: string;
  /** data URL (image/jpeg;base64,...) */
  image: string;
  /** data URL (audio/mpeg;base64,...) */
  audio: string;
}
