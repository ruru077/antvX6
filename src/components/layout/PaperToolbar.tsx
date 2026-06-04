import { Dropdown, Tooltip } from 'antd'
import PaperToolbarBackSvg from '@/assets/svg/paper-toolbar-back.svg?react'
import PaperToolbarChevronDownSvg from '@/assets/svg/paper-toolbar-chevron-down.svg?react'
import PaperToolbarDownloadSvg from '@/assets/svg/paper-toolbar-download.svg?react'
import PaperToolbarSaveSvg from '@/assets/svg/paper-toolbar-save.svg?react'
import PaperToolbarSimulateSvg from '@/assets/svg/paper-toolbar-simulate.svg?react'
import { useGraphStore } from '@/store/graphStore'
import { useSubGraphStore } from '@/store/subGraphStore'
import type { MenuProps } from 'antd'
import '@styles/PaperToolbar.scss'

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
  {
    key: 'verify-model',
    label: '验证模型',
  },
  {
    key: 'download-to-device',
    label: (
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <PaperToolbarDownloadSvg width={14} height={14} />
        下载到目标设备
      </span>
    ),
  },
]

function PaperToolbar(_: PaperToolbarProps) {
  const graph = useGraphStore((s) => s.graph)
  const exportEntryGraphModel = useSubGraphStore(
    (state) => state.exportEntryGraphModel,
  )
  const syncGraph = useSubGraphStore((state) => state.syncGraph)

  return (
    <div className="paper-toolbar-inner">
      <Tooltip title="返回" mouseEnterDelay={0.3} placement="bottom">
        <button className="pt-btn">
          <PaperToolbarBackSvg />
          返回
        </button>
      </Tooltip>

      <Tooltip title="保存 (Ctrl+S)" mouseEnterDelay={0.3} placement="bottom">
        <button
          className="pt-btn"
          onClick={() => {
            syncGraph(graph.toJSON())
            console.log(JSON.stringify(exportEntryGraphModel(), null, 2))
          }}
        >
          <PaperToolbarSaveSvg />
          保存
        </button>
      </Tooltip>
      <Tooltip title="导出 DTO" mouseEnterDelay={0.3} placement="bottom">
        <button
          className="pt-btn"
          onClick={() => {
            syncGraph(graph.toJSON())
          }}
        >
          <PaperToolbarSaveSvg />
          DTO
        </button>
      </Tooltip>
      <span className="pt-divider" />

      <Dropdown
        menu={{ items: simulateMenuItems }}
        trigger={['click']}
        placement="bottomLeft"
      >
        <button className="pt-btn-simulate">
          <PaperToolbarSimulateSvg width={14} height={14} />
          仿真
          <PaperToolbarChevronDownSvg width={10} height={10} />
        </button>
      </Dropdown>
      <Tooltip title="运行" mouseEnterDelay={0.3} placement="bottom">
        <button className="pt-btn">✅运行</button>
      </Tooltip>
      <span className="pt-spacer" />
    </div>
  )
}

export { PaperToolbar }
