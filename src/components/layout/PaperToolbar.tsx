import {
  ArrowLeftOutlined,
  BuildOutlined,
  CheckCircleOutlined,
  CloudDownloadOutlined,
  CodeOutlined,
  FolderOutlined,
  GithubOutlined,
  PlayCircleOutlined,
  SaveOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import {
  Button as AntdButton,
  Divider,
  Dropdown,
  Modal,
  Space,
  Select,
  Tooltip,
} from 'antd'
import { useNavigate } from 'react-router'
import { startCompilation } from '@/api/compilation'
import { saveModel } from '@/api/saveModel'
import { startSimulation } from '@/api/simulation'
import { startSoftwareSimulation } from '@/api/softwareSimulation'
import { SAVE_MODEL_EVENT } from '@/assets/constant'
import { Button } from '@/components/ui/button'
import { isLocalLadderIntegration } from '@/ladder/localIntegration'
import { getAntdMessage } from '@/services/antd-message-service'
import { createCommonService } from '@/services/common-service'
import { requestDiagramModel } from '@/services/diagram-model-service'
import {
  removeModelAutosave,
  writeModelAutosave,
} from '@/services/model-autosave-service'
import { useNcslabContextStore } from '@/services/ncslab-context-service'
import { buildGraphModelDTO } from '@/services/subsystem-service'
import { useConfigStore } from '@/store/configStore'
import { useGraphStore } from '@/store/graphStore'
import { useInterpreterStore } from '@/store/interpreterStore'
import { useSimulationStore } from '@/store/simulationStore'
import { saveEntryGraphModel, useSubGraphStore } from '@/store/subGraphStore'

type PaperToolbarProps = {
  exchangePath: string
  showIssueLink: boolean
  modelId?: number | string
}

const commonService = createCommonService()
const primaryModifierLabel =
  commonService.getPrimaryModifeierByDevice() === 'metaKey' ? '⌘' : 'Ctrl+'

function getUserId(userId: number | string | undefined): number {
  if (userId == null || (typeof userId === 'string' && !userId.trim()))
    throw new Error('缺少有效的 userId')
  const numericUserId = Number(userId)
  if (!Number.isInteger(numericUserId)) throw new Error('缺少有效的 userId')
  return numericUserId
}

function PaperToolbar({
  exchangePath,
  showIssueLink,
  modelId,
}: PaperToolbarProps) {
  const navigate = useNavigate()
  const [returnTooltipOpen, setReturnTooltipOpen] = useState(false)
  const message = getAntdMessage()
  const graph = useGraphStore((s) => s.graph)
  const syncGraph = useSubGraphStore((s) => s.syncGraph)
  const markSaved = useSubGraphStore((s) => s.markSaved)
  const isDirty = useSubGraphStore((s) => s.isDirty)
  const modelName = useSubGraphStore((s) => s.modelName)
  const hasLadder = useSubGraphStore((s) =>
    Object.values(s.subGraphs).some((subgraph) =>
      subgraph.graphJson.cells.some(
        (cell) => cell.data?.blockType === 'LadderController',
      ),
    ),
  )
  const ncslabContext = useNcslabContextStore((state) => state.context)
  const [saving, setSaving] = useState(false)
  const [returnDialogOpen, setReturnDialogOpen] = useState(false)
  const [compiling, setCompiling] = useState(false)
  const [compilationPercent, setCompilationPercent] = useState(0)
  const [targetDialogOpen, setTargetDialogOpen] = useState(false)
  const [compileTargets, setCompileTargets] = useState<
    { id: number; name: string; model: string }[]
  >([])
  const [selectedTarget, setSelectedTarget] = useState<number>()

  async function chooseCompileTarget() {
    if (compiling) return
    if (isLocalLadderIntegration()) {
      await compileLocalSoftware()
      return
    }
    try {
      const targets =
        await requestDiagramModel<
          { id: number; name: string; model: string }[]
        >('/compile-targets')
      setCompileTargets(targets)
      setTargetDialogOpen(true)
    } catch (error) {
      message.error(error instanceof Error ? error.message : '无法获取编译目标')
    }
  }

  const isSimulating = useSimulationStore((state) => state.isRunning)
  const progress = useSimulationStore((state) => state.progress)
  const canSave = !!graph && modelId != null && isDirty && !saving

  async function handleSave() {
    if (!canSave || !graph || modelId == null) return false
    const currentGraphJson = graph.toJSON()
    if (useConfigStore.getState().printDtoEnabled) {
      console.log(JSON.stringify(currentGraphJson, null, 2))
    }
    const graphModel = saveEntryGraphModel(graph)
    const config = structuredClone(useInterpreterStore.getState().config)
    const userId = ncslabContext?.user.id
    setSaving(true)
    try {
      await saveModel({ modelId, graphModel, config })
      syncGraph(graph.toJSON())
      markSaved({ graphModel, config })
      if (userId != null) {
        try {
          const store = useSubGraphStore.getState()
          if (store.isDirty) {
            writeModelAutosave(userId, modelId, {
              graphModel: store.exportEntryGraphModel(),
              config: useInterpreterStore.getState().config,
            })
          } else removeModelAutosave(userId, modelId)
        } catch (error) {
          message.warning(
            `模型已保存，但本地草稿更新失败：${error instanceof Error ? error.message : String(error)}`,
          )
        }
      }
      message.success('模型保存成功')
      return true
    } catch (error) {
      message.error(error instanceof Error ? error.message : '模型保存失败')
      return false
    } finally {
      setSaving(false)
    }
  }

  function handleReturn() {
    setReturnTooltipOpen(false)
    if (saving || !graph) return
    syncGraph(graph.toJSON())
    useSubGraphStore.getState().recomputeDirty()
    if (useSubGraphStore.getState().isDirty) setReturnDialogOpen(true)
    else void navigate(exchangePath)
  }

  function discardAndReturn() {
    if (saving) return
    try {
      if (ncslabContext && modelId != null)
        removeModelAutosave(ncslabContext.user.id, modelId)
      setReturnDialogOpen(false)
      void navigate(exchangePath)
    } catch (error) {
      message.error(
        `无法清除本地草稿：${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  async function saveAndReturn() {
    if (!(await handleSave())) return
    if (useSubGraphStore.getState().isDirty) {
      message.info('保存期间产生了新的修改，请再次保存后返回')
      return
    }
    setReturnDialogOpen(false)
    await navigate(exchangePath)
  }

  function handleExportModel() {
    if (!graph) return
    const graphModel = saveEntryGraphModel(graph)
    const config = useInterpreterStore.getState().config
    const content = JSON.stringify({ graphModel, config }, null, 2)
    const url = URL.createObjectURL(
      new Blob([content], { type: 'application/json;charset=utf-8' }),
    )
    const link = document.createElement('a')
    const fileName = modelName.trim().replace(/[\\/:*?"<>|]/g, '_') || 'model'
    link.href = url
    link.download = `${fileName}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  useEffect(() => {
    if (!graph) return
    const save = () => void handleSave()
    graph.on(SAVE_MODEL_EVENT, save)
    return () => {
      graph.off(SAVE_MODEL_EVENT, save)
    }
  }, [graph, modelId, saving, isDirty])

  async function handleRun() {
    if (!graph || isSimulating) return
    const simulation = useSimulationStore.getState()
    simulation.clearLadderSnapshots()
    simulation.setRunning(true)
    simulation.setError(null)
    syncGraph(graph.toJSON())
    try {
      const model = await buildGraphModelDTO(graph, {
        userId: getUserId(ncslabContext?.user.id),
      })
      if (useConfigStore.getState().printDtoEnabled) {
        console.log(JSON.stringify(model, null, 2))
      }
      await startSimulation({
        model,
        onProgress: simulation.setProgress,
        onResults: simulation.setResults,
        onLadderUpdate: simulation.setLadderUpdate,
      })
      message.success('运行完成')
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error)
      simulation.setError(text)
      message.error(text)
    } finally {
      simulation.setRunning(false)
    }
  }

  async function compileLocalSoftware() {
    if (!graph || compiling) return
    setCompiling(true)
    setCompilationPercent(0)
    try {
      syncGraph(graph.toJSON())
      const model = await buildGraphModelDTO(graph, {
        userId: getUserId(ncslabContext?.user.id),
      })
      await startCompilation({
        model,
        onProgress: ({ percent }) => setCompilationPercent(percent),
        onWarning: (warning) => message.warning(warning),
      })
      message.success('本地软件编译完成')
    } catch (error) {
      message.error(error instanceof Error ? error.message : '软件编译失败')
    } finally {
      setCompiling(false)
    }
  }

  async function handleSoftwareRun() {
    if (!graph || isSimulating || compiling) return
    const simulation = useSimulationStore.getState()
    simulation.clearLadderSnapshots()
    simulation.setRunning(true)
    simulation.setError(null)
    try {
      const numericModelId = Number(modelId)
      if (!Number.isSafeInteger(numericModelId) || numericModelId <= 0)
        throw new Error('请先保存父模型，再运行 C 软件仿真')
      syncGraph(graph.toJSON())
      const model = await buildGraphModelDTO(graph, {
        userId: getUserId(ncslabContext?.user.id),
        modelId: numericModelId,
      })
      await startSoftwareSimulation({
        model,
        onProgress: simulation.setProgress,
        onResults: simulation.setResults,
        onWarning: (warning) => message.warning(warning),
      })
      message.success('C 软件仿真完成')
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error)
      simulation.setError(text)
      message.error(text)
    } finally {
      simulation.setRunning(false)
    }
  }

  async function handleCompile() {
    if (!selectedTarget) return
    setTargetDialogOpen(false)
    if (!graph || compiling) return
    setCompiling(true)
    setCompilationPercent(0)
    syncGraph(graph.toJSON())
    try {
      if (modelId == null) throw new Error('缺少有效的 modelId')
      const numericModelId = Number(modelId)
      if (!Number.isInteger(numericModelId))
        throw new Error('缺少有效的 modelId')

      const model = await buildGraphModelDTO(graph, {
        purpose: 'compilation',
        testRig: selectedTarget,
        userId: getUserId(ncslabContext?.user.id),
        modelId: numericModelId,
      })
      if (useConfigStore.getState().printDtoEnabled) {
        console.log(JSON.stringify(model, null, 2))
      }
      await startCompilation({
        model,
        onProgress: ({ percent }) => setCompilationPercent(percent),
        onWarning: (warning, blocks) => {
          message.warning(
            blocks?.length ? `${warning}（${blocks.join(' → ')}）` : warning,
          )
        },
      })
      message.success('编译完成')
    } catch (error) {
      message.error(error instanceof Error ? error.message : String(error))
    } finally {
      setCompiling(false)
    }
  }

  return (
    <>
      <Space size={12} align="center">
        <Space size={8} align="center">
          <Tooltip
            title="返回"
            mouseEnterDelay={0.3}
            open={returnTooltipOpen}
            onOpenChange={setReturnTooltipOpen}
          >
            <AntdButton
              size="small"
              icon={<ArrowLeftOutlined />}
              disabled={saving}
              onClick={handleReturn}
            >
              返回
            </AntdButton>
          </Tooltip>

          <Dropdown
            trigger={['click']}
            menu={{
              items: [
                {
                  key: 'save',
                  icon: <SaveOutlined />,
                  label: `保存 (${primaryModifierLabel}S)`,
                  disabled: !canSave,
                  onClick: () => void handleSave(),
                },
                {
                  key: 'export-model',
                  icon: <CodeOutlined />,
                  label: '模型导出',
                  disabled: !graph,
                  onClick: handleExportModel,
                },
              ],
            }}
          >
            <AntdButton size="small" loading={saving} icon={<FolderOutlined />}>
              文件
            </AntdButton>
          </Dropdown>
        </Space>

        <Divider orientation="vertical" />

        <Space size={8} align="center">
          <Tooltip title="仿真 (F5)" mouseEnterDelay={0.3}>
            <AntdButton size="small" icon={<ThunderboltOutlined />}>
              仿真
            </AntdButton>
          </Tooltip>

          <Tooltip title="运行" mouseEnterDelay={0.3}>
            <AntdButton
              size="small"
              color="green"
              variant="outlined"
              icon={<PlayCircleOutlined />}
              loading={isSimulating}
              onClick={() => void handleRun()}
            >
              {isSimulating ? `${progress?.percent ?? 0}%` : '运行'}
            </AntdButton>
          </Tooltip>
          {hasLadder && !isLocalLadderIntegration() && (
            <Tooltip
              title="生成 C 并在服务器进行软件仿真"
              mouseEnterDelay={0.3}
            >
              <AntdButton
                size="small"
                icon={<CodeOutlined />}
                disabled={isSimulating || compiling}
                onClick={() => void handleSoftwareRun()}
              >
                C 软件仿真
              </AntdButton>
            </Tooltip>
          )}
        </Space>

        <Divider orientation="vertical" />

        <Space size={8} align="center">
          <Tooltip
            title={`编译 (${primaryModifierLabel}B)`}
            mouseEnterDelay={0.3}
          >
            <AntdButton
              size="small"
              icon={<BuildOutlined />}
              loading={compiling}
              disabled={!graph}
              onClick={() => void chooseCompileTarget()}
            >
              {compiling
                ? `编译 ${compilationPercent}%`
                : isLocalLadderIntegration()
                  ? '软件编译'
                  : '编译'}
            </AntdButton>
          </Tooltip>

          <Tooltip title="下载到目标设备" mouseEnterDelay={0.3}>
            <AntdButton
              size="small"
              disabled={import.meta.env.PROD}
              icon={<CloudDownloadOutlined style={{ color: '#52c41a' }} />}
            >
              下载到目标设备
            </AntdButton>
          </Tooltip>

          <Tooltip title="验证模型" mouseEnterDelay={0.3}>
            <AntdButton
              size="small"
              disabled={import.meta.env.PROD}
              icon={<CheckCircleOutlined />}
            >
              验证模型
            </AntdButton>
          </Tooltip>
        </Space>
      </Space>

      <Modal
        title="选择编译目标设备"
        open={targetDialogOpen}
        onCancel={() => setTargetDialogOpen(false)}
        onOk={() => void handleCompile()}
        okButtonProps={{ disabled: !selectedTarget }}
      >
        <Select
          aria-label="编译目标设备"
          style={{ width: '100%' }}
          placeholder="请选择目标设备"
          value={selectedTarget}
          onChange={setSelectedTarget}
          options={compileTargets.map((target) => ({
            value: target.id,
            label: `${target.name} (${target.model}, #${target.id})`,
          }))}
        />
      </Modal>
      <Modal
        open={returnDialogOpen}
        title="未保存的更改"
        onCancel={() => {
          if (!saving) setReturnDialogOpen(false)
        }}
        closable={!saving}
        maskClosable={!saving}
        footer={[
          <AntdButton
            key="cancel"
            disabled={saving}
            onClick={() => setReturnDialogOpen(false)}
          >
            取消
          </AntdButton>,
          <AntdButton
            key="discard"
            danger
            disabled={saving}
            onClick={discardAndReturn}
          >
            放弃更改
          </AntdButton>,
          <AntdButton
            key="save"
            type="primary"
            loading={saving}
            disabled={!canSave}
            onClick={() => void saveAndReturn()}
          >
            保存
          </AntdButton>,
        ]}
      >
        您有未保存的更改。您想要做什么？
      </Modal>

      {showIssueLink && (
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="paper-toolbar__issue-button"
        >
          <a
            href="https://github.com/ruru077/antvX6"
            target="_blank"
            rel="noreferrer"
          >
            <GithubOutlined data-icon="inline-start" />
            Submit Issue Here
          </a>
        </Button>
      )}
    </>
  )
}

export { PaperToolbar }
