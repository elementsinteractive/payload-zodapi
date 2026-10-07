import type { Config, Endpoint, Payload } from "payload";

import "../testHelpers.js";

import { CollectionsSchema, GlobalsSchema } from "@/payload-schemas";

import { zodApiPlugin } from "../plugin.js";
import { createMockRequest } from "../testHelpers.js";

const createConfig = (): Config =>
  ({
    collections: [{ fields: [], slug: "posts" }],
    globals: [],
  }) as unknown as Config;

const getSpecHandler = (config: Config) => {
  const endpoint = (config.endpoints as Endpoint[]).find(
    (e) => e.path === "/openapi.json",
  );
  if (!endpoint) {
    throw new Error("spec endpoint not registered");
  }
  return endpoint.handler;
};

const fetchSpecPaths = async (config: Config) => {
  const response = await getSpecHandler(config)(createMockRequest());
  const spec = (await response.json()) as { paths: Record<string, unknown> };
  return Object.keys(spec.paths);
};

describe("zodApiPlugin", () => {
  const schemas = vi.fn(async () => ({ CollectionsSchema, GlobalsSchema }));

  beforeEach(() => {
    schemas.mockClear();
  });

  it("registers built-in endpoints in the spec when onInit never ran", async () => {
    // Payload skips onInit when retrying after a failed init
    const config = zodApiPlugin({ schemas })(createConfig());

    const paths = await fetchSpecPaths(config);

    expect(paths).toContain("/api/posts");
    expect(paths).toContain("/api/posts/{id}");
    expect(schemas).toHaveBeenCalledOnce();
  });

  it("loads the schemas only once when onInit ran", async () => {
    vi.stubEnv("NODE_ENV", "production"); // skip schema generation
    const config = zodApiPlugin({ schemas })(createConfig());
    const payload = createMockRequest().payload as unknown as Payload;

    await config.onInit?.(payload);
    const paths = await fetchSpecPaths(config);

    expect(paths).toContain("/api/posts");
    expect(schemas).toHaveBeenCalledOnce();
    vi.unstubAllEnvs();
  });
});
