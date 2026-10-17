// The AvaTails agent team. Each agent owns one stage of the factory.
export type AgentId = "chief" | "writer" | "voice" | "artist" | "editor" | "publisher";

export interface AgentDef {
  id: AgentId;
  name: string;
  role: string;
  emoji: string;
}

export const AGENTS: AgentDef[] = [
  { id: "chief", name: "Chief of Staff", role: "Runs the queue, assigns jobs", emoji: "👔" },
  { id: "writer", name: "Scriptwriter", role: "Writes 6-scene toddler episodes", emoji: "✍️" },
  { id: "voice", name: "Voice Artist", role: "ElevenLabs narration per scene", emoji: "🎙️" },
  { id: "artist", name: "Illustrator", role: "Cartoon scene art (OpenAI images)", emoji: "🎨" },
  { id: "editor", name: "Video Editor", role: "Captions, transitions, music, MP4", emoji: "🎬" },
  { id: "publisher", name: "Publisher", role: "Saves episodes + metadata", emoji: "📦" },
];

export const agentOf = (id: AgentId): AgentDef => AGENTS.find((a) => a.id === id) as AgentDef;

/** Which agents are active for a pipeline stage. */
export const STAGE_AGENTS: Record<string, AgentId[]> = {
  script: ["writer"],
  assets: ["voice", "artist"],
  render: ["editor"],
  save: ["publisher"],
};
