import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import type { CollectionConfig } from "payload";
import { z } from "zod";
/**
 * Registers the standard Payload CRUD endpoints for a single collection.
 *
 * Covers: find, findByID, create, updateByID, deleteByID, count,
 * bulk update, bulk delete, duplicate, versions, and docAccess.
 */
export declare function registerCollectionEndpoints(
  collection: CollectionConfig,
  apiPrefix: string,
  registry: OpenAPIRegistry,
  collectionsSchema: z.ZodObject<z.ZodRawShape>,
): void;
