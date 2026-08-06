import {
  type OpenAPIRegistry,
  OpenApiGeneratorV3,
  OpenApiGeneratorV31,
} from "@asteasolutions/zod-to-openapi";
import type { PayloadRequest } from "payload";

import type { OpenApiMetadata, SpecAccess } from "../types";

import { specAccessResponse } from "../utils/access";

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
export const createSpecHandler = (
  registry: OpenAPIRegistry,
  config: SpecHandlerConfig,
) => {
  const isV31 = config.openapiVersion === "3.1";
  const Generator = isV31 ? OpenApiGeneratorV31 : OpenApiGeneratorV3;

  let spec: null | ReturnType<
    InstanceType<typeof Generator>["generateDocument"]
  > = null;

  return async (req: PayloadRequest) => {
    const accessResponse = await specAccessResponse(req, config.readAccess);
    if (accessResponse) {
      return accessResponse;
    }

    if (!spec) {
      await config.readyPromise;

      spec = new Generator(registry.definitions).generateDocument({
        info: config.metadata,
        openapi: isV31 ? "3.1.0" : "3.0.0",
      });
    }

    return Response.json(spec);
  };
};
