import { randomUUID } from 'node:crypto'
import type {
  AuditEvent,
  AuditEventInput,
  AuditRepository,
} from '@openmkt/core'
import { and, desc, eq, lt, or } from 'drizzle-orm'
import type { OpenMktDatabase } from '../client.js'
import { auditEvents } from '../schema/openmkt.js'

type Cursor = {
  createdAt: string
  id: string
}

function decodeCursor(value: string): { createdAt: Date; id: string } {
  const decoded = JSON.parse(
    Buffer.from(value, 'base64url').toString('utf8'),
  ) as Cursor
  const createdAt = new Date(decoded.createdAt)

  if (Number.isNaN(createdAt.getTime()) || !decoded.id) {
    throw new Error('Invalid audit cursor')
  }

  return { createdAt, id: decoded.id }
}

function mapRow(row: typeof auditEvents.$inferSelect): AuditEvent {
  if (row.actorType !== 'user') {
    throw new Error(`Unsupported audit actor type: ${row.actorType}`)
  }

  return {
    id: row.id,
    workspaceId: row.workspaceId,
    actor: {
      type: 'user',
      id: row.actorId,
    },
    action: row.action,
    resourceType: row.resourceType,
    ...(row.resourceId ? { resourceId: row.resourceId } : {}),
    metadata: row.metadata,
    createdAt: row.createdAt,
  }
}

export class DrizzleAuditRepository implements AuditRepository {
  constructor(private readonly db: OpenMktDatabase) {}

  async append(event: AuditEventInput): Promise<void> {
    await this.db.insert(auditEvents).values({
      id: randomUUID(),
      workspaceId: event.workspaceId,
      actorType: event.actor.type,
      actorId: event.actor.id,
      action: event.action,
      resourceType: event.resourceType,
      ...(event.resourceId ? { resourceId: event.resourceId } : {}),
      metadata: event.metadata ?? {},
    })
  }

  async list(input: {
    workspaceId: string
    limit: number
    before?: string
  }): Promise<AuditEvent[]> {
    const cursor = input.before ? decodeCursor(input.before) : undefined
    const cursorCondition = cursor
      ? or(
          lt(auditEvents.createdAt, cursor.createdAt),
          and(
            eq(auditEvents.createdAt, cursor.createdAt),
            lt(auditEvents.id, cursor.id),
          ),
        )
      : undefined

    const rows = await this.db
      .select()
      .from(auditEvents)
      .where(
        cursorCondition
          ? and(
              eq(auditEvents.workspaceId, input.workspaceId),
              cursorCondition,
            )
          : eq(auditEvents.workspaceId, input.workspaceId),
      )
      .orderBy(desc(auditEvents.createdAt), desc(auditEvents.id))
      .limit(input.limit)

    return rows.map(mapRow)
  }
}

export function createAuditRepository(db: OpenMktDatabase): AuditRepository {
  return new DrizzleAuditRepository(db)
}
