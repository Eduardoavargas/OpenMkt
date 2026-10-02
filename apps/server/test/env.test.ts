import { describe, expect, it } from 'vitest'
import { parseServerEnv } from '../src/env.js'

const baseEnv = {
  DATABASE_URL: 'postgresql://openmkt:openmkt@localhost:5432/openmkt',
  BETTER_AUTH_SECRET: 'x'.repeat(32),
  BETTER_AUTH_URL: 'http://localhost:3001',
  APP_ORIGIN: 'http://localhost:5173',
}

describe('parseServerEnv', () => {
  it('parses a minimal portable configuration and defaults the port', () => {
    const env = parseServerEnv(baseEnv)

    expect(env.port).toBe(3001)
    expect(env.google).toBeUndefined()
    expect(env.github).toBeUndefined()
  })

  it('rejects missing required secrets', () => {
    const { BETTER_AUTH_SECRET: _secret, ...withoutSecret } = baseEnv
    expect(() => parseServerEnv(withoutSecret)).toThrow()
  })

  it('rejects partial OAuth provider credentials', () => {
    expect(() =>
      parseServerEnv({ ...baseEnv, GOOGLE_CLIENT_ID: 'google-client' }),
    ).toThrow()
  })
})
