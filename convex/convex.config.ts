import { defineApp } from "convex/server";
import { v } from "convex/values";

// Declared env vars → typed `env` import from `_generated/server`, validated
// at deploy time. Set values with `npx convex env set NAME value` (prod) or
// by exporting them before `npx convex dev` (local dev).
export default defineApp({
  env: {
    BOT_TOKEN: v.string(), // classic Bot API token from @BotFather
    WEBHOOK_SECRET: v.string(), // setWebhook secret_token; Telegram sends it as a header
    // Price per generation, in Telegram Stars (positive integer). Lives ONLY
    // here — change it anytime without redeploying:
    //   npx convex env set SERVICE_COST '120'
    SERVICE_COST: v.string(),

    // Comfy Cloud (this repo's provider). Use your PRODUCTION key here when
    // going live — it never touches the repo.
    COMFY_API_KEY: v.optional(v.string()), // https://platform.comfy.org/profile/api-keys
    COMFY_API_BASE: v.optional(v.string()), // default https://cloud.comfy.org
    // The API-format workflow graph (JSON string, ≤ 8 KB env limit) with the
    // placeholder tokens __IMAGE__ (customer photo) and __VIDEO__ (reel file)
    // replaced at submit time. Keep the graph in a private store, not git.
    COMFY_WORKFLOW: v.optional(v.string()),
    // Optional URL template for resolving Instagram reel links to direct
    // video URLs, e.g. "https://your-downloader.example/?url={url}".
    COMFY_REEL_RESOLVER: v.optional(v.string()),
  },
});
