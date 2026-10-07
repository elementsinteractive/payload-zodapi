import { APIError } from "payload";

import { createMockRequest } from "../testHelpers.js";
import { specAccessResponse } from "../utils/access.js";

// Mock payload/shared to avoid pulling in the full Payload module tree
vi.mock("payload/shared", () => ({
  formatAdminURL: ({
    adminRoute,
    basePath,
    path,
  }: {
    adminRoute: string;
    basePath: string;
    path: string;
  }) => `${basePath}${adminRoute}${path}`,
}));

const mockReq = (user?: object) =>
  createMockRequest({
    headers: new Headers({ host: "example.com" }),
    payload: {
      getAdminURL: () => "http://example.com/admin",
    } as never,
    protocol: "https:" as never,
    t: ((key: string) => key) as never,
    user: user as never,
  });

describe("specAccessResponse", () => {
  it("returns undefined when no access function is provided", async () => {
    const result = await specAccessResponse(mockReq());
    expect(result).toBeUndefined();
  });

  it("returns undefined when access returns true", async () => {
    const access = vi.fn().mockReturnValue(true);
    const result = await specAccessResponse(mockReq({ id: "1" }), access);
    expect(result).toBeUndefined();
  });

  it("returns undefined when async access resolves true", async () => {
    const access = vi.fn().mockResolvedValue(true);
    const result = await specAccessResponse(mockReq({ id: "1" }), access);
    expect(result).toBeUndefined();
  });

  it("redirects to login when access returns false and no user", async () => {
    const access = vi.fn().mockReturnValue(false);
    const result = await specAccessResponse(mockReq(), access);

    expect(result).toBeDefined();
    expect(result?.status).toBe(302);
    expect(result?.headers.get("location")).toBe(
      "http://example.com/admin/login",
    );
  });

  it("throws 403 APIError when access returns false and user is present", async () => {
    const access = vi.fn().mockReturnValue(false);

    await expect(
      specAccessResponse(mockReq({ id: "1" }), access),
    ).rejects.toThrow(APIError);

    try {
      await specAccessResponse(mockReq({ id: "1" }), access);
    } catch (err) {
      expect((err as APIError).status).toBe(403);
    }
  });

  it("passes req to the access function", async () => {
    const access = vi.fn().mockReturnValue(true);
    const req = mockReq({ id: "1" });
    await specAccessResponse(req, access);

    expect(access).toHaveBeenCalledWith({ req });
  });
});
