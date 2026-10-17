# 🐊 AvaTails Factory

The production video factory for the **AvaTails** YouTube Kids channel
([youtube.com/@AvaTails](https://www.youtube.com/@AvaTails)) — toddler animal-learning
episodes ("A is for Alligator!"), generated end to end:

```
Letter + Animal → AI script → ElevenLabs voiceover → AI illustrations → rendered MP4
```

## Features

- **One-click episodes** — a single streaming pipeline call writes the script, generates
  all voiceovers and illustrations **in parallel**, renders, and saves the video
- **Batch A–Z mode** — queue a whole series (`A, Alligator` … `Z, Zebra`), one episode at
  a time, with per-episode download links
- **Episode history** — every render is persisted to Vercel Blob with thumbnails and
  metadata (when storage is attached)
- **Professional render engine** — burned-in captions, Ken Burns zoom, crossfade
  transitions, loudness-normalized voiceover, optional background music bed
- **Password gate** — set `FACTORY_PASSWORD` and the whole app sits behind a login page
- **Settings tab** — voice, models, transitions, and music, adjustable without redeploys

## Stack

- **Next.js 14** (App Router, TypeScript)
- **OpenAI** — scripts (`gpt-4o-mini`) + illustrations (`gpt-image-1`, `dall-e-3` fallback)
- **ElevenLabs** — per-scene voiceover
- **FFmpeg** (`ffmpeg-static`) + **sharp** — caption burn-in, transitions, music mix, MP4 assembly
- **Vercel Blob** — asset + episode persistence (optional but recommended)

## API

| Route | Purpose |
|---|---|
| `POST /api/episodes` | **Main pipeline.** Streams NDJSON progress events, ends with the finished episode |
| `GET /api/episodes` | Episode history (from Blob storage) |
| `POST /api/music` | Upload the background music bed once, reuse forever |
| `POST /api/script` `/api/voice` `/api/image` `/api/render` | Individual stages (manual/advanced use) |
| `POST /api/auth/login` | Password gate (active when `FACTORY_PASSWORD` is set) |

The episode format is locked in `lib/prompts.ts` (letter intro → animal reveal → sound →
fun fact → action → recap). Change it there and every future episode follows.

## Deploy to Vercel

1. **Add New → Project** → import `TabSphere/AvaTails`.
2. Environment variables (see `.env.example`):
   - `OPENAI_API_KEY`, `ELEVENLABS_API_KEY` — required
   - `FACTORY_PASSWORD` — recommended
3. **Storage tab → Create Blob store** (free tier) — attaches `BLOB_READ_WRITE_TOKEN`
   automatically, enabling History + music uploads.
4. Deploy → open → sign in → generate your first episode.

> ⚠️ **Plan note:** the full pipeline (script + 6 voices + 6 images + render) takes
> 1–3 minutes. Vercel **Pro** allows 300s functions; on **Hobby** (60s) long episodes may
> time out — run locally (`npm run dev`) or split work via the staged routes.

## Local development

```bash
cp .env.example .env.local   # fill in your keys
npm install
npm run dev                  # http://localhost:3000
```

## Cost per episode (approx.)

- Script: < $0.01 · 6 images (gpt-image-1 medium): ~$0.10–0.15 · Voiceover: a few cents

## Roadmap

- [ ] YouTube Data API auto-upload with scheduling (`madeForKids` flag auto-set)
- [ ] Background job queue (QStash) so batches run without an open browser tab
- [ ] Compilation stitcher: 10 episodes → 15-min compilation video
- [ ] WildTails mode: same factory, animal-facts template for the sister channel
- [ ] Per-series visual identity (consistent character sets via reference images)
