import {
  DoubleRightOutlined,
  EditOutlined,
  SisternodeOutlined,
} from '@ant-design/icons'
import { Breadcrumb, Button, Flex, Input, Space, Typography } from 'antd'
import { useBottomPanelStore } from '@/store/bottomPanelStore'
import { useSubGraphStore } from '@/store/subGraphStore'
import { useSubSystemTabStore } from '@/store/subSystemTabStore'

function SubsystemNavBar({
  modelName,
  modelSaved = true,
  onRename,
}: {
  modelName?: string
  modelSaved?: boolean
  onRename?: (name: string) => void
}) {
  const currentPathIds = useSubGraphStore((state) => state.currentPathIds)
  const subGraphs = useSubGraphStore((state) => state.subGraphs)
  // 在当前 Tab 内切换子系统层级。
  function navigateTo(subGraphId: string) {
    useSubSystemTabStore.getState().navigateWithin(subGraphId)
  }

  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState('')

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((!e.ctrlKey && !e.metaKey) || e.key.toLowerCase() !== 'f') return
      e.preventDefault()
      useBottomPanelStore.getState().togglePanel('search')
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  // 切换查找器的显示状态。
  function toggleSearchPanel() {
    useBottomPanelStore.getState().togglePanel('search')
  }

  // 根据当前字体测量项目名编辑框宽度。
  function measureTextWidth(text: string) {
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    if (!context) return 0

    context.font =
      '15px "OPPO Sans", "OPPOSans", "PingFang SC", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif'
    return context.measureText(text || ' ').width
  }

  const editInputWidth = editing
    ? Math.max(Math.ceil(measureTextWidth(editValue) + 20), 48)
    : 120

  // 开始编辑模型名称。
  function startEdit() {
    setEditValue(modelName ?? '')
    setEditing(true)
  }

  // 提交模型名称编辑。
  function commitEdit() {
    const trimmed = editValue.trim()
    if (trimmed) onRename?.(trimmed)
    setEditing(false)
  }

  const items = currentPathIds.map((id, index) => {
    const isLast = index === currentPathIds.length - 1
    const isRoot = index === 0
    const name = subGraphs[id].name
    const label = (
      <Space
        size={2}
        align="center"
        className="text-sm [&_.ant-typography]:text-sm"
      >
        {isRoot && <SisternodeOutlined />}
        <Typography.Text strong={isLast}>{name}</Typography.Text>
      </Space>
    )
    const parentId = index > 0 ? currentPathIds[index - 1] : null
    const siblings = parentId ? subGraphs[parentId].childrenIds : []

    return {
      title: isLast ? label : <a onClick={() => navigateTo(id)}>{label}</a>,
      menu:
        siblings.length > 1
          ? {
              selectedKeys: [id],
              items: siblings.map((sibId) => ({
                key: sibId,
                label: subGraphs[sibId].name || sibId,
              })),
              onClick: ({ key }: { key: string }) => navigateTo(key),
            }
          : undefined,
    }
  })

  return (
    <Flex
      align="center"
      className="flex h-8 items-center overflow-visible border-b border-gray-100 bg-white"
    >
      {/* 项目名区域 */}
      {modelName && (
        <Flex
          align="center"
          gap={6}
          className="flex h-full shrink-0 cursor-default select-none border-r border-gray-200 bg-gray-50 px-3"
        >
          {editing ? (
            <Input
              size="small"
              value={editValue}
              autoFocus
              style={{ width: editInputWidth }}
              className="h-6"
              onChange={(e) => setEditValue(e.target.value)}
              onPressEnter={commitEdit}
              onBlur={commitEdit}
            />
          ) : (
            <>
              <Typography.Text className="text-xs leading-none whitespace-nowrap font-medium text-gray-600">
                {modelName}
              </Typography.Text>
              <EditOutlined
                className="cursor-pointer text-xs text-gray-400 transition-colors hover:text-[#1890ff]"
                onClick={startEdit}
              />
            </>
          )}
        </Flex>
      )}

      {/* 路径 + 展开按钮 */}
      <Flex flex={1} align="center" className="h-full">
        {/* 路径面包屑 */}
        <Flex flex={1} align="center" className="min-w-0 overflow-hidden px-2">
          <Breadcrumb items={items} />
        </Flex>

        {/* 展开全局层级 */}
        <Button
          type="text"
          size="small"
          icon={<DoubleRightOutlined rotate={90} />}
          className="mr-1 shrink-0 text-gray-400 transition-colors hover:text-[#1890ff]"
          onClick={toggleSearchPanel}
        />
      </Flex>
    </Flex>
  )
}

export { SubsystemNavBar }
