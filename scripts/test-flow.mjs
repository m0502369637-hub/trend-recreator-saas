#!/usr/bin/env node
// scripts/test-flow.mjs — local end-to-end test of the trend-recreator flow,
// mimicking the comfy_cloud provider exactly (upload photo → upload reel →
// /api/prompt → poll /history → download output) without needing a Telegram
// bot or a Convex deployment.
//
// Usage:
//   COMFY_API_KEY=… COMFY_WORKFLOW_FILE=/path/to/api-workflow.json \
//   node scripts/test-flow.mjs --photo /path/photo.jpg --reel /path/reel.mp4
//
// The workflow file is NOT part of the repo (COMFY_WORKFLOW is an env var in
// production); pass it on disk here for the test only.

import { readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? null : args[i + 1];
};
const PHOTO = opt("photo");
const REEL = opt("reel");
const KEY = process.env.COMFY_API_KEY;
const BASE = (process.env.COMFY_API_BASE || "https://cloud.comfy.org").replace(/\/+$/, "");
const WORKFLOW_FILE = process.env.COMFY_WORKFLOW_FILE;

if (!KEY || !PHOTO || !REEL || !WORKFLOW_FILE) {
  console.error("Required: COMFY_API_KEY, COMFY_WORKFLOW_FILE, --photo <path>, --reel <path>");
  process.exit(1);
}

async function upload(filePath, filename, contentType) {
  const form = new FormData();
  form.append("image", new Blob([readFileSync(filePath)], { type: contentType }), filename);
  form.append("overwrite", "true");
  const res = await fetch(`${BASE}/api/upload/image`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}` },
    body: form,
  });
  if (!res.ok) throw new Error(`upload failed: HTTP ${res.status} ${await res.text()}`);
  const data = await res.json();
  console.log(`uploaded ${filename} →`, data.name);
  return data.name;
}

async function main() {
  const photoName = await upload(PHOTO, "photo.jpg", "image/jpeg");
  const videoName = await upload(REEL, "reel.mp4", "video/mp4");

  const workflow = readFileSync(WORKFLOW_FILE, "utf-8")
    .replaceAll("__IMAGE__", photoName)
    .replaceAll("__VIDEO__", videoName);
  const graph = JSON.parse(workflow);

  const submit = await fetch(`${BASE}/api/prompt`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: graph, client_id: "test-flow" }),
  });
  if (!submit.ok) throw new Error(`submit failed: HTTP ${submit.status} ${(await submit.text()).slice(0, 500)}`);
  const { prompt_id } = await submit.json();
  console.log("submitted prompt_id:", prompt_id);

  // Poll /history until outputs appear.
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 30000));
    const res = await fetch(`${BASE}/history/${prompt_id}`, { headers: { Authorization: `Bearer ${KEY}` } });
    if (!res.ok) throw new Error(`history failed: HTTP ${res.status}`);
    const history = await res.json();
    const entry = history[prompt_id];
    if (!entry) {
      console.log(`poll ${i + 1}: still running…`);
      continue;
    }
    if (entry.status?.status_str === "error") {
      throw new Error(`job failed: ${JSON.stringify(entry.status).slice(0, 400)}`);
    }
    for (const out of Object.values(entry.outputs ?? {})) {
      const file = out?.videos?.[0] ?? out?.gifs?.[0] ?? out?.images?.[0];
      if (!file?.filename) continue;
      const sub = file.subfolder ? `&subfolder=${encodeURIComponent(file.subfolder)}` : "";
      const type = file.type ? `&type=${encodeURIComponent(file.type)}` : "&type=output";
      const url = `${BASE}/view?filename=${encodeURIComponent(file.filename)}${sub}${type}`;
      const dl = await fetch(url, { headers: { Authorization: `Bearer ${KEY}` } });
      if (!dl.ok) throw new Error(`view failed: HTTP ${dl.status}`);
      const buf = Buffer.from(await dl.arrayBuffer());
      const outPath = `/home/ubuntu/idea/saas/motion-inputs/result/test-flow-${file.filename}`;
      writeFileSync(outPath, buf);
      console.log(`✅ output saved: ${outPath} (${buf.length} bytes)`);
    }
    return;
  }
  throw new Error("timed out waiting for the job");
}

main().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
