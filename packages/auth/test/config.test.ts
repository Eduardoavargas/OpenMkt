import { describe, expect, it } from 'vitest'
import { buildAuthOptions } from '../src/options.js'

const baseInput = {
  baseURL: 'http://localhost:3001',
  secret: 'x'.repeat(32),
  trustedOrigins: ['http://localhost:5173'],
}

describe('buildAuthOptions', () => {
  it('supports portable email/password auth without social providers', () => {
    const options = buildAuthOptions(baseInput)

    expect(options.emailAndPassword).toEqual({ enabled: true })
    expect(options.socialProviders).toBeUndefined()
  })

  it.each([
    ['google', { google: { clientId: 'google-client' } }],
    ['google', { google: { clientSecret: 'google-secret' } }],
    ['github', { github: { clientId: 'github-client' } }],
    ['github', { github: { clientSecret: 'github-secret' } }],
  ])('rejects partial %s OAuth credentials', (_provider, partial) => {
    expect(() => buildAuthOptions({ ...baseInput, ...partial })).toThrow()
  })

  it('configures complete optional social providers', () => {
    const options = buildAuthOptions({
      ...baseInput,
      google: { clientId: 'google-client', clientSecret: 'google-secret' },
      github: { clientId: 'github-client', clientSecret: 'github-secret' },
    })

    expect(options.socialProviders).toMatchObject({
      google: { clientId: 'google-client', clientSecret: 'google-secret' },
      github: { clientId: 'github-client', clientSecret: 'github-secret' },
    })
  })
})
