# trend-recreator-saas

**Photo + Instagram reel link → a video of *you* in the trend**, a monetised
Telegram bot on Convex + Comfy Cloud. The pipeline is the proven "viral
character swap": Gemini analyzes the reel scene-by-scene, GPT Image 2 puts
the customer into the reel's first frame, and Seedance 2.0 regenerates the
video (9:16, up to 12 s, audio) with the customer as the subject.

Derived from [`my-saas-boilerplate`](https://github.com/m0502369637-hub/my-saas-boilerplate)
(wired as the `upstream` remote — pull plumbing updates from it).

## How a generation flows

```
Telegram ──webhook──▶ Convex /telegram
                          │ user sends PHOTO with the reel link as caption
                          │ jobs.createJob (debit SERVICE_COST)
                          │ jobs_actions.submitJob → comfy_cloud provider:
                          │   1. photo → POST /api/upload/image
                          │   2. reel link → COMFY_REEL_RESOLVER (IG downloader) → mp4 → upload
                          │   3. COMFY_WORKFLOW (env) with __IMAGE__/__VIDEO__ substituted
                          │   4. POST /api/prompt → { prompt_id }
                          ▼
        Comfy Cloud: Gemini analysis → GPT Image 2 frame swap → Seedance 2.0 (9:16, 12s)
                          │ scheduler chain + cron sweep poll GET /history/<id>
                          ▼
        video out → download (Bearer) → sendVideo to the user → complete (or refund on failure)
```

## Environment variables

| Name | Required | Purpose |
| --- | --- | --- |
| `BOT_TOKEN` | ✅ | Classic Bot API token |
| `WEBHOOK_SECRET` | ✅ | `setWebhook` secret_token |
| `SERVICE_COST` | ✅ | Stars per generation — change anytime, no redeploy |
| `COMFY_API_KEY` | run-time | Comfy Cloud API key (**use your production key at launch**) |
| `COMFY_API_BASE` | optional | Defaults to `https://cloud.comfy.org` |
| `COMFY_WORKFLOW` | run-time | API-format workflow JSON (≤ 8 KB env limit) with `__IMAGE__` / `__VIDEO__` placeholders — the graph lives HERE, never in the repo |
| `COMFY_REEL_RESOLVER` | optional | URL template (with `{url}`) of a reel-downloader API — instagram.com blocks server fetches, so page links need this |

## Deploy

```bash
npm install
npx convex dev                        # login + create the Convex project
npx convex env set BOT_TOKEN '…'
npx convex env set WEBHOOK_SECRET "$(openssl rand -hex 16)"
npx convex env set SERVICE_COST '100'
npx convex env set COMFY_API_KEY 'comfyui-…'
npx convex env set COMFY_WORKFLOW '{"18":{"class_type":"LoadVideo",…} …}'   # the API graph
npx convex env set COMFY_REEL_RESOLVER 'https://your-downloader.example/?url={url}'
npm run deploy
cp .env.example .env.local
WEBHOOK_URL=https://<deployment>.convex.site npm run webhook:set
```

Then: send the bot **a photo with the Instagram reel link in the caption**.

## Local end-to-end test (no bot, no Convex deploy)

```bash
COMFY_API_KEY=… COMFY_WORKFLOW_FILE=/path/to/api-workflow.json \
node scripts/test-flow.mjs --photo /path/photo.jpg --reel /path/reel.mp4
```

This mirrors the provider exactly: upload both files → `/api/prompt` →
poll `/history` → download the output video.

## Money model

- Telegram Stars invoice (`XTR`) → internal wallet; generation debits
  `SERVICE_COST` in the same transaction that creates the job.
- Failed / timed-out / cancelled → refunded in the same transaction that flips
  the status; every movement writes a `payments` row.
- Update idempotency via `processed_updates` (at-least-once webhook delivery).

## Notes

- Comfy Cloud generation needs an active subscription; this pipeline spends
  credits on Gemini + GPT Image 2 + Seedance per run — price `SERVICE_COST`
  accordingly.
- Instagram's ToS: scraping/downloading reels is a gray area — use a licensed
  downloader API and your own compliance judgment.
