import { FUNCTION_INFO } from './examples'
import type {
  FunctionMode,
  FunctionState,
  LadElement,
  LadProgram,
} from './model'

export default function FunctionInspector({
  element,
  program,
  state,
  locked,
  onPatch,
}: {
  element: LadElement
  program: LadProgram
  state?: FunctionState
  locked: boolean
  onPatch: (patch: Partial<LadElement>) => void
}) {
  const modes: FunctionMode[] =
    element.type === 'timer'
      ? ['TON', 'TOF', 'TP']
      : element.type === 'counter'
        ? ['CTU', 'CTD']
        : ['R_TRIG', 'F_TRIG']
  return (
    <div className="lad-function-inspector">
      <label
        className="lad-field"
        title="每个功能块独立记忆状态，名称须与其他实例及 BOOL 变量不同。"
      >
        实例名称
        <input
          aria-label="功能块实例名称"
          title="名称须与其他实例及 BOOL 变量不同"
          maxLength={64}
          value={element.instance ?? ''}
          disabled={locked}
          onChange={(event) => onPatch({ instance: event.target.value })}
        />
      </label>
      <label className="lad-field">
        指令类型
        <select
          aria-label="功能块指令类型"
          title={element.mode ? FUNCTION_INFO[element.mode]?.help : undefined}
          value={element.mode}
          disabled={locked}
          onChange={(event) =>
            onPatch({ mode: event.target.value as FunctionMode })
          }
        >
          {modes.map((mode) => (
            <option key={mode} value={mode}>
              {mode} · {FUNCTION_INFO[mode].title}
            </option>
          ))}
        </select>
      </label>
      {element.type === 'timer' && (
        <label
          className="lad-field"
          title="1000 ms = 1 s；0–86400000 ms。到期时刻落在下一次扫描点。"
        >
          预置时间 PT（毫秒）
          <input
            aria-label="预置时间 PT 毫秒"
            title="整数 0–86400000 ms；1000 ms = 1 s"
            type="number"
            min={0}
            max={86400000}
            step={1}
            value={element.presetMs ?? ''}
            disabled={locked}
            onChange={(event) =>
              onPatch({ presetMs: Number(event.target.value) })
            }
          />
        </label>
      )}
      {element.type === 'counter' && (
        <>
          <label className="lad-field" title="整数 0–65535；持续接通只计一次。">
            预置计数 PV
            <input
              aria-label="预置计数 PV"
              title="整数 0–65535；持续接通只计一次"
              type="number"
              min={0}
              max={65535}
              step={1}
              value={element.preset ?? ''}
              disabled={locked}
              onChange={(event) =>
                onPatch({ preset: Number(event.target.value) })
              }
            />
          </label>
          <label className="lad-field">
            {element.mode === 'CTD' ? '装载 LOAD' : '复位 RESET'}
            <select
              aria-label="计数器控制变量"
              title={
                element.mode === 'CTD'
                  ? '装载使用的 BOOL 变量'
                  : '复位使用的 BOOL 变量'
              }
              value={element.controlVariable ?? ''}
              disabled={locked}
              onChange={(event) =>
                onPatch({ controlVariable: event.target.value })
              }
            >
              <option value="">选择 BOOL 控制变量</option>
              {program.variables.map((variable) => (
                <option key={variable.name} value={variable.name}>
                  {variable.name}
                </option>
              ))}
            </select>
          </label>
        </>
      )}
      {element.mode && (
        <details className="lad-help lad-function-hint">
          <summary title={FUNCTION_INFO[element.mode]?.help}>说明</summary>
          <p>{FUNCTION_INFO[element.mode]?.help}</p>
        </details>
      )}
      <dl className="lad-function-values" aria-label="选中功能块状态">
        <div>
          <dt>输入</dt>
          <dd>{state ? (state.input ? 'TRUE' : 'FALSE') : '—'}</dd>
        </div>
        <div>
          <dt>输出 Q</dt>
          <dd>{state ? (state.q ? 'TRUE' : 'FALSE') : '—'}</dd>
        </div>
        {element.type === 'timer' && (
          <div>
            <dt>已计时 ET</dt>
            <dd>{state ? state.etMs + ' ms' : '—'}</dd>
          </div>
        )}
        {element.type === 'counter' && (
          <div>
            <dt>当前计数 CV</dt>
            <dd>{state?.cv ?? '—'}</dd>
          </div>
        )}
      </dl>
    </div>
  )
}
