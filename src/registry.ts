import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'
import type { Endpoint } from 'payload'

import { z } from 'zod'

import type { AnyZodObject, EndpointOpenApiConfig } from './types'

// ── Path helpers ────────────────────────────────────────────────────

/** Extracts param names from an Express-style path (e.g. `/:id` → `["id"]`). */
export const extractPathParams = (path: string): string[] =>
  [...path.matchAll(/:(\w+)/g)].map((m) => m[1])

/** Converts Express-style params to OpenAPI format (`:id` → `{id}`). */
export const toOpenApiPath = (prefix: string, path: string): string =>
  `${prefix}${path}`.replace(/:(\w+)/g, '{$1}')

// ── Schema helpers ──────────────────────────────────────────────────

type OpenApiResponses = Record<
  string,
  {
    content?: { 'application/json': { schema: AnyZodObject } }
    description: string
  }
>

/**
 * Merges auto-detected path params with an optional user schema.
 * User schema fields take precedence over auto-detected `z.string()` defaults.
 */
export const buildParamsSchema = (
  paramNames: string[],
  userSchema?: AnyZodObject,
): AnyZodObject | undefined => {
  if (paramNames.length === 0) {
    return userSchema
  }

  const base = z.object(Object.fromEntries(paramNames.map((n) => [n, z.string()])))

  return userSchema instanceof z.ZodObject ? base.merge(userSchema) : (userSchema ?? base)
}

/** Converts response config into OpenAPI response definitions. */
export const buildResponseDefs = (
  config?: AnyZodObject | Record<number, AnyZodObject>,
): OpenApiResponses => {
  if (!config) {
    return { '200': { description: 'Success' } }
  }

  if (config instanceof z.ZodObject) {
    return {
      '200': {
        content: { 'application/json': { schema: config } },
        description: 'Success',
      },
    }
  }

  return Object.fromEntries(
    Object.entries(config).map(([code, schema]) => [
      code,
      {
        content: { 'application/json': { schema } },
        description: `Status ${code}`,
      },
    ]),
  )
}

// ── Endpoint registration (spec-only, no handler wrapping) ─────────────

/**
 * Registers a single endpoint in the OpenAPI registry.
 * Validation is handled by `defineEndpoint` — this only generates the spec.
 * Endpoints without `custom.openapi` are returned unchanged.
 */
export const registerEndpoint = (
  endpoint: Endpoint,
  pathPrefix: string,
  registry: OpenAPIRegistry,
): Endpoint => {
  const config = endpoint.custom?.openapi as EndpointOpenApiConfig | undefined
  if (!config) {
    return endpoint
  }

  if (endpoint.method === 'connect') {
    // eslint-disable-next-line no-console -- payload logger is not initialized here.
    console.warn('unsupported openapi method type connect')
    return endpoint
  }

  const paramNames = extractPathParams(endpoint.path)
  const resolvedParams = buildParamsSchema(paramNames, config.params)

  registry.registerPath({
    description: config.description,
    method: endpoint.method,
    path: toOpenApiPath(pathPrefix, endpoint.path),
    request: {
      body: config.body ? { content: { 'application/json': { schema: config.body } } } : undefined,
      params: resolvedParams,
      query: config.query,
    },
    responses: buildResponseDefs(config.response),
    summary: config.summary,
    tags: config.tags,
  })

  return endpoint
}

/** Registers an array of endpoints, registering each in the OpenAPI registry. */
export const registerEndpoints = (
  endpoints: Endpoint[] | false | undefined,
  pathPrefix: string,
  registry: OpenAPIRegistry,
): Endpoint[] | undefined => {
  if (!endpoints || typeof endpoints === 'boolean') {
    return undefined
  }
  return endpoints.map((ep) => registerEndpoint(ep, pathPrefix, registry))
}
