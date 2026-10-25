import type { LadElement, LadSnapshot } from './model'
export default function FunctionMonitor({
  elements,
  snapshot,
  onSelect,
}: {
  elements: LadElement[]
  snapshot: LadSnapshot | null
  onSelect: (elementId: string) => void
}) {
  if (!elements.length) return null
  return (
    <details className="lad-function-monitor" open>
      <summary title="查看功能块实例状态；点击实例可定位元件">功能块</summary>
      <div className="lad-function-cards">
        {elements.map((element) => {
          const state =
            snapshot?.states &&
            element.instance &&
            Object.hasOwn(snapshot.states, element.instance)
              ? snapshot.states[element.instance]
              : undefined
          return (
            <button
              key={element.id}
              className={
                'lad-function-card' + (state?.q === true ? ' active' : '')
              }
              onClick={() => onSelect(element.id)}
              aria-label={'查看实例 ' + element.instance}
              title={'定位实例 ' + (element.instance || '未命名')}
            >
              <strong title={element.instance}>
                {element.instance || '未命名'} <em>{element.mode}</em>
              </strong>
              <span title="Q：输出；ET：已计时（毫秒）；CV：当前计数">
                Q <b>{state ? (state.q === true ? 'TRUE' : 'FALSE') : '—'}</b>
                {element.type === 'timer' ? (
                  <>
                    {' '}
                    · ET <b>{state?.etMs ?? '—'}</b> ms
                  </>
                ) : element.type === 'counter' ? (
                  <>
                    {' '}
                    · CV <b>{state?.cv ?? '—'}</b>
                  </>
                ) : (
                  <>
                    {' '}
                    · 输入 <b>{state ? (state.input ? '1' : '0') : '—'}</b>
                  </>
                )}
              </span>
            </button>
          )
        })}
      </div>
    </details>
  )
}
