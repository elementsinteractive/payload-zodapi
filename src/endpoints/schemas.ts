import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";

import { z } from "zod";

// ── Common query parameter schemas ──────────────────────────────────

export const baseQueryParams = z.object({
  depth: z.number().optional(),
  "fallback-locale": z.string().optional(),
  locale: z.string().optional(),
});

export const paginationQueryParams = baseQueryParams.extend({
  limit: z.number().optional(),
  page: z.number().optional(),
  sort: z.string().optional(),
  where: z.record(z.string(), z.unknown()).optional(),
});

// ── Response envelope factories ─────────────────────────────────────

/** Wraps a doc schema in Payload's standard paginated response envelope. */
export const paginatedResponse = (docSchema: z.ZodTypeAny) =>
  z.object({
    docs: z.array(docSchema),
    hasNextPage: z.boolean(),
    hasPrevPage: z.boolean(),
    limit: z.number(),
    nextPage: z.number().nullable(),
    page: z.number(),
    pagingCounter: z.number(),
    prevPage: z.number().nullable(),
    totalDocs: z.number(),
    totalPages: z.number(),
  });

/** Wraps a doc schema in Payload's single-doc mutation response envelope. */
export const mutationResponse = (docSchema: z.ZodTypeAny) =>
  z.object({
    doc: docSchema,
    message: z.string(),
  });

/** Payload's bulk operation response envelope. */
export const bulkResponse = (docSchema: z.ZodTypeAny) =>
  z.object({
    docs: z.array(docSchema),
    errors: z.array(
      z.object({
        id: z.string().optional(),
        message: z.string(),
      }),
    ),
  });

/** Wraps a doc in Payload's version envelope. */
export const versionResponse = (docSchema: z.ZodTypeAny) =>
  z.object({
    id: z.string(),
    createdAt: z.string(),
    parent: z.string(),
    updatedAt: z.string(),
    version: docSchema,
  });

// ── Schema registration ─────────────────────────────────────────────

/** Strips whitespace from a label for use as an OpenAPI ref ID. */
export const toRefId = (label: string) => label.replace(/\s/g, "");

/**
 * Registers the base schema and its derived variants (paginated, mutation, etc.)
 * in the OpenAPI registry under `components/schemas`.
 *
 * Returns the registered schemas so paths can reference them as `$ref`.
 */
export function registerSchemas(
  registry: OpenAPIRegistry,
  refId: string,
  schema: z.ZodObject<z.ZodRawShape>,
) {
  const base = registry.register(refId, schema);
  const update = registry.register(`${refId}Update`, schema.partial());
  const list = registry.register(`${refId}List`, paginatedResponse(base));
  const mutation = registry.register(
    `${refId}Mutation`,
    mutationResponse(base),
  );
  return { base, list, mutation, update };
}
