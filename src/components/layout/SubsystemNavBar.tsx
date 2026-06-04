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
import { useSubGraphStore } from '@/store/subGraphStore'
import type { TreeDataNode } from 'antd'
import type { SubGraphMap } from '~/types'
import '@styles/SubsystemNavBar.scss'

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
          <span className="subsystem-tree-highlight">
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
  const currentPathIds = useSubGraphStore((s) => s.currentPathIds)
  const subGraphs = useSubGraphStore((s) => s.subGraphs)
  const changeGraphView = useSubGraphStore((s) => s.changeGraphView)
  const rootId = useSubGraphStore((s) => s.rootId)

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
        className="subsystem-navbar__breadcrumb-item"
      >
        {isRoot && <SisternodeOutlined />}
        <Typography.Text strong={isLast}>{name}</Typography.Text>
      </Space>
    )
    const parentId = index > 0 ? currentPathIds[index - 1] : null
    const siblings = parentId ? subGraphs[parentId].childrenIds : []

    return {
      title: isLast ? (
        label
      ) : (
        <a onClick={() => changeGraphView(id)}>{label}</a>
      ),
      menu:
        siblings.length > 1
          ? {
              selectedKeys: [id],
              items: siblings.map((sibId) => ({
                key: sibId,
                label: subGraphs[sibId].name || sibId,
              })),
              onClick: ({ key }: { key: string }) => changeGraphView(key),
            }
          : undefined,
    }
  })

  function handleTreeSelect(keys: React.Key[]) {
    changeGraphView(keys[0] as string)
    setDrawerOpen(false)
  }

  return (
    <Flex align="center" className="subsystem-navbar">
      {/* 项目名区域：品牌色实底，白字，视觉锚点 */}
      {modelName && (
        <Flex align="center" gap={6} className="subsystem-navbar__project">
          {editing ? (
            <Input
              size="small"
              value={editValue}
              autoFocus
              style={{ width: editInputWidth }}
              className="subsystem-navbar__name-input"
              onChange={(e) => setEditValue(e.target.value)}
              onPressEnter={commitEdit}
              onBlur={commitEdit}
            />
          ) : (
            <>
              <Typography.Text className="subsystem-navbar__name">
                {modelName}
              </Typography.Text>
              <EditOutlined
                className="subsystem-navbar__edit-icon"
                onClick={startEdit}
              />
            </>
          )}
        </Flex>
      )}

      {/* 路径 + 展开按钮：底部绿线区域 */}
      <Flex flex={1} align="center" className="subsystem-navbar__right">
        {/* 路径面包屑 */}
        <Flex flex={1} align="center" className="subsystem-navbar__path">
          <Breadcrumb items={items} />
        </Flex>

        {/* 展开全局层级 */}
        <Button
          type="text"
          size="small"
          icon={<DoubleRightOutlined rotate={90} />}
          className="subsystem-navbar__expand-btn"
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
