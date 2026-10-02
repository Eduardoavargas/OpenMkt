import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { betterAuth } from 'better-auth'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { buildAuthOptions } from './src/options.js'

const databaseUrl =
  process.env.DATABASE_URL ??
  process.env.TEST_DATABASE_URL ??
  'postgresql://openmkt:openmkt@localhost:5432/openmkt'

const pool = new Pool({ connectionString: databaseUrl })
const db = drizzle({ client: pool })

export const auth = betterAuth({
  ...buildAuthOptions({
    baseURL: 'http://localhost:3001',
    secret: 'openmkt-schema-generation-only-secret-change-me',
    trustedOrigins: [],
  }),
  database: drizzleAdapter(db, {
    provider: 'pg',
    schemaName: 'auth',
  }),
})
