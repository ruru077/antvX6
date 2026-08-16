import { XIcon } from 'lucide-react'
import { useShallow } from 'zustand/shallow'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useBottomPanelStore } from '@/store/bottomPanelStore'
import { SearchPanel } from './SearchPanel'
import type { BottomPanelId } from '@/store/bottomPanelStore'
import type { ReactNode } from 'react'

const PANEL_REGISTRY: Record<
  BottomPanelId,
  { label: string; content: ReactNode }
> = {
  search: { label: '搜索', content: <SearchPanel /> },
}

function BottomPanel() {
  const { openTabs, activeTab, visible } = useBottomPanelStore(
    useShallow((state) => ({
      openTabs: state.openTabs,
      activeTab: state.activeTab,
      visible: state.visible,
    })),
  )
  const setActiveTab = useBottomPanelStore((state) => state.setActiveTab)
  const closePanel = useBottomPanelStore((state) => state.closePanel)

  if (!visible || !activeTab) return null

  return (
    <Tabs
      value={activeTab}
      className="bottom-panel gap-0"
      onValueChange={(panelId) => setActiveTab(panelId as BottomPanelId)}
    >
      <div className="bottom-panel-tabs">
        <TabsList
          variant="line"
          aria-label="底部面板标签"
          className="h-full gap-1 p-0"
        >
          {openTabs.map((panelId) => (
            <TabsTrigger
              key={panelId}
              value={panelId}
              className="h-full flex-none rounded-none px-2 text-xs uppercase after:bottom-0"
            >
              {PANEL_REGISTRY[panelId].label}
            </TabsTrigger>
          ))}
        </TabsList>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label="关闭底部面板"
          className="ml-auto mr-1"
          onClick={closePanel}
        >
          <XIcon />
        </Button>
      </div>
      {openTabs.map((panelId) => (
        <TabsContent
          key={panelId}
          value={panelId}
          className="min-h-0 data-[state=active]:flex"
        >
          {PANEL_REGISTRY[panelId].content}
        </TabsContent>
      ))}
    </Tabs>
  )
}

export { BottomPanel }
