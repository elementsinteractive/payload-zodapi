import type { JSONSchema4 } from "json-schema";

import type { SchemaPreProcessor } from "../types";

import { preprocessJsonSchema } from "../bin/generate-schemas";

describe("preprocessJsonSchema", () => {
	const baseSchema: JSONSchema4 = {
		type: "object",
		definitions: {},
		properties: {},
		required: [],
	};

	describe("collectionsJoins stripping", () => {
		it("removes collectionsJoins from properties", () => {
			const schema: JSONSchema4 = {
				...baseSchema,
				properties: {
					collections: {
						type: "object",
						properties: {
							seasonCovers: { $ref: "#/definitions/seasonCovers" },
						},
					},
					collectionsJoins: {
						type: "object",
						properties: {
							seasonCovers: {
								type: "object",
								properties: {
									usedIn: { type: "object" },
								},
							},
						},
					},
				},
				required: ["collections", "collectionsJoins"],
			};

			const result = preprocessJsonSchema(schema);

			expect(result.properties).not.toHaveProperty("collectionsJoins");
			expect(result.properties).toHaveProperty("collections");
		});

		it("removes collectionsJoins from required array", () => {
			const schema: JSONSchema4 = {
				...baseSchema,
				properties: {
					collections: { type: "object" },
					collectionsJoins: { type: "object" },
				},
				required: ["collections", "collectionsJoins", "db"],
			};

			const result = preprocessJsonSchema(schema);

			expect(result.required).toEqual(["collections", "db"]);
		});

		it("handles schema without collectionsJoins", () => {
			const schema: JSONSchema4 = {
				...baseSchema,
				properties: {
					collections: { type: "object" },
				},
				required: ["collections"],
			};

			const result = preprocessJsonSchema(schema);

			expect(result.properties).toHaveProperty("collections");
			expect(result.required).toEqual(["collections"]);
		});
	});

	describe("custom schemaPreProcessors", () => {
		it("applies a single pre-processor after built-in stripping", () => {
			const addDescription: SchemaPreProcessor = (schema) => ({
				...schema,
				description: "processed",
			});

			const schema: JSONSchema4 = {
				...baseSchema,
				properties: {
					collections: { type: "object" },
					collectionsJoins: { type: "object" },
				},
				required: ["collections", "collectionsJoins"],
			};

			const result = preprocessJsonSchema(schema, [addDescription]);

			expect(result.properties).not.toHaveProperty("collectionsJoins");
			expect(result.description).toBe("processed");
		});

		it("applies multiple pre-processors in order", () => {
			const first: SchemaPreProcessor = (schema) => ({
				...schema,
				description: "first",
			});
			const second: SchemaPreProcessor = (schema) => ({
				...schema,
				description: `${schema.description}+second`,
			});

			const result = preprocessJsonSchema(baseSchema, [first, second]);

			expect(result.description).toBe("first+second");
		});

		it("pre-processors receive schema with collectionsJoins already stripped", () => {
			const inspectSchema: SchemaPreProcessor = (schema) => {
				expect(schema.properties).not.toHaveProperty("collectionsJoins");
				return schema;
			};

			const schema: JSONSchema4 = {
				...baseSchema,
				properties: {
					collections: { type: "object" },
					collectionsJoins: { type: "object" },
				},
			};

			preprocessJsonSchema(schema, [inspectSchema]);
		});

		it("works with an empty pre-processors array", () => {
			const schema: JSONSchema4 = {
				...baseSchema,
				properties: {
					collections: { type: "object" },
					collectionsJoins: { type: "object" },
				},
			};

			const result = preprocessJsonSchema(schema, []);

			expect(result.properties).not.toHaveProperty("collectionsJoins");
			expect(result.properties).toHaveProperty("collections");
		});

		it("pre-processor can modify definitions", () => {
			const simplifyUsedIn: SchemaPreProcessor = (schema) => {
				const definitions = { ...(schema.definitions ?? {}) } as Record<
					string,
					JSONSchema4
				>;
				for (const [key, def] of Object.entries(definitions)) {
					if (def.properties?.usedIn) {
						definitions[key] = {
							...def,
							properties: { ...def.properties, usedIn: { type: "object" } },
						};
					}
				}
				return { ...schema, definitions };
			};

			const schema: JSONSchema4 = {
				...baseSchema,
				definitions: {
					seasonCovers: {
						type: "object",
						properties: {
							id: { type: "string" },
							usedIn: {
								type: "object",
								properties: {
									appContent: {
										$ref: "#/definitions/appContent-multi-tenant-collection",
									},
								},
							},
						},
						title: "SeasonCover",
					},
				},
			};

			const result = preprocessJsonSchema(schema, [simplifyUsedIn]);

			const seasonCovers = result.definitions?.seasonCovers as JSONSchema4;
			expect(seasonCovers.properties?.usedIn).toEqual({ type: "object" });
			expect(seasonCovers.properties?.id).toEqual({ type: "string" });
		});
	});

	describe("immutability", () => {
		it("does not mutate the original schema", () => {
			const original: JSONSchema4 = {
				...baseSchema,
				definitions: {
					seasonCovers: {
						type: "object",
						properties: {
							id: { type: "string" },
						},
					},
				},
				properties: {
					collections: { type: "object" },
					collectionsJoins: { type: "object" },
				},
				required: ["collections", "collectionsJoins"],
			};

			const originalJson = JSON.stringify(original);
			preprocessJsonSchema(original);

			expect(JSON.stringify(original)).toBe(originalJson);
		});
	});

	describe("edge cases", () => {
		it("handles schema with no properties", () => {
			const schema: JSONSchema4 = {
				type: "object",
				definitions: {},
			};

			const result = preprocessJsonSchema(schema);

			expect(result.properties).toEqual({});
		});

		it("handles schema with no definitions", () => {
			const schema: JSONSchema4 = {
				type: "object",
				properties: { x: { type: "string" } },
			};

			const result = preprocessJsonSchema(schema);

			expect(result.properties).toHaveProperty("x");
		});

		it("handles schema with no required array", () => {
			const schema: JSONSchema4 = {
				type: "object",
				properties: {
					collectionsJoins: { type: "object" },
				},
			};

			const result = preprocessJsonSchema(schema);

			expect(result.required).toBeUndefined();
			expect(result.properties).not.toHaveProperty("collectionsJoins");
		});
	});
});
