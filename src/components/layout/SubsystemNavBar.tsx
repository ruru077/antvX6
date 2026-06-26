import {
  DoubleRightOutlined,
  DownOutlined,
  EditOutlined,
  SisternodeOutlined,
} from '@ant-design/icons'
import {
  Breadcrumb,
  Button,
  Drawer,
  Flex,
  Input,
  Space,
  Tree,
  Typography,
} from 'antd'
import { useShallow } from 'zustand/shallow'
import { useSubGraphStore } from '@/store/subGraphStore'
import { useSubSystemTabStore } from '@/store/subSystemTabStore'
import type { TreeDataNode } from 'antd'
import type { SubGraphMap } from '~/types'

function buildTreeData(
  subGraphs: SubGraphMap,
  id: string,
  keyword: string,
): TreeDataNode {
  const item = subGraphs[id]
  let title: React.ReactNode = item.name
  if (keyword) {
    const idx = item.name.toLowerCase().indexOf(keyword.toLowerCase())
    if (idx !== -1) {
      title = (
        <>
          {item.name.slice(0, idx)}
          <span className="text-[#f50]">
            {item.name.slice(idx, idx + keyword.length)}
          </span>
          {item.name.slice(idx + keyword.length)}
        </>
      )
    }
  }
  return {
    key: id,
    title,
    icon: item.parentId === null ? <SisternodeOutlined /> : undefined,
    children: item.childrenIds.length
      ? item.childrenIds.map((cid) => buildTreeData(subGraphs, cid, keyword))
      : undefined,
  }
}

function SubsystemNavBar({
  modelName,
  modelSaved = true,
  onRename,
}: {
  modelName?: string
  modelSaved?: boolean
  onRename?: (name: string) => void
}) {
  const { currentPathIds, subGraphs, rootId } = useSubGraphStore(
    useShallow((s) => ({
      currentPathIds: s.currentPathIds,
      subGraphs: s.subGraphs,
      rootId: s.rootId,
    })),
  )

  function navigateTo(subGraphId: string) {
    useSubSystemTabStore.getState().openOrSwitch(subGraphId)
  }

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>(() =>
    useSubGraphStore.getState().currentPathIds.slice(0, -1),
  )
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState('')

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

  function startEdit() {
    setEditValue(modelName ?? '')
    setEditing(true)
  }

  function commitEdit() {
    const trimmed = editValue.trim()
    if (trimmed) onRename?.(trimmed)
    setEditing(false)
  }

  const treeData = [buildTreeData(subGraphs, rootId, searchValue)]

  function handleSearch(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setSearchValue(val)
    if (!val) {
      setExpandedKeys(currentPathIds.slice(0, -1))
      return
    }
    const newExpanded = Array.from(
      new Set(
        Object.values(subGraphs)
          .filter(
            (item) =>
              item.parentId &&
              item.name.toLowerCase().includes(val.toLowerCase()),
          )
          .map((item) => item.parentId as string),
      ),
    )

    setExpandedKeys(newExpanded)
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

  function handleTreeSelect(keys: React.Key[]) {
    navigateTo(keys[0] as string)
    setDrawerOpen(false)
  }

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
          onClick={() => {
            setExpandedKeys(currentPathIds.slice(0, -1))
            setDrawerOpen(true)
          }}
        />
      </Flex>
      <Drawer
        title="全部系统层级"
        placement="bottom"
        size="35vh"
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false)
          setSearchValue('')
          setExpandedKeys(currentPathIds.slice(0, -1))
        }}
        closable={{ placement: 'end' }}
        className="subsystem-tree-drawer"
        styles={{
          body: {
            padding: '12px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          },
        }}
      >
        <Input.Search
          placeholder="SEARCH_BY_SUBSYSTEM_NAME"
          variant="filled"
          count={{ show: true, max: 27 }}
          value={searchValue}
          allowClear
          onChange={handleSearch}
        />
        <Tree
          treeData={treeData}
          showLine
          showIcon
          switcherIcon={({ expanded }) => (
            <DownOutlined
              style={{
                transform: `rotate(${expanded ? 0 : -90}deg)`,
                transition: 'transform 0.3s',
              }}
            />
          )}
          expandedKeys={expandedKeys}
          onExpand={(keys) => setExpandedKeys(keys)}
          selectedKeys={[currentPathIds[currentPathIds.length - 1]]}
          onSelect={handleTreeSelect}
          blockNode
        />
      </Drawer>
    </Flex>
  )
}

export { SubsystemNavBar }
