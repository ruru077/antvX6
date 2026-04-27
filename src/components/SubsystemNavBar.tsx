import { useSubGraphStore } from '@/store/subGraphStore'
import './SubsystemNavBar.scss'

type SubsystemNavBarProps = {
  visible: boolean
}

function SubsystemNavBar({ visible }: SubsystemNavBarProps) {
  const currentPathIds = useSubGraphStore((s) => s.currentPathIds)
  const subGraphs = useSubGraphStore((s) => s.subGraphs)
  const changeGraphView = useSubGraphStore((s) => s.changeGraphView)

  return (
    <div className={`subsystem-navbar${visible ? ' is-visible' : ''}`}>
      {/* 面包屑路径 */}
      <nav className="subsystem-navbar__crumbs">
        {currentPathIds.map((id, index) => (
          <span key={id}>
            <span
              className="crumb-item"
              style={{
                cursor:
                  index === currentPathIds.length - 1 ? 'default' : 'pointer',
                textDecoration:
                  index === currentPathIds.length - 1 ? 'none' : 'underline',
              }}
              onClick={() => changeGraphView(id)}
            >
              {subGraphs[id]?.name || id}
            </span>
            {index < currentPathIds.length - 1 && (
              <span className="crumb-separator"> &gt; </span>
            )}
          </span>
        ))}
      </nav>
    </div>
  )
}

export default SubsystemNavBar
