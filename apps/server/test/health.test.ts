import { describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'

describe('GET /healthz', () => {
  it('returns the service health payload', async () => {
    const response = await createApp().request('/healthz')

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ status: 'ok' })
  })
})
