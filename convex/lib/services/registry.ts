import type { Service } from "./types";
import { trendRecreate } from "./trend_recreate/index";

// lib/services/registry.ts — the ONE service this bot offers.
export const SERVICES: Record<string, Service> = {
  trend_recreate: trendRecreate,
};

export function getService(name: string): Service | null {
  return SERVICES[name] ?? null;
}

/** The service that consumes photos (single-service repos have exactly one). */
export function photoService(): Service | null {
  return Object.values(SERVICES).find((s) => s.config.trigger.kind === "photo") ?? null;
}

/** The service that consumes prompt commands (e.g. /imagine <prompt>). */
export function promptService(): Service | null {
  return Object.values(SERVICES).find((s) => s.config.trigger.kind === "prompt") ?? null;
}
