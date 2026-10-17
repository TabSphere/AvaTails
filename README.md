# 🐊 AvaTails Factory

An **AI agent team** that produces kids animal-learning episodes for the
**AvaTails** YouTube Kids channel ([youtube.com/@AvaTails](https://www.youtube.com/@AvaTails)) —
autonomously, around the clock:

```
Job Queue → 👔 Chief of Staff dispatches → ✍️ Scriptwriter → 🎙️ Voice Artist +
🎨 Illustrator (parallel) → 🎬 Video Editor → 📦 Publisher → finished MP4
```

## The agent team

| Agent | Job |
|---|---|
| 👔 Chief of Staff | Runs the job queue, dispatches work |
| ✍️ Scriptwriter | 6-scene toddler episode scripts (OpenAI) |
| 🎙️ Voice Artist | Per-scene narration (ElevenLabs) |
| 🎨 Illustrator | Cartoon scene art (OpenAI `gpt-image-1` / `dall-e-3`) |
| 🎬 Video Editor | Captions, Ken Burns zoom, crossfades, music bed, loudness normalization (FFmpeg) |
| 📦 Publisher | Persists episodes + metadata (Vercel Blob) |

## Features

- **🏭 Factory Floor** — live dashboard: agent status lights, current job progress,
  activity feed, jobs queued / episodes made / estimated spend
- **📋 Job Queue** — enqueue the whole A–Z series at once; jobs live in Blob storage,
  not your browser, so production continues with the tab closed
- **⏰ Cron worker** (`/api/cron/run-queue`, see `vercel.json`) — picks up one queued
  job per run. This is the *works-while-you-sleep* shift
- **🎬 Create tab** — instant single-episode mode with streaming progress
- **🗂️ History** — every episode persisted with thumbnail, metadata, download link
- **💰 Cost tracking** — estimated $ per episode and running total
- **🔒 Password gate** — set `FACTORY_PASSWORD` to put the whole app behind a login

## Deploy to Vercel

1. **Add New → Project** → import `TabSphere/AvaTails`.
2. Environment variables (see `.env.example`):
   - `OPENAI_API_KEY`, `ELEVENLABS_API_KEY` — required
   - `FACTORY_PASSWORD` — recommended
   - `CRON_SECRET` — recommended (Vercel sends it as a bearer header on cron runs)
3. **Storage tab → Create Blob store** — required for the queue, history, and music.
4. Deploy. The cron in `vercel.json` (every 10 min) is registered automatically.

> ⚠️ **Plan notes:** Vercel **Hobby** allows only one cron run **per day** and 60s
> functions — enough to test, not to run a factory. **Pro** unlocks the 10-minute
> schedule and 300s functions (a full episode takes 1–3 min). On Hobby, use the
> Factory Floor's **"Run next job now"** button instead.

## Daily operation

1. Job Queue tab → paste `Letter, Animal` lines → **Enqueue jobs**.
2. Walk away. The cron worker produces episodes one at a time.
3. Check the Factory Floor anytime to watch agents work; download from History.
4. Upload to YouTube Studio, set **"Made for Kids"** (COPPA).

## API

| Route | Purpose |
|---|---|
| `GET/POST /api/queue` | Queue state / enqueue jobs |
| `POST /api/queue/run` | Run the next queued job now (manual dispatch) |
| `GET /api/cron/run-queue` | Cron worker (bearer `CRON_SECRET`) |
| `POST /api/episodes` | One-click episode pipeline (NDJSON progress stream) |
| `GET /api/episodes` | Episode history |
| `POST /api/music` | Upload the background music bed |
| `POST /api/script` `/api/voice` `/api/image` `/api/render` | Individual stages |
| `POST /api/auth/login` | Password gate |

## Local development

```bash
cp .env.example .env.local
npm install
npm run dev   # http://localhost:3000
```

## Roadmap

- [ ] YouTube Data API auto-upload + scheduling (`madeForKids` auto-set) — the Publisher agent's next skill
- [ ] Parallel job workers (QStash) instead of one-at-a-time cron
- [ ] Compilation stitcher: 10 episodes → 15-min compilation
- [ ] WildTails mode: animal-facts template for the sister channel
- [ ] Consistent character sets via reference images
