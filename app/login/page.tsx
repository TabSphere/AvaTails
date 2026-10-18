"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");
      router.replace("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container" style={{ maxWidth: 420, paddingTop: 120 }}>
      <header className="brand" style={{ justifyContent: "center" }}>
        <div className="logo">TS</div>
        <h1>
          Ava<span>Tails</span> Factory
        </h1>
      </header>
      <div className="card">
        <h2>Sign in</h2>
        <form onSubmit={submit}>
          <label>Factory password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            style={{
              width: "100%",
              background: "var(--panel-2)",
              border: "1px solid #2c3355",
              color: "var(--text)",
              borderRadius: 10,
              padding: "10px 12px",
              fontSize: 15,
              outline: "none",
            }}
          />
          {error && <p style={{ color: "var(--err)", fontSize: 13 }}>{error}</p>}
          <button type="submit" disabled={busy || !password}>
            Enter the factory →
          </button>
        </form>
      </div>
    </div>
  );
}
