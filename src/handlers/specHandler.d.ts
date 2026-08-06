import { type OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import type { PayloadRequest } from "payload";
import type { OpenApiMetadata, SpecAccess } from "../types";
export type SpecHandlerConfig = {
  metadata: OpenApiMetadata;
  openapiVersion: "3.0" | "3.1";
  readAccess?: SpecAccess;
  /** Promise that resolves when the registry is fully populated (after onInit). */
  readyPromise: Promise<void>;
};
/**
 * Creates a request handler that generates and returns the OpenAPI document
 * from the registry. The document is generated lazily on the first request
 * (after the optional readyPromise resolves) and cached for subsequent requests.
 */
export declare const createSpecHandler: (
  registry: OpenAPIRegistry,
  config: SpecHandlerConfig,
) => (req: PayloadRequest) => Promise<Response>;
