import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import { Pool } from 'pg'

const databaseUrl = process.env.TEST_DATABASE_URL

if (!databaseUrl) {
  throw new Error('TEST_DATABASE_URL is required')
}

const pool = new Pool({ connectionString: databaseUrl })

afterAll(async () => {
  await pool.end()
})

describe('OpenMkt tenancy schema', () => {
  it('enforces unique workspace slugs', async () => {
    const firstId = randomUUID()
    const secondId = randomUUID()
    const slug = `workspace-${randomUUID()}`

    await pool.query(
      'insert into workspaces (id, name, slug, created_at, updated_at) values ($1, $2, $3, now(), now())',
      [firstId, 'First workspace', slug],
    )

    await expect(
      pool.query(
        'insert into workspaces (id, name, slug, created_at, updated_at) values ($1, $2, $3, now(), now())',
        [secondId, 'Second workspace', slug],
      ),
    ).rejects.toMatchObject({ code: '23505' })
  })
})
