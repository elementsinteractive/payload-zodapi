import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
export declare const baseQueryParams: z.ZodObject<
  {
    depth: z.ZodOptional<z.ZodNumber>;
    "fallback-locale": z.ZodOptional<z.ZodString>;
    locale: z.ZodOptional<z.ZodString>;
  },
  z.core.$strip
>;
export declare const paginationQueryParams: z.ZodObject<
  {
    depth: z.ZodOptional<z.ZodNumber>;
    "fallback-locale": z.ZodOptional<z.ZodString>;
    locale: z.ZodOptional<z.ZodString>;
    limit: z.ZodOptional<z.ZodNumber>;
    page: z.ZodOptional<z.ZodNumber>;
    sort: z.ZodOptional<z.ZodString>;
    where: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
  },
  z.core.$strip
>;
/** Wraps a doc schema in Payload's standard paginated response envelope. */
export declare const paginatedResponse: (
  docSchema: z.ZodTypeAny,
) => z.ZodObject<
  {
    docs: z.ZodArray<
      z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>
    >;
    hasNextPage: z.ZodBoolean;
    hasPrevPage: z.ZodBoolean;
    limit: z.ZodNumber;
    nextPage: z.ZodNullable<z.ZodNumber>;
    page: z.ZodNumber;
    pagingCounter: z.ZodNumber;
    prevPage: z.ZodNullable<z.ZodNumber>;
    totalDocs: z.ZodNumber;
    totalPages: z.ZodNumber;
  },
  z.core.$strip
>;
/** Wraps a doc schema in Payload's single-doc mutation response envelope. */
export declare const mutationResponse: (docSchema: z.ZodTypeAny) => z.ZodObject<
  {
    doc: z.ZodType<
      unknown,
      unknown,
      z.core.$ZodTypeInternals<unknown, unknown>
    >;
    message: z.ZodString;
  },
  z.core.$strip
>;
/** Payload's bulk operation response envelope. */
export declare const bulkResponse: (docSchema: z.ZodTypeAny) => z.ZodObject<
  {
    docs: z.ZodArray<
      z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>
    >;
    errors: z.ZodArray<
      z.ZodObject<
        {
          id: z.ZodOptional<z.ZodString>;
          message: z.ZodString;
        },
        z.core.$strip
      >
    >;
  },
  z.core.$strip
>;
/** Wraps a doc in Payload's version envelope. */
export declare const versionResponse: (docSchema: z.ZodTypeAny) => z.ZodObject<
  {
    id: z.ZodString;
    createdAt: z.ZodString;
    parent: z.ZodString;
    updatedAt: z.ZodString;
    version: z.ZodType<
      unknown,
      unknown,
      z.core.$ZodTypeInternals<unknown, unknown>
    >;
  },
  z.core.$strip
>;
/** Strips whitespace from a label for use as an OpenAPI ref ID. */
export declare const toRefId: (label: string) => string;
/**
 * Registers the base schema and its derived variants (paginated, mutation, etc.)
 * in the OpenAPI registry under `components/schemas`.
 *
 * Returns the registered schemas so paths can reference them as `$ref`.
 */
export declare function registerSchemas(
  registry: OpenAPIRegistry,
  refId: string,
  schema: z.ZodObject<z.ZodRawShape>,
): {
  base: z.ZodObject<
    Readonly<{
      [k: string]: z.core.$ZodType<
        unknown,
        unknown,
        z.core.$ZodTypeInternals<unknown, unknown>
      >;
    }>,
    z.core.$strip
  >;
  list: z.ZodObject<
    {
      docs: z.ZodArray<
        z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>
      >;
      hasNextPage: z.ZodBoolean;
      hasPrevPage: z.ZodBoolean;
      limit: z.ZodNumber;
      nextPage: z.ZodNullable<z.ZodNumber>;
      page: z.ZodNumber;
      pagingCounter: z.ZodNumber;
      prevPage: z.ZodNullable<z.ZodNumber>;
      totalDocs: z.ZodNumber;
      totalPages: z.ZodNumber;
    },
    z.core.$strip
  >;
  mutation: z.ZodObject<
    {
      doc: z.ZodType<
        unknown,
        unknown,
        z.core.$ZodTypeInternals<unknown, unknown>
      >;
      message: z.ZodString;
    },
    z.core.$strip
  >;
  update: z.ZodObject<
    {
      readonly [x: string]: z.ZodOptional<
        z.core.$ZodType<
          unknown,
          unknown,
          z.core.$ZodTypeInternals<unknown, unknown>
        >
      >;
    },
    z.core.$strip
  >;
};
