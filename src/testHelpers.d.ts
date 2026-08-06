/**
 * Shared test utilities for OpenAPI plugin tests.
 */
import type { Endpoint, PayloadRequest } from "payload";
/**
 * Creates a mock PayloadRequest for testing.
 * The `payload` override is shallow-merged with the defaults so callers
 * don't have to repeat `config` / `logger` every time.
 */
export declare const createMockRequest: (
  overrides?: Partial<PayloadRequest>,
) => PayloadRequest;
/**
 * Creates a mock Endpoint for testing.
 */
export declare const createMockEndpoint: (
  config: Partial<Endpoint> & Pick<Endpoint, "handler" | "method" | "path">,
) => Endpoint;
/**
 * Helper to find a route definition in the registry by path.
 */
export declare const findRouteByPath: (
  definitions: Array<{
    route?: {
      path: string;
    };
    type: string;
  }>,
  path: string,
) =>
  | {
      route?: {
        path: string;
      };
      type: string;
    }
  | undefined;
