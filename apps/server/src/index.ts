import { serve } from '@hono/node-server'
import { createAuth } from '@openmkt/auth'
import { createDatabase } from '@openmkt/database'
import { createApp } from './app.js'
import { parseServerEnv } from './env.js'

const env = parseServerEnv(process.env)
const db = createDatabase(env.databaseUrl)
const auth = createAuth({
  db,
  baseURL: env.betterAuthUrl,
  secret: env.betterAuthSecret,
  trustedOrigins: [env.appOrigin],
  google: env.google,
  github: env.github,
})
const app = createApp({ auth, appOrigin: env.appOrigin })

serve({
  fetch: app.fetch,
  port: env.port,
})
