import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import type { GlobalConfig } from "payload";
import { z } from "zod";
/**
 * Registers the standard Payload endpoints for a single global.
 *
 * Covers: findOne (GET), update (POST), docAccess, versions.
 */
export declare function registerGlobalEndpoints(
  global: GlobalConfig,
  apiPrefix: string,
  registry: OpenAPIRegistry,
  globalsSchema: z.ZodObject<z.ZodRawShape>,
): void;
