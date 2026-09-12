import { create } from 'zustand'

export interface PlatformUser {
  id: number
  realname?: string
  username?: string
  role?: unknown
}
export const usePlatformStore = create<{
  user: PlatformUser | null
  plantId: number
  copyNum: number
  fileName: string | null
  saving: boolean
  settingsDirty: boolean
}>()(() => ({
  user: null,
  plantId: 2,
  copyNum: 0,
  fileName: null,
  saving: false,
  settingsDirty: false,
}))
