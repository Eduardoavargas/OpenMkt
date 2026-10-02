import { describe, expect, it, vi } from 'vitest'
import {
  WorkspaceNotFoundError,
  WorkspaceService,
  type WorkspaceRepository,
} from '../../src/index.js'

function createRepository(): WorkspaceRepository {
  return {
    createWithOwner: vi.fn(),
    listForUser: vi.fn(),
    findMembership: vi.fn(),
  }
}

describe('WorkspaceService', () => {
  it('creates a workspace through the owner-specific repository operation', async () => {
    const repository = createRepository()
    vi.mocked(repository.createWithOwner).mockImplementation(async (input) => ({
      ...input.workspace,
    }))
    const service = new WorkspaceService(repository)

    const workspace = await service.createWorkspace({
      principal: { type: 'user', userId: '00000000-0000-4000-8000-000000000001' },
      name: 'Itscred',
      slug: 'itscred',
    })

    expect(repository.createWithOwner).toHaveBeenCalledOnce()
    expect(repository.createWithOwner).toHaveBeenCalledWith({
      workspace: {
        id: expect.any(String),
        name: 'Itscred',
        slug: 'itscred',
      },
      ownerUserId: '00000000-0000-4000-8000-000000000001',
    })
    expect(workspace.slug).toBe('itscred')
  })

  it('lists only through the current user scope', async () => {
    const repository = createRepository()
    vi.mocked(repository.listForUser).mockResolvedValue([])
    const service = new WorkspaceService(repository)

    await service.listWorkspaces({
      type: 'user',
      userId: '00000000-0000-4000-8000-000000000002',
    })

    expect(repository.listForUser).toHaveBeenCalledWith(
      '00000000-0000-4000-8000-000000000002',
    )
  })

  it.each([null])(
    'returns the same not-found error for nonexistent and inaccessible workspaces',
    async (membership) => {
      const repository = createRepository()
      vi.mocked(repository.findMembership).mockResolvedValue(membership)
      const service = new WorkspaceService(repository)

      await expect(
        service.requireMembership({
          principal: {
            type: 'user',
            userId: '00000000-0000-4000-8000-000000000003',
          },
          workspaceId: '00000000-0000-4000-8000-000000000099',
        }),
      ).rejects.toEqual(new WorkspaceNotFoundError())
    },
  )

  it.each([
    { name: '   ', slug: 'valid-slug' },
    { name: 'Workspace', slug: 'Not-Normalized' },
    { name: 'Workspace', slug: 'not normalized' },
  ])('rejects invalid workspace input %#', async (input) => {
    const repository = createRepository()
    const service = new WorkspaceService(repository)

    await expect(
      service.createWorkspace({
        principal: { type: 'user', userId: '00000000-0000-4000-8000-000000000004' },
        ...input,
      }),
    ).rejects.toThrow()
    expect(repository.createWithOwner).not.toHaveBeenCalled()
  })
})
