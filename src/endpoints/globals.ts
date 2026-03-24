import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'
import type { GlobalConfig } from 'payload'

import { formatLabels } from 'payload'
import { z } from 'zod'

import { baseQueryParams, paginatedResponse, toRefId, versionResponse } from './schemas'

/**
 * Registers the standard Payload endpoints for a single global.
 *
 * Covers: findOne (GET), update (POST), docAccess, versions.
 */
export function registerGlobalEndpoints(
  global: GlobalConfig,
  apiPrefix: string,
  registry: OpenAPIRegistry,
  globalsSchema: z.ZodObject<z.ZodRawShape>,
) {
  const slug = global.slug
  const rawSchema = globalsSchema.shape[slug] as undefined | z.ZodObject<z.ZodRawShape>
  if (!rawSchema) {
    return
  }

  const label = formatLabels(slug).singular
  const refId = toRefId(label)
  const tags = [label]
  const basePath = `${apiPrefix}/globals/${slug}`
  const base = registry.register(refId, rawSchema)
  const update = registry.register(`${refId}Update`, rawSchema.partial())

  // GET / — Read global
  registry.registerPath({
    method: 'get',
    operationId: `get${refId}`,
    path: basePath,
    request: { query: baseQueryParams },
    responses: {
      '200': {
        content: { 'application/json': { schema: base } },
        description: label,
      },
    },
    summary: `Get ${label}`,
    tags,
  })

  // POST / — Update global
  registry.registerPath({
    method: 'post',
    operationId: `update${refId}`,
    path: basePath,
    request: {
      body: {
        content: { 'application/json': { schema: update } },
      },
    },
    responses: {
      '200': {
        content: { 'application/json': { schema: base } },
        description: `Updated ${label}`,
      },
    },
    summary: `Update ${label}`,
    tags,
  })

  // POST /access — Document access
  registry.registerPath({
    method: 'post',
    operationId: `${slug}GlobalAccess`,
    path: `${basePath}/access`,
    responses: {
      '200': {
        content: {
          'application/json': {
            schema: z.record(z.string(), z.unknown()),
          },
        },
        description: 'Access permissions',
      },
    },
    summary: `Check access for ${label}`,
    tags,
  })

  // GET /versions — List versions
  registry.registerPath({
    method: 'get',
    operationId: `list${refId}GlobalVersions`,
    path: `${basePath}/versions`,
    request: {
      query: z.object({
        limit: z.number().optional(),
        page: z.number().optional(),
      }),
    },
    responses: {
      '200': {
        content: {
          'application/json': {
            schema: paginatedResponse(versionResponse(base)),
          },
        },
        description: `Paginated list of ${label} versions`,
      },
    },
    summary: `List ${label} versions`,
    tags,
  })

  // GET /versions/{id} — Get version by ID
  registry.registerPath({
    method: 'get',
    operationId: `get${refId}GlobalVersionById`,
    path: `${basePath}/versions/{id}`,
    request: {
      params: z.object({ id: z.string() }),
    },
    responses: {
      '200': {
        content: {
          'application/json': { schema: versionResponse(base) },
        },
        description: `${label} version`,
      },
      '404': { description: 'Version not found' },
    },
    summary: `Get a ${label} version by ID`,
    tags,
  })

  // POST /versions/{id} — Restore version
  registry.registerPath({
    method: 'post',
    operationId: `restore${refId}GlobalVersion`,
    path: `${basePath}/versions/{id}`,
    request: {
      params: z.object({ id: z.string() }),
    },
    responses: {
      '200': {
        content: { 'application/json': { schema: base } },
        description: `Restored ${label}`,
      },
      '404': { description: 'Version not found' },
    },
    summary: `Restore a ${label} version`,
    tags,
  })

  // GET /preview — Preview global
  registry.registerPath({
    method: 'get',
    operationId: `preview${refId}Global`,
    path: `${basePath}/preview`,
    responses: {
      '200': {
        content: { 'application/json': { schema: base } },
        description: `Preview of ${label}`,
      },
    },
    summary: `Preview ${label}`,
    tags,
  })
}
