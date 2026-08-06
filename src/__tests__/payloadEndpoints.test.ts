import type { Endpoint } from "payload";
import type z from "zod";

import "../testHelpers";

/**
 * Drift-detection tests for the endpoints/ module.
 *
 * These tests import Payload's *actual* default endpoint arrays and verify
 * that our OpenAPI registrations cover every path + method 1:1. If Payload
 * adds, removes, or renames an endpoint in a future version, these tests
 * will fail and tell us exactly what changed.
 */
import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { CollectionsSchema, GlobalsSchema } from "@/payload-schemas";

import {
  registerAuthCollectionEndpoints,
  registerAuthRootEndpoints,
} from "../endpoints/auth";
import { registerCollectionEndpoints } from "../endpoints/collections";
import { registerGlobalEndpoints } from "../endpoints/globals";
import { registerUploadEndpoints } from "../endpoints/uploads";

// ── Import Payload's internal endpoint arrays ───────────────────────
// Payload's package.json exports don't expose these, so we resolve
// through the filesystem. These are stable public arrays that Payload
// uses during config sanitization.

const resolvePayloadDist = (subpath: string) => {
  const payloadDir = require.resolve("payload").replace(/\/dist\/.*/, "/dist");
  // nosemgrep: eslint.detect-non-literal-require / This is a test file, not using user-input
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require(`${payloadDir}/${subpath}`);
};

const { defaultCollectionEndpoints } = resolvePayloadDist(
  "collections/endpoints/index.js",
) as { defaultCollectionEndpoints: Endpoint[] };

const { defaultGlobalEndpoints } = resolvePayloadDist(
  "globals/endpoints/index.js",
) as { defaultGlobalEndpoints: Endpoint[] };

const { authCollectionEndpoints, authRootEndpoints } = resolvePayloadDist(
  "auth/endpoints/index.js",
) as { authCollectionEndpoints: Endpoint[]; authRootEndpoints: Endpoint[] };

const { uploadCollectionEndpoints } = resolvePayloadDist(
  "uploads/endpoints/index.js",
) as { uploadCollectionEndpoints: Endpoint[] };

// ── Helpers ─────────────────────────────────────────────────────────

/** Converts Express-style `:param` to OpenAPI-style `{param}` and normalises slashes. */
const toOpenApiPath = (prefix: string, path: string): string =>
  `${prefix}${path}`
    .replace(/:(\w+)\?/g, "{$1}")
    .replace(/:(\w+)/g, "{$1}")
    .replace(/\/+$/, "");

/** Extracts the set of `method:path` strings from Payload's endpoint arrays. */
const payloadEndpointSet = (
  endpoints: Endpoint[],
  prefix: string,
): Set<string> =>
  new Set(
    endpoints.map((ep) => `${ep.method}:${toOpenApiPath(prefix, ep.path)}`),
  );

/** Extracts the set of `method:path` strings from registered OpenAPI paths. */
const registryPathSet = (registry: OpenAPIRegistry): Set<string> => {
  const set = new Set<string>();
  for (const def of registry.definitions) {
    if (def.type === "route" && def.route) {
      const path = def.route.path.replace(/\/+$/, "");
      set.add(`${def.route.method}:${path}`);
    }
  }
  return set;
};

// ── Mocks ───────────────────────────────────────────────────────────

vi.mock("@/payload-schemas", async () => {
  const { extendZodWithOpenApi } = await import(
    "@asteasolutions/zod-to-openapi"
  );
  const { default: z } = await import("zod");

  extendZodWithOpenApi(z);

  const stubSchema = z.object({ id: z.string() });
  const schemaProxy = new Proxy({}, { get: () => stubSchema });

  return {
    CollectionsSchema: { shape: schemaProxy },
    GlobalsSchema: { shape: schemaProxy },
  };
});

// ── Tests ───────────────────────────────────────────────────────────

const COLLECTION_PREFIX = "/api";
const GLOBAL_PREFIX = "/api";

const stubCollection = (slug: string) =>
  ({ slug, auth: false, upload: false }) as Parameters<
    typeof registerCollectionEndpoints
  >[0];

const stubAuthCollection = (slug: string) =>
  ({ slug, auth: { useAPIKey: true }, upload: false }) as unknown as Parameters<
    typeof registerAuthCollectionEndpoints
  >[0];

const stubUploadCollection = (slug: string) =>
  ({ slug, auth: false, upload: true }) as unknown as Parameters<
    typeof registerUploadEndpoints
  >[0];

const stubGlobal = (slug: string) =>
  ({ slug }) as Parameters<typeof registerGlobalEndpoints>[0];

describe("endpoints/ drift detection against Payload", () => {
  it("defaultCollectionEndpoints", () => {
    const registry = new OpenAPIRegistry();
    registerCollectionEndpoints(
      stubCollection("test"),
      COLLECTION_PREFIX,
      registry,
      CollectionsSchema as unknown as z.ZodObject<z.ZodRawShape>,
    );

    const expected = payloadEndpointSet(
      defaultCollectionEndpoints,
      `${COLLECTION_PREFIX}/test`,
    );
    const actual = registryPathSet(registry);

    expect(actual).toEqual(expected);
  });

  it("defaultGlobalEndpoints", () => {
    const registry = new OpenAPIRegistry();
    registerGlobalEndpoints(
      stubGlobal("test"),
      GLOBAL_PREFIX,
      registry,
      GlobalsSchema as unknown as z.ZodObject<z.ZodRawShape>,
    );

    const expected = payloadEndpointSet(
      defaultGlobalEndpoints,
      `${GLOBAL_PREFIX}/globals/test`,
    );
    const actual = registryPathSet(registry);

    expect(actual).toEqual(expected);
  });

  it("authCollectionEndpoints", () => {
    const registry = new OpenAPIRegistry();
    registerAuthCollectionEndpoints(
      stubAuthCollection("users"),
      COLLECTION_PREFIX,
      registry,
      CollectionsSchema as unknown as z.ZodObject<z.ZodRawShape>,
    );

    const expected = payloadEndpointSet(
      authCollectionEndpoints,
      `${COLLECTION_PREFIX}/users`,
    );
    const actual = registryPathSet(registry);

    expect(actual).toEqual(expected);
  });

  it("authRootEndpoints", () => {
    const registry = new OpenAPIRegistry();
    registerAuthRootEndpoints(COLLECTION_PREFIX, registry);

    const expected = payloadEndpointSet(authRootEndpoints, COLLECTION_PREFIX);
    const actual = registryPathSet(registry);

    expect(actual).toEqual(expected);
  });

  it("uploadCollectionEndpoints", () => {
    const registry = new OpenAPIRegistry();
    registerUploadEndpoints(
      stubUploadCollection("media"),
      COLLECTION_PREFIX,
      registry,
    );

    const expected = payloadEndpointSet(
      uploadCollectionEndpoints,
      `${COLLECTION_PREFIX}/media`,
    );
    const actual = registryPathSet(registry);

    expect(actual).toEqual(expected);
  });
});
