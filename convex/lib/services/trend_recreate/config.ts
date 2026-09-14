// lib/services/trend_recreate/config.ts — knobs for the trend-recreator
// service. The workflow graph is NOT here — it is supplied per deployment via
// the COMFY_WORKFLOW env var. The price is NOT here either — SERVICE_COST env.
import type { ServiceConfig } from "../types";

export const config: ServiceConfig = {
  name: "trend_recreate",
  title: "🎬 Trend Recreator",
  description:
    "Send your photo with an Instagram reel link as the caption — I'll recreate the trend with you in it.",
  provider: "comfy_cloud",
  maxJobAgeMs: 20 * 60 * 1000, // Gemini + GPT Image + Seedance can take a while
  pollAfterMs: 30 * 1000,
  trigger: { kind: "photo" },
};
