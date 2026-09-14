import type { Provider } from "./types";
import { comfyCloudProvider } from "./comfy_cloud";

// lib/providers/registry.ts — the provider registry for THIS repo.
export const PROVIDERS: Record<string, Provider> = {
  comfy_cloud: comfyCloudProvider,
};

export function getProvider(name: string): Provider | null {
  return PROVIDERS[name] ?? null;
}
