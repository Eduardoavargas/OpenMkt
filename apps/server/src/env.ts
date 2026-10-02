import { z } from 'zod'

const optionalNonEmptyString = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().min(1).optional(),
)

const serverEnvSchema = z
  .object({
    DATABASE_URL: z.string().min(1),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.string().url(),
    APP_ORIGIN: z.string().url(),
    PORT: z.coerce.number().int().min(1).max(65535).default(3001),
    GOOGLE_CLIENT_ID: optionalNonEmptyString,
    GOOGLE_CLIENT_SECRET: optionalNonEmptyString,
    GITHUB_CLIENT_ID: optionalNonEmptyString,
    GITHUB_CLIENT_SECRET: optionalNonEmptyString,
  })
  .superRefine((value, ctx) => {
    for (const [provider, clientId, clientSecret] of [
      ['Google', value.GOOGLE_CLIENT_ID, value.GOOGLE_CLIENT_SECRET],
      ['GitHub', value.GITHUB_CLIENT_ID, value.GITHUB_CLIENT_SECRET],
    ] as const) {
      if (Boolean(clientId) !== Boolean(clientSecret)) {
        ctx.addIssue({
          code: 'custom',
          message: `${provider} OAuth requires both client ID and client secret`,
        })
      }
    }
  })

export interface ServerEnv {
  databaseUrl: string
  betterAuthSecret: string
  betterAuthUrl: string
  appOrigin: string
  port: number
  google?: { clientId: string; clientSecret: string }
  github?: { clientId: string; clientSecret: string }
}

export function parseServerEnv(
  input: Record<string, string | undefined>,
): ServerEnv {
  const parsed = serverEnvSchema.parse(input)

  return {
    databaseUrl: parsed.DATABASE_URL,
    betterAuthSecret: parsed.BETTER_AUTH_SECRET,
    betterAuthUrl: parsed.BETTER_AUTH_URL,
    appOrigin: parsed.APP_ORIGIN,
    port: parsed.PORT,
    ...(parsed.GOOGLE_CLIENT_ID && parsed.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: parsed.GOOGLE_CLIENT_ID,
            clientSecret: parsed.GOOGLE_CLIENT_SECRET,
          },
        }
      : {}),
    ...(parsed.GITHUB_CLIENT_ID && parsed.GITHUB_CLIENT_SECRET
      ? {
          github: {
            clientId: parsed.GITHUB_CLIENT_ID,
            clientSecret: parsed.GITHUB_CLIENT_SECRET,
          },
        }
      : {}),
  }
}
