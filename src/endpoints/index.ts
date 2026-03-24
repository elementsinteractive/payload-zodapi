import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'
import type { CollectionConfig, GlobalConfig } from 'payload'
import type { z } from 'zod'

import { registerAuthCollectionEndpoints, registerAuthRootEndpoints } from './auth'
import { registerCollectionEndpoints } from './collections'
import { registerGlobalEndpoints } from './globals'
import { registerUploadEndpoints } from './uploads'

/**
 * Registers all default Payload endpoints in the OpenAPI registry:
 *
 * - Collection CRUD, count, duplicate, versions, and access endpoints
 * - Auth endpoints for auth-enabled collections (login, logout, etc.)
 * - Upload endpoints for upload-enabled collections (file serving)
 * - Global read, update, versions, and access endpoints
 * - Root-level access endpoint
 *
 * Schemas are registered under `components/schemas` so that paths
 * reference them via `$ref` rather than inlining the full definition.
 */
export function registerPayloadDefaults(
  collections: CollectionConfig[],
  globals: GlobalConfig[],
  apiPrefix: string,
  registry: OpenAPIRegistry,
  schemas: {
    collectionsSchema?: z.ZodObject<z.ZodRawShape>
    globalsSchema?: z.ZodObject<z.ZodRawShape>
  },
) {
  const { collectionsSchema, globalsSchema } = schemas

  for (const collection of collections) {
    if (collectionsSchema) {
      registerCollectionEndpoints(collection, apiPrefix, registry, collectionsSchema)

      if (collection.auth) {
        registerAuthCollectionEndpoints(collection, apiPrefix, registry, collectionsSchema)
      }
    }

    if (collection.upload) {
      registerUploadEndpoints(collection, apiPrefix, registry)
    }
  }

  if (globalsSchema) {
    for (const global of globals) {
      registerGlobalEndpoints(global, apiPrefix, registry, globalsSchema)
    }
  }

  registerAuthRootEndpoints(apiPrefix, registry)
}
