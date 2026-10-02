import type {
  AuditEvent,
  AuditEventInput,
  AuditRecorder,
  AuditRepository,
} from './types.js'

export class AuditService implements AuditRecorder {
  constructor(private readonly repository: AuditRepository) {}

  record(input: AuditEventInput): Promise<void> {
    return this.repository.append(input)
  }

  listForWorkspace(input: {
    workspaceId: string
    limit?: number
    before?: string
  }): Promise<AuditEvent[]> {
    const limit = Math.max(1, Math.min(input.limit ?? 50, 100))

    return this.repository.list({
      workspaceId: input.workspaceId,
      limit,
      ...(input.before ? { before: input.before } : {}),
    })
  }
}
