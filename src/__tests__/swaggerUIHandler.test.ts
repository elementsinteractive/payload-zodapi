import "../testHelpers.js";
import { createDocsHandler } from "../handlers/swaggerUIHandler.js";
import { createMockRequest } from "../testHelpers.js";

// Mock the access utility
vi.mock("../utils/access.js", () => ({
  specAccessResponse: vi.fn().mockResolvedValue(undefined),
}));

import { specAccessResponse } from "../utils/access.js";

const mockedAccess = vi.mocked(specAccessResponse);

const mockReq = () =>
  createMockRequest({
    protocol: "https" as never,
    headers: new Headers({ host: "example.com" }),
  });

describe("createDocsHandler", () => {
  beforeEach(() => mockedAccess.mockResolvedValue(undefined));

  it("returns HTML containing Swagger UI bundle", async () => {
    const handler = createDocsHandler({ specPath: "/api/openapi.json" });
    const res = await handler(mockReq());

    expect(res.headers.get("content-type")).toBe("text/html");
    const body = await res.text();
    expect(body).toContain("swagger-ui");
    expect(body).toContain("SwaggerUIBundle");
  });

  it("uses the configured spec path in the HTML", async () => {
    const handler = createDocsHandler({
      specPath: "/custom/openapi.json",
    });
    const res = await handler(mockReq());
    const body = await res.text();

    expect(body).toContain("'/custom/openapi.json'");
  });

  it("does not include request host in the spec URL", async () => {
    const handler = createDocsHandler({ specPath: "/api/openapi.json" });
    const res = await handler(mockReq());
    const body = await res.text();

    expect(body).not.toContain("example.com");
  });

  it("delegates to specAccessResponse for access control", async () => {
    const mockAccessResponse = new Response(null, { status: 302 });
    mockedAccess.mockResolvedValueOnce(mockAccessResponse);

    const accessFn = vi.fn();
    const handler = createDocsHandler({
      specPath: "/api/openapi.json",
      readAccess: accessFn,
    });
    const req = mockReq();
    const res = await handler(req);

    expect(res).toBe(mockAccessResponse);
    expect(mockedAccess).toHaveBeenCalledWith(req, accessFn);
  });
});
