import type { Config } from "payload";
import type { OpenApiMetadata, SchemaPreProcessor, SpecAccess } from "./types";
export type ZodApiPluginConfig = {
  /** Path for the Swagger UI docs page. Set to `false` to disable. */
  docsEndpoint?: false | string;
  enabled?: boolean;
  metadata?: OpenApiMetadata;
  openapiVersion?: "3.0" | "3.1";
  readAccess?: SpecAccess;
  /** Additional pre-processors to apply to the JSON schema before Zod generation. */
  schemaPreProcessors?: SchemaPreProcessor[];
  /** Path at which to save the generated zod schemas */
  schemasPath?: string;
  specEndpoint?: string;
};
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
export declare const zodApiPlugin: (
  options?: ZodApiPluginConfig,
) => (config: Config) => Config;
