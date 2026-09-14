import { env } from "../../_generated/server";
import * as telegram from "../telegram";
import type { JobRow } from "../../queries";
import type { ImageRefs } from "../services/types";
import type { JobPollResult, Provider, SubmitResult } from "./types";

// lib/providers/comfy_cloud.ts — Comfy Cloud provider adapter.
//
// Talks to the hosted Comfy Cloud over the standard ComfyUI HTTP API:
//   POST /api/upload/image  multipart            → { name } in input storage
//   POST /api/prompt        { prompt, client_id } → { prompt_id }
//   GET  /history/<id>      {} while running; outputs when done
//   GET  /view?filename=…&type=output             → file bytes (Bearer)
//   POST /interrupt         { prompt_id }          → cancel
//
// The workflow graph is NOT in this repo: it is supplied per deployment via
// the COMFY_WORKFLOW env var (JSON, API format, with the placeholder tokens
// __IMAGE__ and __VIDEO__ replaced at submit time).

function baseUrl(): string {
  return (env.COMFY_API_BASE || "https://cloud.comfy.org").replace(/\/+$/, "");
}

function apiKey(): string {
  const key = env.COMFY_API_KEY;
  if (!key) throw new Error("COMFY_API_KEY env var is not set (npx convex env set COMFY_API_KEY …)");
  return key;
}

function authHeaders(json = false): Record<string, string> {
  const headers: Record<string, string> = { Authorization: `Bearer ${apiKey()}` };
  if (json) headers["Content-Type"] = "application/json";
  return headers;
}

/** Upload raw bytes into Comfy input storage; returns the server-side file name. */
async function upload(bytes: Uint8Array, filename: string, contentType: string): Promise<string> {
  const form = new FormData();
  form.append("image", new Blob([bytes as BlobPart], { type: contentType }), filename);
  form.append("overwrite", "true");
  const res = await fetch(`${baseUrl()}/api/upload/image`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey()}` },
    body: form,
  });
  if (!res.ok) throw new Error(`comfy cloud upload failed: HTTP ${res.status}`);
  const data = (await res.json()) as { name?: string };
  if (!data?.name) throw new Error("comfy cloud upload returned no name");
  return data.name;
}

export interface TrendPayload {
  reelUrl?: string; // Instagram reel link or direct video URL (resolved by the provider)
  imageName?: string; // the customer's photo, already in Comfy input storage
}

export const comfyCloudProvider: Provider = {
  name: "comfy_cloud",

  async resolveImages(photoIds: string[]): Promise<ImageRefs> {
    if (photoIds.length === 0) return {};
    const bytes = await telegram.downloadPhoto(photoIds[0]);
    const name = await upload(bytes, "photo.jpg", "image/jpeg");
    return { imageName: name };
  },

  async submit(job: JobRow, raw: unknown): Promise<SubmitResult> {
    const payload = (raw ?? {}) as TrendPayload;
    const template = env.COMFY_WORKFLOW;
    if (!template) {
      throw new Error("COMFY_WORKFLOW env var is not set — supply the API-format workflow JSON with __IMAGE__/__VIDEO__ placeholders");
    }

    // 1. The reel video → bytes → input storage. Instagram PAGE urls need a
    //    resolver (COMFY_REEL_RESOLVER template, "{url}" placeholder) because
    //    instagram.com blocks server fetches; direct .mp4/CDN links work as-is.
    let videoName = "";
    if (payload.reelUrl) {
      const resolver = env.COMFY_REEL_RESOLVER;
      const target =
        payload.reelUrl.includes("instagram.com") && resolver
          ? resolver.replace("{url}", encodeURIComponent(payload.reelUrl))
          : payload.reelUrl;
      const res = await fetch(target, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; trend-recreator/1.0)" },
      });
      if (!res.ok || !(res.headers.get("content-type") ?? "").includes("video")) {
        throw new Error(
          "could not download the reel video from that URL — Instagram page links need COMFY_REEL_RESOLVER (a reel-downloader API) or a direct .mp4 link",
        );
      }
      const bytes = new Uint8Array(await res.arrayBuffer());
      videoName = await upload(bytes, "reel.mp4", "video/mp4");
    }

    // 2. Build the workflow from the deploy-time template.
    const graphText = template.replace("__IMAGE__", payload.imageName ?? "").replace("__VIDEO__", videoName);
    let graph: unknown;
    try {
      graph = JSON.parse(graphText);
    } catch (e) {
      throw new Error(`COMFY_WORKFLOW is not valid JSON after substitution: ${e instanceof Error ? e.message : String(e)}`);
    }

    // 3. Submit — returns { prompt_id } immediately, never waits for output.
    const res = await fetch(`${baseUrl()}/api/prompt`, {
      method: "POST",
      headers: authHeaders(true),
      body: JSON.stringify({ prompt: graph, client_id: `trend-${job._id}` }),
    });
    if (!res.ok) {
      let detail = "";
      try {
        detail = JSON.stringify(await res.json());
      } catch {
        /* not json */
      }
      throw new Error(`comfy cloud submit failed: HTTP ${res.status}${detail ? ` ${detail.slice(0, 400)}` : ""}`);
    }
    const data = (await res.json()) as { prompt_id?: string; error?: string };
    if (!data?.prompt_id) throw new Error(`comfy cloud submit failed: ${data?.error ?? "no prompt_id"}`);
    return {
      providerJobId: data.prompt_id,
      providerStatusUrl: `${baseUrl()}/history/${data.prompt_id}`,
    };
  },

  async getJobStatus(job: JobRow): Promise<JobPollResult> {
    const res = await fetch(`${baseUrl()}/history/${job.providerJobId}`, { headers: authHeaders() });
    if (!res.ok) throw new Error(`comfy cloud history failed: HTTP ${res.status}`);
    const history = (await res.json()) as Record<string, any>;
    const entry = history?.[job.providerJobId ?? ""];
    if (!entry) return { status: "processing", failed: false }; // {} while queued/running

    if (entry.status?.status_str === "error") {
      const messages = ((entry.status?.messages ?? []) as unknown[]).flat().map((m) => JSON.stringify(m)).join("; ").slice(0, 300);
      return { status: "complete", failed: true, error: `Comfy Cloud error: ${messages || "unknown"}` };
    }

    for (const out of Object.values(entry.outputs ?? {}) as any[]) {
      const file = out?.videos?.[0] ?? out?.gifs?.[0] ?? out?.images?.[0];
      if (!file?.filename) continue;
      const kind: "video" | "image" = out?.images?.[0]?.filename === file.filename && !out?.videos?.length ? "image" : "video";
      const sub = file.subfolder ? `&subfolder=${encodeURIComponent(file.subfolder)}` : "";
      const type = file.type ? `&type=${encodeURIComponent(file.type)}` : "&type=output";
      return {
        status: "complete",
        failed: false,
        output: { url: `${baseUrl()}/view?filename=${encodeURIComponent(file.filename)}${sub}${type}`, kind, requiresDownload: true },
      };
    }
    return { status: "processing", failed: false }; // finished but no output yet — keep polling
  },

  async cancel(job: JobRow): Promise<{ alreadyCompleted: boolean }> {
    try {
      await fetch(`${baseUrl()}/interrupt`, {
        method: "POST",
        headers: authHeaders(true),
        body: JSON.stringify({ prompt_id: job.providerJobId }),
      });
    } catch {
      /* best-effort by design */
    }
    return { alreadyCompleted: false };
  },

  async downloadOutput(url: string): Promise<Uint8Array> {
    const res = await fetch(url, { headers: authHeaders() });
    if (!res.ok) throw new Error(`comfy cloud view failed: HTTP ${res.status}`);
    return new Uint8Array(await res.arrayBuffer());
  },
};
