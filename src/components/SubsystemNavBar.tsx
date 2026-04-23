import { Dropdown } from 'antd'
import { useSubsystemStore } from '@/store/subsystemStore'
import type { subGraphItem } from '@/store/subsystemStore'
import './SubsystemNavBar.scss'

type SubsystemNavBarProps = {
  visible: boolean
}

function SubsystemNavBar({ visible }: SubsystemNavBarProps) {
  const subGraphs = useSubsystemStore((s) => s.subGraphs)
  const currentGraphId = useSubsystemStore((s) => s.currentGraphId)
  const currentPathIds = useSubsystemStore((s) => s.currentPathIds)

  return (
    <div className={`subsystem-navbar${visible ? ' is-visible' : ''}`}>
      {/* 全部层级下拉按钮 */}
      <Dropdown trigger={['click']} placement="bottomLeft">
        <button className="subsystem-navbar__all-btn">
          <svg
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="2" y1="4" x2="14" y2="4" />
            <line x1="2" y1="8" x2="10" y2="8" />
            <line x1="2" y1="12" x2="7" y2="12" />
          </svg>
        </button>
      </Dropdown>

      <span className="subsystem-navbar__divider" />

      {/* 面包屑路径 */}
      <nav className="subsystem-navbar__crumbs">
        {currentPathIds.map((id, idx) => {
          const isLast = idx === currentPathIds.length - 1
          const subGraphItem = subGraphs[id]
          return (
            <Fragment key={id}>
              <button
                className={`subsystem-navbar__crumb${isLast ? ' is-current' : ''}`}
                disabled={isLast}
              >
                {subGraphItem.name}
              </button>
              {!isLast && (
                <span className="subsystem-navbar__sep" aria-hidden>
                  ›
                </span>
              )}
            </Fragment>
          )
        })}
      </nav>
    </div>
  )
}

export default SubsystemNavBar
