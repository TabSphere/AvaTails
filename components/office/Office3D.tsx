"use client";

import { useEffect, useRef, useState } from "react";
import { OFFICE_AGENTS } from "./officeScene";

interface Office3DProps {
  workingIds: string[];
  status: string;
}

type SceneHandle = {
  setWorking: (ids: string[]) => void;
  setTime: (minutes: number) => void;
  toggleCyberpunk: () => boolean;
  destroy: () => void;
};

export default function Office3D({ workingIds, status }: Office3DProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SceneHandle | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [cyberpunk, setCyberpunk] = useState(false);
  const [clockText, setClockText] = useState("");

  // Create scene once (client-only; this component is loaded with ssr:false)
  useEffect(() => {
    let alive = true;
    import("./officeScene")
      .then((m) => {
        if (!alive || !mountRef.current || sceneRef.current) return;
        try {
          const now = new Date();
          const scene = m.createOfficeScene(mountRef.current) as SceneHandle;
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
  }, []);

  // Forward working agents to the scene
  useEffect(() => {
    sceneRef.current?.setWorking(workingIds);
  }, [workingIds, ready]);

  // Real clock
  useEffect(() => {
    const tick = () =>
      setClockText(
        new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      );
    tick();
    const id = setInterval(tick, 15000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="office-wrap">
      <div ref={mountRef} className="office-canvas" />
      {!ready && !error && <div className="office-loading">🏭 Building the factory floor…</div>}
      {error && <div className="office-loading">⚠️ 3D floor failed to start: {error}</div>}

      {/* top-left: live status */}
      <div className="office-status">
        <span className={`office-dot ${workingIds.length ? "on" : ""}`} />
        {status}
      </div>

      {/* top-right: clock */}
      <div className="office-clock">{clockText}</div>

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
