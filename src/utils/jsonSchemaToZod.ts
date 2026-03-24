import type { JSONSchema4 } from 'json-schema'

import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi'
import { z } from 'zod'

// Ensure all Zod schemas created here have .openapi() support.
// This is idempotent and safe to call multiple times.
extendZodWithOpenApi(z)

/**
 * Extracts a `z.object({ [slug]: z.object({...}) })` schema from
 * the `collections` section of a Payload JSON schema.
 */
export function extractCollectionsZodSchema(
  root: JSONSchema4,
): undefined | z.ZodObject<z.ZodRawShape> {
  return extractSectionSchema(root, 'collections')
}

/**
 * Extracts a `z.object({ [slug]: z.object({...}) })` schema from
 * the `globals` section of a Payload JSON schema.
 */
export function extractGlobalsZodSchema(root: JSONSchema4): undefined | z.ZodObject<z.ZodRawShape> {
  return extractSectionSchema(root, 'globals')
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function extractSectionSchema(
  root: JSONSchema4,
  section: string,
): undefined | z.ZodObject<z.ZodRawShape> {
  const sectionSchema = root.properties?.[section]
  if (!sectionSchema) {
    return undefined
  }

  const resolved = resolveRef(sectionSchema, root)
  if (!resolved.properties || Object.keys(resolved.properties).length === 0) {
    return undefined
  }

  const shape: Record<string, z.ZodTypeAny> = {}
  for (const [slug, propSchema] of Object.entries(resolved.properties)) {
    shape[slug] = convertToZodObject(resolveRef(propSchema, root), root)
  }

  return z.object(shape as z.ZodRawShape)
}

/**
 * Resolves a `$ref` pointer (e.g. `"#/definitions/posts"`) against the root schema.
 * Returns the schema unchanged if it has no `$ref`.
 */
function resolveRef(schema: JSONSchema4, root: JSONSchema4): JSONSchema4 {
  if (!schema.$ref) {
    return schema
  }

  const refPath = schema.$ref.replace(/^#\//, '').split('/')
  let current: unknown = root
  for (const segment of refPath) {
    if (current == null || typeof current !== 'object') {
      return {}
    }
    current = (current as Record<string, unknown>)[segment]
  }
  return (current as JSONSchema4) ?? {}
}

/**
 * Converts a JSON Schema object definition to `z.object({...})`.
 */
function convertToZodObject(schema: JSONSchema4, root: JSONSchema4): z.ZodObject<z.ZodRawShape> {
  const resolved = resolveRef(schema, root)
  if (!resolved.properties) {
    return z.object({})
  }

  const requiredFields = Array.isArray(resolved.required) ? resolved.required : []
  const requiredSet = new Set(requiredFields)
  const shape: Record<string, z.ZodTypeAny> = {}

  for (const [key, prop] of Object.entries(resolved.properties)) {
    const zodType = convertProperty(prop, root)
    shape[key] = requiredSet.has(key) ? zodType : zodType.optional()
  }

  return z.object(shape as z.ZodRawShape)
}

/**
 * Converts a single JSON Schema property to a Zod type.
 * Handles common patterns produced by Payload's `configToJSONSchema`:
 * refs, objects, arrays, enums, oneOf/anyOf unions, and primitives.
 */
function convertProperty(schema: JSONSchema4, root: JSONSchema4): z.ZodTypeAny {
  const resolved = resolveRef(schema, root)

  // allOf — merge sub-schemas (used for composed types)
  if (resolved.allOf) {
    const merged: JSONSchema4 = { type: 'object', properties: {}, required: [] }
    for (const sub of resolved.allOf) {
      const r = resolveRef(sub, root)
      if (r.properties) {
        Object.assign(merged.properties!, r.properties)
      }
      if (Array.isArray(r.required)) {
        ;(merged.required as string[]).push(...r.required)
      }
    }
    return convertToZodObject(merged, root)
  }

  // oneOf / anyOf — union types (nullable fields, polymorphic relationships)
  if (resolved.oneOf || resolved.anyOf) {
    const variants = (resolved.oneOf || resolved.anyOf) as JSONSchema4[]
    const nonNull = variants.filter((v) => resolveRef(v, root).type !== 'null')
    if (nonNull.length === 0) {
      return z.null()
    }
    if (nonNull.length === 1) {
      return convertProperty(nonNull[0], root).nullable()
    }
    // Multiple non-null variants: simplify to unknown
    return z.unknown()
  }

  // Enum values
  if (resolved.enum) {
    const values = resolved.enum.filter((v): v is string => typeof v === 'string')
    if (values.length > 0) {
      return z.enum(values as [string, ...string[]])
    }
    return z.unknown()
  }

  // Type arrays like ["string", "null"] (used by json fields)
  if (Array.isArray(resolved.type)) {
    const types = resolved.type.filter((t) => t !== 'null')
    const isNullable = resolved.type.includes('null')
    const inner =
      types.length === 1 ? convertProperty({ ...resolved, type: types[0] }, root) : z.unknown()
    return isNullable ? inner.nullable() : inner
  }

  // Const values
  if (resolved.const !== undefined) {
    return z.literal(resolved.const as boolean | number | string)
  }

  // Basic type mapping
  switch (resolved.type) {
    case 'array':
      return z.array(
        resolved.items ? convertProperty(resolved.items as JSONSchema4, root) : z.unknown(),
      )
    case 'boolean':
      return z.boolean()
    case 'integer':
    case 'number':
      return z.number()
    case 'null':
      return z.null()
    case 'object':
      return convertToZodObject(resolved, root)
    case 'string':
      return z.string()
    default:
      return z.unknown()
  }
}
