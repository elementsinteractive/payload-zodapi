import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import type { Config, Endpoint } from "payload";
import {
  DEFAULT_SCHEMAS_PATH,
  script as generateSchemas,
} from "./bin/generate-schemas";
import { registerPayloadDefaults } from "./endpoints";
import { createSpecHandler } from "./handlers/specHandler";
import { createDocsHandler } from "./handlers/swaggerUIHandler";
import { registerEndpoints } from "./registry";
import type { OpenApiMetadata, SchemaPreProcessor, SpecAccess } from "./types";

export type ZodApiPluginConfig = {
  /** Path for the Swagger UI docs page. Set to `false` to disable. */
  docsEndpoint?: false | string;
  enabled?: boolean;
  metadata?: OpenApiMetadata;
  openapiVersion?: "3.0" | "3.1";
  readAccess?: SpecAccess;
  /** Additional pre-processors to apply to the JSON schema before Zod generation. */
  schemaPreProcessors?: SchemaPreProcessor[];
  /** Path at which to save the generated zod schemas */
  schemasPath?: string;
  specEndpoint?: string;
};

/**
 * Default configuration values for the plugin
 */
const DEFAULTS = {
  docsEndpointPath: "/docs",
  metadata: {
    title: "Payload API",
    version: "1.0.0",
  },
  openapiVersion: "3.0" as const,
  specEndpointPath: "/openapi.json",
};

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

/**
 * payload-zodapi plugin for Payload CMS
 *
 * Generates an OpenAPI spec from collection/global schemas and custom endpoint
 * definitions, and serves it at a configurable path.
 *
 * @example
 * ```ts
 * plugins: [
 *   zodApiPlugin({
 *     metadata: { title: "My API", version: "1.0.0" },
 *   }),
 * ]
 * ```
 */
export const zodApiPlugin =
  (options: ZodApiPluginConfig = {}) =>
  (config: Config): Config => {
    if (options.enabled === false) {
      return config;
    }

    const openapiVersion = options.openapiVersion ?? DEFAULTS.openapiVersion;
    const metadata = options.metadata ?? DEFAULTS.metadata;
    const specEndpointPath = options.specEndpoint ?? DEFAULTS.specEndpointPath;
    const apiPrefix = config.routes?.api ?? "/api";
    const docsEndpointPath = options.docsEndpoint ?? DEFAULTS.docsEndpointPath;
    const schemasPath = options.schemasPath ?? DEFAULT_SCHEMAS_PATH;

    // Forward plugin options to `custom` so the bin script can read them
    config.custom = {
      ...config.custom,
      zodApiPluginOpts: {
        ...config.custom?.zodApiPluginOpts,
        schemasPath,
        ...(options.schemaPreProcessors?.length
          ? { schemaPreProcessors: options.schemaPreProcessors }
          : {}),
      },
    };

    // Add script to generate zod schemas
    config.bin = [
      ...(config.bin ?? []),
      {
        key: "generate:schemas",
        scriptPath: path.resolve(dirname, "bin/generate-schemas.ts"),
      },
    ];

    // Create registry for endpoint and schema documentation
    const registry = new OpenAPIRegistry();

    // Register API key security scheme (Payload uses Authorization header)
    registry.registerComponent("securitySchemes", "ApiKey", {
      name: "Authorization",
      type: "apiKey",
      description:
        "Payload API key. Format: `<collection-slug> API-Key <key>` (e.g. `users API-Key abc123`)",
      in: "header",
    });

    // Register JWT bearer security scheme
    registry.registerComponent("securitySchemes", "Bearer", {
      type: "http",
      bearerFormat: "JWT",
      description: "JWT token obtained from the login endpoint.",
      scheme: "bearer",
    });

    // Register all custom endpoints (root, collections, globals)
    config.endpoints = registerEndpoints(config.endpoints, apiPrefix, registry);

    config.collections = config.collections?.map((collection) => ({
      ...collection,
      endpoints: registerEndpoints(
        collection.endpoints || undefined,
        `${apiPrefix}/${collection.slug}`,
        registry,
      ),
    }));

    config.globals = config.globals?.map((global) => ({
      ...global,
      endpoints: registerEndpoints(
        global.endpoints || undefined,
        `${apiPrefix}/globals/${global.slug}`,
        registry,
      ),
    }));

    // Promise that resolves once the registry is fully populated (after onInit).
    // The spec handler waits on this before generating the OpenAPI document.
    let resolveReady: () => void;
    const readyPromise = new Promise<void>((resolve) => {
      resolveReady = resolve;
    });

    // Snapshot config lists before they are consumed by Payload
    const collections = config.collections ?? [];
    const globals = config.globals ?? [];

    // Add the OpenAPI spec endpoint
    const specHandler = createSpecHandler(registry, {
      metadata,
      openapiVersion,
      readAccess: options.readAccess,
      readyPromise,
    });
    const specEndpoint: Endpoint = {
      handler: specHandler,
      method: "get",
      path: specEndpointPath,
    };
    config.endpoints = [...(config.endpoints ?? []), specEndpoint];

    // Add the Swagger UI docs endpoint
    if (docsEndpointPath !== false) {
      const docsHandler = createDocsHandler({
        readAccess: options.readAccess,
        specPath: `${apiPrefix}${specEndpointPath}`,
      });
      const docsEndpoint: Endpoint = {
        handler: docsHandler,
        method: "get",
        path: docsEndpointPath,
      };
      config.endpoints = [...config.endpoints, docsEndpoint];
    }

    // On init: generate schemas, then import them and register Payload's
    // built-in CRUD endpoints in the OpenAPI registry.
    const superOnInit = config.onInit;
    config.onInit = async (payload) => {
      await superOnInit?.(payload);

      try {
        if (process.env.NODE_ENV !== "production") {
          payload.logger.info(
            `[payload-zodapi] Generating zod schemas at "${schemasPath}"...`,
          );
          await generateSchemas(payload.config);
        }
        // Dynamically import the freshly-generated schemas file.
        // Bypass Turbopack's static import analysis via AsyncFunction.
        const absolutePath = path.resolve(process.cwd(), schemasPath);
        const AsyncFunction = Object.getPrototypeOf(async () => {})
          .constructor as new (
          ...args: string[]
        ) => (...args: unknown[]) => Promise<Record<string, unknown>>;
        const loadModule = new AsyncFunction(
          "specifier",
          "return await import(specifier)",
        );
        const schemasModule = await loadModule(
          pathToFileURL(absolutePath).href,
        );

        registerPayloadDefaults(collections, globals, apiPrefix, registry, {
          collectionsSchema: schemasModule.CollectionsSchema as Parameters<
            typeof registerPayloadDefaults
          >[4]["collectionsSchema"],
          globalsSchema: schemasModule.GlobalsSchema as Parameters<
            typeof registerPayloadDefaults
          >[4]["globalsSchema"],
        });
        payload.logger.info(
          `[payload-zodapi] zod schema generation succesful!`,
        );
      } catch (err) {
        payload.logger.error(
          `payload-zodapi: Could not import schemas from "${schemasPath}". ` +
            "Built-in collection/global endpoints will not appear in the OpenAPI spec.",
        );
        payload.logger.error(err);
      }

      resolveReady();
    };

    return config;
  };
