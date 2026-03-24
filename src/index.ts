import type { Config } from 'payload'

export type PayloadZodapiConfig = object

export const payloadZodapi =
  (_: PayloadZodapiConfig) =>
  (config: Config): Config => {
    return config
  }
