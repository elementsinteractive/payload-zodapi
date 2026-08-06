import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import type { CollectionConfig } from "payload";
import { z } from "zod";
/**
 * Registers auth-specific endpoints for a single auth-enabled collection.
 *
 * Covers: login, logout, me, refresh-token, forgot-password,
 * reset-password, unlock, verify, init, first-register.
 */
export declare function registerAuthCollectionEndpoints(
  collection: CollectionConfig,
  apiPrefix: string,
  registry: OpenAPIRegistry,
  collectionsSchema: z.ZodObject<z.ZodRawShape>,
): void;
/**
 * Registers the root-level auth endpoints.
 *
 * Covers: GET /access — returns the access control hierarchy.
 */
export declare function registerAuthRootEndpoints(
  apiPrefix: string,
  registry: OpenAPIRegistry,
): void;
