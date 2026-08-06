import type { PayloadRequest } from "payload";
import type { SpecAccess } from "../types";
export type SwaggerUIHandlerConfig = {
  readAccess?: SpecAccess;
  specPath: string;
};
/** Serves an HTML page that renders Swagger UI pointing at the spec endpoint. */
export declare function createDocsHandler({
  readAccess,
  specPath,
}: SwaggerUIHandlerConfig): (req: PayloadRequest) => Promise<Response>;
