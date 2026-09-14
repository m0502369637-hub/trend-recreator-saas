# AGENTS.md

Orientation and **hard constraints** for AI coding agents (and humans) working
in this repository. Auto-loaded by Claude Code, Cursor, and similar tools.
The platform reference is https://docs.convex.dev — when in doubt, it wins
over any assumption in this file.

## What this project is

A single-service monetised Telegram SaaS bot on **Convex + Comfy Cloud**,
derived from `my-saas-boilerplate` (wired as the `upstream` remote — pull
plumbing updates from it). The service: a customer sends a PHOTO with an
Instagram reel link as the caption → `trend_recreate` builds a payload →
the `comfy_cloud` provider uploads photo + reel, injects them into the
deploy-time workflow (COMFY_WORKFLOW env var, `__IMAGE__` / `__VIDEO__`
placeholders), submits to Comfy Cloud (Gemini analysis → GPT Image 2 frame
swap → Seedance 2.0, 9:16, 12 s), and delivers the recreated video.
Pricing lives only in the `SERVICE_COST` env var.

## Layout

| Path | Role |
| --- | --- |
| `convex/**` | Deployed Convex code (queries, mutations, actions, http, crons, schema). |
| `convex/lib/services/types.ts` + `registry.ts` | Service contract + this repo's one service (`trend_recreate`). |
| `convex/lib/providers/types.ts` + `registry.ts` | Provider contract + this repo's one provider (`comfy_cloud`). |
| `convex/_generated/` | Generated types — **committed** (code won't typecheck without it). Regenerate with `npx convex codegen --system-udfs --init` after schema/env changes; `npx convex dev`/`deploy` regenerate too. |
| `scripts/*.ts` | Local-only tooling: `dev-poll.ts` (long polling in dev), `set-webhook.ts`. |
| everything else | Docs, `package.json`, `.env.example`. |

## Rules that bite

1. **Mutations and queries are deterministic.** No `fetch`, no external calls,
   no non-seeded randomness, `Date.now()` is frozen per execution (still fine
   for timestamps/guards). All external I/O lives in **actions**.
2. **Actions run in the default web-standards runtime** (fetch, Blob,
   FormData, TextEncoder, Uint8Array — all fine). If you ever need Node
   builtins (`Buffer`, `node:*`, npm Node-only libs), that file must start
   with `"use node"`, may contain **only actions**, and may only be imported
   by other actions.
3. **`env` only, never `process.env` for your own vars.** Env vars are
   declared in `convex/convex.config.ts` and read via the typed `env` import
   from `_generated/server`. This repo adds `COMFY_API_KEY`, `COMFY_API_BASE`,
   `COMFY_WORKFLOW` (the API-format workflow JSON, ≤ 8 KB env value limit,
   `__IMAGE__` / `__VIDEO__` placeholders — never commit the graph to git),
   and `COMFY_REEL_RESOLVER` (Instagram reel downloader template with
   `{url}`).
4. **Provider code lives in SaaS repos only.** The BASE repo stays
   provider-free; this repo's provider (`lib/providers/comfy_cloud.ts`) must
   implement the `Provider` interface and never leak its API key into git.
5. **No foreign keys, no SQL.** Relations are plain fields + indexes; integrity
   is enforced in code. Mutations are serializable transactions — a
   read-check-write inside one mutation is race-free. Never read-modify-write
   a balance across awaits (each mutation is atomic; actions must call
   mutations for every state change).
6. **The job state machine is owned by `jobs.ts` — exclusively.**
   Statuses: `queued → submitted → processing → complete | failed |
   timed_out | cancelled`. Do not write `jobs.status` anywhere else. Route
   every transition through `createJob`, `markSubmitted`, `markPolled`,
   `beginDelivery`, `completeJob`, `failJob`, `timeoutJob`, `cancelJob`.
   Every failed/timed_out/cancelled path refunds inside the same transaction
   that flips the status.
7. **Do not block inside update handling.** `updates.processUpdate` may
   await the submit (a few fast HTTP calls) but NEVER generation output.
   Completion arrives via the scheduler chain (`markSubmitted` schedules the
   first `pollJob` atomically), the 🔄 button, or the cron sweep.
8. **Idempotency on `update_id`.** Webhook delivery is at-least-once; claim
   each update in `processed_updates` (done in `processUpdate`) before any
   side effect.
9. **Money rules.** Stars invoices: currency `XTR`, no `provider_token`,
   payload `buy_stars`; `pre_checkout_query` must be answered ok. Credit from
   Telegram's `total_amount`, never from a payload. Debit only inside
   `createJob` (atomic balance gate). The price is the `SERVICE_COST` env var,
   stamped onto each job so refunds match the charge. Every wallet movement
   writes a `payments` row.
10. **Callback payloads** are `check:<jobId>` / `cancel:<jobId>` /
    `buy:<amount>` — keep them under 64 bytes.

## Adding a new SaaS — in its OWN repository

This repo ships no services and must stay that way. A new SaaS is a new
repository:

1. `git clone` this repo into the new service's repo (keep `upstream` pointing
   here to pull plumbing updates later).
2. Add a service: `convex/lib/services/<name>/` (`config.ts` + `index.ts`,
   pure modules — no network, no DB, no price, no committed provider payloads).
3. Add a provider: implement `Provider` from `convex/lib/providers/types.ts`
   in e.g. `convex/lib/providers/my_provider.ts` and register it in
   `convex/lib/providers/registry.ts` (matching `config.provider`).
4. Register the service in `convex/lib/services/registry.ts`.
5. Add provider secrets to `convex/convex.config.ts` + `.env.example`.
6. Route the trigger in `convex/updates.ts` (photo triggers and prompt
   commands are handled generically via `photoService()`/`promptService()`).
7. Deploy: `npx convex dev` (link project) → `npx convex env set …` →
   `npm run deploy` → `npm run webhook:set`.

Full recipe: `services/README.md`. Never add a service or provider to the
base repo.

## Deploy & verify

```
npm run typecheck        # tsc on convex/ + scripts/
npx convex codegen --system-udfs --init   # regenerate committed types after schema/env edits
npx convex deploy        # deploy code + schema + cron
npx convex env set NAME value   # prod env vars (dev reads .env.local)
WEBHOOK_URL=… npm run webhook:set   # point Telegram at the deployed /telegram route
```

- `convex deploy` pushes schema + functions + cron in one go; check the
  dashboard Logs after deploy.
- `npm run webhook:set -- --delete` switches back to long-polling mode.
- In dev, `npx convex dev` serves HTTP actions at
  `http://127.0.0.1:3210`; `npm run dev:poll` forwards Telegram updates there.

## Allowed imports

`convex/*` (functions, values, server), `./_generated/*`, `./lib/*`,
`./schema` (types). Node-only imports only in `"use node"` action files.
Never import files across the runtime boundary (default ↔ node).
