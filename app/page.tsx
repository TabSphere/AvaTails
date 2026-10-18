"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

const Office3D = dynamic(() => import("@/components/office/Office3D"), {
  ssr: false,
  loading: () => <div className="office-loading">🖥️ Powering up the AI data centre…</div>,
});

/* ── shared types ── */
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
  channel?: string;
  script: { title: string; description: string; tags: string[] };
  scenes: Scene[];
  videoUrl?: string;
  bytes?: number;
  costUSD?: number;
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
interface QueueJob {
  id: string;
  letter: string;
  animal: string;
  channel?: string;
  status: "queued" | "running" | "waiting" | "done" | "failed";
  stage?: string;
  agents?: string[];
  progress?: number;
  error?: string;
  episodeId?: string;
  costUSD?: number;
  createdAt: string;
  finishedAt?: string;
  logTail: string[];
}
interface QueueState {
  jobs: QueueJob[];
  totalEpisodes: number;
  totalCostUSD: number;
  updatedAt: string;
  storage?: string;
}
interface HistoryEntry {
  id: string;
  letter: string;
  animal: string;
  channel?: string;
  title: string;
  videoUrl?: string;
  thumbUrl?: string;
  createdAt: string;
  status: "done" | "failed";
}
type LogEntry = { text: string; kind: "info" | "ok" | "err" };
type Tab = "floor" | "queue" | "create" | "history" | "settings";

const DEFAULT_SETTINGS: Settings = {
  scriptModel: "gpt-4o-mini",
  imageModel: "gpt-image-1",
  voiceId: "21m00Tcm4TlvDq8ikWAM",
  transitions: true,
  musicUrl: "",
};

/* ── Channel brands: each gets its own themed 3D office floor.
   To add a future channel: add one entry here AND one in OFFICE_THEMES
   (components/office/officeScene.js) — the floor, sign and theming follow automatically. ── */
const BRANDS = [
  { id: "avatails", name: "AvaTails", emoji: "🐊", tagline: "Kids animal ABC episodes" },
  { id: "wildtails", name: "WildTails", emoji: "🦁", tagline: "Wild nature shorts" },
] as const;
type BrandId = (typeof BRANDS)[number]["id"];

/* ── Per-channel formats: each brand runs its own show ── */
const channelEmoji = (c?: string) => (c === "wildtails" ? "🦁" : "🐊");
const jobTitle = (j: { letter: string; animal: string; channel?: string }) =>
  j.channel === "wildtails" ? `${j.animal} — Wild Facts` : `${j.letter} is for ${j.animal}`;

/** Default batch lists per channel — matches each channel's real format. */
const DEFAULT_LISTS: Record<BrandId, string> = {
  avatails:
    "A, Alligator\nB, Bear\nC, Cat\nD, Dog\nE, Elephant\nF, Frog\nG, Giraffe\nH, Hippo\nI, Iguana\nJ, Jaguar\nK, Koala\nL, Lion\nM, Monkey\nN, Narwhal\nO, Owl\nP, Penguin\nQ, Quokka\nR, Rabbit\nS, Snake\nT, Tiger\nU, Unau\nV, Vulture\nW, Whale\nX, X-ray Fish\nY, Yak\nZ, Zebra",
  wildtails:
    "Lion\nWolf\nGolden Retriever\nRed Panda\nBald Eagle\nDolphin\nGerman Shepherd\nTiger\nElephant\nPersian Cat\nPenguin\nSiberian Husky",
};

/* Approval gate — the Publisher holds finished episodes until the boss taps OK. */
async function decideJob(jobId: string, action: "approve" | "reject", note?: string): Promise<string> {
  const res = await fetch("/api/queue/approve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jobId, action, note }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "approval failed");
  return action === "approve" ? "✅ Approved — episode shipped to History." : "❌ Rejected — job marked failed.";
}

const loadSettings = (): Settings => {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem("avatails_settings") : null;
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
};

export default function Home() {
  const [tab, setTab] = useState<Tab>("floor");
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [queue, setQueue] = useState<QueueState | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => setSettings(loadSettings()), []);

  // Poll queue state while on floor/queue tabs — the "watch them work" feed.
  useEffect(() => {
    const poll = () =>
      fetch("/api/queue")
        .then((r) => r.json())
        .then((d) => setQueue(d))
        .catch(() => {});
    poll();
    if (tab === "floor" || tab === "queue") {
      pollRef.current = setInterval(poll, 4000);
      return () => {
        if (pollRef.current) clearInterval(pollRef.current);
      };
    }
    return undefined;
  }, [tab]);

  const saveSettings = (s: Settings) => {
    setSettings(s);
    localStorage.setItem("avatails_settings", JSON.stringify(s));
  };

  return (
    <div className="container">
      <header className="brand">
        <div className="logo">🐊</div>
        <h1>
          Tab<span>Sphere</span>
        </h1>
        <div className="div-badge">YouTube Automation Division</div>
      </header>
      <p className="subtitle">
        Powering <strong>@AvaTails</strong> 🐊 (toddler Animal ABCs) and <strong>@WildTails</strong> 🦁 (family
        wildlife facts) — two channels, two formats, one AI agent team working around the clock.
      </p>

      <nav className="tabs">
        {(["floor", "queue", "create", "history", "settings"] as Tab[]).map((t) => (
          <button key={t} className={`tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
            {t === "floor"
              ? "🖥️ Data Centre"
              : t === "queue"
                ? "📋 Job Queue"
                : t === "create"
                  ? "🎬 Create"
                  : t === "history"
                    ? "🗂️ History"
                    : "⚙️ Settings"}
          </button>
        ))}
      </nav>

      {tab === "floor" && <FloorTab queue={queue} settings={settings} />}
      {tab === "queue" && <QueueTab queue={queue} settings={settings} />}
      {tab === "create" && <CreateTab settings={settings} />}
      {tab === "history" && <HistoryTab />}
      {tab === "settings" && <SettingsTab settings={settings} onSave={saveSettings} />}
    </div>
  );
}

/* ───────────────────────── Factory Floor ───────────────────────── */

function FloorTab({ queue, settings }: { queue: QueueState | null; settings: Settings }) {
  const [triggerMsg, setTriggerMsg] = useState("");
  const [triggering, setTriggering] = useState(false);
  const [brand, setBrand] = useState<BrandId>("avatails");
  const activeBrand = BRANDS.find((b) => b.id === brand) || BRANDS[0];
  const [deciding, setDeciding] = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  const [decisionMsg, setDecisionMsg] = useState("");

  const runningJob = queue?.jobs.find((j) => j.status === "running");
  const waitingJob = queue?.jobs.find((j) => j.status === "waiting");
  const queuedCount = queue?.jobs.filter((j) => j.status === "queued").length || 0;
  // Pipeline running → its agents glow. Waiting on approval → the Publisher waves.
  const workingIds = runningJob?.agents || (waitingJob ? ["publisher"] : []);
  const boardJob = runningJob || waitingJob;
  const officeStatus = runningJob
    ? `${jobTitle(runningJob)} — ${runningJob.stage || "starting"}`
    : waitingJob
      ? `${jobTitle(waitingJob)} — Publisher needs your OK ✋`
      : queuedCount > 0
        ? `${queuedCount} job${queuedCount > 1 ? "s" : ""} waiting — agents standing by`
        : "All agents idle — queue is empty";

  async function decide(jobId: string, action: "approve" | "reject") {
    setDeciding(true);
    try {
      setDecisionMsg(await decideJob(jobId, action, action === "reject" ? rejectNote : undefined));
      setRejectNote("");
      const d = await fetch("/api/queue").then((r) => r.json());
      // queue state refresh happens via the poller; this just speeds it up
      void d;
    } catch (e) {
      setDecisionMsg(`❌ ${e instanceof Error ? e.message : e}`);
    } finally {
      setDeciding(false);
    }
  }

  async function runNext() {
    setTriggering(true);
    setTriggerMsg("👔 Chief of Staff is dispatching the next job…");
    try {
      const res = await fetch("/api/queue/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      });
      const data = await res.json();
      if (data.ran && !data.error) setTriggerMsg(`✋ Episode produced — the Publisher is holding it for your OK.`);
      else if (data.error) setTriggerMsg(`❌ ${data.error}`);
      else setTriggerMsg("💤 Queue is empty — add jobs in the Job Queue tab.");
    } catch (e) {
      setTriggerMsg(`❌ ${e instanceof Error ? e.message : e}`);
    } finally {
      setTriggering(false);
    }
  }

  return (
    <>
      <div className="stat-strip">
        <div className="stat">
          <div className="stat-v">{queuedCount}</div>
          <div className="stat-k">jobs queued</div>
        </div>
        <div className="stat">
          <div className="stat-v">{runningJob ? 1 : 0}</div>
          <div className="stat-k">running now</div>
        </div>
        <div className="stat">
          <div className="stat-v">{queue?.totalEpisodes ?? 0}</div>
          <div className="stat-k">episodes made</div>
        </div>
        <div className="stat">
          <div className="stat-v">${(queue?.totalCostUSD ?? 0).toFixed(2)}</div>
          <div className="stat-k">est. spend</div>
        </div>
      </div>

      <div className="card">
        <h2>
          🖥️ Inside the {activeBrand.name} AI data centre — live
          <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 400, marginLeft: 8 }}>
            {activeBrand.tagline}
          </span>
        </h2>
        <div className="tabs" style={{ marginBottom: 14 }}>
          {BRANDS.map((b) => (
            <button
              key={b.id}
              className={`tab ${brand === b.id ? "active" : ""}`}
              onClick={() => setBrand(b.id)}
            >
              {b.emoji} {b.name} floor
            </button>
          ))}
        </div>
        <Office3D
          brand={brand}
          workingIds={workingIds}
          status={officeStatus}
          stage={runningJob?.stage ?? (waitingJob ? "needs approval" : undefined)}
          progress={boardJob?.progress}
          jobTitle={boardJob ? jobTitle(boardJob) : undefined}
        />
        <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 0, marginTop: 10 }}>
          Drag to orbit · scroll to zoom · agents glow when the real pipeline has them working. Data-centre floor adapted from{" "}
          <a href="https://github.com/Gaurav2693/ai-office" target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>
            ai-office
          </a>{" "}
          (MIT).
        </p>
      </div>

      {waitingJob && !runningJob && (
        <div className="card approval-card">
          <h2>✋ Waiting for your OK</h2>
          <div className="scene-row">
            <div className="thumb placeholder">{channelEmoji(waitingJob.channel)}</div>
            <div className="line">
              <strong>{jobTitle(waitingJob)}</strong>
              <div style={{ color: "var(--muted)", fontSize: 12 }}>
                Episode produced{waitingJob.costUSD != null && ` · $${waitingJob.costUSD.toFixed(3)}`} — the Publisher
                won't ship it until you approve.
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
            <button style={{ marginTop: 0 }} onClick={() => decide(waitingJob.id, "approve")} disabled={deciding}>
              ✅ Approve — ship it
            </button>
            <button
              className="secondary"
              style={{ marginTop: 0 }}
              onClick={() => decide(waitingJob.id, "reject")}
              disabled={deciding}
            >
              ❌ Reject
            </button>
          </div>
          <input
            type="text"
            placeholder="Reject note (optional) — e.g. intro too long"
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
          />
          {decisionMsg && <p style={{ fontSize: 13, marginBottom: 0 }}>{decisionMsg}</p>}
        </div>
      )}

      {runningJob && (
        <div className="card">
          <h2>🔴 Live now</h2>
          <div className="scene-row">
            <div className="thumb placeholder">{channelEmoji(runningJob.channel)}</div>
            <div className="line">
              <strong>{jobTitle(runningJob)}</strong>
              <div style={{ color: "var(--muted)", fontSize: 12 }}>stage: {runningJob.stage || "starting"}</div>
            </div>
            <div className="status">{runningJob.progress ?? 0}%</div>
          </div>
          <div className="progress">
            <div className="progress-bar" style={{ width: `${runningJob.progress ?? 0}%` }} />
          </div>
          <div className="log" style={{ marginTop: 12 }}>
            {(runningJob.logTail || []).map((l, i) => (
              <div key={i}>• {l}</div>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <h2>Foreman controls</h2>
        <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 0 }}>
          The cron worker (every 10 min on Vercel Pro) picks up queued jobs automatically — that’s the “while you
          sleep” shift. Use the button to dispatch a job right now.
        </p>
        <button onClick={runNext} disabled={triggering || queuedCount === 0}>
          {triggering ? "🏭 Working…" : `▶ Run next job now (${queuedCount} queued)`}
        </button>
        {triggerMsg && <p style={{ fontSize: 13, marginBottom: 0 }}>{triggerMsg}</p>}
      </div>

      {queue?.storage === "none" && (
        <div className="card">
          <div className="meta-box">
            💡 The Factory Floor needs storage: attach a <strong>Vercel Blob</strong> store (Storage tab in Vercel) and
            redeploy. That’s where the queue and history live so agents work without your browser open.
          </div>
        </div>
      )}
    </>
  );
}

/* ───────────────────────── Queue ───────────────────────── */

function QueueTab({ queue, settings }: { queue: QueueState | null; settings: Settings }) {
  const [qBrand, setQBrand] = useState<BrandId>("avatails");
  const [inputs, setInputs] = useState<Record<BrandId, string>>(DEFAULT_LISTS);
  const input = inputs[qBrand];
  const [msg, setMsg] = useState("");
  const [decidingId, setDecidingId] = useState("");
  void settings;

  async function decide(jobId: string, action: "approve" | "reject") {
    setDecidingId(jobId);
    try {
      setMsg(await decideJob(jobId, action));
    } catch (e) {
      setMsg(`❌ ${e instanceof Error ? e.message : e}`);
    } finally {
      setDecidingId("");
    }
  }

  async function enqueue() {
    const jobs = input
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const parts = l.split(/[,\t]/).map((p) => p.trim());
        // "Letter, Animal" — or just "Animal" (WildTails style; letter auto-derives)
        return parts.length > 1 ? { letter: parts[0], animal: parts[1] } : { letter: "", animal: parts[0] };
      })
      .filter((j) => j.animal && (qBrand === "wildtails" || j.letter));
    if (!jobs.length) return;
    setMsg("Adding jobs…");
    try {
      const res = await fetch("/api/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobs, channel: qBrand }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMsg(
        `✅ ${data.enqueued} ${channelEmoji(qBrand)} jobs queued for ${qBrand === "wildtails" ? "WildTails" : "AvaTails"}. Agents will pick them up.`
      );
    } catch (e) {
      setMsg(`❌ ${e instanceof Error ? e.message : e}`);
    }
  }

  const jobs = queue?.jobs || [];

  return (
    <div className="grid">
      <div className="card">
        <h2>
          <span className="num">📋</span>Add jobs
        </h2>
        <div className="tabs" style={{ marginBottom: 12 }}>
          {BRANDS.map((b) => (
            <button
              key={b.id}
              className={`tab ${qBrand === b.id ? "active" : ""}`}
              onClick={() => setQBrand(b.id)}
            >
              {b.emoji} {b.name}
            </button>
          ))}
        </div>
        <label>
          {qBrand === "wildtails"
            ? "One animal per line — Wild Facts format (hook → facts → wow → outro)"
            : "One episode per line: Letter, Animal — Animal ABCs format"}
        </label>
        <textarea
          rows={12}
          value={input}
          onChange={(e) => setInputs({ ...inputs, [qBrand]: e.target.value })}
        />
        <button onClick={enqueue}>➕ Enqueue {qBrand === "wildtails" ? "WildTails" : "AvaTails"} jobs</button>
        {msg && <p style={{ fontSize: 13 }}>{msg}</p>}
        <p style={{ fontSize: 12, color: "var(--muted)" }}>
          Each channel runs its own format: 🐊 toddler ABC episodes vs 🦁 family wildlife facts. Jobs live in storage,
          not your browser — the cron worker keeps producing even when this tab is closed.
        </p>
      </div>

      <div className="card">
        <h2>Queue ({jobs.length})</h2>
        {jobs.length === 0 && <div style={{ color: "var(--muted)", fontSize: 14 }}>No jobs yet.</div>}
        {jobs.map((j) => (
          <div key={j.id} className="scene-row">
            <div className="thumb placeholder">{channelEmoji(j.channel)}</div>
            <div className="line">
              <strong>{jobTitle(j)}</strong>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>
                {new Date(j.createdAt).toLocaleString()}
                {j.costUSD != null && ` · $${j.costUSD.toFixed(3)}`}
              </div>
              {j.error && <div style={{ color: "var(--err)", fontSize: 12 }}>{j.error}</div>}
              {j.status === "waiting" && (
                <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                  <button
                    className="mini ok"
                    disabled={decidingId === j.id}
                    onClick={() => decide(j.id, "approve")}
                  >
                    ✅ Approve
                  </button>
                  <button
                    className="mini"
                    disabled={decidingId === j.id}
                    onClick={() => decide(j.id, "reject")}
                  >
                    ❌ Reject
                  </button>
                </div>
              )}
            </div>
            <div className="status">
              {j.status === "queued" && "⏸️"}
              {j.status === "running" && `⏳ ${j.progress ?? 0}%`}
              {j.status === "waiting" && "✋"}
              {j.status === "done" && "✅"}
              {j.status === "failed" && "❌"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ───────────────────────── Create (manual single) ───────────────────────── */

function CreateTab({ settings }: { settings: Settings }) {
  const [cBrand, setCBrand] = useState<BrandId>("avatails");
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
        body: JSON.stringify({
          letter: cBrand === "wildtails" ? animal.trim()[0] || "W" : letter,
          animal,
          channel: cBrand,
          settings,
        }),
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
    a.download =
      episode.channel === "wildtails"
        ? `${episode.animal.toLowerCase().replace(/\s+/g, "-")}-wild-facts.mp4`
        : `${episode.letter}-is-for-${episode.animal}.mp4`;
    a.target = "_blank";
    a.click();
  }

  return (
    <div className="grid">
      <div>
        <div className="card">
          <h2>
            <span className="num">▶</span>Single episode (instant)
          </h2>
          <div className="tabs" style={{ marginBottom: 12 }}>
            {BRANDS.map((b) => (
              <button
                key={b.id}
                className={`tab ${cBrand === b.id ? "active" : ""}`}
                onClick={() => {
                  setCBrand(b.id);
                  setAnimal(b.id === "wildtails" ? "Lion" : "Alligator");
                }}
              >
                {b.emoji} {b.name}
              </button>
            ))}
          </div>
          {cBrand === "avatails" && (
            <>
              <label>Letter</label>
              <input type="text" value={letter} maxLength={1} onChange={(e) => setLetter(e.target.value.toUpperCase())} />
            </>
          )}
          <label>{cBrand === "wildtails" ? "Animal (wildlife, dog breed or pet)" : "Animal"}</label>
          <input type="text" value={animal} onChange={(e) => setAnimal(e.target.value)} />
          <button onClick={run} disabled={busy || !animal || (cBrand === "avatails" && !letter)}>
            {busy
              ? "🏭 Factory running…"
              : cBrand === "wildtails"
                ? "🚀 Generate Wild Facts episode"
                : "🚀 Generate full episode"}
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
              <button onClick={download}>
                ⬇️ Download MP4{episode.bytes ? ` (${(episode.bytes / 1048576).toFixed(1)} MB)` : ""}
              </button>
              {episode.costUSD != null && (
                <p style={{ fontSize: 12, color: "var(--muted)" }}>Est. cost: ${episode.costUSD.toFixed(3)}</p>
              )}
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
                {episode.channel === "wildtails" ? (
                  <>
                    🦁 WildTails targets a family audience — upload to <strong>@WildTails24</strong> (not marked
                    “Made for Kids”, so comments stay on).
                  </>
                ) : (
                  <>
                    ⚠️ Set the video as <strong>“Made for Kids”</strong> when uploading to @AvaTails (COPPA).
                  </>
                )}
              </p>
            </div>
          </>
        )}
        {!episode && !busy && (
          <div className="card" style={{ color: "var(--muted)", fontSize: 14 }}>
            <h2>Tip 💡</h2>
            <p>
              For hands-off production use the <strong>Job Queue</strong> tab instead — queue the whole A–Z series and
              let the agents work through it. This tab is for one-off test runs.
            </p>
          </div>
        )}
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
                {e.channel === "wildtails" ? "🦁" : e.letter}
              </div>
            )}
            <div className="history-meta">
              <div className="history-title">
                {channelEmoji(e.channel)} {e.title || jobTitle(e)}
              </div>
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
      <p style={{ fontSize: 12, color: "var(--muted)" }}>
        Settings are stored in this browser only. The cron worker runs with defaults — voice/model changes here apply
        to manual runs and the queue “run now” button.
      </p>
    </div>
  );
}
