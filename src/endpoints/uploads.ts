import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import type { CollectionConfig } from "payload";

import { formatLabels } from "payload";
import { z } from "zod";

import { toRefId } from "./schemas";

/**
 * Registers upload-specific endpoints for a single upload-enabled collection.
 *
 * Covers: GET /file/{filename}, GET /paste-url/{id}.
 */
export function registerUploadEndpoints(
  collection: CollectionConfig,
  apiPrefix: string,
  registry: OpenAPIRegistry,
) {
  const slug = collection.slug;
  const { plural, singular } = formatLabels(slug);
  const refId = toRefId(singular);
  const basePath = `${apiPrefix}/${slug}`;
  const tags = [plural];

  // GET /file/{filename} — Serve uploaded file
  registry.registerPath({
    method: "get",
    operationId: `get${refId}File`,
    path: `${basePath}/file/{filename}`,
    request: {
      params: z.object({ filename: z.string() }),
    },
    responses: {
      "200": {
        description: "The uploaded file",
      },
      "404": { description: "File not found" },
    },
    summary: `Get an uploaded ${singular} file`,
    tags,
  });

  // GET /paste-url/{id} — Download file from external URL
  registry.registerPath({
    method: "get",
    operationId: `${slug}PasteUrl`,
    path: `${basePath}/paste-url/{id}`,
    request: {
      params: z.object({ id: z.string() }),
    },
    responses: {
      "200": {
        content: {
          "application/json": {
            schema: z.record(z.string(), z.unknown()),
          },
        },
        description: "File metadata",
      },
    },
    summary: `Download a file from URL for ${singular}`,
    tags,
  });
}
