import type { JSONSchema4 } from "json-schema";
import { z } from "zod";
/**
 * Extracts a `z.object({ [slug]: z.object({...}) })` schema from
 * the `collections` section of a Payload JSON schema.
 */
export declare function extractCollectionsZodSchema(
  root: JSONSchema4,
): undefined | z.ZodObject<z.ZodRawShape>;
/**
 * Extracts a `z.object({ [slug]: z.object({...}) })` schema from
 * the `globals` section of a Payload JSON schema.
 */
export declare function extractGlobalsZodSchema(
  root: JSONSchema4,
): undefined | z.ZodObject<z.ZodRawShape>;
