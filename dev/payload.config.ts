import { mongooseAdapter } from '@payloadcms/db-mongodb'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import path from 'path'
import { buildConfig } from 'payload'
import { defineEndpoint, zodApiPlugin } from 'payload-zodapi'
import sharp from 'sharp'
import { fileURLToPath } from 'url'
import { z } from 'zod'

import { testEmailAdapter } from './helpers/testEmailAdapter'
import { seed } from './seed'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

if (!process.env.ROOT_DIR) {
  process.env.ROOT_DIR = dirname
}

const buildConfigWithMemoryDB = async () => {
  if (!process.env.DATABASE_URL || process.env.NODE_ENV === 'test') {
    const memoryDB = await MongoMemoryReplSet.create({
      replSet: {
        count: 3,
        dbName: 'payloadmemory',
      },
    })

    process.env.DATABASE_URL = `${memoryDB.getUri()}&retryWrites=true`
  }

  return buildConfig({
    admin: {
      importMap: {
        baseDir: path.resolve(dirname),
      },
    },
    collections: [
      {
        slug: 'posts',
        endpoints: [
          defineEndpoint({
            handler: async (req, { pathParams }) => {
              const post = await req.payload.findByID({
                id: pathParams.id,
                collection: 'posts',
              })
              return Response.json({
                id: post.id,
                preview: true,
                title: post.title,
              })
            },
            method: 'get',
            openapi: {
              response: z.object({
                id: z.string(),
                preview: z.boolean(),
                title: z.string(),
              }),
              summary: 'Preview a post',
              tags: ['Posts'],
            },
            path: '/:id/preview',
          }),
        ],
        fields: [
          { name: 'title', type: 'text', required: true },
          { name: 'content', type: 'richText' },
        ],
      },
      {
        slug: 'users',
        auth: true,
        fields: [],
      },
      {
        slug: 'media',
        fields: [],
        upload: {
          staticDir: path.resolve(dirname, 'media'),
        },
      },
    ],
    db: mongooseAdapter({
      ensureIndexes: true,
      url: process.env.DATABASE_URL || '',
    }),
    editor: lexicalEditor(),
    email: testEmailAdapter,
    endpoints: [
      defineEndpoint({
        handler: async () => {
          return Response.json({
            status: 'ok',
            uptime: process.uptime(),
          })
        },
        method: 'get',
        openapi: {
          response: z.object({
            status: z.string(),
            uptime: z.number(),
          }),
          summary: 'Health check',
          tags: ['System'],
        },
        path: '/health',
      }),
    ],
    onInit: async (payload) => {
      await seed(payload)
    },
    plugins: [
      zodApiPlugin({
        metadata: {
          description: 'payload-zodapi development server',
          title: 'Dev API',
          version: '0.1.0',
        },
      }),
    ],
    secret: process.env.PAYLOAD_SECRET || 'test-secret_key',
    sharp,
    typescript: {
      outputFile: path.resolve(dirname, 'payload-types.ts'),
    },
  })
}

export default buildConfigWithMemoryDB()
