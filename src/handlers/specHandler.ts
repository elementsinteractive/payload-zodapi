import type { PayloadRequest } from "payload";

import {
  OpenApiGeneratorV3,
  OpenApiGeneratorV31,
  type OpenAPIRegistry,
} from "@asteasolutions/zod-to-openapi";

import type { OpenApiMetadata, SpecAccess } from "../types";

import { specAccessResponse } from "../utils/access";

export type SpecHandlerConfig = {
  metadata: OpenApiMetadata;
  openapiVersion: "3.0" | "3.1";
  readAccess?: SpecAccess;
};

/**
 * Creates a request handler that generates and returns the OpenAPI document
 * from the registry.
 */
export const createSpecHandler = (
  registry: OpenAPIRegistry,
  config: SpecHandlerConfig,
) => {
  const isV31 = config.openapiVersion === "3.1";

  const Generator = isV31 ? OpenApiGeneratorV31 : OpenApiGeneratorV3;
  const spec = new Generator(registry.definitions).generateDocument({
    info: config.metadata,
    openapi: isV31 ? "3.1.0" : "3.0.0",
  });

  return async (req: PayloadRequest) => {
    const accessResponse = await specAccessResponse(req, config.readAccess);
    if (accessResponse) {return accessResponse;}

    return Response.json(spec);
  };
};
