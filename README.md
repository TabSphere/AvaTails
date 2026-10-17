# 🐊 AvaTails Factory

The automated video factory for the **AvaTails** YouTube Kids channel
([youtube.com/@AvaTails](https://www.youtube.com/@AvaTails)) — toddler animal-learning
episodes ("A is for Alligator!"), generated end to end:

```
Letter + Animal → AI script → ElevenLabs voiceover → AI illustrations → rendered MP4
```

One repeatable episode format, one click per stage, finished vertical video ready to upload.

## Stack

- **Next.js 14** (App Router, TypeScript) — dashboard + API pipeline
- **OpenAI** — episode scripts (`gpt-4o-mini`) and scene illustrations (`gpt-image-1`, `dall-e-3` fallback)
- **ElevenLabs** — voiceover per scene
- **FFmpeg** (`ffmpeg-static`) + **sharp** — caption burn-in, Ken Burns zoom, MP4 assembly

## API pipeline

| Route | Stage | In → Out |
|---|---|---|
| `POST /api/script` | Scriptwriter | `{ letter, animal }` → 6-scene episode JSON (title, description, tags, scenes) |
| `POST /api/voice` | Voice bot | `{ text }` → mp3 data URL |
| `POST /api/image` | Visual bot | `{ prompt }` → JPEG data URL |
| `POST /api/render` | Video factory | `{ scenes: [{ caption, image, audio }] }` → MP4 data URL |

The episode format is locked in `lib/prompts.ts` (letter intro → animal reveal → animal
sound → fun fact → action → recap). Change it there and every future episode follows.

## Local development

```bash
cp .env.example .env.local   # fill in your keys
npm install
npm run dev                  # http://localhost:3000
```

## Deploy to Vercel

1. Push this repo to GitHub (done — you're reading it).
2. [vercel.com](https://vercel.com) → **Add New → Project** → import `TabSphere/AvaTails`.
3. Add environment variables from `.env.example` (**OPENAI_API_KEY** and
   **ELEVENLABS_API_KEY** are required).
4. Deploy.

> ⚠️ **Plan note:** video rendering is CPU-bound. Vercel **Hobby** caps functions at 60s —
> short episodes usually fit, but if renders time out, upgrade to **Pro** (300s) or run
> the render step locally with `npm run dev`. Serverless bodies are limited to ~4.5MB, so
> the renderer automatically drops resolution/bitrate until the MP4 fits.

## Usage

1. Open the dashboard, pick a **letter + animal** (A → Alligator, B → Bear, …).
2. **Generate script** → review the 6 scenes.
3. **Generate voice + visuals** → per-scene voiceover and illustration.
4. **Render video** → preview + download the MP4.
5. Upload to YouTube Studio, paste the generated title/description/tags, and set
   **"Made for Kids"** (required by COPPA).

## Cost per episode (approx.)

- Script: < $0.01
- 6 images (gpt-image-1 medium): ~$0.10–0.15
- Voiceover (~100 chars × 6): a few cents on ElevenLabs

## Roadmap

- [ ] YouTube Data API auto-upload with scheduling (OAuth refresh token + `madeForKids` flag)
- [ ] Vercel Blob storage for rendered episodes (lifts the 4.5MB response cap)
- [ ] Batch mode: generate the whole A–Z series in one run
- [ ] Compilation stitcher: 10 episodes → 15-min compilation video
- [ ] WildTails mode: same factory, animal-facts template for the sister channel
