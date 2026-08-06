import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import type { Endpoint } from "payload";
import type { AnyZodObject } from "./types";
/** Extracts param names from an Express-style path (e.g. `/:id` → `["id"]`). */
export declare const extractPathParams: (path: string) => string[];
/** Converts Express-style params to OpenAPI format (`:id` → `{id}`). */
export declare const toOpenApiPath: (prefix: string, path: string) => string;
type OpenApiResponses = Record<
  string,
  {
    content?: {
      "application/json": {
        schema: AnyZodObject;
      };
    };
    description: string;
  }
>;
/**
 * Merges auto-detected path params with an optional user schema.
 * User schema fields take precedence over auto-detected `z.string()` defaults.
 */
export declare const buildParamsSchema: (
  paramNames: string[],
  userSchema?: AnyZodObject,
) => AnyZodObject | undefined;
/** Converts response config into OpenAPI response definitions. */
export declare const buildResponseDefs: (
  config?: AnyZodObject | Record<number, AnyZodObject>,
) => OpenApiResponses;
/**
 * Registers a single endpoint in the OpenAPI registry.
 * Validation is handled by `defineEndpoint` — this only generates the spec.
 * Endpoints without `custom.openapi` are returned unchanged.
 */
export declare const registerEndpoint: (
  endpoint: Endpoint,
  pathPrefix: string,
  registry: OpenAPIRegistry,
) => Endpoint;
/** Registers an array of endpoints, registering each in the OpenAPI registry. */
export declare const registerEndpoints: (
  endpoints: Endpoint[] | false | undefined,
  pathPrefix: string,
  registry: OpenAPIRegistry,
) => Endpoint[] | undefined;
