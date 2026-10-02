import type { OpenMktAuth } from '@openmkt/auth'
import type { Context, MiddlewareHandler } from 'hono'
import { HTTPException } from 'hono/http-exception'

export type AuthSession = NonNullable<
  Awaited<ReturnType<OpenMktAuth['api']['getSession']>>
>

type SessionEnv = {
  Variables: {
    authSession: AuthSession | null
  }
}

export function createSessionMiddleware(auth: OpenMktAuth): MiddlewareHandler {
  return async (c, next) => {
    const session = await auth.api.getSession({
      headers: c.req.raw.headers,
    })

    ;(c as Context<SessionEnv>).set('authSession', session)
    await next()
  }
}

export function requireSession(c: Context): AuthSession {
  const session = (c as Context<SessionEnv>).get('authSession')

  if (!session) {
    throw new HTTPException(401, { message: 'Unauthenticated' })
  }

  return session
}
