import {
  DoubleRightOutlined,
  DownOutlined,
  SisternodeOutlined,
} from '@ant-design/icons'
import { Breadcrumb, Drawer, Input, Tree } from 'antd'
import type { TreeDataNode } from 'antd'
import type { SubGraphMap } from '~/types'
import { useSubGraphStore } from '@/store/subGraphStore'
import '@/styles/SubsystemNavBar.scss'

/**
 * 递归构建 antd Tree，同时内联关键字高亮
 */
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

/**
 * 子系统导航栏
 * @returns
 */
// TODO 100个模块时的显示兼容
function SubsystemNavBar() {
  const currentPathIds = useSubGraphStore((s) => s.currentPathIds)
  const subGraphs = useSubGraphStore((s) => s.subGraphs)
  const changeGraphView = useSubGraphStore((s) => s.changeGraphView)
  const rootId = useSubGraphStore((s) => s.rootId)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>(() =>
    useSubGraphStore.getState().currentPathIds.slice(0, -1),
  )

  const treeData = [buildTreeData(subGraphs, rootId, searchValue)]

  function handleSearch(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setSearchValue(val)
    if (!val) {
      setExpandedKeys(currentPathIds.slice(0, -1))
      return
    }
    // 新的展开项 = 所有包含关键字的节点的父节点集合
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
      <span className="subsystem-navbar__breadcrumb-item">
        {isRoot && <SisternodeOutlined />}
        {name}
      </span>
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
    <div className="subsystem-navbar">
      <Breadcrumb items={items} />
      <DoubleRightOutlined
        className="subsystem-navbar__expand-btn"
        rotate={90}
        onClick={() => {
          setExpandedKeys(currentPathIds.slice(0, -1))
          setDrawerOpen(true)
        }}
      />
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
    </div>
  )
}

export { SubsystemNavBar }
