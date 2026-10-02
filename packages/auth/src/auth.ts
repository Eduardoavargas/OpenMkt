import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import type { OpenMktDatabase } from '@openmkt/database'
import * as schema from '@openmkt/database/schema'
import { betterAuth } from 'better-auth'
import {
  buildAuthOptions,
  type BuildAuthOptionsInput,
} from './options.js'

export interface CreateAuthInput extends BuildAuthOptionsInput {
  db: OpenMktDatabase
}

export function createAuth(input: CreateAuthInput) {
  return betterAuth({
    ...buildAuthOptions(input),
    database: drizzleAdapter(input.db, {
      provider: 'pg',
      schemaName: 'auth',
      schema,
    }),
  })
}

export type OpenMktAuth = ReturnType<typeof createAuth>
