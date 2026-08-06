import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import type { CollectionConfig } from "payload";
/**
 * Registers upload-specific endpoints for a single upload-enabled collection.
 *
 * Covers: GET /file/{filename}, GET /paste-url/{id}.
 */
export declare function registerUploadEndpoints(
  collection: CollectionConfig,
  apiPrefix: string,
  registry: OpenAPIRegistry,
): void;
