import type { UserRole } from '~/types/common/permission'
import type { BlockLibrary } from '~/types/vo/block'

/** user 角色不可访问的 libraryId 列表 */
const USER_RESTRICTED_LIBRARY_IDS: ReadonlySet<number> = new Set([14])

/** 设备库仅展示已放行的 Block */
const USER_ALLOWED_DEVICE_BLOCK_IDS: ReadonlySet<number> = new Set([56])
const DEVICE_LIBRARY_ID = 1

function createPermissionService() {
  /**
   * 当前用户角色 — 暂时写死，后续替换为真实鉴权逻辑
   * TODO: 从后端接口 / 全局 store 中读取真实角色
   */
  let currentRole: UserRole = 'user'

  function setRole(role: UserRole): void {
    currentRole = role
  }

  function canAccessLibrary(libraryId: number): boolean {
    if (currentRole === 'admin') return true
    return !USER_RESTRICTED_LIBRARY_IDS.has(libraryId)
  }

  function canAccessBlock(blockId: number, libraryId: number): boolean {
    if (currentRole === 'admin') return true
    if (!canAccessLibrary(libraryId)) return false
    if (libraryId === DEVICE_LIBRARY_ID) {
      return USER_ALLOWED_DEVICE_BLOCK_IDS.has(blockId)
    }
    return true
  }

  function filterAccessLibraries(libraries: BlockLibrary[]): BlockLibrary[] {
    if (currentRole === 'admin') return libraries
    return libraries.filter((lib) => !USER_RESTRICTED_LIBRARY_IDS.has(lib.id))
  }

  return {
    setRole,
    canAccessLibrary,
    canAccessBlock,
    filterAccessLibraries,
  }
}

export { createPermissionService }
