import type { OpenMktAuth } from '@openmkt/auth'
import { Hono } from 'hono'
import { cors } from 'hono/cors'

export function registerAuthRoutes(
  app: Hono,
  auth: Pick<OpenMktAuth, 'handler'>,
  appOrigin: string,
): void {
  app.use(
    '/api/auth/*',
    cors({
      origin: appOrigin,
      credentials: true,
    }),
  )
  app.all('/api/auth/*', (c) => auth.handler(c.req.raw))
}
