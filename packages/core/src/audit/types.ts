export type AuditActor = {
  type: 'user'
  id: string
}

export interface AuditEventInput {
  workspaceId: string
  actor: AuditActor
  action: string
  resourceType: string
  resourceId?: string
  metadata?: Record<string, unknown>
}

export interface AuditEvent {
  id: string
  workspaceId: string
  actor: AuditActor
  action: string
  resourceType: string
  resourceId?: string
  metadata: Record<string, unknown>
  createdAt: Date
}

export interface AuditRepository {
  append(event: AuditEventInput): Promise<void>
  list(input: {
    workspaceId: string
    limit: number
    before?: string
  }): Promise<AuditEvent[]>
}

export interface AuditRecorder {
  record(input: AuditEventInput): Promise<void>
}
