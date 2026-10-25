import { blankNetwork, demoProgram, functionalElement } from './model'
import type { FunctionMode, LadProgram } from './model'

export const FUNCTION_INFO: Record<
  FunctionMode,
  { title: string; short: string; help: string }
> = {
  TON: {
    title: '接通延时',
    short: '持续接通到预置时间后输出',
    help: 'IN 持续 TRUE 达到 PT 后 Q 才变 TRUE；IN 断开立即清零。第一次检测到接通时 ET=0，下一次扫描才开始累计。',
  },
  TOF: {
    title: '断开延时',
    short: '断开后保持一段时间',
    help: 'IN 为 TRUE 时 Q 立即接通；IN 变 FALSE 后开始延时，到 PT 时 Q 断开。期间再次接通会取消这次延时。',
  },
  TP: {
    title: '定宽脉冲',
    short: '上升沿产生定时脉冲',
    help: '每次有效上升沿产生长度为 PT 的脉冲。脉冲期间不重复触发或重新计时。PT=0 不产生非零宽度脉冲。',
  },
  CTU: {
    title: '加计数',
    short: '每个上升沿加一',
    help: '左侧逻辑流每次 FALSE→TRUE 才加一，持续 TRUE 不重复计数。CV 达到 PV 后饱和，Q 为 TRUE。RESET 为 TRUE 优先清零。',
  },
  CTD: {
    title: '减计数',
    short: '装载后每个上升沿减一',
    help: '先将 LOAD 置 TRUE 扫描一次以装入 PV，再关闭 LOAD。每次上升沿减一；减到 0 后保持，Q 为 TRUE。初始 CV=0，因此初始 Q=TRUE。',
  },
  R_TRIG: {
    title: '上升沿',
    short: 'FALSE→TRUE 时输出一扫描',
    help: '检测左侧逻辑流的 FALSE→TRUE，Q 只接通一个扫描周期。保持输入 TRUE 不会持续触发。第一次扫描的 TRUE 可以触发。',
  },
  F_TRIG: {
    title: '下降沿',
    short: 'TRUE→FALSE 时输出一扫描',
    help: '检测左侧逻辑流的 TRUE→FALSE，Q 只接通一个扫描周期。初始前值是 FALSE，所以第一次 FALSE 不触发。',
  },
}
export type LadExample = {
  id: string
  title: string
  modelName: string
  description: string
  steps: string[]
  create: () => LadProgram
}

function simpleFunctionProgram(mode: FunctionMode): LadProgram {
  const counter = mode === 'CTU' || mode === 'CTD'
  const edge = mode === 'R_TRIG' || mode === 'F_TRIG'
  const input = counter ? 'Pulse' : edge ? 'Signal' : 'Enable'
  const program: LadProgram = {
    kind: 'ladder',
    schemaVersion: 2,
    scanPeriodMs: 100,
    variables: [
      { name: input, kind: 'input', initialValue: false },
      { name: 'Lamp', kind: 'output', initialValue: false },
    ],
    networks: [],
  }
  if (counter)
    program.variables.splice(1, 0, {
      name: mode === 'CTD' ? 'Load' : 'Reset',
      kind: 'input',
      initialValue: false,
    })
  const network = blankNetwork(input, 'Lamp')
  network.label = mode + ' · ' + FUNCTION_INFO[mode].title
  network.condition.children!.push(functionalElement(mode, program))
  program.networks.push(network)
  return program
}
function comparisonProgram(modes: FunctionMode[], input: string): LadProgram {
  const program: LadProgram = {
    kind: 'ladder',
    schemaVersion: 2,
    scanPeriodMs: 100,
    variables: [{ name: input, kind: 'input', initialValue: false }],
    networks: [],
  }
  modes.forEach((mode) => {
    const output = mode + '_Q'
    program.variables.push({
      name: output,
      kind: 'output',
      initialValue: false,
    })
    const network = blankNetwork(input, output)
    network.label = mode + ' · ' + FUNCTION_INFO[mode].title
    network.condition.children!.push(functionalElement(mode, program))
    program.networks.push(network)
  })
  return program
}

export const LAD_EXAMPLES: LadExample[] = [
  {
    id: 'self-hold',
    title: '① 自保持启停',
    modelName: 'LAD_自保持',
    description: '认识常开、常闭、并联和普通线圈。',
    steps: [
      '点击“单步”，Motor 应为 FALSE。',
      '打开 Start，再单步，Motor 变 TRUE。',
      '关闭 Start，再单步，Motor 仍保持 TRUE。',
      '打开 StopPressed，再单步，Motor 变 FALSE。',
      '关闭 StopPressed 后单步，不会自行启动。',
    ],
    create: demoProgram,
  },
  {
    id: 'set-reset',
    title: '② 置位 / 复位 S/R',
    modelName: 'LAD_置位复位',
    description: '了解保持线圈和上下网络的优先顺序。',
    steps: [
      '打开 SetRequest，单步，Lamp 置为 TRUE。',
      '关闭 SetRequest，再单步，Lamp 仍为 TRUE。',
      '打开 ResetRequest，单步，Lamp 变 FALSE。',
      '同时打开两项输入后单步：下方 R 后执行，所以 Lamp 为 FALSE。',
      '暂停后将 R 网络上移，再单步：现在 S 后执行，Lamp 为 TRUE。',
    ],
    create: () => {
      const set = blankNetwork('SetRequest', 'Lamp'),
        reset = blankNetwork('ResetRequest', 'Lamp')
      set.label = '置位 S · 来流断开时保持'
      set.coil.mode = 'set'
      reset.label = '复位 R · 同时触发时下方网络优先'
      reset.coil.mode = 'reset'
      return {
        kind: 'ladder',
        schemaVersion: 2,
        scanPeriodMs: 100,
        variables: [
          { name: 'SetRequest', kind: 'input', initialValue: false },
          { name: 'ResetRequest', kind: 'input', initialValue: false },
          { name: 'Lamp', kind: 'output', initialValue: false },
        ],
        networks: [set, reset],
      }
    },
  },
  {
    id: 'ton',
    title: '③ TON 接通延时',
    modelName: 'LAD_TON接通延时',
    description: '预置 300 ms，扫描周期 100 ms，观察 ET 与 Q。',
    steps: [
      '点击“重置”，打开 Enable。',
      '单步一次：时间 100 ms，ET=0，Lamp 为 FALSE。',
      '再单步两次：ET 依次为 100、200 ms，Lamp 仍为 FALSE。',
      '再单步一次：时间 400 ms，ET=300 ms，Lamp 为 TRUE。',
      '关闭 Enable 后单步：ET=0，Lamp 为 FALSE。暂停时逻辑时间不推进。',
    ],
    create: () => simpleFunctionProgram('TON'),
  },
  {
    id: 'tof',
    title: '④ TOF 断开延时',
    modelName: 'LAD_TOF断开延时',
    description: '输出先接通，断开输入后再延时关闭。',
    steps: [
      '打开 Enable 后单步，Lamp 立即为 TRUE。',
      '关闭 Enable 后单步：ET=0，Lamp 仍为 TRUE。',
      '再单步三次：ET 达到 300 ms 时 Lamp 变 FALSE。',
      '再次打开 Enable 后单步，Lamp 立即为 TRUE。',
      '延时等待期间重新打开 Enable，会取消延时，ET 归 0。',
    ],
    create: () => simpleFunctionProgram('TOF'),
  },
  {
    id: 'tp',
    title: '⑤ TP 定宽脉冲',
    modelName: 'LAD_TP定宽脉冲',
    description: '由上升沿触发 300 ms 脉冲，活动期间不重触发。',
    steps: [
      '重置后打开 Enable，单步：ET=0，Lamp 为 TRUE。',
      '关闭 Enable 再单步：ET=100 ms，Lamp 仍为 TRUE。',
      '重新打开 Enable 再单步：ET=200 ms，不会重置计时。',
      '再单步一次：ET=300 ms，Lamp 变 FALSE。',
      '关闭 Enable 单步，再打开 Enable 单步，才会开始一个新脉冲。',
    ],
    create: () => simpleFunctionProgram('TP'),
  },
  {
    id: 'ctu',
    title: '⑥ CTU 加计数',
    modelName: 'LAD_CTU加计数',
    description: '每个上升沿加一，计到 3 时输出。',
    steps: [
      '确保 Reset 关闭，打开 Pulse 后单步，CV=1。',
      '保持 Pulse 打开再单步，CV 仍为 1。',
      '关闭 Pulse 单步，再打开 Pulse 单步，CV=2。',
      '再做一组关闭 / 打开并分别单步：CV=3，Lamp 为 TRUE。',
      '打开 Reset 后单步：CV=0。复位优先于同一次扫描的计数输入。',
    ],
    create: () => simpleFunctionProgram('CTU'),
  },
  {
    id: 'ctd',
    title: '⑦ CTD 减计数',
    modelName: 'LAD_CTD减计数',
    description: '先装载 3，再通过上升沿减到 0。',
    steps: [
      '初始 CV=0，计数器 Q=TRUE；先打开 Load 后单步，装入 CV=3。',
      '关闭 Load，打开 Pulse 后单步，CV=2。',
      '保持 Pulse 再单步，不会继续减。',
      '关闭 / 打开 Pulse 并分别单步，两次上升沿后 CV=0，Lamp 为 TRUE。',
      '再次打开 Load 后单步，可重新装入 3；Load 优先于计数。',
    ],
    create: () => simpleFunctionProgram('CTD'),
  },
  {
    id: 'r-trig',
    title: '⑧ R_TRIG 上升沿',
    modelName: 'LAD_R_TRIG上升沿',
    description: '仅在输入从 FALSE 变 TRUE 时输出一扫描。',
    steps: [
      '打开 Signal 后单步，Lamp 为 TRUE。',
      '保持 Signal 再单步，Lamp 变 FALSE。',
      '关闭 Signal 后单步，Lamp 仍为 FALSE。',
      '重新打开 Signal 后单步，Lamp 再次为 TRUE。',
    ],
    create: () => simpleFunctionProgram('R_TRIG'),
  },
  {
    id: 'f-trig',
    title: '⑨ F_TRIG 下降沿',
    modelName: 'LAD_F_TRIG下降沿',
    description: '仅在输入从 TRUE 变 FALSE 时输出一扫描。',
    steps: [
      '初次 Signal 关闭时单步，Lamp 为 FALSE。',
      '打开 Signal 后单步，Lamp 仍为 FALSE。',
      '关闭 Signal 后单步，Lamp 为 TRUE。',
      '保持 Signal 关闭再单步，Lamp 变 FALSE。',
    ],
    create: () => simpleFunctionProgram('F_TRIG'),
  },
  {
    id: 'timer-comparison',
    title: '⑩ 三种定时器对比',
    modelName: 'LAD_三种定时器对比',
    description: '同一个 Enable 驱动 TON / TOF / TP，PT 均为 300 ms。',
    steps: [
      '重置后打开 Enable 并单步：TON_Q=FALSE，TOF_Q 和 TP_Q 为 TRUE。',
      '保持 Enable 再单步三次：TON_Q=TRUE，TOF_Q=TRUE，TP_Q=FALSE。',
      '关闭 Enable 后单步：TON_Q 立即断开，TOF_Q 暂时保持；TP_Q 仍为 FALSE。',
      '再单步三次，TOF_Q 也断开；三个实例的 ET 独立记录。',
    ],
    create: () => comparisonProgram(['TON', 'TOF', 'TP'], 'Enable'),
  },
  {
    id: 'edge-comparison',
    title: '⑪ 上升沿 / 下降沿对比',
    modelName: 'LAD_双边沿对比',
    description: '同一个 Signal 驱动两种边沿检测，观察单次扫描脉冲。',
    steps: [
      '打开 Signal 并单步：R_TRIG_Q=TRUE，F_TRIG_Q=FALSE。',
      '保持 Signal 再单步：两路均为 FALSE。',
      '关闭 Signal 并单步：F_TRIG_Q=TRUE，R_TRIG_Q=FALSE。',
      '保持 Signal 关闭再单步：两路再次均为 FALSE。',
    ],
    create: () => comparisonProgram(['R_TRIG', 'F_TRIG'], 'Signal'),
  },
]
