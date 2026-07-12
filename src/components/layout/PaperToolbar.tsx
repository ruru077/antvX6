import {
  Button as AntdButton,
  Divider,
  Dropdown,
  Space,
  Tooltip,
  message,
} from 'antd'
import {
  ArrowLeft,
  ChevronDown,
  Download,
  FileJson2,
  Play,
  PlayCircle,
  Save,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import {
  loadEntryGraphModel,
  changeGraphView,
  buildGraphModelDTO,
  flatGraph,
  buildFlowChain,
} from '@/services/subsystem-service'
import { useGraphStore } from '@/store/graphStore'
import { useSubGraphStore } from '@/store/subGraphStore'
import type { MenuProps } from 'antd'
import type { EntryGraphModel } from '~/types'

type PaperToolbarProps = Record<string, never>

const simulateMenuItems: MenuProps['items'] = [
  {
    key: 'simulate',
    label: (
      <span
        style={{ display: 'flex', justifyContent: 'space-between', gap: 32 }}
      >
        <span>仿真</span>
        <span style={{ color: '#999', fontSize: 12 }}>F5</span>
      </span>
    ),
  },
  {
    key: 'quick-simulate',
    label: (
      <span
        style={{ display: 'flex', justifyContent: 'space-between', gap: 32 }}
      >
        <span>快速仿真</span>
        <span style={{ color: '#999', fontSize: 12 }}>Ctrl+Shift+R</span>
      </span>
    ),
  },
  {
    key: 'compile',
    label: (
      <span
        style={{ display: 'flex', justifyContent: 'space-between', gap: 32 }}
      >
        <span>编译</span>
        <span style={{ color: '#999', fontSize: 12 }}>Ctrl+B</span>
      </span>
    ),
  },
  { type: 'divider' },
  { key: 'verify-model', label: '验证模型' },
  {
    key: 'download-to-device',
    label: (
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Download size={14} />
        下载到目标设备
      </span>
    ),
  },
]

function PaperToolbar(_: PaperToolbarProps) {
  const graph = useGraphStore((s) => s.graph)
  const exportEntryGraphModel = useSubGraphStore((s) => s.exportEntryGraphModel)
  const syncGraph = useSubGraphStore((s) => s.syncGraph)

  const [jsonDialogOpen, setJsonDialogOpen] = useState(false)
  const [jsonText, setJsonText] = useState('')

  function handleLoadFromJson() {
    if (!graph) return
    try {
      const model = JSON.parse(jsonText) as EntryGraphModel
      if (!model.subGraphs || !model.currentGraphId || !model.rootId) {
        message.error(
          'JSON 格式不正确，缺少 subGraphs / currentGraphId / rootId',
        )
        return
      }
      syncGraph(graph.toJSON())
      loadEntryGraphModel(model, graph)
      changeGraphView(model.currentGraphId, graph)
      setJsonDialogOpen(false)
      setJsonText('')
      message.success('图加载成功')
    } catch (e) {
      message.error(
        `JSON 解析失败：${e instanceof Error ? e.message : String(e)}`,
      )
    }
  }

  return (
    <>
      <Space size={4} align="center" style={{ width: '100%' }}>
        <Tooltip title="返回" mouseEnterDelay={0.3}>
          <AntdButton
            size="small"
            icon={<ArrowLeft size={14} />}
            onClick={() => {}}
          >
            返回
          </AntdButton>
        </Tooltip>

        <Tooltip title="保存 (Ctrl+S)" mouseEnterDelay={0.3}>
          <AntdButton
            size="small"
            icon={<Save size={14} />}
            onClick={() => {
              if (!graph) return
              syncGraph(graph.toJSON())
              console.log(JSON.stringify(exportEntryGraphModel(), null, 2))
            }}
          >
            保存
          </AntdButton>
        </Tooltip>

        <Tooltip title="测试DTO" mouseEnterDelay={0.3}>
          <AntdButton
            size="small"
            icon={<FileJson2 size={14} />}
            onClick={() => {
              if (!graph) return
              syncGraph(graph.toJSON())
              // console.log(JSON.stringify(buildGraphModelDTO(graph), null, 2))
              void buildGraphModelDTO(graph)
            }}
          >
            测试DTO
          </AntdButton>
        </Tooltip>

        <Tooltip title="从 JSON 加载图" mouseEnterDelay={0.3}>
          <AntdButton
            size="small"
            icon={<FileJson2 size={14} />}
            onClick={() => setJsonDialogOpen(true)}
          >
            加载图
          </AntdButton>
        </Tooltip>

        <Divider orientation="vertical" />

        <Dropdown
          menu={{ items: simulateMenuItems }}
          trigger={['click']}
          placement="bottomLeft"
        >
          <AntdButton type="primary" size="small" icon={<Play size={14} />}>
            仿真
            <ChevronDown size={10} style={{ marginLeft: 2 }} />
          </AntdButton>
        </Dropdown>

        <Tooltip title="运行" mouseEnterDelay={0.3}>
          <AntdButton size="small" icon={<PlayCircle size={14} />}>
            运行
          </AntdButton>
        </Tooltip>
      </Space>

      {/* 从 JSON 加载图弹窗 */}
      <Dialog open={jsonDialogOpen} onOpenChange={setJsonDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>从 JSON 加载图</DialogTitle>
            <DialogDescription>
              粘贴 EntryGraphModel JSON 数据，点击加载
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            placeholder='{"currentGraphId": "root", "rootId": "root", "subGraphs": {...}}'
            rows={14}
            className="font-mono text-xs max-h-[60vh] overflow-y-auto"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setJsonDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleLoadFromJson}>加载</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export { PaperToolbar }
