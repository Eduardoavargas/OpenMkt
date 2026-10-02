import { Hono } from 'hono'
import { describe, expect, it, vi } from 'vitest'
import { createSessionMiddleware, requireSession } from '../src/middleware/session.js'

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
