# payload-zodapi

A [Payload CMS](https://payloadcms.com) plugin that generates a unified OpenAPI spec for both Payload's built-in collection/global endpoints and your custom endpoints, with full Zod-based request/response validation and TypeScript type inference.

## Why

Payload gives you a powerful API out of the box, but there's no built-in way to document it or validate custom endpoints consistently. This plugin bridges that gap:

- **One spec for everything** — built-in CRUD, auth, upload, and version endpoints are documented alongside your custom ones, all in a single OpenAPI document served at `/api/openapi.json`.
- **Type-safe custom endpoints** — `defineEndpoint` wraps Payload endpoint handlers with Zod validation for path params, query params, and request/response bodies. You get full type inference with zero boilerplate.
- **Zod schema generation** — a `generate:schemas` bin command converts the Payload JSON schema into TypeScript Zod schemas, which you can use for response validation, data transformation, or anywhere else you need runtime schema checks.

## Installation

```bash
pnpm add payload-zodapi
# or
npm install payload-zodapi
```

## Setup

Register the plugin in your `payload.config.ts`:

```ts
import { zodApiPlugin } from "payload-zodapi";

export default buildConfig({
  plugins: [
    zodApiPlugin({
      openapiVersion: "3.0",
      metadata: { title: "My API", version: "1.0.0" },
    }),
  ],
  custom: {
    zodApiPluginOpts: {
      schemasPath: "src/payload-schemas.ts", // output path for generated Zod schemas
    },
  },
});
```

The OpenAPI spec is served at `/api/openapi.json` and interactive docs at `/api/docs`.

## Defining Custom Endpoints

Use `defineEndpoint` instead of a raw Payload endpoint object. It handles validation, type inference, and OpenAPI registration automatically.

```ts
import type { CollectionConfig } from "payload";
import { z } from "zod";
import { defineEndpoint } from "payload-zodapi";

const getPost = defineEndpoint({
  path: "/:id",
  method: "get",
  openapi: {
    summary: "Get post by ID",
    tags: ["Posts"],
    params: z.object({ id: z.string().uuid() }),
    query: z.object({ include: z.string().optional() }),
    response: z.object({ id: z.string(), title: z.string() }),
  },
  handler: async (req, { pathParams, queryParams }) => {
    const { id } = pathParams;       // { id: string }
    const { include } = queryParams; // { include?: string }
    return Response.json({ id, title: "Hello world" });
  },
});

export const Posts: CollectionConfig = {
  slug: "posts",
  endpoints: [getPost],
  fields: [{ name: "title", type: "text" }],
};
```

### Automatic Path Param Inference

Omit `params` and path params are inferred directly from the `:param` segments in `path` — both at the type level and at runtime.

```ts
defineEndpoint({
  path: "/posts/:slug/:version",
  method: "get",
  handler: async (req, { pathParams }) => {
    // pathParams: { slug: string; version: string }
    const { slug, version } = pathParams;
  },
});
```

Provide an explicit `params` schema when you need stricter validation:

```ts
defineEndpoint({
  path: "/posts/:id/:status",
  method: "get",
  openapi: {
    params: z.object({
      id: z.string().uuid(),
      status: z.enum(["draft", "published"]),
    }),
  },
  handler: async (req, { pathParams }) => {
    // pathParams: { id: string; status: "draft" | "published" }
  },
});
```

### Multi-Value Query Params

Use the `queryArray` helper to normalise query params that may appear multiple times (e.g. `?tag=a&tag=b`):

```ts
import { defineEndpoint, queryArray } from "payload-zodapi";

defineEndpoint({
  path: "/items",
  method: "get",
  openapi: {
    query: z.object({
      tag: queryArray(z.string()), // string[] — handles ?tag=a&tag=b
      page: z.string().optional(), // string   — single value
    }),
  },
  handler: async (req, { queryParams }) => {
    const { tag, page } = queryParams; // tag: string[], page: string | undefined
  },
});
```

### Guards

Guards are async functions that run before the handler. Return a `Response` to short-circuit the request, or return nothing to allow it through. They're useful for authentication, authorization, and other pre-handler checks.

```ts
defineEndpoint({
  path: "/:id",
  method: "get",
  guards: [
    async (req) => {
      if (!req.user) {
        return Response.json({ error: "Not authenticated" }, { status: 401 });
      }
    },
  ],
  handler: async (req, { pathParams }) => {
    return Response.json({ id: pathParams.id });
  },
});
```

Multiple guards run in order and each can independently short-circuit.

### Response Validation

Response bodies are validated against the `response` schema. Behaviour is controlled per-endpoint via `responseValidation`:

| Mode        | Behaviour                                          |
| ----------- | -------------------------------------------------- |
| `"enforce"` | Logs error and returns 500 (default)               |
| `"log"`     | Logs a warning but returns the original response   |
| `"off"`     | Skips response validation entirely                 |

```ts
defineEndpoint({
  openapi: {
    response: z.object({ id: z.string() }),
    responseValidation: "log",
  },
  handler: async (req, input) => { /* ... */ },
});
```

## Zod Schema Generation

Generate Zod schemas from your Payload config with:

```bash
pnpm payload generate:schemas
```

This reads the Payload config, converts it to JSON schema via `configToJSONSchema`, and outputs TypeScript Zod schemas to the path configured in `custom.zodApiPluginOpts.schemasPath`.

### Using Generated Schemas

```ts
import { PostSchema } from "@/payload-schemas";

const myEndpoint = defineEndpoint({
  path: "/posts",
  method: "get",
  openapi: {
    response: z.array(PostSchema),
  },
  handler: async (req) => { /* ... */ },
});
```

### Custom Schema Pre-Processors

If your JSON schema contains structures that confuse quicktype, supply additional pre-processors via the `schemaPreProcessors` plugin option. Each pre-processor receives a `JSONSchema4` and returns a transformed one.

```ts
import type { SchemaPreProcessor } from "payload-zodapi";

// Flatten a deeply-nested or circular property so quicktype can handle it
const flattenCircularRefs: SchemaPreProcessor = (schema) => {
  const definitions = { ...(schema.definitions ?? {}) };
  for (const [key, def] of Object.entries(definitions)) {
    if (def.properties?.metadata) {
      definitions[key] = {
        ...def,
        properties: { ...def.properties, metadata: { type: "object" } },
      };
    }
  }
  return { ...schema, definitions };
};

zodApiPlugin({
  metadata: { title: "My API", version: "1.0.0" },
  schemaPreProcessors: [flattenCircularRefs],
});
```

## License

MIT
