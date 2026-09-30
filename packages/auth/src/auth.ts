import type { OpenMktDatabase } from '@openmkt/database'
import * as schema from '@openmkt/database/schema'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { openMktAuthDefaults } from './config.js'

export interface CreateAuthInput {
  db: OpenMktDatabase
  baseURL: string
  secret: string
  trustedOrigins: string[]
}

export function createAuth(input: CreateAuthInput) {
  return betterAuth({
    ...openMktAuthDefaults,
    database: drizzleAdapter(input.db, {
      provider: 'pg',
      schemaName: 'auth',
      schema,
    }),
    baseURL: input.baseURL,
    secret: input.secret,
    trustedOrigins: input.trustedOrigins,
  })
}

export type OpenMktAuth = ReturnType<typeof createAuth>
