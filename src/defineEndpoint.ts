import type { Endpoint, PayloadHandler, PayloadRequest } from "payload";

import { z } from "zod";

import type {
  AnyZodObject,
  EndpointOpenApiConfig,
  PathParamSchema,
  ValidatedInput,
  ValidationMode,
} from "./types";

export type { PathParams } from "./types";

/**
 * Wraps a Zod schema to accept a query param that may appear multiple times.
 *
 * A repeated key like `?tag=a&tag=b` is parsed by Next.js as `string[]`,
 * while a single `?tag=a` produces a plain `string`. This helper normalises
 * both cases into `T[]` so your schema always receives an array.
 *
 * @example
 * ```ts
 * query: z.object({
 *   tag: queryArray(z.string()),   // string[]  — works for ?tag=a&tag=b
 *   page: z.string(),              // string    — ordinary single value
 * })
 * ```
 */
export const queryArray = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess(
    (val) => (Array.isArray(val) ? val : val !== undefined ? [val] : []),
    z.array(schema),
  );

/**
 * Defines a Payload endpoint with typed params/query/body and OpenAPI metadata.
 *
 * Path params and query are always validated (400 on failure).
 * Response validation is controlled by `responseValidation` (enforce | log | off).
 *
 * @example
 * ```ts
 * defineEndpoint({
 *   path: "/:id",
 *   method: "get",
 *   openapi: {
 *     summary: "Get item by ID",
 *     params: z.object({ id: z.string().uuid() }),
 *     query: z.object({ include: z.string().optional() }),
 *   },
 *   handler: async (req, { pathParams, queryParams }) => {
 *     const { id } = pathParams;
 *     return Response.json({ id });
 *   },
 * });
 * ```
 */
export function defineEndpoint<
  TPath extends string,
  TParams extends PathParamSchema<TPath> | undefined = undefined,
  TQuery extends AnyZodObject | undefined = undefined,
  TBody extends AnyZodObject | undefined = undefined,
>(config: {
  handler: (
    req: PayloadRequest,
    input: ValidatedInput<TParams, TQuery, TBody, TPath>,
  ) => Promise<Response> | Response;
  method: Endpoint["method"];
  openapi?: {
    body?: TBody;
    params?: TParams;
    query?: TQuery;
  } & Omit<EndpointOpenApiConfig, "body" | "params" | "query">;
  path: TPath;
}): Endpoint {
  const { handler, openapi, ...rest } = config;

  return {
    ...rest,
    custom: openapi ? { openapi: openapi as EndpointOpenApiConfig } : undefined,
    handler: createHandler(handler, openapi),
  };
}

/** Wraps a typed handler with request parsing and response validation. */
function createHandler<
  TParams extends AnyZodObject | undefined,
  TQuery extends AnyZodObject | undefined,
  TBody extends AnyZodObject | undefined,
>(
  handler: (
    req: PayloadRequest,
    input: ValidatedInput<TParams, TQuery, TBody>,
  ) => Promise<Response> | Response,
  openapi?: {
    body?: TBody;
    params?: TParams;
    query?: TQuery;
    response?: AnyZodObject | Record<number, AnyZodObject>;
    responseValidation?: ValidationMode;
  },
): PayloadHandler {
  const resMode: ValidationMode = openapi?.responseValidation ?? "enforce";

  return async (req) => {
    // ── Request validation (always enforced: 400 on failure) ───────────
    let input: ValidatedInput<TParams, TQuery, TBody>;
    try {
      const pathParams = openapi?.params
        ? await openapi.params.parseAsync(req.routeParams)
        : (req.routeParams ?? {});

      const queryParams = openapi?.query
        ? await openapi.query.parseAsync(req.query)
        : (req.query ?? {});

      const body =
        openapi?.body && req.data
          ? await openapi.body.parseAsync(req.data)
          : undefined;

      input = { body, pathParams, queryParams } as ValidatedInput<
        TParams,
        TQuery,
        TBody
      >;
    } catch (err) {
      if (err instanceof z.ZodError) {
        return Response.json(
          { details: err.issues, error: "Validation Failed" },
          { status: 400 },
        );
      }
      throw err;
    }

    // ── Call handler ─────────────────────────────────────────────────
    const response = await handler(req, input);

    // ── Response validation ──────────────────────────────────────────
    if (openapi?.response && response.ok && resMode !== "off") {
      return validateResponse(req, response, openapi.response, resMode);
    }

    return response;
  };
}

/** Validates a response body against the configured schema. */
async function validateResponse(
  req: PayloadRequest,
  response: Response,
  responseConfig: AnyZodObject | Record<number, AnyZodObject>,
  mode: Exclude<ValidationMode, "off">,
): Promise<Response> {
  const schema =
    responseConfig instanceof z.ZodObject
      ? responseConfig
      : responseConfig[response.status];

  if (!schema) {return response;}

  const data = await response.clone().json();
  const result = schema.safeParse(data);

  if (!result.success) {
    if (mode === "enforce") {
      req.payload.logger.error({
        errors: z.treeifyError(result.error),
        msg: "Response validation failed",
      });
      return Response.json({ error: "Something went wrong" }, { status: 500 });
    }
    req.payload.logger.warn({
      errors: z.treeifyError(result.error),
      msg: "Response validation failed",
    });
  }

  return response;
}
