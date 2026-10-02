import { defineConfig } from 'drizzle-kit'

const databaseUrl = process.env.DATABASE_URL ?? process.env.TEST_DATABASE_URL

if (!databaseUrl) {
  throw new Error('DATABASE_URL or TEST_DATABASE_URL is required')
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/index.ts',
  out: './migrations',
  dbCredentials: {
    url: databaseUrl,
  },
})
