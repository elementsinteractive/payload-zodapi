import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import type { PayloadRequest } from "payload";

import { createSpecHandler } from "../handlers/specHandler";
import "../testHelpers"; // Polyfills Response

// Mock the access utility
vi.mock("../utils/access", () => ({
  specAccessResponse: vi.fn().mockResolvedValue(undefined),
}));

import { specAccessResponse } from "../utils/access";

const mockedAccess = vi.mocked(specAccessResponse);

const createMockRequest = () =>
  ({
    payload: { config: { collections: [], globals: [] } },
  }) as unknown as PayloadRequest;

const createConfig = (
  overrides: Partial<{
    metadata: { description?: string; title: string; version: string };
    openapiVersion: "3.0" | "3.1";
    readAccess: (args: { req: unknown }) => boolean;
  }> = {},
) => ({
  metadata: { title: "Test API", version: "1.0.0" },
  openapiVersion: "3.0" as const,
  readyPromise: Promise.resolve(),
  ...overrides,
});

describe("createSpecHandler", () => {
  it("includes registered endpoints in the spec", async () => {
    const registry = new OpenAPIRegistry();
    registry.registerPath({
      method: "get",
      path: "/api/custom",
      responses: { 200: { description: "OK" } },
      summary: "Custom endpoint",
    });

    const handler = createSpecHandler(registry, createConfig());
    const spec = await (await handler(createMockRequest())).json();

    expect(spec.paths["/api/custom"]).toBeDefined();
    expect(spec.paths["/api/custom"].get.summary).toBe("Custom endpoint");
  });

  it("generates a 3.0 spec by default", async () => {
    const registry = new OpenAPIRegistry();
    const handler = createSpecHandler(
      registry,
      createConfig({ openapiVersion: "3.0" }),
    );
    const spec = await (await handler(createMockRequest())).json();

    expect(spec.openapi).toBe("3.0.0");
  });

  it("generates a 3.1 spec when configured", async () => {
    const registry = new OpenAPIRegistry();
    const handler = createSpecHandler(
      registry,
      createConfig({ openapiVersion: "3.1" }),
    );
    const spec = await (await handler(createMockRequest())).json();

    expect(spec.openapi).toBe("3.1.0");
  });

  it("uses provided metadata in the info block", async () => {
    const registry = new OpenAPIRegistry();
    const handler = createSpecHandler(
      registry,
      createConfig({
        metadata: {
          description: "Custom description",
          title: "My API",
          version: "2.0.0",
        },
      }),
    );
    const spec = await (await handler(createMockRequest())).json();

    expect(spec.info).toMatchObject({
      description: "Custom description",
      title: "My API",
      version: "2.0.0",
    });
  });

  it("handles an empty registry", async () => {
    const registry = new OpenAPIRegistry();
    const spec = await (
      await createSpecHandler(registry, createConfig())(createMockRequest())
    ).json();

    expect(spec.info.title).toBe("Test API");
    expect(spec.paths).toEqual({});
  });

  it("supports multiple methods on the same path", async () => {
    const registry = new OpenAPIRegistry();
    registry.registerPath({
      method: "get",
      path: "/api/items",
      responses: { 200: { description: "OK" } },
      summary: "List",
    });
    registry.registerPath({
      method: "post",
      path: "/api/items",
      responses: { 201: { description: "Created" } },
      summary: "Create",
    });

    const handler = createSpecHandler(registry, createConfig());
    const spec = await (await handler(createMockRequest())).json();

    expect(spec.paths["/api/items"]?.get).toBeDefined();
    expect(spec.paths["/api/items"]?.post).toBeDefined();
  });

  it("delegates to specAccessResponse for access control", async () => {
    const mockAccessResponse = new Response(null, { status: 302 });
    mockedAccess.mockResolvedValueOnce(mockAccessResponse);

    const accessFn = vi.fn();
    const registry = new OpenAPIRegistry();
    const handler = createSpecHandler(
      registry,
      createConfig({ readAccess: accessFn }),
    );
    const req = createMockRequest();
    const res = await handler(req);

    expect(res).toBe(mockAccessResponse);
    expect(mockedAccess).toHaveBeenCalledWith(req, accessFn);
  });
});
