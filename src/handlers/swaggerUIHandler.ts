import type { PayloadRequest } from "payload";

import type { SpecAccess } from "../types";

import { specAccessResponse } from "../utils/access";

const SWAGGER_UI_VERSION = "5.20.0";

export type SwaggerUIHandlerConfig = {
  readAccess?: SpecAccess;
  specPath: string;
};

/** Serves an HTML page that renders Swagger UI pointing at the spec endpoint. */
export function createDocsHandler({
  readAccess,
  specPath,
}: SwaggerUIHandlerConfig): (req: PayloadRequest) => Promise<Response> {
  // Pre-build the HTML at init time — specPath is a trusted config value,
  // so no user-controlled data is interpolated into the template.
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>API Documentation</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui@${SWAGGER_UI_VERSION}/dist/swagger-ui.min.css" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui@${SWAGGER_UI_VERSION}/dist/swagger-ui-bundle.min.js"></script>
  <script>
    SwaggerUIBundle({ url: '${specPath}', dom_id: '#swagger-ui' });
  </script>
</body>
</html>`;

  return async (req) => {
    const accessResponse = await specAccessResponse(req, readAccess);
    if (accessResponse) {return accessResponse;}

    return new Response(html, {
      headers: { "content-type": "text/html" },
    });
  };
}
