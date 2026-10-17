"use client";

import { useState } from "react";

interface Scene {
  id: number;
  line: string;
  imagePrompt: string;
}
interface EpisodeScript {
  title: string;
  description: string;
  tags: string[];
  scenes: Scene[];
}
interface SceneAssets {
  image?: string; // data URL
  audio?: string; // data URL
}

type LogEntry = { text: string; kind: "info" | "ok" | "err" };

export default function Home() {
  const [letter, setLetter] = useState("A");
  const [animal, setAnimal] = useState("Alligator");
  const [script, setScript] = useState<EpisodeScript | null>(null);
  const [assets, setAssets] = useState<Record<number, SceneAssets>>({});
  const [video, setVideo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<LogEntry[]>([]);

  const addLog = (text: string, kind: LogEntry["kind"] = "info") =>
    setLog((l) => [...l, { text, kind }]);

  async function callApi<T>(url: string, body: unknown): Promise<T> {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || `${url} failed (${res.status})`);
    return data as T;
  }

  async function generateScript() {
    setBusy(true);
    setScript(null);
    setAssets({});
    setVideo(null);
    try {
      addLog(`Writing script: ${letter.toUpperCase()} is for ${animal}…`);
      const { script } = await callApi<{ script: EpisodeScript }>("/api/script", { letter, animal });
      setScript(script);
      addLog(`Script ready — ${script.scenes.length} scenes.`, "ok");
    } catch (e) {
      addLog(e instanceof Error ? e.message : String(e), "err");
    } finally {
      setBusy(false);
    }
  }

  async function generateAssets() {
    if (!script) return;
    setBusy(true);
    const next: Record<number, SceneAssets> = {};
    try {
      for (const scene of script.scenes) {
        addLog(`Scene ${scene.id}: generating voice…`);
        const { audio } = await callApi<{ audio: string }>("/api/voice", { text: scene.line });
        addLog(`Scene ${scene.id}: generating illustration…`);
        const { image } = await callApi<{ image: string }>("/api/image", { prompt: scene.imagePrompt });
        next[scene.id] = { audio, image };
        setAssets({ ...next });
        addLog(`Scene ${scene.id}: assets done.`, "ok");
      }
      addLog("All scene assets generated.", "ok");
    } catch (e) {
      addLog(e instanceof Error ? e.message : String(e), "err");
    } finally {
      setBusy(false);
    }
  }

  async function renderVideo() {
    if (!script) return;
    setBusy(true);
    try {
      addLog("Rendering video (captions, zoom, concat)… this can take a minute.");
      const scenes = script.scenes.map((s) => ({
        caption: s.line,
        image: assets[s.id]?.image || "",
        audio: assets[s.id]?.audio || "",
      }));
      const { video, bytes } = await callApi<{ video: string; bytes: number }>("/api/render", { scenes });
      setVideo(video);
      addLog(`Video rendered — ${(bytes / 1024 / 1024).toFixed(1)} MB. Ready to download!`, "ok");
    } catch (e) {
      addLog(e instanceof Error ? e.message : String(e), "err");
    } finally {
      setBusy(false);
    }
  }

  const assetsReady = script ? script.scenes.every((s) => assets[s.id]?.image && assets[s.id]?.audio) : false;
  const step = video ? 4 : assetsReady ? 3 : script ? 2 : 1;

  function download() {
    if (!video) return;
    const a = document.createElement("a");
    a.href = video;
    a.download = `${letter.toUpperCase()}-is-for-${animal}.mp4`;
    a.click();
  }

  return (
    <div className="container">
      <header className="brand">
        <div className="logo">🐊</div>
        <h1>
          Ava<span>Tails</span> Factory
        </h1>
      </header>
      <p className="subtitle">Kids animal-learning episodes — script → voice → visuals → video, in one click.</p>

      <div className="pipeline">
        {["1 Script", "2 Voice + Visuals", "3 Render", "4 Download"].map((s, i) => (
          <div key={s} className={`step-pill ${step === i + 1 ? "active" : step > i + 1 ? "done" : ""}`}>
            {s}
          </div>
        ))}
      </div>

      <div className="grid">
        <div>
          <div className="card">
            <h2>
              <span className="num">1</span>Episode setup
            </h2>
            <label>Letter</label>
            <input type="text" value={letter} maxLength={1} onChange={(e) => setLetter(e.target.value.toUpperCase())} />
            <label>Animal</label>
            <input type="text" value={animal} onChange={(e) => setAnimal(e.target.value)} />
            <button onClick={generateScript} disabled={busy || !letter || !animal}>
              ✍️ Generate script
            </button>
          </div>

          <div className="card">
            <h2>
              <span className="num">2</span>Assets
            </h2>
            <button onClick={generateAssets} disabled={busy || !script} className={script ? "" : "secondary"}>
              🎙️🎨 Generate voice + visuals
            </button>
          </div>

          <div className="card">
            <h2>
              <span className="num">3</span>Render
            </h2>
            <button onClick={renderVideo} disabled={busy || !assetsReady} className={assetsReady ? "" : "secondary"}>
              🎬 Render video
            </button>
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
          {script && (
            <div className="card">
              <h2>Scenes</h2>
              {script.scenes.map((s) => (
                <div key={s.id} className="scene-row">
                  {assets[s.id]?.image ? (
                    <img className="thumb" src={assets[s.id].image} alt={`Scene ${s.id}`} />
                  ) : (
                    <div className="thumb placeholder">{s.id}</div>
                  )}
                  <div className="line">{s.line}</div>
                  <div className="status">
                    {assets[s.id]?.image && assets[s.id]?.audio ? "✅" : assets[s.id] ? "⏳" : "·"}
                  </div>
                </div>
              ))}
            </div>
          )}

          {video && (
            <div className="card">
              <h2>Your episode 🎉</h2>
              <video controls src={video} />
              <button onClick={download}>⬇️ Download MP4</button>
            </div>
          )}

          {script && (
            <div className="card">
              <h2>YouTube metadata</h2>
              <div className="copy-row">
                <div className="meta-box">
                  <div className="k">Title</div>
                  {script.title}
                </div>
                <button className="secondary" onClick={() => navigator.clipboard.writeText(script.title)}>
                  Copy
                </button>
              </div>
              <div style={{ height: 10 }} />
              <div className="copy-row">
                <div className="meta-box">
                  <div className="k">Description</div>
                  {script.description}
                </div>
                <button className="secondary" onClick={() => navigator.clipboard.writeText(script.description)}>
                  Copy
                </button>
              </div>
              <div style={{ height: 10 }} />
              <div className="meta-box">
                <div className="k">Tags</div>
                {script.tags?.join(", ")}
              </div>
              <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 0 }}>
                ⚠️ Uploading to the kids channel? Set the video as <strong>“Made for Kids”</strong> in YouTube Studio.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
