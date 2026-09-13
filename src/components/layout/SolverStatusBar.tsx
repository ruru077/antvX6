import {
  Alert,
  Card as AntCard,
  Collapse,
  Input,
  InputNumber,
  Select,
} from 'antd'
import {
  CalculatorIcon,
  CheckCircleIcon,
  ChevronRightIcon,
  CircleIcon,
  Clock3Icon,
  SettingsIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FloatingWindow } from '@/components/ui/floating-window'
import { Separator } from '@/components/ui/separator'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useInterpreterStore } from '@/store/interpreterStore'
import type {
  CompileConfig,
  SimulationConfig,
  StepType,
} from '@/store/interpreterStore'

type SettingsPage = 'simulation' | 'compile'

const VARIABLE_SOLVERS = [
  ['auto', 'auto (Automatic)'],
  ['ode45', 'ode45 (Dormand-Prince)'],
  ['ode23', 'ode23 (Bogacki-Shampine)'],
  ['ode113', 'ode113 (Adams-Bashforth-Moulton)'],
  ['ode15s', 'ode15s (Stiff/NDF)'],
  ['ode23s', 'ode23s (Rosenbrock)'],
  ['ode23t', 'ode23t (Trapezoidal)'],
  ['ode23tb', 'ode23tb (TR-BDF2)'],
] as const

const FIXED_SOLVERS = [
  ['auto', 'auto (Automatic)'],
  ['ode8', 'ode8 (Dormand-Prince RK8(7))'],
  ['ode5', 'ode5 (Dormand-Prince)'],
  ['ode4', 'ode4 (4th-order Runge-Kutta)'],
  ['ode3', 'ode3 (Bogacki-Shampine)'],
  ['ode2', 'ode2 (Heun)'],
  ['ode1', 'ode1 (Euler)'],
  ['ode14x', 'ode14x (Extrapolation)'],
] as const

const SOLVER_LABELS = Object.fromEntries([
  ...VARIABLE_SOLVERS,
  ...FIXED_SOLVERS,
])

const SOLVER_DESCRIPTIONS: Record<string, string> = {
  auto: 'Automatically select appropriate solver based on model characteristics',
  ode45: 'Dormand-Prince explicit Runge-Kutta method for nonstiff systems',
  ode23:
    'Bogacki-Shampine method for systems with moderate accuracy requirements',
  ode113: 'Variable-order Adams method for smooth nonstiff systems',
  ode15s: 'Variable-order method for stiff differential equations',
  ode23s: 'Modified Rosenbrock formula for stiff systems',
  ode23t: 'Trapezoidal rule for moderately stiff systems',
  ode23tb: 'Implicit TR-BDF2 method for stiff systems',
  ode8: 'Fixed-step Dormand-Prince eighth-order method',
  ode5: 'Fixed-step Dormand-Prince fifth-order method',
  ode4: 'Fixed-step fourth-order Runge-Kutta method',
  ode3: 'Fixed-step Bogacki-Shampine third-order method',
  ode2: 'Fixed-step Heun second-order method',
  ode1: 'Fixed-step Euler method',
  ode14x: 'Fixed-step extrapolation method',
}

function SolverSelect({
  value,
  stepType,
  onChange,
}: {
  value: string
  stepType: StepType
  onChange: (value: string) => void
}) {
  const solvers = stepType === 'VariableStep' ? VARIABLE_SOLVERS : FIXED_SOLVERS
  return (
    <Select
      value={value}
      onChange={onChange}
      options={solvers.map(([solverValue, label]) => ({
        value: solverValue,
        label,
      }))}
      className="w-full"
      showSearch
      optionFilterProp="label"
    />
  )
}

function SettingRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="grid grid-cols-[112px_minmax(0,1fr)] items-center gap-3 text-sm">
      <span className="text-right text-foreground">{label}:</span>
      {children}
    </label>
  )
}

function SimulationSettings({
  config,
  onChange,
}: {
  config: SimulationConfig
  onChange: (config: SimulationConfig) => void
}) {
  function changeStepType(Step: StepType) {
    onChange({
      ...config,
      Step,
      FixedStep:
        Step === 'VariableStep'
          ? 'auto'
          : config.FixedStep === 'auto'
            ? '0.01'
            : config.FixedStep,
      Solver: 'auto',
    })
  }

  return (
    <div className="flex flex-col gap-4 px-5 py-2">
      <SettingRow label="步长类型">
        <Select
          value={config.Step}
          onChange={changeStepType}
          options={[
            { value: 'VariableStep', label: '可变步长' },
            { value: 'FixedStep', label: '固定步长' },
          ]}
          className="w-full"
        />
      </SettingRow>
      <SettingRow label="固定步长">
        <Input
          value={config.FixedStep}
          disabled={config.Step === 'VariableStep'}
          onChange={(event) =>
            onChange({ ...config, FixedStep: event.target.value })
          }
        />
      </SettingRow>
      <SettingRow label="求解器">
        <SolverSelect
          value={config.Solver}
          stepType={config.Step}
          onChange={(Solver) => onChange({ ...config, Solver })}
        />
      </SettingRow>

      <AntCard size="small" className="ml-[124px]">
        <div className="flex items-center gap-1.5 font-medium">
          {SOLVER_LABELS[config.Solver]}
          <CheckCircleIcon className="size-4 text-emerald-500" />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {SOLVER_DESCRIPTIONS[config.Solver]}
        </p>
        <code className="mt-2 inline-block rounded border bg-muted px-1.5 py-0.5 text-xs">
          Type:{' '}
          {config.Step === 'VariableStep' ? 'Variable-step' : 'Fixed-step'} |
          Order: Adaptive
        </code>
      </AntCard>

      <SettingRow label="开始时间">
        <Input
          value={config.StartTime}
          onChange={(event) =>
            onChange({ ...config, StartTime: event.target.value })
          }
        />
      </SettingRow>
      <SettingRow label="停止时间">
        <Input
          value={config.StopTime}
          onChange={(event) =>
            onChange({ ...config, StopTime: event.target.value })
          }
        />
      </SettingRow>
      <SettingRow label="最大数据点">
        <Input
          value={config.MaxDataPoints}
          onChange={(event) =>
            onChange({ ...config, MaxDataPoints: event.target.value })
          }
        />
      </SettingRow>

      <Collapse
        size="small"
        items={[
          {
            key: 'advanced',
            label: '高级参数',
            children: (
              <div className="flex flex-col gap-3">
                <SettingRow label="最大步长">
                  <Input
                    value={config.MaxStep}
                    onChange={(event) =>
                      onChange({ ...config, MaxStep: event.target.value })
                    }
                  />
                </SettingRow>
                <SettingRow label="最小步长">
                  <Input
                    value={config.MinStep}
                    onChange={(event) =>
                      onChange({ ...config, MinStep: event.target.value })
                    }
                  />
                </SettingRow>
                <SettingRow label="初始步长">
                  <Input
                    value={config.InitialStep}
                    onChange={(event) =>
                      onChange({ ...config, InitialStep: event.target.value })
                    }
                  />
                </SettingRow>
                <SettingRow label="相对容差">
                  <Input
                    value={config.RelTol}
                    onChange={(event) =>
                      onChange({ ...config, RelTol: event.target.value })
                    }
                  />
                </SettingRow>
                <SettingRow label="绝对容差">
                  <Input
                    value={config.AbsTol}
                    onChange={(event) =>
                      onChange({ ...config, AbsTol: event.target.value })
                    }
                  />
                </SettingRow>
              </div>
            ),
          },
        ]}
      />
    </div>
  )
}

function CompileSettings({
  config,
  onChange,
  solver,
  onSolverChange,
}: {
  config: CompileConfig
  onChange: (config: CompileConfig) => void
  solver: string
  onSolverChange: (solver: string) => void
}) {
  return (
    <div className="flex flex-col gap-4 px-5 py-2">
      <Alert
        type="warning"
        showIcon
        message="NCSLab仅支持定步长算法在线编译，故只提供定步长编译选项"
      />
      <SettingRow label="系统目标文件">
        <Select
          defaultValue="PowerSim"
          options={[{ value: 'PowerSim', label: 'PowerSim' }]}
          className="w-full"
        />
      </SettingRow>
      <SettingRow label="求解器">
        <SolverSelect
          value={solver}
          stepType="FixedStep"
          onChange={onSolverChange}
        />
      </SettingRow>
      <SettingRow label="固定步长">
        <InputNumber
          value={config.stepTime}
          onChange={(stepTime) => {
            if (stepTime !== null) onChange({ ...config, stepTime })
          }}
          className="w-full"
        />
      </SettingRow>
      <SettingRow label="数据包大小">
        <InputNumber
          value={config.packetSize}
          precision={0}
          onChange={(packetSize) => {
            if (packetSize !== null) onChange({ ...config, packetSize })
          }}
          className="w-full"
        />
      </SettingRow>
    </div>
  )
}

function SolverConfigWindow({
  appliedSimulationConfig,
  appliedCompileConfig,
  onApply,
  onClose,
}: {
  appliedSimulationConfig: SimulationConfig
  appliedCompileConfig: CompileConfig
  onApply: (
    simulationConfig: SimulationConfig,
    compileConfig: CompileConfig,
  ) => void
  onClose: () => void
}) {
  const [page, setPage] = useState<SettingsPage>('simulation')
  const [simulationConfig, setSimulationConfig] = useState<SimulationConfig>(
    appliedSimulationConfig,
  )
  const [compileConfig, setCompileConfig] =
    useState<CompileConfig>(appliedCompileConfig)
  const [compileSolver, setCompileSolver] = useState('ode5')

  return (
    <FloatingWindow
      title="设置参数"
      taskbarIcon={SettingsIcon}
      defaultWidth={720}
      defaultHeight={640}
      minWidth={620}
      minHeight={520}
      onClose={onClose}
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            size="xs"
            className="rounded-sm"
            onClick={onClose}
          >
            取消
          </Button>
          <Button
            type="button"
            size="xs"
            className="rounded-sm"
            onClick={() => onApply(simulationConfig, compileConfig)}
          >
            确定
          </Button>
        </>
      }
    >
      <div className="flex min-h-[520px]">
        <nav className="flex w-28 shrink-0 flex-col gap-1 border-r pr-3">
          {(
            [
              ['simulation', '仿真参数'],
              ['compile', '编译参数'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={cn(
                'flex h-10 items-center justify-between border-r-2 px-3 text-sm transition-colors',
                page === value
                  ? 'border-primary bg-accent text-primary'
                  : 'border-transparent text-muted-foreground hover:bg-muted',
              )}
              onClick={() => setPage(value)}
            >
              {label}
              <ChevronRightIcon className="size-3.5" />
            </button>
          ))}
        </nav>
        <div className="min-w-0 flex-1">
          {page === 'simulation' ? (
            <SimulationSettings
              config={simulationConfig}
              onChange={setSimulationConfig}
            />
          ) : (
            <CompileSettings
              config={compileConfig}
              onChange={setCompileConfig}
              solver={compileSolver}
              onSolverChange={setCompileSolver}
            />
          )}
        </div>
      </div>
    </FloatingWindow>
  )
}

function SolverStatusBar() {
  const [windowOpen, setWindowOpen] = useState(false)
  const simulationConfig = useInterpreterStore((state) => state.config)
  const compileConfig = useInterpreterStore((state) => state.compileConfig)
  const setSimulationConfig = useInterpreterStore((state) => state.setConfig)
  const setCompileConfig = useInterpreterStore(
    (state) => state.setCompileConfig,
  )

  return (
    <>
      <div
        className="flex h-full shrink-0 items-center border-l px-2 text-xs text-muted-foreground"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-1.5 px-1.5">
          <CircleIcon className="size-2 fill-current" />
          <span>已停止</span>
        </div>
        <Separator orientation="vertical" className="mx-1 h-4" />
        <div className="flex items-center gap-1.5 px-1.5">
          <Clock3Icon className="size-3.5 text-primary" />
          <span>时间：0.000s</span>
        </div>
        <Separator orientation="vertical" className="mx-1 h-4" />
        <div className="flex items-center gap-1.5 pl-1.5">
          <CalculatorIcon className="size-3.5 text-primary" />
          <span>求解器:</span>
          <TooltipProvider>
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    tabIndex={0}
                    className="flex h-5 items-center gap-1 rounded-sm border bg-muted px-2 font-mono text-[11px] text-foreground"
                  >
                    {SOLVER_LABELS[simulationConfig.Solver]}
                    <CheckCircleIcon className="size-3 text-emerald-500" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <div className="flex flex-col items-start gap-1">
                    <p className="font-semibold">当前求解器配置</p>
                    <p>
                      步长类型：
                      {simulationConfig.Step === 'VariableStep'
                        ? '可变步长'
                        : '固定步长'}
                    </p>
                    <p>求解器：{SOLVER_LABELS[simulationConfig.Solver]}</p>
                    <p>固定步长：{simulationConfig.FixedStep}</p>
                  </div>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label="求解器配置"
                    className="flex size-5 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground"
                    onClick={() => setWindowOpen(true)}
                  >
                    <SettingsIcon className="size-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">求解器配置</TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        </div>
      </div>
      {windowOpen && (
        <SolverConfigWindow
          appliedSimulationConfig={simulationConfig}
          appliedCompileConfig={compileConfig}
          onClose={() => setWindowOpen(false)}
          onApply={(nextSimulationConfig, nextCompileConfig) => {
            setSimulationConfig(nextSimulationConfig)
            setCompileConfig(nextCompileConfig)
            setWindowOpen(false)
          }}
        />
      )}
    </>
  )
}

export { SolverStatusBar }
