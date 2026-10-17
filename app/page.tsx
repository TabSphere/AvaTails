"use client";

import { useEffect, useState } from "react";

interface Scene {
  id: number;
  line: string;
  imagePrompt: string;
  imageUrl?: string;
  audioUrl?: string;
}
interface Episode {
  id: string;
  letter: string;
  animal: string;
  script: { title: string; description: string; tags: string[] };
  scenes: Scene[];
  videoUrl?: string;
  bytes?: number;
  createdAt: string;
  status: "done" | "failed";
}
interface Settings {
  scriptModel: string;
  imageModel: string;
  voiceId: string;
  transitions: boolean;
  musicUrl: string;
}
interface HistoryEntry {
  id: string;
  letter: string;
  animal: string;
  title: string;
  videoUrl?: string;
  thumbUrl?: string;
  createdAt: string;
  status: "done" | "failed";
}
type LogEntry = { text: string; kind: "info" | "ok" | "err" };
type Tab = "create" | "batch" | "history" | "settings";

const DEFAULT_SETTINGS: Settings = {
  scriptModel: "gpt-4o-mini",
  imageModel: "gpt-image-1",
  voiceId: "21m00Tcm4TlvDq8ikWAM",
  transitions: true,
  musicUrl: "",
};

const loadSettings = (): Settings => {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem("avatails_settings") : null;
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
};

export default function Home() {
  const [tab, setTab] = useState<Tab>("create");
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  useEffect(() => setSettings(loadSettings()), []);
  const saveSettings = (s: Settings) => {
    setSettings(s);
    localStorage.setItem("avatails_settings", JSON.stringify(s));
  };

  return (
    <div className="container">
      <header className="brand">
        <div className="logo">🐊</div>
        <h1>
          Ava<span>Tails</span> Factory
        </h1>
      </header>
      <p className="subtitle">Kids animal-learning episodes — one click from letter to finished video.</p>

      <nav className="tabs">
        {(["create", "batch", "history", "settings"] as Tab[]).map((t) => (
          <button key={t} className={`tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
            {t === "create" ? "🎬 Create" : t === "batch" ? "📚 Batch A–Z" : t === "history" ? "🗂️ History" : "⚙️ Settings"}
          </button>
        ))}
      </nav>

      {tab === "create" && <CreateTab settings={settings} />}
      {tab === "batch" && <BatchTab settings={settings} />}
      {tab === "history" && <HistoryTab />}
      {tab === "settings" && <SettingsTab settings={settings} onSave={saveSettings} />}
    </div>
  );
}

/* ───────────────────────── Create ───────────────────────── */

function CreateTab({ settings }: { settings: Settings }) {
  const [letter, setLetter] = useState("A");
  const [animal, setAnimal] = useState("Alligator");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [episode, setEpisode] = useState<Episode | null>(null);

  const addLog = (text: string, kind: LogEntry["kind"] = "info") => setLog((l) => [...l, { text, kind }]);

  async function run() {
    setBusy(true);
    setEpisode(null);
    setProgress(0);
    setLog([]);
    try {
      const res = await fetch("/api/episodes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ letter, animal, settings }),
      });
      if (!res.ok || !res.body) throw new Error(`Pipeline failed (${res.status})`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() || "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const ev = JSON.parse(line);
          if (ev.type === "progress") {
            addLog(ev.message);
            if (typeof ev.progress === "number") setProgress(ev.progress);
          } else if (ev.type === "episode") {
            setEpisode(ev.episode);
            addLog("Episode ready to download!", "ok");
          } else if (ev.type === "error") {
            addLog(ev.message, "err");
          }
        }
      }
    } catch (e) {
      addLog(e instanceof Error ? e.message : String(e), "err");
    } finally {
      setBusy(false);
    }
  }

  function download() {
    if (!episode?.videoUrl) return;
    const a = document.createElement("a");
    a.href = episode.videoUrl;
    a.download = `${episode.letter}-is-for-${episode.animal}.mp4`;
    a.target = "_blank";
    a.click();
  }

  return (
    <div className="grid">
      <div>
        <div className="card">
          <h2>
            <span className="num">▶</span>New episode
          </h2>
          <label>Letter</label>
          <input type="text" value={letter} maxLength={1} onChange={(e) => setLetter(e.target.value.toUpperCase())} />
          <label>Animal</label>
          <input type="text" value={animal} onChange={(e) => setAnimal(e.target.value)} />
          <button onClick={run} disabled={busy || !letter || !animal}>
            {busy ? "🏭 Factory running…" : "🚀 Generate full episode"}
          </button>
          {(busy || progress > 0) && (
            <div className="progress">
              <div className="progress-bar" style={{ width: `${progress}%` }} />
            </div>
          )}
        </div>

        <div className="card">
          <h2>Factory log</h2>
          <div className="log">
            {log.length === 0 && <div>Waiting for orders, boss. 🐾</div>}
            {log.map((l, i) => (
              <div key={i} className={l.kind}>
                {l.kind === "ok" ? "✅ " : l.kind === "err" ? "❌ " : "• "}
                {l.text}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div>
        {episode && (
          <>
            <div className="card">
              <h2>Your episode 🎉</h2>
              {episode.videoUrl && <video controls src={episode.videoUrl} />}
              <button onClick={download}>⬇️ Download MP4{episode.bytes ? ` (${(episode.bytes / 1048576).toFixed(1)} MB)` : ""}</button>
            </div>

            <div className="card">
              <h2>Scenes</h2>
              {episode.scenes.map((s) => (
                <div key={s.id} className="scene-row">
                  {s.imageUrl ? (
                    <img className="thumb" src={s.imageUrl} alt={`Scene ${s.id}`} />
                  ) : (
                    <div className="thumb placeholder">{s.id}</div>
                  )}
                  <div className="line">{s.line}</div>
                </div>
              ))}
            </div>

            <div className="card">
              <h2>YouTube metadata</h2>
              <div className="copy-row">
                <div className="meta-box">
                  <div className="k">Title</div>
                  {episode.script.title}
                </div>
                <button className="secondary" onClick={() => navigator.clipboard.writeText(episode.script.title)}>
                  Copy
                </button>
              </div>
              <div style={{ height: 10 }} />
              <div className="copy-row">
                <div className="meta-box">
                  <div className="k">Description</div>
                  {episode.script.description}
                </div>
                <button className="secondary" onClick={() => navigator.clipboard.writeText(episode.script.description)}>
                  Copy
                </button>
              </div>
              <div style={{ height: 10 }} />
              <div className="meta-box">
                <div className="k">Tags</div>
                {episode.script.tags?.join(", ")}
              </div>
              <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 0 }}>
                ⚠️ Set the video as <strong>“Made for Kids”</strong> when uploading (COPPA).
              </p>
            </div>
          </>
        )}
        {!episode && !busy && (
          <div className="card" style={{ color: "var(--muted)", fontSize: 14 }}>
            <h2>How it works</h2>
            <p>Pick a letter and an animal, hit the button, and the factory will:</p>
            <p>
              1. ✍️ Write a 6-scene toddler episode
              <br />
              2. 🎙️ Voice every scene (ElevenLabs)
              <br />
              3. 🎨 Illustrate every scene (OpenAI)
              <br />
              4. 🎬 Render a captioned vertical MP4 with transitions
              {settings.musicUrl ? " and your music bed" : ""}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ───────────────────────── Batch ───────────────────────── */

interface BatchRow {
  letter: string;
  animal: string;
  status: "queued" | "running" | "done" | "failed";
  episode?: Episode;
  error?: string;
}

function BatchTab({ settings }: { settings: Settings }) {
  const [input, setInput] = useState(
    "A, Alligator\nB, Bear\nC, Cat\nD, Dog\nE, Elephant\nF, Frog\nG, Giraffe\nH, Hippo"
  );
  const [rows, setRows] = useState<BatchRow[]>([]);
  const [busy, setBusy] = useState(false);

  async function runBatch() {
    const parsed: BatchRow[] = input
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const [letter, animal] = l.split(/[,\t]/).map((p) => p.trim());
        return { letter: (letter || "").toUpperCase(), animal: animal || "", status: "queued" as const };
      })
      .filter((r) => r.letter && r.animal);
    if (!parsed.length) return;
    setRows(parsed);
    setBusy(true);

    for (let i = 0; i < parsed.length; i++) {
      setRows((rs) => rs.map((r, j) => (j === i ? { ...r, status: "running" } : r)));
      try {
        const res = await fetch("/api/episodes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ letter: parsed[i].letter, animal: parsed[i].animal, settings }),
        });
        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        let episode: Episode | null = null;
        let error = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() || "";
          for (const line of lines) {
            if (!line.trim()) continue;
            const ev = JSON.parse(line);
            if (ev.type === "episode") episode = ev.episode;
            if (ev.type === "error") error = ev.message;
          }
        }
        if (episode) {
          const ep = episode as Episode;
          setRows((rs) => rs.map((r, j) => (j === i ? { ...r, status: "done", episode: ep } : r)));
        } else {
          throw new Error(error || "unknown error");
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setRows((rs) => rs.map((r, j) => (j === i ? { ...r, status: "failed", error: msg } : r)));
      }
    }
    setBusy(false);
  }

  return (
    <div className="grid">
      <div className="card">
        <h2>
          <span className="num">📚</span>Batch queue
        </h2>
        <label>One episode per line: Letter, Animal</label>
        <textarea rows={10} value={input} onChange={(e) => setInput(e.target.value)} />
        <button onClick={runBatch} disabled={busy}>
          {busy ? "🏭 Batch running…" : `🏭 Run batch (${input.split("\n").filter((l) => l.trim()).length} episodes)`}
        </button>
        <p style={{ fontSize: 12, color: "var(--muted)" }}>
          Runs one episode at a time. Keep this tab open — each finished episode appears on the right with a download
          link.
        </p>
      </div>

      <div className="card">
        <h2>Results</h2>
        {rows.length === 0 && <div style={{ color: "var(--muted)", fontSize: 14 }}>No batch yet.</div>}
        {rows.map((r, i) => (
          <div key={i} className="scene-row">
            <div className="thumb placeholder">{r.letter}</div>
            <div className="line">
              <strong>{r.animal}</strong>
              {r.error && <div style={{ color: "var(--err)", fontSize: 12 }}>{r.error}</div>}
            </div>
            <div className="status">
              {r.status === "queued" && "⏸️"}
              {r.status === "running" && "⏳"}
              {r.status === "failed" && "❌"}
              {r.status === "done" && r.episode?.videoUrl && (
                <a href={r.episode.videoUrl} download target="_blank" rel="noreferrer" style={{ color: "var(--ok)" }}>
                  ⬇️ MP4
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ───────────────────────── History ───────────────────────── */

function HistoryTab() {
  const [episodes, setEpisodes] = useState<HistoryEntry[]>([]);
  const [storage, setStorage] = useState<string>("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/episodes")
      .then((r) => r.json())
      .then((d) => {
        setEpisodes(d.episodes || []);
        setStorage(d.storage || "none");
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  return (
    <div className="card">
      <h2>Episode history</h2>
      {loaded && storage === "none" && (
        <div className="meta-box">
          💡 History needs storage: add a <strong>Vercel Blob</strong> store to your project (it sets
          BLOB_READ_WRITE_TOKEN automatically) and redeploy. Until then, episodes are delivered as instant downloads
          only.
        </div>
      )}
      <div className="history-grid">
        {episodes.map((e) => (
          <div key={e.id} className="history-card">
            {e.thumbUrl ? (
              <img src={e.thumbUrl} alt={e.title} />
            ) : (
              <div className="thumb placeholder" style={{ width: "100%", height: 140 }}>
                {e.letter}
              </div>
            )}
            <div className="history-meta">
              <div className="history-title">{e.title || `${e.letter} is for ${e.animal}`}</div>
              <div className="history-date">
                {new Date(e.createdAt).toLocaleDateString()} · {e.status === "done" ? "✅ done" : "❌ failed"}
              </div>
              {e.videoUrl && (
                <a href={e.videoUrl} target="_blank" rel="noreferrer" download>
                  ⬇️ Download
                </a>
              )}
            </div>
          </div>
        ))}
        {loaded && storage !== "none" && episodes.length === 0 && (
          <div style={{ color: "var(--muted)" }}>No episodes yet — go make the first one! 🐊</div>
        )}
      </div>
    </div>
  );
}

/* ───────────────────────── Settings ───────────────────────── */

function SettingsTab({ settings, onSave }: { settings: Settings; onSave: (s: Settings) => void }) {
  const [draft, setDraft] = useState<Settings>(settings);
  const [saved, setSaved] = useState(false);
  const [musicMsg, setMusicMsg] = useState("");

  useEffect(() => setDraft(settings), [settings]);

  async function uploadMusic(file: File) {
    setMusicMsg("Uploading music…");
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = reject;
      r.readAsDataURL(file);
    });
    try {
      const res = await fetch("/api/music", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ music: dataUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDraft({ ...draft, musicUrl: data.musicUrl });
      setMusicMsg("✅ Music uploaded and will play under every episode.");
    } catch (e) {
      // Blob storage off — keep the data URL inline (works for short tracks)
      setDraft({ ...draft, musicUrl: dataUrl });
      setMusicMsg(`⚠️ Stored locally instead (${e instanceof Error ? e.message : "no blob storage"}).`);
    }
  }

  return (
    <div className="card" style={{ maxWidth: 560 }}>
      <h2>Factory settings</h2>
      <label>Script model</label>
      <input type="text" value={draft.scriptModel} onChange={(e) => setDraft({ ...draft, scriptModel: e.target.value })} />
      <label>Image model</label>
      <input type="text" value={draft.imageModel} onChange={(e) => setDraft({ ...draft, imageModel: e.target.value })} />
      <label>ElevenLabs voice ID</label>
      <input type="text" value={draft.voiceId} onChange={(e) => setDraft({ ...draft, voiceId: e.target.value })} />
      <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16 }}>
        <input
          type="checkbox"
          checked={draft.transitions}
          onChange={(e) => setDraft({ ...draft, transitions: e.target.checked })}
          style={{ width: 16, height: 16 }}
        />
        Crossfade transitions between scenes
      </label>
      <label>Background music (mp3, plays quietly under the voice)</label>
      <input type="file" accept="audio/mpeg,audio/mp3" onChange={(e) => e.target.files?.[0] && uploadMusic(e.target.files[0])} />
      {musicMsg && <p style={{ fontSize: 12, color: "var(--muted)" }}>{musicMsg}</p>}
      {draft.musicUrl && (
        <p style={{ fontSize: 12, color: "var(--ok)" }}>
          🎵 Music set{" "}
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setDraft({ ...draft, musicUrl: "" });
            }}
            style={{ color: "var(--err)" }}
          >
            (remove)
          </a>
        </p>
      )}
      <button
        onClick={() => {
          onSave(draft);
          setSaved(true);
          setTimeout(() => setSaved(false), 2000);
        }}
      >
        {saved ? "✅ Saved!" : "💾 Save settings"}
      </button>
      <p style={{ fontSize: 12, color: "var(--muted)" }}>Settings are stored in this browser only.</p>
    </div>
  );
}
