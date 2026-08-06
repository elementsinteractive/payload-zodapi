import type { JSONSchema4 } from "json-schema";
import type { BinScript } from "payload";
import type { SchemaPreProcessor } from "../types";
export declare const DEFAULT_SCHEMAS_PATH = "src/payload-schemas.ts";
export declare const script: BinScript;
/**
 * Applies the built-in `collectionsJoins` stripping and any additional
 * user-provided pre-processors to a Payload JSON schema.
 */
export declare const preprocessJsonSchema: (
  jsonSchema: JSONSchema4,
  preProcessors?: SchemaPreProcessor[],
) => JSONSchema4;
