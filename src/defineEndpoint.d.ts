import type { Endpoint, PayloadRequest } from "payload";
import { z } from "zod";
import type {
  AnyZodObject,
  EndpointOpenApiConfig,
  PathParamSchema,
  ValidatedInput,
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
export declare const queryArray: <T extends z.ZodTypeAny>(
  schema: T,
) => z.ZodPipe<z.ZodTransform<any[], unknown>, z.ZodArray<T>>;
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
 *  guards: [async (req) => {
 *    if (!req.user) {
 *       return Response.json({ error: "Not authenticated" }, { status: 401 });
 *     }
 *   }],
 *   handler: async (req, { pathParams, queryParams }) => {
 *     const { id } = pathParams;
 *     return Response.json({ id });
 *   },
 * });
 * ```
 */
export declare function defineEndpoint<
  TPath extends string,
  TParams extends PathParamSchema<TPath> | undefined = undefined,
  TQuery extends AnyZodObject | undefined = undefined,
  TBody extends AnyZodObject | undefined = undefined,
>(config: {
  guards?: ((req: PayloadRequest) => Promise<Response | undefined>)[];
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
}): Endpoint;
