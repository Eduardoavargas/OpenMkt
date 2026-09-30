import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { betterAuth } from 'better-auth'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'

const databaseUrl =
  process.env.DATABASE_URL ??
  process.env.TEST_DATABASE_URL ??
  'postgresql://openmkt:openmkt@localhost:5432/openmkt'

const pool = new Pool({ connectionString: databaseUrl })
const db = drizzle({ client: pool })

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schemaName: 'auth',
  }),
  emailAndPassword: {
    enabled: true,
  },
  advanced: {
    database: {
      generateId: 'uuid',
    },
  },
  secret: 'openmkt-schema-generation-only-secret-change-me',
  baseURL: 'http://localhost:3001',
})
