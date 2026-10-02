import { Hono } from 'hono'
import { describe, expect, it, vi } from 'vitest'
import { createSessionMiddleware, requireSession } from '../src/middleware/session.js'
import { registerAuthRoutes } from '../src/routes/auth.js'

describe('session middleware', () => {
  it('returns 401 for a missing session and does not create a principal', async () => {
    const getSession = vi.fn().mockResolvedValue(null)
    const auth = { api: { getSession } }
    const app = new Hono()
    let protectedHandlerReached = false

    app.use('/probe', createSessionMiddleware(auth as never))
    app.get('/probe', (c) => {
      requireSession(c)
      protectedHandlerReached = true
      return c.json({ ok: true })
    })

    const response = await app.request('/probe')

    expect(response.status).toBe(401)
    expect(protectedHandlerReached).toBe(false)
    expect(getSession).toHaveBeenCalledTimes(1)
  })
})

describe('auth routes', () => {
  it('forwards auth requests and applies credentialed CORS for the app origin', async () => {
    const handler = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        headers: { 'content-type': 'application/json' },
      }),
    )
    const app = new Hono()
    registerAuthRoutes(app, { handler } as never, 'http://localhost:5173')

    const response = await app.request('/api/auth/get-session', {
      headers: { Origin: 'http://localhost:5173' },
    })

    expect(response.status).toBe(200)
    expect(handler).toHaveBeenCalledTimes(1)
    expect(response.headers.get('access-control-allow-origin')).toBe(
      'http://localhost:5173',
    )
    expect(response.headers.get('access-control-allow-credentials')).toBe('true')
  })
})
