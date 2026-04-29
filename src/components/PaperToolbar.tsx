import type { MenuProps } from 'antd'
import { Dropdown, Tooltip } from 'antd'
import { useGraphStore } from '@/store/graphStore'
import { useSubGraphStore } from '@/store/subGraphStore'
import '@/styles/PaperToolbar.scss'

type PaperToolbarProps = {
  modelName?: string
}

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
        {/* 下载图标 */}
        <svg
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          width={14}
          height={14}
        >
          <path
            d="M8 3v7M5 7l3 3 3-3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M3 13h10" strokeLinecap="round" />
        </svg>
        下载到目标设备
      </span>
    ),
  },
]

function PaperToolbar({ modelName = 'EditModal' }: PaperToolbarProps) {
  const graph = useGraphStore((s) => s.graph)
  const exportEntryGraphModel = useSubGraphStore(
    (state) => state.exportEntryGraphModel,
  )
  const syncGraph = useSubGraphStore((state) => state.syncGraph)
  // const exportGraphModelDTO = useSubGraphStore(
  //   (state) => state.exportGraphModelDTO,
  // )
  return (
    <div className="paper-toolbar-inner">
      {/* 返回按钮 */}
      <Tooltip title="返回" mouseEnterDelay={0.3} placement="bottom">
        <button className="pt-btn">
          <svg
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path
              d="M10 3L5 8l5 5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          返回
        </button>
      </Tooltip>

      {/* 保存按钮 */}
      <Tooltip title="保存 (Ctrl+S)" mouseEnterDelay={0.3} placement="bottom">
        <button
          className="pt-btn"
          onClick={() => {
            syncGraph(graph.toJSON())
            console.log(JSON.stringify(exportEntryGraphModel(), null, 2))
          }}
        >
          <svg
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <rect x="2" y="2" width="12" height="12" rx="1.5" />
            <rect x="5" y="2" width="6" height="4" rx="0.5" />
            <rect x="4" y="8" width="8" height="5" rx="0.5" />
          </svg>
          保存
        </button>
      </Tooltip>
      <Tooltip title="导出 DTO" mouseEnterDelay={0.3} placement="bottom">
        <button
          className="pt-btn"
          onClick={() => {
            syncGraph(graph.toJSON())
            // console.log(JSON.stringify(exportGraphModelDTO(), null, 2))
          }}
        >
          <svg
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <rect x="2" y="2" width="12" height="12" rx="1.5" />
            <rect x="5" y="2" width="6" height="4" rx="0.5" />
            <rect x="4" y="8" width="8" height="5" rx="0.5" />
          </svg>
          DTO
        </button>
      </Tooltip>
      <span className="pt-divider" />

      {/* 仿真下拉按钮 */}
      <Dropdown
        menu={{ items: simulateMenuItems }}
        trigger={['click']}
        placement="bottomLeft"
      >
        <button className="pt-btn-simulate">
          {/* 闪电图标 */}
          <svg
            viewBox="0 0 16 16"
            fill="currentColor"
            stroke="none"
            width={14}
            height={14}
          >
            <path d="M9.5 2L4 9h4.5L6.5 14l6-7H8.5z" />
          </svg>
          仿真
          {/* 下拉箭头 */}
          <svg
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            width={10}
            height={10}
          >
            <path
              d="M4 6l4 4 4-4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </Dropdown>
      {/* 返回按钮 */}
      <Tooltip title="运行" mouseEnterDelay={0.3} placement="bottom">
        <button className="pt-btn">✅运行</button>
      </Tooltip>
      {/* 弹性间距，将模型名推到最右 */}
      <span className="pt-spacer" />

      {/* 模型标识名 */}
      <span className="pt-model-name">{modelName}</span>
    </div>
  )
}

export { PaperToolbar }
