import { demoProgram, ladId, validateProgram } from './model'
import type { LadProgram } from './model'
import type { EntryGraphModel } from '~/types/common/subGraph'

export const LADDER_BLOCK_TYPE = 'LadderController'
export const LADDER_CAPABILITY = 'ladder-controller-v1'
export type LadderInterfacePort = {
  id: string
  direction: 'input' | 'output'
  variable: string
  order: number
}
export type LadderBlockData = {
  version: 1
  program: LadProgram
  interfacePorts: LadderInterfacePort[]
}

/** IDs identify terminals; the array order and variable name never identify a wire. */
export function reconcileLadderPorts(
  program: LadProgram,
  previous: LadderInterfacePort[] = [],
  renames: Record<string, string> = {},
): LadderInterfacePort[] {
  const orders = { input: 0, output: 0 }
  return program.variables
    .filter((v) => v.kind !== 'memory')
    .map((variable) => {
      const direction = variable.kind as 'input' | 'output'
      const old = previous.find(
        (port) =>
          port.direction === direction &&
          (Object.hasOwn(renames, port.variable)
            ? renames[port.variable]
            : port.variable) === variable.name,
      )
      return {
        id: old?.id ?? ladId(),
        direction,
        variable: variable.name,
        order: ++orders[direction],
      }
    })
}

export function createLadderBlockData(
  program = demoProgram(),
): LadderBlockData {
  return {
    version: 1,
    program: structuredClone(program),
    interfacePorts: reconcileLadderPorts(program),
  }
}

export function assertLadderBlock(
  value: unknown,
): asserts value is LadderBlockData {
  const block = value as LadderBlockData | undefined
  if (!block || block.version !== 1 || !Array.isArray(block.interfacePorts))
    throw new Error('不支持的 LAD 模块版本或端口表')
  const issues = validateProgram(block.program)
  if (issues.length)
    throw new Error(`LAD ${issues[0].path}: ${issues[0].message}`)
  const expected = block.program.variables.filter((v) => v.kind !== 'memory')
  const ids = new Set<string>()
  const bindings = new Set<string>()
  const orders = { input: new Set<number>(), output: new Set<number>() }
  for (const port of block.interfacePorts) {
    if (
      !port ||
      typeof port.id !== 'string' ||
      !/^[A-Za-z0-9_-]{1,64}$/.test(port.id) ||
      ids.has(port.id)
    )
      throw new Error('LAD 端口 ID 无效或重复')
    ids.add(port.id)
    if (
      !['input', 'output'].includes(port.direction) ||
      !Number.isInteger(port.order) ||
      port.order < 1
    )
      throw new Error('LAD 端口方向或序号无效')
    const variable = expected.find(
      (v) => v.name === port.variable && v.kind === port.direction,
    )
    if (
      !variable ||
      bindings.has(port.variable) ||
      orders[port.direction].has(port.order)
    )
      throw new Error('LAD 端口变量绑定无效或重复')
    bindings.add(port.variable)
    orders[port.direction].add(port.order)
  }
  if (bindings.size !== expected.length)
    throw new Error('LAD 必须暴露全部输入和输出')
  for (const direction of ['input', 'output'] as const) {
    const values = [...orders[direction]].sort((a, b) => a - b)
    if (values.some((value, index) => value !== index + 1))
      throw new Error('LAD 端口序号必须连续且从 1 开始')
  }
}

export function ladderPortNumber(
  data: { blockType?: string; ladder?: unknown },
  portId: string,
): string {
  if (data.blockType !== LADDER_BLOCK_TYPE) return portId.replace(/\D/g, '')
  assertLadderBlock(data.ladder)
  const port = data.ladder.interfacePorts.find((item) => item.id === portId)
  if (!port) throw new Error(`LAD 连接引用了不存在的端口：${portId}`)
  return String(port.order)
}

export function assertLadderSolver(
  programs: LadProgram[],
  config: { Step: string; SimSolver: string; SimFixedStep: string },
  purpose = 'simulation',
) {
  if (!programs.length) return
  if (purpose === 'compilation')
    throw new Error('LAD 控制器当前支持软件仿真与软件编译，尚未开放设备编译')
  if (config.Step !== 'FixedStep' || config.SimSolver !== 'ode4')
    throw new Error('含 LAD 的模型请选择固定步长（FixedStep）和 ode4 求解器')
  const step = Number(config.SimFixedStep)
  if (!Number.isFinite(step) || step <= 0)
    throw new Error('含 LAD 的模型必须设置明确的正数仿真步长')
  for (const program of programs) {
    const ratio = program.scanPeriodMs / 1000 / step
    if (
      ratio < 1 ||
      Math.abs(ratio - Math.round(ratio)) > 1e-9 * Math.max(1, ratio)
    )
      throw new Error(
        `LAD 扫描周期 ${program.scanPeriodMs} ms 必须是父模型步长 ${step} s 的正整数倍`,
      )
  }
}

export function withLadderCapabilities(
  model: EntryGraphModel,
): EntryGraphModel {
  const capabilities = new Set(model.requiredCapabilities ?? [])
  let hasLadder = false
  for (const graph of Object.values(model.subGraphs)) {
    for (const cell of graph.graphJson.cells) {
      if (cell.data?.blockType === LADDER_BLOCK_TYPE) hasLadder = true
    }
  }
  if (hasLadder) capabilities.add(LADDER_CAPABILITY)
  else capabilities.delete(LADDER_CAPABILITY)
  const result = { ...model }
  if (capabilities.size) result.requiredCapabilities = [...capabilities]
  else delete result.requiredCapabilities
  return result
}

export function validateLadderModel(model: EntryGraphModel): void {
  const unknown = model.requiredCapabilities?.filter(
    (value) => value !== LADDER_CAPABILITY,
  )
  if (unknown?.length)
    throw new Error(`当前编辑器不支持模型能力：${unknown.join(', ')}`)
  for (const [graphId, graph] of Object.entries(model.subGraphs)) {
    for (const cell of graph.graphJson.cells) {
      if (cell.data?.blockType !== LADDER_BLOCK_TYPE) continue
      if (!model.requiredCapabilities?.includes(LADDER_CAPABILITY))
        throw new Error('LAD 模型缺少能力标记')
      try {
        assertLadderBlock(cell.data.ladder)
      } catch (error) {
        throw new Error(
          `${graphId}/${cell.id}: ${error instanceof Error ? error.message : error}`,
        )
      }
      const ports =
        (cell as { ports?: { items?: { id?: string; group?: string }[] } })
          .ports?.items ?? []
      const declared = new Map(
        (cell.data.ladder as LadderBlockData).interfacePorts.map((p) => [
          p.id,
          p,
        ]),
      )
      if (
        cell.shape !== 'ladder-controller' ||
        ports.length !== declared.size ||
        new Set(ports.map((p) => p.id)).size !== ports.length ||
        ports.some(
          (p) =>
            !p.id ||
            !declared.has(p.id) ||
            !p.group
              ?.toLowerCase()
              .startsWith(
                declared.get(p.id)!.direction === 'input' ? 'in' : 'out',
              ),
        )
      )
        throw new Error(`LAD ${cell.id} 的画布端口与程序接口不一致`)
    }
  }
}
