import { Button, Input, Modal, Select, Space, Tooltip } from 'antd'
import { useState } from 'react'
import { startSimulation } from '@/api/simulation'
import example from '@/assets/platformExample.json'
import { getAntdMessage } from '@/services/antd-message-service'
import {
  createModelFile,
  parseModelFile,
  listModelFiles,
  readModelFile,
} from '@/services/model-file-service'
import {
  buildGraphModelDTO,
  loadEntryGraphModel,
  changeGraphView,
} from '@/services/subsystem-service'
import { useGraphStore } from '@/store/graphStore'
import {
  useInterpreterStore,
  DEFAULT_SIMULATION_CONFIG,
  DEFAULT_COMPILE_CONFIG,
} from '@/store/interpreterStore'
import { usePlatformStore } from '@/store/platformStore'
import { useSimulationStore } from '@/store/simulationStore'
import { saveEntryGraphModel, useSubGraphStore } from '@/store/subGraphStore'
import type { EntryGraphModel } from '~/types'

function PaperToolbar() {
  const message = getAntdMessage()
  const graph = useGraphStore((s) => s.graph)
  const modelName = useSubGraphStore((s) => s.modelName)
  const dirty = useSubGraphStore((s) => s.isDirty)
  const saving = usePlatformStore((s) => s.saving)
  const fileName = usePlatformStore((s) => s.fileName)
  const isRunning = useSimulationStore((s) => s.isRunning)
  const progress = useSimulationStore((s) => s.progress)
  const [files, setFiles] = useState<string[]>([])
  const [selected, setSelected] = useState<string>()
  const [filesOpen, setFilesOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [json, setJson] = useState('')
  const mayReplace = () =>
    !useSubGraphStore.getState().isDirty ||
    window.confirm('当前模型尚未保存，确定打开其他模型吗？')

  function load(
    model: EntryGraphModel,
    fileName: string | null = null,
    saved = false,
  ) {
    if (!graph) return
    loadEntryGraphModel(structuredClone(model), graph)
    changeGraphView(model.currentGraphId, graph)
    useSubGraphStore.getState().syncGraph(graph.toJSON())
    usePlatformStore.setState({ fileName, settingsDirty: false })
    useSimulationStore.setState({
      results: null,
      openScopeIds: [],
      error: null,
      progress: null,
    })
    if (saved) useSubGraphStore.getState().markSaved()
    else useSubGraphStore.setState({ isDirty: true })
    requestAnimationFrame(() => graph.zoomToFit({ padding: 100, maxScale: 1 }))
  }

  async function simulate() {
    if (!graph || isRunning) return
    const state = useSimulationStore.getState()
    state.setRunning(true)
    state.setError(null)
    useSimulationStore.setState({ results: null, progress: null })
    try {
      useSubGraphStore.getState().syncGraph(graph.toJSON())
      const model = await buildGraphModelDTO(graph)
      if (
        !model.blocks.length ||
        !model.blocks.some((b) => b.blockType === 'Scope')
      )
        throw new Error('请先添加并连接模块和 Scope')
      const results = await startSimulation({
        model,
        onProgress: state.setProgress,
        onResults: state.setResults,
      })
      results.scopes.forEach((scope, index) =>
        state.openScope(scope.uuid || scope.path || `scope-${index}`),
      )
      state.setProgress({ message: 'finished', percent: 100 })
      message.success('仿真完成')
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error)
      state.setError(text)
      message.error(text, 8)
    } finally {
      state.setRunning(false)
    }
  }

  async function showFiles() {
    setFilesOpen(true)
    setLoading(true)
    try {
      setFiles(await listModelFiles())
    } catch (e) {
      message.error((e as Error).message)
    } finally {
      setLoading(false)
    }
  }
  async function openFile() {
    if (!selected || !mayReplace()) return
    setLoading(true)
    try {
      const file = await readModelFile(selected)
      useInterpreterStore.setState({
        config: file.config || DEFAULT_SIMULATION_CONFIG,
        compileConfig: file.compileConfig || DEFAULT_COMPILE_CONFIG,
      })
      load(file.model, selected, true)
      setFilesOpen(false)
    } catch (e) {
      message.error((e as Error).message)
    } finally {
      setLoading(false)
    }
  }
  function exportFile() {
    if (!graph) return
    useSubGraphStore.getState().syncGraph(graph.toJSON())
    const file = createModelFile(
      useSubGraphStore.getState().exportEntryGraphModel(),
    )
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' }),
    )
    const link = document.createElement('a')
    link.href = url
    link.download = `${modelName.replace(/[<>:"/\\|?*]/g, '_')}.x6.json`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  function importFile() {
    try {
      const value = JSON.parse(json)
      const file = parseModelFile(value)
      if (!mayReplace()) return
      useInterpreterStore.setState({
        config: file.config || DEFAULT_SIMULATION_CONFIG,
        compileConfig: file.compileConfig || DEFAULT_COMPILE_CONFIG,
      })
      load(file.model)
      setImportOpen(false)
      setJson('')
    } catch (e) {
      message.error((e as Error).message)
    }
  }
  return (
    <>
      <Space size={6} wrap style={{ padding: '2px 4px', width: '100%' }}>
        <Input
          aria-label="模型名称"
          value={modelName}
          style={{ width: 170 }}
          onChange={(e) =>
            useSubGraphStore.getState().renameModel(e.target.value)
          }
          disabled={isRunning || saving}
        />
        <Button
          size="small"
          disabled={isRunning || saving}
          onClick={() => {
            if (!mayReplace()) return
            useInterpreterStore.setState({
              config: DEFAULT_SIMULATION_CONFIG,
              compileConfig: DEFAULT_COMPILE_CONFIG,
            })
            const empty = structuredClone(example) as unknown as EntryGraphModel
            empty.modelName = '未命名模型'
            empty.subGraphs[empty.rootId].graphJson.cells = []
            load(empty)
          }}
        >
          新建
        </Button>
        <Tooltip title="保存到当前账号的我的文件">
          <Button
            size="small"
            loading={saving}
            disabled={isRunning}
            onClick={() => graph && void saveEntryGraphModel(graph)}
          >
            保存
          </Button>
        </Tooltip>
        <Button
          size="small"
          disabled={isRunning || saving}
          onClick={() => void showFiles()}
        >
          我的模型
        </Button>
        <Button
          size="small"
          disabled={isRunning || saving}
          onClick={() => {
            if (!mayReplace()) return
            useInterpreterStore.setState({
              config: DEFAULT_SIMULATION_CONFIG,
              compileConfig: DEFAULT_COMPILE_CONFIG,
            })
            load(example as unknown as EntryGraphModel)
          }}
        >
          加载示例
        </Button>
        <Button size="small" onClick={exportFile}>
          导出模型
        </Button>
        <Button
          size="small"
          disabled={isRunning || saving}
          onClick={() => setImportOpen(true)}
        >
          导入模型
        </Button>
        <Button
          type="primary"
          size="small"
          loading={isRunning}
          disabled={saving}
          onClick={() => void simulate()}
        >
          {isRunning ? `仿真 ${progress?.percent || 0}%` : '仿真'}
        </Button>
        <span role="status" style={{ fontSize: 12, color: '#667085' }}>
          {isRunning
            ? '正在仿真'
            : progress?.message === 'finished'
              ? '仿真完成'
              : ''}
          {dirty ? ' · 未保存' : fileName ? ' · 已保存' : ' · 新模型'}
        </span>
      </Space>
      <Modal
        title="我的模型"
        open={filesOpen}
        onCancel={() => setFilesOpen(false)}
        onOk={() => void openFile()}
        confirmLoading={loading}
        okButtonProps={{ disabled: !selected }}
        okText="打开"
        cancelText="取消"
      >
        <p>
          这里显示 M2PLink 保存的模型，包含此前新版 Sim
          保存的模型。历史模型请从首页进入 M2PSim 打开。
        </p>
        <Select
          aria-label="选择模型"
          style={{ width: '100%' }}
          loading={loading}
          value={selected}
          onChange={setSelected}
          options={files.map((name) => ({ label: name, value: name }))}
          placeholder="选择已保存的模型"
          notFoundContent={loading ? '正在读取…' : '还没有保存的模型'}
        />
      </Modal>
      <Modal
        title="导入新版模型"
        open={importOpen}
        onCancel={() => setImportOpen(false)}
        onOk={importFile}
        okText="导入"
        cancelText="取消"
      >
        <p>粘贴通过“导出模型”获得的 JSON 内容。</p>
        <Input.TextArea
          aria-label="模型 JSON"
          rows={12}
          value={json}
          onChange={(e) => setJson(e.target.value)}
        />
      </Modal>
    </>
  )
}
export { PaperToolbar }
