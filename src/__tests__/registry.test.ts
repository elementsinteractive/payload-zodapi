import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import type { Endpoint } from "payload";
import { z } from "zod";

import {
  buildParamsSchema,
  buildResponseDefs,
  extractPathParams,
  registerEndpoint,
  registerEndpoints,
  toOpenApiPath,
} from "../registry.js";
import { createMockEndpoint, findRouteByPath } from "../testHelpers.js";

describe("path helpers", () => {
  it.each([
    ["/users/:id", ["id"]],
    ["/users/:userId/posts/:postId", ["userId", "postId"]],
    ["/users/all", []],
    ["/", []],
  ])("extractPathParams(%s) → %j", (path, expected) => {
    expect(extractPathParams(path)).toEqual(expected);
  });

  it.each([
    ["/api", "/users/:id", "/api/users/{id}"],
    ["", "/users/:id", "/users/{id}"],
    ["/api/v1", "/health", "/api/v1/health"],
    [
      "/api",
      "/tenants/:tenantId/assets/:platform",
      "/api/tenants/{tenantId}/assets/{platform}",
    ],
  ])("toOpenApiPath(%s, %s) → %s", (prefix, path, expected) => {
    expect(toOpenApiPath(prefix, path)).toBe(expected);
  });
});

describe("schema helpers", () => {
  describe("buildParamsSchema", () => {
    it("returns undefined when no params and no user schema", () => {
      expect(buildParamsSchema([])).toBeUndefined();
    });

    it("returns user schema when no path params detected", () => {
      const schema = z.object({ custom: z.string() });
      expect(buildParamsSchema([], schema)).toBe(schema);
    });

    it("builds string schema from detected param names", () => {
      const result = buildParamsSchema(["id", "name"]);
      expect(result?.parse({ id: "123", name: "test" })).toEqual({
        id: "123",
        name: "test",
      });
    });

    it("merges user schema with path params (user takes precedence)", () => {
      const userSchema = z.object({ id: z.string().uuid() });
      const result = buildParamsSchema(["id", "name"], userSchema);

      expect(
        result?.safeParse({
          id: "550e8400-e29b-41d4-a716-446655440000",
          name: "test",
        }).success,
      ).toBe(true);
      expect(
        result?.safeParse({ id: "not-a-uuid", name: "test" }).success,
      ).toBe(false);
    });
  });

  describe("buildResponseDefs", () => {
    it("returns default 200 when no config", () => {
      expect(buildResponseDefs()).toEqual({
        "200": { description: "Success" },
      });
    });

    it("wraps single schema as 200 response", () => {
      const result = buildResponseDefs(z.object({ msg: z.string() }));
      expect(result["200"].content).toBeDefined();
    });

    it("maps status codes from record config", () => {
      const result = buildResponseDefs({
        200: z.object({ data: z.string() }),
        404: z.object({ error: z.string() }),
      });
      expect(result["200"].description).toBe("Status 200");
      expect(result["404"].description).toBe("Status 404");
    });
  });
});

describe("registerEndpoint", () => {
  const mockHandler = vi.fn();

  it("returns endpoint unchanged when no openapi config", () => {
    const registry = new OpenAPIRegistry();
    const endpoint = createMockEndpoint({
      handler: mockHandler,
      method: "get",
      path: "/test",
    });

    expect(registerEndpoint(endpoint, "/api", registry)).toBe(endpoint);
    expect(registry.definitions).toHaveLength(0);
  });

  it("registers path and returns endpoint unchanged", () => {
    const registry = new OpenAPIRegistry();
    const endpoint = createMockEndpoint({
      custom: {
        openapi: { query: z.object({ q: z.string() }), summary: "Test" },
      },
      handler: mockHandler,
      method: "get",
      path: "/test",
    });

    const result = registerEndpoint(endpoint, "/api", registry);

    expect(registry.definitions).toHaveLength(1);
    expect(findRouteByPath(registry.definitions, "/api/test")).toBeDefined();
    expect(result.handler).toBe(mockHandler);
  });

  it("registers path for endpoints with metadata only (no schemas)", () => {
    const registry = new OpenAPIRegistry();
    const endpoint = createMockEndpoint({
      custom: { openapi: { summary: "Test" } },
      handler: mockHandler,
      method: "get",
      path: "/test",
    });

    const result = registerEndpoint(endpoint, "/api", registry);

    expect(registry.definitions).toHaveLength(1);
    expect(result.handler).toBe(mockHandler);
  });

  it("converts path params to OpenAPI format in registry", () => {
    const registry = new OpenAPIRegistry();
    registerEndpoint(
      createMockEndpoint({
        custom: { openapi: { summary: "Nested" } },
        handler: mockHandler,
        method: "get",
        path: "/:parentId/children/:childId",
      }),
      "/api/resources",
      registry,
    );

    expect(
      findRouteByPath(
        registry.definitions,
        "/api/resources/{parentId}/children/{childId}",
      ),
    ).toBeDefined();
  });

  it("logs error and skips unsupported connect method", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const registry = new OpenAPIRegistry();
    const endpoint = createMockEndpoint({
      custom: { openapi: { summary: "Connect" } },
      handler: mockHandler,
      method: "connect",
      path: "/test",
    });

    expect(registerEndpoint(endpoint, "/api", registry)).toBe(endpoint);
    expect(spy).toHaveBeenCalledWith("unsupported openapi method type connect");
    spy.mockRestore();
  });
});

describe("registerEndpoints", () => {
  const mockHandler = vi.fn();

  it("returns undefined for undefined or false", () => {
    const registry = new OpenAPIRegistry();
    expect(registerEndpoints(undefined, "/api", registry)).toBeUndefined();
    expect(registerEndpoints(false, "/api", registry)).toBeUndefined();
  });

  it("registers only endpoints with openapi config", () => {
    const registry = new OpenAPIRegistry();
    const endpoints: Endpoint[] = [
      createMockEndpoint({
        custom: {
          openapi: { params: z.object({ id: z.string() }), summary: "Doc" },
        },
        handler: mockHandler,
        method: "get",
        path: "/doc",
      }),
      createMockEndpoint({
        handler: mockHandler,
        method: "get",
        path: "/plain",
      }),
    ];

    const result = registerEndpoints(endpoints, "/api", registry);

    expect(result).toHaveLength(2);
    expect(registry.definitions).toHaveLength(1);
    expect(result?.[0].handler).toBe(mockHandler); // unchanged
    expect(result?.[1].handler).toBe(mockHandler); // unchanged
  });
});
