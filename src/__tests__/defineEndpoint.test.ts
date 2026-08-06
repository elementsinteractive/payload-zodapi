import { z } from "zod";

import { defineEndpoint, queryArray } from "../defineEndpoint";
import { createMockRequest } from "../testHelpers";

describe("defineEndpoint", () => {
  it("creates a basic endpoint without openapi config", () => {
    const endpoint = defineEndpoint({
      handler: vi.fn(),
      method: "get",
      path: "/test",
    });

    expect(endpoint.path).toBe("/test");
    expect(endpoint.method).toBe("get");
    expect(endpoint.custom).toBeUndefined();
  });

  it("attaches openapi metadata to custom.openapi", () => {
    const endpoint = defineEndpoint({
      handler: vi.fn(),
      method: "post",
      openapi: {
        description: "Creates a new item",
        summary: "Create item",
        tags: ["items"],
      },
      path: "/items",
    });

    expect(endpoint.custom?.openapi).toMatchObject({
      description: "Creates a new item",
      summary: "Create item",
      tags: ["items"],
    });
  });

  it("includes params, query, body, and response schemas", () => {
    const params = z.object({ id: z.string() });
    const query = z.object({ include: z.string().optional() });
    const body = z.object({ name: z.string() });
    const response = z.object({ id: z.string(), name: z.string() });

    const endpoint = defineEndpoint({
      handler: vi.fn(),
      method: "put",
      openapi: { body, params, query, response, summary: "Update item" },
      path: "/:id",
    });

    expect(endpoint.custom?.openapi?.params).toBe(params);
    expect(endpoint.custom?.openapi?.query).toBe(query);
    expect(endpoint.custom?.openapi?.body).toBe(body);
    expect(endpoint.custom?.openapi?.response).toBe(response);
  });

  it("supports response schema map by status code", () => {
    const success = z.object({ id: z.string() });
    const error = z.object({ error: z.string() });

    const endpoint = defineEndpoint({
      handler: vi.fn(),
      method: "post",
      openapi: { response: { 201: success, 400: error }, summary: "Create" },
      path: "/items",
    });

    const response = endpoint.custom?.openapi?.response as Record<
      number,
      z.ZodObject<z.ZodRawShape>
    >;
    expect(response[201]).toBe(success);
    expect(response[400]).toBe(error);
  });

  describe("path param inference", () => {
    it("parses params from the path string when no params schema is given", async () => {
      const handlerFn = vi.fn().mockResolvedValue(Response.json({ ok: true }));
      const endpoint = defineEndpoint({
        handler: handlerFn,
        method: "get",
        path: "/assets/:tenantId/:platform",
      });

      const req = createMockRequest({
        routeParams: { platform: "ios", tenantId: "tenant-1" },
      });
      await endpoint.handler(req);

      expect(handlerFn).toHaveBeenCalledWith(
        req,
        expect.objectContaining({
          pathParams: { platform: "ios", tenantId: "tenant-1" },
        }),
      );
    });

    it("passes through all route params from the request", async () => {
      const handlerFn = vi.fn().mockResolvedValue(Response.json({ ok: true }));
      const endpoint = defineEndpoint({
        handler: handlerFn,
        method: "get",
        path: "/:id",
      });

      const req = createMockRequest({
        routeParams: { id: "42", extra: "also-present" },
      });
      await endpoint.handler(req);

      expect(handlerFn).toHaveBeenCalledWith(
        req,
        expect.objectContaining({
          pathParams: { id: "42", extra: "also-present" },
        }),
      );
    });

    it("passes empty pathParams for a path with no params", async () => {
      const handlerFn = vi.fn().mockResolvedValue(Response.json({ ok: true }));
      const endpoint = defineEndpoint({
        handler: handlerFn,
        method: "get",
        path: "/items",
      });

      const req = createMockRequest({ routeParams: {} });
      await endpoint.handler(req);

      expect(handlerFn).toHaveBeenCalledWith(
        req,
        expect.objectContaining({ pathParams: {} }),
      );
    });

    it("uses explicit params schema over the inferred one", async () => {
      const handlerFn = vi.fn().mockResolvedValue(Response.json({ ok: true }));
      const endpoint = defineEndpoint({
        handler: handlerFn,
        method: "get",
        openapi: { params: z.object({ id: z.string().uuid() }) },
        path: "/:id",
      });

      const req = createMockRequest({ routeParams: { id: "not-uuid" } });
      const response = await endpoint.handler(req);

      expect(response.status).toBe(400);
    });
  });

  describe("guards", () => {
    it("does not run validation if the guard fails", async () => {
      const guard = vi.fn().mockImplementation((req) => {
        if (!req.user) {
          return Response.json({ error: "Not authenticated" }, { status: 401 });
        }
      });
      const handlerFn = vi.fn().mockResolvedValue(Response.json({ ok: true }));

      const endpoint = defineEndpoint({
        guards: [guard],
        handler: handlerFn,
        method: "post",
        openapi: { body: z.object({ name: z.string() }) },
        path: "/items",
      });

      const req = createMockRequest({
        data: { notName: "Test Item" },
        user: null,
      });
      const response = await endpoint.handler(req);

      expect(response.status).toBe(401);
      expect(await response.json()).toMatchObject({
        error: "Not authenticated",
      });

      expect(guard).toHaveBeenCalled();
      expect(handlerFn).not.toHaveBeenCalled();
    });

    it("runs multiple guards in order and stops on the first failure", async () => {
      const guard1 = vi.fn().mockResolvedValue(undefined);
      const guard2 = vi.fn().mockImplementation((req) => {
        if (!req.user) {
          return Response.json({ error: "Not authenticated" }, { status: 401 });
        }
      });
      const guard3 = vi.fn().mockResolvedValue(undefined);
      const handlerFn = vi.fn().mockResolvedValue(Response.json({ ok: true }));

      const endpoint = defineEndpoint({
        guards: [guard1, guard2, guard3],
        handler: handlerFn,
        method: "post",
        openapi: { body: z.object({ name: z.string() }) },
        path: "/items",
      });

      const req = createMockRequest({
        data: { notName: "Test Item" },
        user: null,
      });
      const response = await endpoint.handler(req);

      expect(response.status).toBe(401);
      expect(await response.json()).toMatchObject({
        error: "Not authenticated",
      });

      expect(guard1).toHaveBeenCalled();
      expect(guard2).toHaveBeenCalled();
      expect(guard3).not.toHaveBeenCalled();
      expect(handlerFn).not.toHaveBeenCalled();
    });

    it("runs the handler if all guards pass", async () => {
      const guard1 = vi.fn().mockResolvedValue(undefined);
      const guard2 = vi.fn().mockResolvedValue(undefined);
      const handlerFn = vi.fn().mockResolvedValue(Response.json({ ok: true }));

      const endpoint = defineEndpoint({
        guards: [guard1, guard2],
        handler: handlerFn,
        method: "post",
        openapi: { body: z.object({ name: z.string() }) },
        path: "/items",
      });

      const req = createMockRequest({ data: { name: "Test Item" } });
      const response = await endpoint.handler(req);

      expect(response.status).toBe(200);
      expect(guard1).toHaveBeenCalled();
      expect(guard2).toHaveBeenCalled();
      expect(handlerFn).toHaveBeenCalled();
    });
  });

  describe("body validation", () => {
    it("returns 200 for valid body", async () => {
      const handlerFn = vi.fn().mockResolvedValue(Response.json({ ok: true }));
      const endpoint = defineEndpoint({
        handler: handlerFn,
        method: "post",
        openapi: { body: z.object({ name: z.string() }) },
        path: "/items",
      });

      const req = createMockRequest({
        data: { name: "Test Item" },
      });
      const response = await endpoint.handler(req);

      expect(response.status).toBe(200);
    });

    it("returns 400 for invalid body", async () => {
      const handlerFn = vi.fn().mockResolvedValue(Response.json({ ok: true }));
      const endpoint = defineEndpoint({
        handler: handlerFn,
        method: "post",
        openapi: { body: z.object({ name: z.string() }) },
        path: "/items",
      });

      const req = createMockRequest({
        data: { notName: "Test Item" },
      });
      const response = await endpoint.handler(req);

      expect(response.status).toBe(400);
    });

    it("can handle empty body", async () => {
      const handlerFn = vi.fn().mockResolvedValue(Response.json({ ok: true }));
      const endpoint = defineEndpoint({
        handler: handlerFn,
        method: "post",
        openapi: { body: z.object({ name: z.string() }) },
        path: "/items",
      });

      const req = createMockRequest({ data: undefined });
      const response = await endpoint.handler(req);

      expect(response.status).toBe(400);
    });
  });

  describe("param validation", () => {
    it("passes parsed pathParams to handler", async () => {
      const handlerFn = vi.fn().mockResolvedValue(Response.json({ ok: true }));
      const endpoint = defineEndpoint({
        handler: handlerFn,
        method: "get",
        openapi: { params: z.object({ id: z.string() }) },
        path: "/:id",
      });

      const req = createMockRequest({ routeParams: { id: "123" } });
      await endpoint.handler(req);

      expect(handlerFn).toHaveBeenCalledWith(
        req,
        expect.objectContaining({ pathParams: { id: "123" } }),
      );
    });

    it("returns 400 on invalid params", async () => {
      const endpoint = defineEndpoint({
        handler: vi.fn(),
        method: "get",
        openapi: { params: z.object({ id: z.string().uuid() }) },
        path: "/:id",
      });

      const req = createMockRequest({ routeParams: { id: "not-uuid" } });
      const response = await endpoint.handler(req);

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        error: "Validation Failed",
      });
    });
  });

  describe("query validation", () => {
    it("passes parsed queryParams to handler", async () => {
      const handlerFn = vi.fn().mockResolvedValue(Response.json({ ok: true }));
      const endpoint = defineEndpoint({
        handler: handlerFn,
        method: "get",
        openapi: { query: z.object({ page: z.string() }) },
        path: "/items",
      });

      const req = createMockRequest({ query: { page: "1" } });
      await endpoint.handler(req);

      expect(handlerFn).toHaveBeenCalledWith(
        req,
        expect.objectContaining({ queryParams: { page: "1" } }),
      );
    });

    it("applies zod defaults", async () => {
      const handlerFn = vi.fn().mockResolvedValue(Response.json({ ok: true }));
      const endpoint = defineEndpoint({
        handler: handlerFn,
        method: "get",
        openapi: {
          query: z.object({
            limit: z.string().default("20"),
            page: z.string().default("1"),
          }),
        },
        path: "/items",
      });

      const req = createMockRequest({ query: {} });
      await endpoint.handler(req);

      expect(handlerFn).toHaveBeenCalledWith(
        req,
        expect.objectContaining({ queryParams: { limit: "20", page: "1" } }),
      );
    });

    it("strips extra query params (zod default)", async () => {
      const handlerFn = vi.fn().mockResolvedValue(Response.json({ ok: true }));
      const endpoint = defineEndpoint({
        handler: handlerFn,
        method: "get",
        openapi: { query: z.object({ page: z.string() }) },
        path: "/items",
      });

      const req = createMockRequest({ query: { extra: "ignored", page: "1" } });
      await endpoint.handler(req);

      expect(handlerFn).toHaveBeenCalledWith(
        req,
        expect.objectContaining({ queryParams: { page: "1" } }),
      );
    });

    it("returns 400 on invalid query", async () => {
      const endpoint = defineEndpoint({
        handler: vi.fn(),
        method: "get",
        openapi: { query: z.object({ page: z.coerce.number().positive() }) },
        path: "/items",
      });

      const req = createMockRequest({ query: { page: "invalid" } });
      const response = await endpoint.handler(req);

      expect(response.status).toBe(400);
    });
  });

  describe("queryArray", () => {
    it("wraps a single string value in an array", () => {
      const schema = queryArray(z.string());
      expect(schema.parse("hello")).toEqual(["hello"]);
    });

    it("passes an existing array through", () => {
      const schema = queryArray(z.string());
      expect(schema.parse(["a", "b"])).toEqual(["a", "b"]);
    });

    it("returns an empty array for undefined", () => {
      const schema = queryArray(z.string());
      expect(schema.parse(undefined)).toEqual([]);
    });

    it("validates each element in the array", () => {
      const schema = queryArray(z.string().uuid());
      expect(() => schema.parse(["not-a-uuid"])).toThrow();
    });

    it("delivers multi-value params as an array in the handler", async () => {
      const handlerFn = vi.fn().mockResolvedValue(Response.json({ ok: true }));
      const endpoint = defineEndpoint({
        handler: handlerFn,
        method: "get",
        openapi: {
          query: z.object({ tag: queryArray(z.string()) }),
        },
        path: "/items",
      });

      const req = createMockRequest({ query: { tag: ["a", "b"] } });
      await endpoint.handler(req);

      expect(handlerFn).toHaveBeenCalledWith(
        req,
        expect.objectContaining({ queryParams: { tag: ["a", "b"] } }),
      );
    });

    it("normalises a single string query value into an array in the handler", async () => {
      const handlerFn = vi.fn().mockResolvedValue(Response.json({ ok: true }));
      const endpoint = defineEndpoint({
        handler: handlerFn,
        method: "get",
        openapi: {
          query: z.object({ tag: queryArray(z.string()) }),
        },
        path: "/items",
      });

      const req = createMockRequest({ query: { tag: "solo" } });
      await endpoint.handler(req);

      expect(handlerFn).toHaveBeenCalledWith(
        req,
        expect.objectContaining({ queryParams: { tag: ["solo"] } }),
      );
    });
  });

  describe("response validation", () => {
    const responseSchema = z.object({ id: z.string() });

    it("enforce (default): returns 500 on invalid response", async () => {
      const endpoint = defineEndpoint({
        handler: () => Response.json({ unexpected: true }),
        method: "get",
        openapi: { response: responseSchema },
        path: "/items",
      });

      const req = createMockRequest();
      const response = await endpoint.handler(req);

      expect(response.status).toBe(500);
      expect(req.payload.logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ msg: "Response validation failed" }),
      );
    });

    it("log: warns but returns original response", async () => {
      const endpoint = defineEndpoint({
        handler: () => Response.json({ unexpected: true }),
        method: "get",
        openapi: { response: responseSchema, responseValidation: "log" },
        path: "/items",
      });

      const req = createMockRequest();
      const response = await endpoint.handler(req);

      expect(response.status).toBe(200);
      expect(req.payload.logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ msg: "Response validation failed" }),
      );
    });

    it("off: returns response without validating", async () => {
      const endpoint = defineEndpoint({
        handler: () => Response.json({ unexpected: true }),
        method: "get",
        openapi: { response: responseSchema, responseValidation: "off" },
        path: "/items",
      });

      const req = createMockRequest();
      const response = await endpoint.handler(req);

      expect(response.status).toBe(200);
      expect(req.payload.logger.error).not.toHaveBeenCalled();
      expect(req.payload.logger.warn).not.toHaveBeenCalled();
    });
  });

  it("falls back to raw req values when no openapi config", async () => {
    const handlerFn = vi.fn().mockResolvedValue(Response.json({ ok: true }));
    const endpoint = defineEndpoint({
      handler: handlerFn,
      method: "get",
      path: "/:id",
    });

    const req = createMockRequest({
      query: { q: "test" },
      routeParams: { id: "99" },
    });
    await endpoint.handler(req);

    expect(handlerFn).toHaveBeenCalledWith(req, {
      body: undefined,
      pathParams: { id: "99" },
      queryParams: { q: "test" },
    });
  });

  it("passes through non-Zod errors", async () => {
    const endpoint = defineEndpoint({
      handler: () => {
        throw new Error("Database error");
      },
      method: "get",
      openapi: { params: z.object({ id: z.string() }) },
      path: "/:id",
    });

    await expect(
      endpoint.handler(createMockRequest({ routeParams: { id: "1" } })),
    ).rejects.toThrow("Database error");
  });
});
