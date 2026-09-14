/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as crons from "../crons.js";
import type * as http from "../http.js";
import type * as jobs from "../jobs.js";
import type * as jobs_actions from "../jobs_actions.js";
import type * as lib_format from "../lib/format.js";
import type * as lib_http from "../lib/http.js";
import type * as lib_pricing from "../lib/pricing.js";
import type * as lib_providers_comfy_cloud from "../lib/providers/comfy_cloud.js";
import type * as lib_providers_registry from "../lib/providers/registry.js";
import type * as lib_providers_types from "../lib/providers/types.js";
import type * as lib_services_registry from "../lib/services/registry.js";
import type * as lib_services_trend_recreate_config from "../lib/services/trend_recreate/config.js";
import type * as lib_services_trend_recreate_index from "../lib/services/trend_recreate/index.js";
import type * as lib_services_types from "../lib/services/types.js";
import type * as lib_telegram from "../lib/telegram.js";
import type * as maintenance from "../maintenance.js";
import type * as queries from "../queries.js";
import type * as updates from "../updates.js";
import type * as updates_mutations from "../updates_mutations.js";
import type * as users from "../users.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  crons: typeof crons;
  http: typeof http;
  jobs: typeof jobs;
  jobs_actions: typeof jobs_actions;
  "lib/format": typeof lib_format;
  "lib/http": typeof lib_http;
  "lib/pricing": typeof lib_pricing;
  "lib/providers/comfy_cloud": typeof lib_providers_comfy_cloud;
  "lib/providers/registry": typeof lib_providers_registry;
  "lib/providers/types": typeof lib_providers_types;
  "lib/services/registry": typeof lib_services_registry;
  "lib/services/trend_recreate/config": typeof lib_services_trend_recreate_config;
  "lib/services/trend_recreate/index": typeof lib_services_trend_recreate_index;
  "lib/services/types": typeof lib_services_types;
  "lib/telegram": typeof lib_telegram;
  maintenance: typeof maintenance;
  queries: typeof queries;
  updates: typeof updates;
  updates_mutations: typeof updates_mutations;
  users: typeof users;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
