import { createDocsHandler } from "../handlers/swaggerUIHandler";
import { createMockRequest } from "../testHelpers";

// Mock the access utility
jest.mock("../utils/access", () => ({
  specAccessResponse: jest.fn().mockResolvedValue(undefined),
}));

import { specAccessResponse } from "../utils/access";

const mockedAccess = specAccessResponse as jest.MockedFunction<
  typeof specAccessResponse
>;

const mockReq = () =>
  createMockRequest({
    headers: new Headers({ host: "example.com" }),
    protocol: "https" as never,
  });

describe("createDocsHandler", () => {
  beforeEach(() => mockedAccess.mockResolvedValue(undefined));

  it("returns HTML containing Swagger UI bundle", async () => {
    const handler = createDocsHandler({ specPath: "/api/openapi.json" });
    const res = await handler(mockReq());

    expect(res.headers.get("content-type")).toBe("text/html");
    const body = (res as unknown as { _data: string })._data;
    expect(body).toContain("swagger-ui");
    expect(body).toContain("SwaggerUIBundle");
  });

  it("uses the configured spec path in the HTML", async () => {
    const handler = createDocsHandler({
      specPath: "/custom/openapi.json",
    });
    const res = await handler(mockReq());
    const body = (res as unknown as { _data: string })._data;

    expect(body).toContain("'/custom/openapi.json'");
  });

  it("does not include request host in the spec URL", async () => {
    const handler = createDocsHandler({ specPath: "/api/openapi.json" });
    const res = await handler(mockReq());
    const body = (res as unknown as { _data: string })._data;

    expect(body).not.toContain("example.com");
  });

  it("delegates to specAccessResponse for access control", async () => {
    const mockAccessResponse = new Response(null, { status: 302 });
    mockedAccess.mockResolvedValueOnce(mockAccessResponse);

    const accessFn = jest.fn();
    const handler = createDocsHandler({
      readAccess: accessFn,
      specPath: "/api/openapi.json",
    });
    const req = mockReq();
    const res = await handler(req);

    expect(res).toBe(mockAccessResponse);
    expect(mockedAccess).toHaveBeenCalledWith(req, accessFn);
  });
});
