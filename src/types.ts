import type { JSONSchema4 } from "json-schema";
import type { PayloadRequest } from "payload";
import type { z } from "zod";

export type AnyZodObject = z.ZodType;

type ExtractPathParams<T extends string> =
  T extends `${infer _}:${infer Param}/${infer Rest}`
    ? ExtractPathParams<Rest> | Param
    : T extends `${infer _}:${infer Param}`
      ? Param
      : never;

export type PathParams<T extends string> = [ExtractPathParams<T>] extends [
  never,
]
  ? Record<string, string | undefined>
  : { [K in ExtractPathParams<T>]: string };

/** Constrains a `params` Zod schema to only keys that exist as path params in `TPath` */
export type PathParamSchema<TPath extends string> = [
  ExtractPathParams<TPath>,
] extends [never]
  ? AnyZodObject
  : z.ZodObject<{ [K in ExtractPathParams<TPath>]: z.ZodTypeAny }>;

/** How response validation errors are handled */
export type ValidationMode = "enforce" | "log" | "off";

/** OpenAPI + validation config attached to an endpoint via `custom.openapi` */
export type EndpointOpenApiConfig = {
  body?: AnyZodObject;
  description?: string;
  params?: AnyZodObject;
  query?: AnyZodObject;
  response?: AnyZodObject | Record<number, AnyZodObject>;
  responseValidation?: ValidationMode;
  summary?: string;
  tags?: string[];
};

/** OpenAPI metadata for the spec */
export type OpenApiMetadata = {
  description?: string;
  title: string;
  version: string;
};

/** Typed input passed as the second argument to a `defineEndpoint` handler */
export type ValidatedInput<
  TParams extends AnyZodObject | undefined = undefined,
  TQuery extends AnyZodObject | undefined = undefined,
  TBody extends AnyZodObject | undefined = undefined,
  TPath extends string = string,
> = {
  body: TBody extends AnyZodObject ? z.infer<TBody> : undefined;
  pathParams: TParams extends AnyZodObject
    ? z.infer<TParams>
    : PathParams<TPath>;
  queryParams: TQuery extends AnyZodObject
    ? z.infer<TQuery>
    : Record<string, unknown>;
};

export type SpecAccess = (args: {
  req: PayloadRequest;
}) => boolean | Promise<boolean>;

/** A function that transforms a JSON schema before it is fed to quicktype. */
export type SchemaPreProcessor = (schema: JSONSchema4) => JSONSchema4;
