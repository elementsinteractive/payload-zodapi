import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import type { CollectionConfig } from "payload";

import { formatLabels } from "payload";
import { z } from "zod";

import {
  baseQueryParams,
  bulkResponse,
  paginatedResponse,
  paginationQueryParams,
  registerSchemas,
  toRefId,
  versionResponse,
} from "./schemas.js";

/**
 * Registers the standard Payload CRUD endpoints for a single collection.
 *
 * Covers: find, findByID, create, updateByID, deleteByID, count,
 * bulk update, bulk delete, duplicate, versions, and docAccess.
 */
export function registerCollectionEndpoints(
  collection: CollectionConfig,
  apiPrefix: string,
  registry: OpenAPIRegistry,
  collectionsSchema: z.ZodObject<z.ZodRawShape>,
) {
  const slug = collection.slug;
  const rawSchema = collectionsSchema.shape[slug] as
    | undefined
    | z.ZodObject<z.ZodRawShape>;
  if (!rawSchema) {
    return;
  }

  const { plural, singular } = formatLabels(slug);
  const tags = [plural];
  const basePath = `${apiPrefix}/${slug}`;
  const refId = toRefId(singular);
  const { base, list, mutation, update } = registerSchemas(
    registry,
    refId,
    rawSchema,
  );

  // GET / — List documents
  registry.registerPath({
    method: "get",
    operationId: `list${toRefId(plural)}`,
    path: basePath,
    request: { query: paginationQueryParams },
    responses: {
      "200": {
        content: { "application/json": { schema: list } },
        description: `Paginated list of ${plural}`,
      },
    },
    summary: `List ${plural}`,
    tags,
  });

  // GET /count — Count documents
  registry.registerPath({
    method: "get",
    operationId: `count${toRefId(plural)}`,
    path: `${basePath}/count`,
    request: {
      query: z.object({
        where: z.record(z.string(), z.unknown()).optional(),
      }),
    },
    responses: {
      "200": {
        content: {
          "application/json": {
            schema: z.object({ totalDocs: z.number() }),
          },
        },
        description: `Total count of ${plural}`,
      },
    },
    summary: `Count ${plural}`,
    tags,
  });

  // GET /{id} — Find by ID
  registry.registerPath({
    method: "get",
    operationId: `get${refId}ById`,
    path: `${basePath}/{id}`,
    request: {
      params: z.object({ id: z.string() }),
      query: baseQueryParams,
    },
    responses: {
      "200": {
        content: { "application/json": { schema: base } },
        description: `${singular} document`,
      },
      "404": { description: `${singular} not found` },
    },
    summary: `Get a ${singular} by ID`,
    tags,
  });

  // POST / — Create
  registry.registerPath({
    method: "post",
    operationId: `create${refId}`,
    path: basePath,
    request: {
      body: {
        content: { "application/json": { schema: base } },
      },
    },
    responses: {
      "201": {
        content: { "application/json": { schema: mutation } },
        description: `Created ${singular}`,
      },
    },
    summary: `Create a ${singular}`,
    tags,
  });

  // PATCH / — Bulk update
  registry.registerPath({
    method: "patch",
    operationId: `bulkUpdate${toRefId(plural)}`,
    path: basePath,
    request: {
      body: {
        content: { "application/json": { schema: update } },
      },
      query: z.object({
        where: z.record(z.string(), z.unknown()),
      }),
    },
    responses: {
      "200": {
        content: {
          "application/json": { schema: bulkResponse(base) },
        },
        description: `Updated ${plural}`,
      },
    },
    summary: `Bulk update ${plural}`,
    tags,
  });

  // PATCH /{id} — Update by ID
  registry.registerPath({
    method: "patch",
    operationId: `update${refId}ById`,
    path: `${basePath}/{id}`,
    request: {
      body: {
        content: { "application/json": { schema: update } },
      },
      params: z.object({ id: z.string() }),
    },
    responses: {
      "200": {
        content: { "application/json": { schema: mutation } },
        description: `Updated ${singular}`,
      },
      "404": { description: `${singular} not found` },
    },
    summary: `Update a ${singular}`,
    tags,
  });

  // DELETE / — Bulk delete
  registry.registerPath({
    method: "delete",
    operationId: `bulkDelete${toRefId(plural)}`,
    path: basePath,
    request: {
      query: z.object({
        where: z.record(z.string(), z.unknown()),
      }),
    },
    responses: {
      "200": {
        content: {
          "application/json": { schema: bulkResponse(base) },
        },
        description: `Deleted ${plural}`,
      },
    },
    summary: `Bulk delete ${plural}`,
    tags,
  });

  // DELETE /{id} — Delete by ID
  registry.registerPath({
    method: "delete",
    operationId: `delete${refId}ById`,
    path: `${basePath}/{id}`,
    request: {
      params: z.object({ id: z.string() }),
    },
    responses: {
      "200": {
        content: { "application/json": { schema: mutation } },
        description: `Deleted ${singular}`,
      },
      "404": { description: `${singular} not found` },
    },
    summary: `Delete a ${singular}`,
    tags,
  });

  // POST /{id}/duplicate — Duplicate
  registry.registerPath({
    method: "post",
    operationId: `duplicate${refId}`,
    path: `${basePath}/{id}/duplicate`,
    request: {
      params: z.object({ id: z.string() }),
    },
    responses: {
      "200": {
        content: { "application/json": { schema: mutation } },
        description: `Duplicated ${singular}`,
      },
      "404": { description: `${singular} not found` },
    },
    summary: `Duplicate a ${singular}`,
    tags,
  });

  // POST /access/{id} — Document access
  registry.registerPath({
    method: "post",
    operationId: `${slug}DocAccess`,
    path: `${basePath}/access/{id}`,
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
        description: "Access permissions",
      },
    },
    summary: `Check access for a ${singular}`,
    tags,
  });

  // GET /versions — List versions
  registry.registerPath({
    method: "get",
    operationId: `list${refId}Versions`,
    path: `${basePath}/versions`,
    request: { query: paginationQueryParams },
    responses: {
      "200": {
        content: {
          "application/json": {
            schema: paginatedResponse(versionResponse(base)),
          },
        },
        description: `Paginated list of ${singular} versions`,
      },
    },
    summary: `List ${singular} versions`,
    tags,
  });

  // GET /versions/{id} — Get version by ID
  registry.registerPath({
    method: "get",
    operationId: `get${refId}VersionById`,
    path: `${basePath}/versions/{id}`,
    request: {
      params: z.object({ id: z.string() }),
    },
    responses: {
      "200": {
        content: {
          "application/json": { schema: versionResponse(base) },
        },
        description: `${singular} version`,
      },
      "404": { description: "Version not found" },
    },
    summary: `Get a ${singular} version by ID`,
    tags,
  });

  // POST /versions/{id} — Restore version
  registry.registerPath({
    method: "post",
    operationId: `restore${refId}Version`,
    path: `${basePath}/versions/{id}`,
    request: {
      params: z.object({ id: z.string() }),
    },
    responses: {
      "200": {
        content: { "application/json": { schema: mutation } },
        description: `Restored ${singular}`,
      },
      "404": { description: "Version not found" },
    },
    summary: `Restore a ${singular} version`,
    tags,
  });

  // GET /{id}/preview — Preview document
  registry.registerPath({
    method: "get",
    operationId: `preview${refId}`,
    path: `${basePath}/{id}/preview`,
    request: {
      params: z.object({ id: z.string() }),
    },
    responses: {
      "200": {
        content: { "application/json": { schema: base } },
        description: `Preview of ${singular}`,
      },
      "404": { description: `${singular} not found` },
    },
    summary: `Preview a ${singular}`,
    tags,
  });
}
