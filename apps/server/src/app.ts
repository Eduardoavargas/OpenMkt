import type { OpenMktAuth } from '@openmkt/auth'
import { Hono } from 'hono'
import { registerAuthRoutes } from './routes/auth.js'

export interface CreateAppInput {
  auth?: OpenMktAuth
  appOrigin?: string
}

export function createApp(input: CreateAppInput = {}): Hono {
  const app = new Hono()

  app.get('/healthz', (c) => c.json({ status: 'ok' }))

  if (input.auth) {
    if (!input.appOrigin) {
      throw new Error('appOrigin is required when auth is configured')
    }
    registerAuthRoutes(app, input.auth, input.appOrigin)
  }

  return app
}
