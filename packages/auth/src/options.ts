import { openMktAuthDefaults } from './config.js'

export interface OAuthClient {
  clientId: string
  clientSecret: string
}

export interface OAuthClientInput {
  clientId?: string
  clientSecret?: string
}

export interface BuildAuthOptionsInput {
  baseURL: string
  secret: string
  trustedOrigins: string[]
  google?: OAuthClientInput
  github?: OAuthClientInput
}

function parseOAuthClient(
  provider: 'google' | 'github',
  input?: OAuthClientInput,
): OAuthClient | undefined {
  if (!input) return undefined

  const hasClientId = Boolean(input.clientId)
  const hasClientSecret = Boolean(input.clientSecret)

  if (hasClientId !== hasClientSecret) {
    throw new Error(`${provider} OAuth requires both clientId and clientSecret`)
  }

  if (!hasClientId || !hasClientSecret) return undefined

  return {
    clientId: input.clientId!,
    clientSecret: input.clientSecret!,
  }
}

export function buildAuthOptions(input: BuildAuthOptionsInput) {
  const google = parseOAuthClient('google', input.google)
  const github = parseOAuthClient('github', input.github)
  const socialProviders = {
    ...(google ? { google } : {}),
    ...(github ? { github } : {}),
  }

  return {
    ...openMktAuthDefaults,
    baseURL: input.baseURL,
    secret: input.secret,
    trustedOrigins: input.trustedOrigins,
    ...(Object.keys(socialProviders).length > 0 ? { socialProviders } : {}),
  }
}
