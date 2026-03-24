/**
 * Shared test utilities for OpenAPI plugin tests.
 */
import type { Endpoint, PayloadRequest } from 'payload'

import { vi } from 'vitest'

// Polyfill Response for Node.js test environment
if (typeof globalThis.Response === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(globalThis as any).Response = class MockResponse {
    _data: unknown
    headers: Headers
    ok: boolean
    status: number

    constructor(body?: BodyInit | null, init?: ResponseInit) {
      this.status = init?.status ?? 200
      this.ok = this.status >= 200 && this.status < 300
      this._data = body
      this.headers = new Headers(init?.headers)
    }

    static json(data: unknown, init?: ResponseInit) {
      const response = new MockResponse(JSON.stringify(data), init)
      response._data = data
      return response
    }

    static redirect(url: string, status = 302) {
      const response = new MockResponse(null, { status })
      response.headers.set('location', url)
      return response
    }

    clone() {
      const bodyStr = typeof this._data === 'string' ? this._data : JSON.stringify(this._data)
      return new MockResponse(bodyStr, { status: this.status })
    }

    json() {
      return typeof this._data === 'string' ? JSON.parse(this._data) : this._data
    }
  }
}

/**
 * Creates a mock PayloadRequest for testing.
 * The `payload` override is shallow-merged with the defaults so callers
 * don't have to repeat `config` / `logger` every time.
 */
export const createMockRequest = (overrides: Partial<PayloadRequest> = {}): PayloadRequest => {
  const { payload: payloadOverrides, ...rest } = overrides
  return {
    payload: {
      config: { cors: [] },
      logger: {
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
      },
      ...payloadOverrides,
    },
    query: {},
    routeParams: {},
    ...rest,
  } as unknown as PayloadRequest
}

/**
 * Creates a mock Endpoint for testing.
 */
export const createMockEndpoint = (
  config: Partial<Endpoint> & Pick<Endpoint, 'handler' | 'method' | 'path'>,
): Endpoint => config as Endpoint

/**
 * Helper to find a route definition in the registry by path.
 */
export const findRouteByPath = (
  definitions: Array<{ route?: { path: string }; type: string }>,
  path: string,
) => definitions.find((d) => d.type === 'route' && d.route?.path === path)
