import type { Config, Endpoint } from 'payload'

import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import type { OpenApiMetadata, SchemaPreProcessor, SpecAccess } from './types'

import { registerPayloadDefaults } from './endpoints'
import { createSpecHandler } from './handlers/specHandler'
import { createDocsHandler } from './handlers/swaggerUIHandler'
import { registerEndpoints } from './registry'

export type ZodApiPluginConfig = {
  /** Path for the Swagger UI docs page. Set to `false` to disable. */
  docsEndpoint?: false | string
  enabled?: boolean
  metadata?: OpenApiMetadata
  openapiVersion?: '3.0' | '3.1'
  readAccess?: SpecAccess
  /** Additional pre-processors to apply to the JSON schema before Zod generation. */
  schemaPreProcessors?: SchemaPreProcessor[]
  /** Path at which to save the generated zod schemas */
  schemasPath?: string
  specEndpoint?: string
}

/**
 * Default configuration values for the plugin
 */
const DEFAULTS = {
  docsEndpointPath: '/docs',
  metadata: {
    title: 'Payload API',
    version: '1.0.0',
  },
  openapiVersion: '3.0' as const,
  schemasPath: 'src/payload-schemas.ts',
  specEndpointPath: '/openapi.json',
}

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

/**
 * payload-zodapi plugin for Payload CMS
 *
 * Generates an OpenAPI spec from collection/global schemas and custom endpoint
 * definitions, and serves it at a configurable path.
 *
 * @example
 * ```ts
 * plugins: [
 *   zodApiPlugin({
 *     metadata: { title: "My API", version: "1.0.0" },
 *   }),
 * ]
 * ```
 */
export const zodApiPlugin =
  (options: ZodApiPluginConfig = {}) =>
  (config: Config): Config => {
    if (options.enabled === false) {
      return config
    }

    const openapiVersion = options.openapiVersion ?? DEFAULTS.openapiVersion
    const metadata = options.metadata ?? DEFAULTS.metadata
    const specEndpointPath = options.specEndpoint ?? DEFAULTS.specEndpointPath
    const apiPrefix = config.routes?.api ?? '/api'
    const docsEndpointPath = options.docsEndpoint ?? DEFAULTS.docsEndpointPath

    // Forward schemaPreProcessors to `custom` options, so the bin script can pick them up
    if (options.schemaPreProcessors?.length) {
      config.custom = {
        ...config.custom,
        zodApiPluginOpts: {
          ...config.custom?.zodApiPluginOpts,
          schemaPreProcessors: options.schemaPreProcessors,
          schemasPath: options.schemasPath,
        },
      }
    }

    // Add script to generate zod schemas
    config.bin = [
      ...(config.bin ?? []),
      {
        key: 'generate:schemas',
        scriptPath: path.resolve(dirname, 'bin/generate-schemas.ts'),
      },
    ]

    // Create registry for endpoint and schema documentation
    const registry = new OpenAPIRegistry()

    // Register API key security scheme (Payload uses Authorization header)
    registry.registerComponent('securitySchemes', 'ApiKey', {
      name: 'Authorization',
      type: 'apiKey',
      description:
        'Payload API key. Format: `<collection-slug> API-Key <key>` (e.g. `users API-Key abc123`)',
      in: 'header',
    })

    // Register JWT bearer security scheme
    registry.registerComponent('securitySchemes', 'Bearer', {
      type: 'http',
      bearerFormat: 'JWT',
      description: 'JWT token obtained from the login endpoint.',
      scheme: 'bearer',
    })

    // Register all custom endpoints (root, collections, globals)
    config.endpoints = registerEndpoints(config.endpoints, apiPrefix, registry)

    config.collections = config.collections?.map((collection) => ({
      ...collection,
      endpoints: registerEndpoints(
        collection.endpoints || undefined,
        `${apiPrefix}/${collection.slug}`,
        registry,
      ),
    }))

    config.globals = config.globals?.map((global) => ({
      ...global,
      endpoints: registerEndpoints(
        global.endpoints || undefined,
        `${apiPrefix}/globals/${global.slug}`,
        registry,
      ),
    }))

    // Register Payload's default CRUD endpoints
    registerPayloadDefaults(config.collections ?? [], config.globals ?? [], apiPrefix, registry)

    // Add the OpenAPI spec endpoint
    const specHandler = createSpecHandler(registry, {
      metadata,
      openapiVersion,
      readAccess: options.readAccess,
    })
    const specEndpoint: Endpoint = {
      handler: specHandler,
      method: 'get',
      path: specEndpointPath,
    }
    config.endpoints = [...(config.endpoints ?? []), specEndpoint]

    // Add the Swagger UI docs endpoint
    if (docsEndpointPath !== false) {
      const docsHandler = createDocsHandler({
        readAccess: options.readAccess,
        specPath: `${apiPrefix}${specEndpointPath}`,
      })
      const docsEndpoint: Endpoint = {
        handler: docsHandler,
        method: 'get',
        path: docsEndpointPath,
      }
      config.endpoints = [...config.endpoints, docsEndpoint]
    }

    // Generate schemas on startup (similar to how payload generates types)
    if (process.env.NODE_ENV !== 'production') {
      const superOnInit = config.onInit
      config.onInit = async (payload) => {
        await superOnInit?.(payload)
        void payload.bin({ args: ['generate:schemas'], log: false })
      }
    }

    return config
  }
