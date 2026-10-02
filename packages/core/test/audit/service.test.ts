import { describe, expect, it, vi } from 'vitest'
import {
  AuditService,
  type AuditEventInput,
  type AuditRepository,
} from '../../src/index.js'

function createRepository(): AuditRepository {
  return {
    append: vi.fn(),
    list: vi.fn(),
  }
}

const event: AuditEventInput = {
  workspaceId: '00000000-0000-4000-8000-000000000001',
  actor: {
    type: 'user',
    id: '00000000-0000-4000-8000-000000000002',
  },
  action: 'workspace.created',
  resourceType: 'workspace',
  resourceId: '00000000-0000-4000-8000-000000000001',
  metadata: { source: 'test' },
}

describe('AuditService', () => {
  it('forwards structured audit events to the repository', async () => {
    const repository = createRepository()
    const service = new AuditService(repository)

    await service.record(event)

    expect(repository.append).toHaveBeenCalledOnce()
    expect(repository.append).toHaveBeenCalledWith(event)
  })

  it('defaults list limit to 50', async () => {
    const repository = createRepository()
    vi.mocked(repository.list).mockResolvedValue([])
    const service = new AuditService(repository)

    await service.listForWorkspace({ workspaceId: event.workspaceId })

    expect(repository.list).toHaveBeenCalledWith({
      workspaceId: event.workspaceId,
      limit: 50,
    })
  })

  it('clamps list limit to 100 and forwards the cursor', async () => {
    const repository = createRepository()
    vi.mocked(repository.list).mockResolvedValue([])
    const service = new AuditService(repository)

    await service.listForWorkspace({
      workspaceId: event.workspaceId,
      limit: 500,
      before: 'cursor',
    })

    expect(repository.list).toHaveBeenCalledWith({
      workspaceId: event.workspaceId,
      limit: 100,
      before: 'cursor',
    })
  })
})
