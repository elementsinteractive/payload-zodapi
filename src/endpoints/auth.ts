import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import type { CollectionConfig } from "payload";

import { formatLabels } from "payload";
import { z } from "zod";

const authTag = "Authentication";

const messageResponse = z.object({ message: z.string() });

const tokenResponse = z.object({
  exp: z.number(),
  token: z.string(),
});

/**
 * Registers auth-specific endpoints for a single auth-enabled collection.
 *
 * Covers: login, logout, me, refresh-token, forgot-password,
 * reset-password, unlock, verify, init, first-register.
 */
export function registerAuthCollectionEndpoints(
  collection: CollectionConfig,
  apiPrefix: string,
  registry: OpenAPIRegistry,
  collectionsSchema: z.ZodObject<z.ZodRawShape>,
) {
  const slug = collection.slug;
  const { singular } = formatLabels(slug);
  const basePath = `${apiPrefix}/${slug}`;
  const tags = [authTag];
  const userSchema: z.ZodTypeAny =
    (collectionsSchema.shape[slug] as undefined | z.ZodTypeAny) ??
    z.record(z.string(), z.unknown());

  // POST /login
  registry.registerPath({
    method: "post",
    operationId: `${slug}Login`,
    path: `${basePath}/login`,
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({
              email: z.string(),
              password: z.string(),
            }),
          },
        },
      },
    },
    responses: {
      "200": {
        content: {
          "application/json": {
            schema: tokenResponse.extend({
              user: userSchema,
            }),
          },
        },
        description: "Login successful",
      },
      "401": { description: "Invalid credentials" },
    },
    summary: `Log in as a ${singular}`,
    tags,
  });

  // POST /logout
  registry.registerPath({
    method: "post",
    operationId: `${slug}Logout`,
    path: `${basePath}/logout`,
    responses: {
      "200": {
        content: { "application/json": { schema: messageResponse } },
        description: "Logged out",
      },
    },
    summary: "Log out",
    tags,
  });

  // GET /me
  registry.registerPath({
    method: "get",
    operationId: `${slug}Me`,
    path: `${basePath}/me`,
    responses: {
      "200": {
        content: {
          "application/json": {
            schema: z.object({
              collection: z.string(),
              exp: z.number().optional(),
              token: z.string().optional(),
              user: userSchema.nullable(),
            }),
          },
        },
        description: "Current user",
      },
    },
    summary: "Get current user",
    tags,
  });

  // POST /refresh-token
  registry.registerPath({
    method: "post",
    operationId: `${slug}RefreshToken`,
    path: `${basePath}/refresh-token`,
    responses: {
      "200": {
        content: {
          "application/json": {
            schema: z.object({
              exp: z.number(),
              refreshedToken: z.string(),
              user: userSchema,
            }),
          },
        },
        description: "Token refreshed",
      },
    },
    summary: "Refresh auth token",
    tags,
  });

  // POST /forgot-password
  registry.registerPath({
    method: "post",
    operationId: `${slug}ForgotPassword`,
    path: `${basePath}/forgot-password`,
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({ email: z.string() }),
          },
        },
      },
    },
    responses: {
      "200": {
        content: { "application/json": { schema: messageResponse } },
        description: "Password reset email sent",
      },
    },
    summary: "Request password reset",
    tags,
  });

  // POST /reset-password
  registry.registerPath({
    method: "post",
    operationId: `${slug}ResetPassword`,
    path: `${basePath}/reset-password`,
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({
              password: z.string(),
              token: z.string(),
            }),
          },
        },
      },
    },
    responses: {
      "200": {
        content: {
          "application/json": {
            schema: tokenResponse.extend({
              user: userSchema,
            }),
          },
        },
        description: "Password reset successful",
      },
    },
    summary: "Reset password with token",
    tags,
  });

  // POST /unlock
  registry.registerPath({
    method: "post",
    operationId: `${slug}Unlock`,
    path: `${basePath}/unlock`,
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({ email: z.string() }),
          },
        },
      },
    },
    responses: {
      "200": {
        content: { "application/json": { schema: messageResponse } },
        description: "Account unlocked",
      },
    },
    summary: "Unlock a locked account",
    tags,
  });

  // POST /verify/{id}
  registry.registerPath({
    method: "post",
    operationId: `${slug}VerifyEmail`,
    path: `${basePath}/verify/{id}`,
    request: {
      params: z.object({ id: z.string() }),
    },
    responses: {
      "200": {
        content: { "application/json": { schema: messageResponse } },
        description: "Email verified",
      },
    },
    summary: "Verify email address",
    tags,
  });

  // GET /init
  registry.registerPath({
    method: "get",
    operationId: `${slug}Init`,
    path: `${basePath}/init`,
    responses: {
      "200": {
        content: {
          "application/json": {
            schema: z.object({ initialized: z.boolean() }),
          },
        },
        description: "Initialization status",
      },
    },
    summary: "Check if first user has been created",
    tags,
  });

  // POST /first-register
  registry.registerPath({
    method: "post",
    operationId: `${slug}FirstRegister`,
    path: `${basePath}/first-register`,
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({
              email: z.string(),
              password: z.string(),
            }),
          },
        },
      },
    },
    responses: {
      "200": {
        content: {
          "application/json": {
            schema: tokenResponse.extend({
              user: userSchema,
            }),
          },
        },
        description: "First user registered",
      },
    },
    summary: "Register the first user",
    tags,
  });
}

/**
 * Registers the root-level auth endpoints.
 *
 * Covers: GET /access — returns the access control hierarchy.
 */
export function registerAuthRootEndpoints(
  apiPrefix: string,
  registry: OpenAPIRegistry,
) {
  registry.registerPath({
    method: "get",
    operationId: "access",
    path: `${apiPrefix}/access`,
    responses: {
      "200": {
        content: {
          "application/json": {
            schema: z.record(z.string(), z.unknown()),
          },
        },
        description: "Access control hierarchy for the current user",
      },
    },
    summary: "Get access control hierarchy",
    tags: [authTag],
  });
}
