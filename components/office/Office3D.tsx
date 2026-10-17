"use client";

import { useEffect, useRef, useState } from "react";
import { OFFICE_AGENTS } from "./officeScene";

interface Office3DProps {
  workingIds: string[];
  status: string;
  stage?: string;
  progress?: number;
  jobTitle?: string;
  brand?: string; // key into OFFICE_THEMES — one themed floor per channel
}

type SceneHandle = {
  setWorking: (ids: string[], stage?: string | null) => void;
  setJob: (title: string | null, pct: number, stage?: string | null) => void;
  setTime: (minutes: number) => void;
  toggleCyberpunk: () => boolean;
  destroy: () => void;
};

export default function Office3D({ workingIds, status, stage, progress, jobTitle, brand = "avatails" }: Office3DProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SceneHandle | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [cyberpunk, setCyberpunk] = useState(false);
  const [clockText, setClockText] = useState("");

  // Create scene (client-only; this component is loaded with ssr:false).
  // Rebuilds when the brand changes — each channel gets its own themed floor.
  useEffect(() => {
    let alive = true;
    setReady(false);
    import("./officeScene")
      .then((m) => {
        if (!alive || !mountRef.current || sceneRef.current) return;
        try {
          const now = new Date();
          type Theme = (typeof m.OFFICE_THEMES)["avatails"];
          const themes = m.OFFICE_THEMES as Record<string, Theme>;
          const theme = themes[brand] || m.OFFICE_THEMES.avatails;
          const scene = m.createOfficeScene(mountRef.current, theme) as SceneHandle;
          scene.setTime(now.getHours() * 60 + now.getMinutes());
          sceneRef.current = scene;
          setReady(true);
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e));
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
    return () => {
      alive = false;
      if (sceneRef.current) {
        sceneRef.current.destroy();
        sceneRef.current = null;
      }
    };
  }, [brand]);

  // Forward working agents + current stage to the scene
  useEffect(() => {
    sceneRef.current?.setWorking(workingIds, stage ?? null);
  }, [workingIds, stage, ready]);

  // Mission-control board
  useEffect(() => {
    sceneRef.current?.setJob(jobTitle ?? null, progress ?? 0, stage ?? null);
  }, [jobTitle, progress, stage, ready]);

  // Real clock — scene time follows the visitor's clock
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setClockText(now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      sceneRef.current?.setTime(now.getHours() * 60 + now.getMinutes());
    };
    tick();
    const id = setInterval(tick, 15000);
    return () => clearInterval(id);
  }, []);

  const active = workingIds.length > 0;

  return (
    <div className="office-wrap">
      <div ref={mountRef} className="office-canvas" />
      {!ready && !error && <div className="office-loading">🖥️ Powering up the {brand === "wildtails" ? "WildTails" : "AvaTails"} hall…</div>}
      {error && <div className="office-loading">⚠️ 3D floor failed to start: {error}</div>}

      {/* top-left: live status */}
      <div className="office-status">
        <span className={`office-dot ${active ? "on" : ""}`} />
        {status}
      </div>

      {/* top-right: clock */}
      <div className="office-clock">{clockText}</div>

      {/* progress bar above the HUD while a job runs */}
      {active && (
        <div className="office-progress">
          <div style={{ width: `${progress ?? 0}%` }} />
        </div>
      )}

      {/* bottom bar: legend + lights */}
      <div className="office-hud">
        <div className="office-legend">
          {OFFICE_AGENTS.map((a) => (
            <span
              key={a.id}
              className={`office-chip ${workingIds.includes(a.id) ? "on" : ""}`}
              style={{ borderColor: workingIds.includes(a.id) ? a.hex : undefined }}
            >
              <span className="office-chip-dot" style={{ background: a.hex }} />
              {a.name}
            </span>
          ))}
        </div>
        <button
          className="office-lights"
          onClick={() => setCyberpunk(sceneRef.current?.toggleCyberpunk() ?? false)}
        >
          {cyberpunk ? "💡 LIGHTS ON" : "🌙 LIGHTS OFF"}
        </button>
      </div>
    </div>
  );
}
