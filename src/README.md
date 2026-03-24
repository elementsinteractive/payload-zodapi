# payload-zodapi

Payload CMS plugin that generates a unified OpenAPI spec for both Payload's built-in collection/global endpoints and custom endpoints defined with `defineEndpoint`. Also provides Zod schema generation from the Payload config.

## How It Works

1. Scans all custom endpoints (root, collection, and global) for `custom.openapi` metadata attached via `defineEndpoint`.
2. Registers those custom schemas in an `@asteasolutions/zod-to-openapi` registry.
3. Registers Payload's built-in CRUD, auth, upload, and version endpoints from generated Zod schemas.
4. Generates a single OpenAPI document from the registry, served at `/api/openapi.json`.
5. Registers a `generate:schemas` bin script that converts the Payload JSON schema into Zod TypeScript schemas via [quicktype](https://github.com/glideapps/quicktype).

## Architecture

```
plugin.ts                – Plugin entry point. Registers endpoints, security schemes, and serves the spec.
defineEndpoint.ts        – Endpoint factory. Wraps handlers with Zod-based request parsing and response validation.
registry.ts              – Registers custom endpoint schemas into the OpenAPI registry. Spec-only — no handler wrapping.
specGenerator.ts         – Creates the spec handler that generates the OpenAPI document from the registry.
types.ts                 – Shared types (EndpointOpenApiConfig, ValidatedInput, ValidationMode, etc.).
endpoints/               – Registers Payload's built-in endpoints (collections, globals, auth, uploads).
bin/generate-schemas.ts  – Bin script. Generates Zod schemas from the Payload JSON schema using quicktype.
```

## Usage

### Defining a Custom Endpoint

Use `defineEndpoint` instead of a raw Payload endpoint object. It provides:

- **Zod-based request validation** — path params, query params, and body are parsed and validated automatically (returns 400 on failure).
- **Typed handler signature** — `handler(req, { pathParams, queryParams, body })` with full type inference from your Zod schemas.
- **Automatic path param inference** — when no `params` schema is provided, path params are inferred from the path string (both at the type level and at runtime).
- **OpenAPI spec generation** — schemas are automatically registered in the OpenAPI spec.
- **Optional response validation** — validate response bodies at runtime during development.

```ts
import { z } from "zod";
import { defineEndpoint } from "@/plugins/payload-zodapi";

export const myEndpoint = defineEndpoint({
  path: "/:id",
  method: "get",
  openapi: {
    summary: "Get item by ID",
    tags: ["Items"],
    params: z.object({ id: z.string().uuid() }),
    query: z.object({ include: z.string().optional() }),
    response: z.object({ id: z.string(), name: z.string() }),
  },
  handler: async (req, { pathParams, queryParams }) => {
    const { id } = pathParams;       // typed as { id: string }
    const { include } = queryParams;  // typed as { include?: string }
    // ...
    return Response.json({ id, name: "Example" });
  },
});
```

### Automatic Path Param Inference

If you don't need extra validation on path params (e.g. UUID format checks), you can omit the `params` schema entirely. The handler's `pathParams` type is automatically derived from the `:param` segments in `path`, and `req.routeParams` is passed through directly at runtime.

```ts
defineEndpoint({
  path: "/assets/:tenantId/:platform",
  method: "get",
  handler: async (req, { pathParams }) => {
    //  pathParams: { tenantId: string; platform: string }
    const { tenantId, platform } = pathParams;
    // ...
  },
});
```

Provide an explicit `params` schema whenever you need stricter validation (e.g. UUID, enum):

```ts
defineEndpoint({
  path: "/assets/:tenantId/:platform",
  method: "get",
  openapi: {
    params: z.object({
      tenantId: z.string().uuid(),
      platform: z.enum(["ios", "android"]),
    }),
  },
  handler: async (req, { pathParams }) => {
    //  pathParams: { tenantId: string; platform: "ios" | "android" }
  },
});
```

### Multi-Value Query Params

A query param that appears multiple times (e.g. `?tag=a&tag=b`) is parsed by Next.js as `string[]`, while a single occurrence produces a plain `string`. Use the `queryArray` helper to normalise both cases into an array:

```ts
import { defineEndpoint, queryArray } from "@/plugins/payload-zodapi";
import { z } from "zod";

defineEndpoint({
  path: "/items",
  method: "get",
  openapi: {
    query: z.object({
      tag: queryArray(z.string()),   // string[] — handles ?tag=a&tag=b
      page: z.string().optional(),   // string   — ordinary single value
    }),
  },
  handler: async (req, { queryParams }) => {
    const { tag, page } = queryParams;
    // tag: string[], page: string | undefined
  },
});
```

### Response Validation

By default, response bodies are validated in `"enforce"` mode (returns 500 if the response doesn't match the schema). This can be changed per-endpoint:

| Mode        | Behaviour                                              |
| ----------- | ------------------------------------------------------ |
| `"enforce"` | Logs error and returns 500 (default)                   |
| `"log"`     | Logs a warning but returns the original response       |
| `"off"`     | Skips response validation entirely                     |

```ts
defineEndpoint({
  // ...
  openapi: {
    response: z.object({ id: z.string() }),
    responseValidation: "log", // warn but don't block
  },
  handler: async (req, input) => { /* ... */ },
});
```

### Registering the Plugin

```ts
// payload.config.ts
import { zodApiPlugin } from "./plugins/payload-zodapi";

export default buildConfig({
  plugins: [
    zodApiPlugin({
      openapiVersion: "3.0",
      metadata: { title: "My API", version: "1.0.0" },
    }),
  ],
  custom: {
    zodApiPluginOpts: {
      schemasPath: "src/payload-schemas.ts", // where to write the generated Zod schemas
    },
  },
});
```

The spec is served at `/api/openapi.json` and docs at `/api/docs`.

## Zod Schema Generation

The plugin registers a Payload bin script that generates Zod schemas from the Payload config. These schemas can be imported and used for response validation in custom endpoints, or anywhere else runtime schema validation is needed.

### Running the Generator

```bash
pnpm payload generate:schemas
```

This reads the Payload config, converts it to a JSON schema via `configToJSONSchema`, preprocesses it to work around quicktype limitations, then generates TypeScript Zod schemas.

The output file path is configured via `custom.zodApiPluginOpts.schemasPath` in `payload.config.ts` (defaults to `payload-schemas.ts`).

### How Preprocessing Works

The raw JSON schema produced by Payload contains structures that confuse quicktype. The plugin applies a built-in preprocessor and then any custom ones supplied via the `schemaPreProcessors` option.

**Built-in:** `collectionsJoins` stripping — Payload generates a top-level `collectionsJoins` property that defines inline objects with the same names as collections but containing only join metadata. This causes quicktype to pick the join-only version instead of the full collection definition. The plugin strips it automatically.

### Custom Schema Pre-Processors

If your project's JSON schema contains other structures that confuse quicktype, you can supply additional pre-processors via the `schemaPreProcessors` plugin option. Each pre-processor is a function that receives a `JSONSchema4` and returns a transformed `JSONSchema4`. They run in order, after the built-in `collectionsJoins` stripping.

```ts
import type { JSONSchema4 } from "json-schema";
import { zodApiPlugin } from "./plugins/payload-zodapi";
import type { SchemaPreProcessor } from "./plugins/payload-zodapi";

// Example: simplify circular `usedIn` references so quicktype can generate standalone schemas
const simplifyUsedIn: SchemaPreProcessor = (schema) => {
  const definitions = { ...(schema.definitions ?? {}) } as Record<string, JSONSchema4>;
  for (const [key, def] of Object.entries(definitions)) {
    if (def.properties?.usedIn) {
      definitions[key] = {
        ...def,
        properties: { ...def.properties, usedIn: { type: "object" } },
      };
    }
  }
  return { ...schema, definitions };
};

export default buildConfig({
  plugins: [
    zodApiPlugin({
      metadata: { title: "My API", version: "1.0.0" },
      schemaPreProcessors: [simplifyUsedIn],
    }),
  ],
});
```

### Using Generated Schemas

```ts
import { SeasonCoverSchema, TourSchema } from "@/payload-schemas";

// Use in a defineEndpoint response schema
const myEndpoint = defineEndpoint({
  path: "/seasons",
  method: "get",
  openapi: {
    response: z.array(
      z.object({
        name: z.string(),
        cover: SeasonCoverSchema,
      }),
    ),
  },
  handler: async (req) => { /* ... */ },
});
```
