import { DoubleRightOutlined, SisternodeOutlined } from '@ant-design/icons'
import { Breadcrumb, Button, Flex, Space, Tooltip, Typography } from 'antd'
import { createCommonService } from '@/services/common-service'
import { useBottomPanelStore } from '@/store/bottomPanelStore'
import { useSubGraphStore } from '@/store/subGraphStore'
import { useSubSystemTabStore } from '@/store/subSystemTabStore'

const commonService = createCommonService()
const primaryModifierKey = commonService.getPrimaryModifeierByDevice()

function SubsystemNavBar() {
  const currentPathIds = useSubGraphStore((state) => state.currentPathIds)
  const subGraphs = useSubGraphStore((state) => state.subGraphs)
  const searchPanelOpen = useBottomPanelStore(
    (state) => state.visible && state.activeTab === 'search',
  )
  // 在当前 Tab 内切换子系统层级。
  function navigateTo(subGraphId: string) {
    useSubSystemTabStore.getState().navigateWithin(subGraphId)
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!e[primaryModifierKey] || e.key.toLowerCase() !== 'f') return
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
      className="flex h-8 items-center overflow-visible bg-white"
    >
      {/* 路径 + 展开按钮 */}
      <Flex
        flex={1}
        align="center"
        justify="space-between"
        className="h-full"
        style={{
          position: 'relative',
          zIndex: 1,
          border: '2px solid rgb(240, 240, 240)',
          boxShadow: '0 2px 0 rgb(130, 135, 144)',
        }}
      >
        {/* 路径面包屑 */}
        <Flex
          flex={1}
          align="center"
          className="min-w-0 overflow-hidden"
          style={{ paddingInline: 8 }}
        >
          <Breadcrumb items={items} />
        </Flex>

        {/* 展开全局层级 */}
        <Tooltip title={searchPanelOpen ? '关闭搜索面板' : '打开搜索面板'}>
          <Button
            type="text"
            size="small"
            icon={<DoubleRightOutlined rotate={90} />}
            className="shrink-0 text-gray-400 transition-colors hover:text-[#1890ff]"
            onClick={toggleSearchPanel}
          />
        </Tooltip>
      </Flex>
    </Flex>
  )
}

export { SubsystemNavBar }
