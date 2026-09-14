import type { ImageRefs, JobInput, Service } from "../types";
import { config } from "./config";

// lib/services/trend_recreate/index.ts — Instagram trend re-creation.
//
// PURE module: buildProviderPayload() only packages the runtime inputs for
// the comfy_cloud provider: the customer's photo (already in Comfy input
// storage as imageName) and the reel link from the photo's CAPTION. The
// provider downloads the reel, uploads it, and injects both into the
// deploy-time workflow (COMFY_WORKFLOW env var).

export interface TrendPayload {
  reelUrl?: string;
  imageName?: string;
}

export const trendRecreate: Service = {
  config,
  buildProviderPayload(input: JobInput, images: ImageRefs): unknown {
    const payload: TrendPayload = {
      imageName: images.imageName,
      reelUrl: (input.details ?? "").trim() || undefined,
    };
    if (!payload.reelUrl) {
      throw new Error("Send your photo with the Instagram reel link as the caption");
    }
    return payload;
  },
};
