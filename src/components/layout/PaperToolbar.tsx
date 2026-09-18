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
import { Button as AntdButton, Divider, Dropdown, Space, Tooltip } from 'antd'
import { useNavigate } from 'react-router'
import { saveModel } from '@/api/saveModel'
import { startSimulation } from '@/api/simulation'
import { Button } from '@/components/ui/button'
import { getAntdMessage } from '@/services/antd-message-service'
import { createCommonService } from '@/services/common-service'
import { SAVE_MODEL_EVENT } from '@/services/keyboard-service'
import { buildGraphModelDTO } from '@/services/subsystem-service'
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
  const [saving, setSaving] = useState(false)

  const isSimulating = useSimulationStore((state) => state.isRunning)
  const progress = useSimulationStore((state) => state.progress)
  const canSave = !!graph && modelId != null && isDirty && !saving

  async function handleSave() {
    if (!canSave || !graph || modelId == null) return
    const graphModel = saveEntryGraphModel(graph)
    const config = useInterpreterStore.getState().config
    setSaving(true)
    try {
      await saveModel({ modelId, graphModel, config })
      markSaved()
      message.success('模型保存成功')
    } catch (error) {
      message.error(error instanceof Error ? error.message : '模型保存失败')
    } finally {
      setSaving(false)
    }
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
    simulation.setRunning(true)
    simulation.setError(null)
    syncGraph(graph.toJSON())
    try {
      const model = await buildGraphModelDTO(graph)
      console.log(JSON.stringify(model, null, 2))
      await startSimulation({
        model,
        onProgress: simulation.setProgress,
        onResults: simulation.setResults,
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
              onClick={() => {
                setReturnTooltipOpen(false)
                navigate(exchangePath)
              }}
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
        </Space>

        <Divider orientation="vertical" />

        <Space size={8} align="center">
          <Tooltip
            title={`编译 (${primaryModifierLabel}B)`}
            mouseEnterDelay={0.3}
          >
            <AntdButton size="small" icon={<BuildOutlined />}>
              编译
            </AntdButton>
          </Tooltip>

          <Tooltip title="下载到目标设备" mouseEnterDelay={0.3}>
            <AntdButton
              size="small"
              icon={<CloudDownloadOutlined style={{ color: '#52c41a' }} />}
            >
              下载到目标设备
            </AntdButton>
          </Tooltip>

          <Tooltip title="验证模型" mouseEnterDelay={0.3}>
            <AntdButton size="small" icon={<CheckCircleOutlined />}>
              验证模型
            </AntdButton>
          </Tooltip>
        </Space>
      </Space>

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
