import { platformRequest, PlatformError } from '@/api/platform'
import { getAntdMessage } from '@/services/antd-message-service'
import { useInterpreterStore } from '@/store/interpreterStore'
import { usePlatformStore } from '@/store/platformStore'
import { useSubGraphStore } from '@/store/subGraphStore'
import type { EntryGraphModel } from '~/types'

const DIRECTORY = 'M2PSim'
const API = '/filesystem-link'
export const MODEL_FORMAT = 'm2psim-x6'
export type ModelFile = ReturnType<typeof createModelFile>

export function createModelFile(model: EntryGraphModel) {
  const { config, compileConfig } = useInterpreterStore.getState()
  return {
    format: MODEL_FORMAT,
    version: 1,
    savedAt: new Date().toISOString(),
    model,
    config,
    compileConfig,
  }
}

export function parseModelFile(value: unknown): ModelFile {
  const file = value as ModelFile
  if (
    !file ||
    file.format !== MODEL_FORMAT ||
    file.version !== 1 ||
    !file.model?.subGraphs ||
    !file.model.rootId ||
    !file.model.currentGraphId
  ) {
    throw new Error('请选择新版 Sim 导出的模型；历史模型请使用旧版编辑器打开')
  }
  const { subGraphs, rootId, currentGraphId } = file.model
  if (
    !subGraphs[rootId] ||
    !subGraphs[currentGraphId] ||
    Object.values(subGraphs).some((g) => !Array.isArray(g.graphJson?.cells))
  ) {
    throw new Error('模型图层数据不完整')
  }
  return file
}

export async function listModelFiles(): Promise<string[]> {
  try {
    const data = await platformRequest(`${API}/list/${DIRECTORY}`)
    return (data.files ?? [])
      .map((f: any) => f.name)
      .filter(
        (name: unknown): name is string =>
          typeof name === 'string' && /^[^/\\]+\.x6\.json$/.test(name),
      )
  } catch (error) {
    if (error instanceof PlatformError && error.status === 404) return []
    throw error
  }
}

export async function readModelFile(name: string): Promise<ModelFile> {
  if (!/^[^/\\]+\.x6\.json$/.test(name)) throw new Error('模型文件名无效')
  const result = await platformRequest(
    `${API}/file/${DIRECTORY}/${encodeURIComponent(name)}`,
  )
  const data = result.data ?? result
  return parseModelFile(JSON.parse(data.content))
}

export async function saveModelFile(model: EntryGraphModel): Promise<boolean> {
  const state = usePlatformStore.getState()
  if (state.saving) return false
  usePlatformStore.setState({ saving: true })
  try {
    if (!state.user?.id) throw new Error('请先登录 M2PLab')
    const file = createModelFile(model)
    const content = JSON.stringify(file)
    if (new Blob([content]).size > 10 * 1024 * 1024)
      throw new Error('模型超过 10 MB，请先导出到本地并减少图片大小')
    let fileName = state.fileName
    if (fileName) {
      await platformRequest(
        `${API}/file/${DIRECTORY}/${encodeURIComponent(fileName)}`,
        'PUT',
        { content },
      )
    } else {
      const root = await platformRequest(`${API}/list`)
      if (!(root.directories ?? []).some((d: any) => d.name === DIRECTORY)) {
        await platformRequest(`${API}/directory`, 'POST', {
          name: DIRECTORY,
          path: '/',
        })
      }
      const title = (model.modelName || 'model')
        .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
        .slice(0, 60)
      fileName = `${title}-${crypto.randomUUID().slice(0, 8)}.x6.json`
      await platformRequest(`${API}/file`, 'POST', {
        name: fileName,
        path: `/${DIRECTORY}`,
        content,
      })
      usePlatformStore.setState({ fileName })
    }
    // Only clear the dirty flag if the user has not edited during the request.
    const current = useInterpreterStore.getState()
    if (
      JSON.stringify(useSubGraphStore.getState().exportEntryGraphModel()) ===
        JSON.stringify(model) &&
      JSON.stringify([current.config, current.compileConfig]) ===
        JSON.stringify([file.config, file.compileConfig])
    )
      useSubGraphStore.getState().markSaved()
    getAntdMessage().success('模型已保存到我的文件')
    return true
  } catch (error) {
    getAntdMessage().error(
      error instanceof Error ? error.message : '保存失败，请导出模型备份',
    )
    return false
  } finally {
    usePlatformStore.setState({ saving: false })
  }
}
