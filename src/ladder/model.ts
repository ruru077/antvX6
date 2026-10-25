export type LadVariable = {
  name: string
  kind: 'input' | 'output' | 'memory'
  initialValue: boolean
}
export type LadElement = {
  id: string
  type: 'contact' | 'not' | 'series' | 'parallel' | 'timer' | 'counter' | 'edge'
  variable?: string
  negated?: boolean
  children?: LadElement[]
  instance?: string
  mode?: FunctionMode
  presetMs?: number
  preset?: number
  controlVariable?: string
}
export type FunctionMode =
  | 'TON'
  | 'TOF'
  | 'TP'
  | 'CTU'
  | 'CTD'
  | 'R_TRIG'
  | 'F_TRIG'
export type CoilMode = 'normal' | 'set' | 'reset'
export type LadCoil = {
  id: string
  variable: string
  negated: boolean
  mode?: CoilMode
}
export type LadNetwork = {
  id: string
  label: string
  condition: LadElement
  coil: LadCoil
}
export type LadProgram = {
  kind: 'ladder'
  schemaVersion: 1 | 2
  scanPeriodMs: number
  variables: LadVariable[]
  networks: LadNetwork[]
}
export type LadIssue = { path: string; message: string }
export type LadSnapshot = {
  scanIndex: number
  timeMs: number
  variables: Record<string, boolean>
  trace: Record<string, boolean>
  outputs: Record<string, boolean>
  states?: Record<string, FunctionState>
}
export type FunctionState = {
  kind: 'timer' | 'counter' | 'edge'
  mode: FunctionMode
  input: boolean
  q: boolean
  etMs?: number
  cv?: number
}
export type LadSummary = {
  id: number
  modelName: string
  description: string
  lastUpdate: string
}
export type LadSelection = { networkId: string; elementId: string }

export const ladId = () => 'lad_' + crypto.randomUUID().replaceAll('-', '')
export const isFunctionBlock = (element?: LadElement): boolean =>
  !!element && ['timer', 'counter', 'edge'].includes(element.type)
export function functionBlocks(program: LadProgram): LadElement[] {
  const result: LadElement[] = []
  program.networks.forEach((network) =>
    visitElements(network.condition, (e) => {
      if (isFunctionBlock(e)) result.push(e)
    }),
  )
  return result
}
export function occupiedNames(program: LadProgram): Set<string> {
  return new Set([
    ...program.variables.map((v) => v.name),
    ...functionBlocks(program).map((e) => e.instance ?? ''),
  ])
}
export function uniqueInstance(program: LadProgram, prefix: string): string {
  const names = occupiedNames(program)
  let index = 1
  while (names.has(prefix.slice(0, 56) + index)) index++
  return prefix.slice(0, 56) + index
}
export function functionalElement(
  mode: FunctionMode,
  program: LadProgram,
): LadElement {
  if (['TON', 'TOF', 'TP'].includes(mode))
    return {
      id: ladId(),
      type: 'timer',
      instance: uniqueInstance(program, 'Timer'),
      mode,
      presetMs: 300,
    }
  if (['CTU', 'CTD'].includes(mode))
    return {
      id: ladId(),
      type: 'counter',
      instance: uniqueInstance(program, 'Counter'),
      mode,
      preset: 3,
      controlVariable:
        program.variables.find(
          (v) => v.name === (mode === 'CTD' ? 'Load' : 'Reset'),
        )?.name ?? '',
    }
  return {
    id: ladId(),
    type: 'edge',
    instance: uniqueInstance(program, 'Edge'),
    mode,
  }
}
export const cloneProgram = (program: LadProgram): LadProgram =>
  structuredClone(program)
export const contact = (variable = '', negated = false): LadElement => ({
  id: ladId(),
  type: 'contact',
  variable,
  negated,
})
export function blankNetwork(variable = 'Start', output = 'Motor'): LadNetwork {
  return {
    id: ladId(),
    label: '',
    condition: { id: ladId(), type: 'series', children: [contact(variable)] },
    coil: { id: ladId(), variable: output, negated: false },
  }
}
export function emptyProgram(): LadProgram {
  return {
    kind: 'ladder',
    schemaVersion: 1,
    scanPeriodMs: 100,
    variables: [],
    networks: [],
  }
}
export function demoProgram(): LadProgram {
  const network = blankNetwork()
  network.label = '启动 / 停止 · 自保持'
  network.condition.children = [
    {
      id: ladId(),
      type: 'parallel',
      children: [contact('Start'), contact('Motor')],
    },
    contact('StopPressed', true),
  ]
  return {
    kind: 'ladder',
    schemaVersion: 1,
    scanPeriodMs: 100,
    variables: [
      { name: 'Start', kind: 'input', initialValue: false },
      { name: 'StopPressed', kind: 'input', initialValue: false },
      { name: 'Motor', kind: 'output', initialValue: false },
    ],
    networks: [network],
  }
}
export function visitElements(
  element: LadElement,
  visitor: (element: LadElement, path: string) => void,
  path = '',
) {
  visitor(element, path)
  element.children?.forEach((child, index) =>
    visitElements(child, visitor, path + '.children[' + index + ']'),
  )
}
export function findElement(network: LadNetwork, id: string) {
  let found: LadElement | undefined
  visitElements(network.condition, (element) => {
    if (element.id === id) found = element
  })
  return found
}
export function renameVariable(
  program: LadProgram,
  from: string,
  to: string,
): LadProgram {
  const next = cloneProgram(program)
  if (from !== to && next.variables.some((v) => v.name === to))
    throw new Error('变量名称已存在')
  if (functionBlocks(next).some((e) => e.instance === to))
    throw new Error('该名称已被功能块实例使用')
  if (!/^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(to))
    throw new Error(
      '变量名须以字母或下划线开头，仅含字母、数字和下划线，最多 64 字符',
    )
  next.variables = next.variables.map((v) =>
    v.name === from ? { ...v, name: to } : v,
  )
  next.networks.forEach((network) => {
    if (network.coil.variable === from) network.coil.variable = to
    visitElements(network.condition, (e) => {
      if (e.variable === from) e.variable = to
      if (e.controlVariable === from) e.controlVariable = to
    })
  })
  return next
}
export function duplicateNetwork(
  network: LadNetwork,
  program?: LadProgram,
): LadNetwork {
  const copy = structuredClone(network)
  copy.id = ladId()
  copy.coil.id = ladId()
  copy.label = (copy.label || '网络').slice(0, 196) + '（副本）'
  // A copied coil must be rebound: otherwise two networks silently write one output.
  copy.coil.variable = ''
  const names = program ? occupiedNames(program) : new Set<string>()
  visitElements(network.condition, (e) => {
    if (e.instance) names.add(e.instance)
  })
  visitElements(copy.condition, (e) => {
    e.id = ladId()
    if (isFunctionBlock(e)) {
      const base = (e.instance || 'Block').slice(0, 56)
      let suffix = 2
      while (names.has(base + '_' + suffix)) suffix++
      e.instance = base + '_' + suffix
      names.add(e.instance)
    }
  })
  return copy
}
export type InsertMode = 'after' | 'before' | 'parallel' | 'branch'
export function insertElement(
  network: LadNetwork,
  selectedId: string,
  element: LadElement,
  mode: InsertMode,
): void {
  const selected = findElement(network, selectedId) ?? network.condition
  if (mode === 'branch' && selected.type === 'parallel') {
    selected.children!.push(element)
    return
  }
  if (mode === 'parallel') {
    const former = structuredClone(selected)
    // Keep the root as a series; a root parallel would no longer be a rung.
    const parallel: LadElement = {
      id: ladId(),
      type: 'parallel',
      children: [former, element],
    }
    if (selected === network.condition) {
      network.condition = { id: ladId(), type: 'series', children: [parallel] }
    } else
      Object.assign(selected, parallel, {
        variable: undefined,
        negated: undefined,
        instance: undefined,
        mode: undefined,
        presetMs: undefined,
        preset: undefined,
        controlVariable: undefined,
      })
    return
  }
  if (selected.type === 'series') {
    if (mode === 'before') selected.children!.unshift(element)
    else selected.children!.push(element)
    return
  }
  let parent: LadElement | undefined
  visitElements(network.condition, (e) => {
    if (e.children?.includes(selected)) parent = e
  })
  if (parent?.type === 'series') {
    const at = parent.children!.indexOf(selected) + (mode === 'before' ? 0 : 1)
    parent.children!.splice(at, 0, element)
  } else {
    const former = structuredClone(selected)
    Object.assign(selected, {
      id: ladId(),
      type: 'series',
      children: mode === 'before' ? [element, former] : [former, element],
      variable: undefined,
      negated: undefined,
      instance: undefined,
      mode: undefined,
      presetMs: undefined,
      preset: undefined,
      controlVariable: undefined,
    })
  }
}
/** A one-branch OR is identical to its child; retain the child's IDs and state. */
export function simplifyParallelBranches(network: LadNetwork): void {
  const simplify = (element: LadElement): LadElement => {
    if (element.children) element.children = element.children.map(simplify)
    if (element.type === 'parallel' && element.children?.length === 1)
      return element.children[0]
    // Empty groups stay invalid: never turn an unfinished rung into a live wire.
    return element
  }
  // The network root must remain a series, including when it is empty.
  if (network.condition.children)
    network.condition.children = network.condition.children.map(simplify)
}

export function simplifyProgramBranches(program: LadProgram): LadProgram {
  const next = cloneProgram(program)
  next.networks.forEach(simplifyParallelBranches)
  return next
}

export function removeElement(
  network: LadNetwork,
  selectedId: string,
  simplify = true,
): void {
  if (network.condition.id === selectedId) {
    network.condition.children = []
    return
  }
  const remove = (element: LadElement): LadElement[] => {
    if (element.id === selectedId) return []
    if (element.children?.length) {
      element.children = element.children.flatMap(remove)
      // Remove a branch emptied by this deletion, never an unrelated empty draft.
      if (simplify && !element.children.length) return []
    }
    return [element]
  }
  network.condition.children = network.condition.children?.flatMap(remove)
  if (simplify) simplifyParallelBranches(network)
}
// Structural diagnostics only. PLC execution and conduction are always supplied by Link.
export function validateProgram(value: unknown): LadIssue[] {
  const issues: LadIssue[] = []
  const issue = (path: string, message: string) => {
    if (issues.length < 64) issues.push({ path, message })
  }
  const object = (entry: unknown) =>
    entry !== null && typeof entry === 'object' && !Array.isArray(entry)
  if (!object(value)) return [{ path: 'program', message: '程序必须是对象' }]
  const program = value as LadProgram
  if (!Array.isArray(program.variables)) issue('variables', '变量表必须是数组')
  if (!Array.isArray(program.networks)) issue('networks', '网络列表必须是数组')
  if (issues.length) return issues
  const names = new Map<string, LadVariable>()
  const ids = new Set<string>()
  const written = new Map<string, Set<CoilMode>>()
  const instances = new Set<string>()
  let elements = 0
  const checkId = (id: string, path: string) => {
    if (
      typeof id !== 'string' ||
      !/^[A-Za-z0-9_-]{1,64}$/.test(id) ||
      ids.has(id)
    )
      issue(path, '元件 ID 无效或重复')
    ids.add(id)
  }
  if (program.kind !== 'ladder' || ![1, 2].includes(program.schemaVersion))
    issue('schemaVersion', '不支持此程序版本')
  if (
    !Number.isInteger(program.scanPeriodMs) ||
    program.scanPeriodMs < 1 ||
    program.scanPeriodMs > 60000
  )
    issue('scanPeriodMs', '扫描周期须为 1–60000 ms 的整数')
  if (!program.variables.length || program.variables.length > 256)
    issue('variables', '须有 1–256 个变量')
  program.variables.slice(0, 256).forEach((v, index) => {
    const path = 'variables[' + index + ']'
    if (!object(v)) {
      issue(path, '变量必须是对象')
      return
    }
    if (
      typeof v.name !== 'string' ||
      !/^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(v.name) ||
      names.has(v.name)
    )
      issue(path + '.name', '变量名无效或重复')
    if (
      !['input', 'output', 'memory'].includes(v.kind) ||
      typeof v.initialValue !== 'boolean'
    )
      issue(path, '变量须为 BOOL 输入、输出或内部变量')
    names.set(v.name, v)
  })
  if (!program.networks.length || program.networks.length > 128)
    issue('networks', '须有 1–128 个网络')
  program.networks.slice(0, 128).forEach((network, index) => {
    const path = 'networks[' + index + ']'
    if (!object(network)) {
      issue(path, '网络必须是对象')
      return
    }
    checkId(network.id, path + '.id')
    if (
      network.label !== undefined &&
      (typeof network.label !== 'string' || network.label.length > 200)
    )
      issue(path + '.label', '网络注释最多 200 字符')
    if (network.condition?.type !== 'series')
      issue(path + '.condition', '网络根须为串联结构')
    const inspect = (e: LadElement, at: string, depth: number) => {
      elements++
      if (depth > 16) {
        issue(at, '嵌套深度不能超过 16')
        return
      }
      if (elements > 2048) {
        issue(at, '元件数量不能超过 2048')
        return
      }
      if (!object(e)) {
        issue(at, '元件必须是对象')
        return
      }
      checkId(e.id, at + '.id')
      if (e.type === 'contact') {
        if (typeof e.variable !== 'string' || !names.has(e.variable))
          issue(at + '.variable', '触点未绑定已声明变量')
        if (typeof e.negated !== 'boolean')
          issue(at + '.negated', '触点求反标志必须为 BOOL 值')
      } else if (isFunctionBlock(e)) {
        if (program.schemaVersion !== 2)
          issue(at + '.type', '此功能块需要新版程序格式')
        if (
          typeof e.instance !== 'string' ||
          !/^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(e.instance) ||
          instances.has(e.instance ?? '') ||
          names.has(e.instance ?? '')
        )
          issue(at + '.instance', '实例名称无效、重复或与变量同名')
        instances.add(e.instance ?? '')
        if (e.type === 'timer') {
          if (!['TON', 'TOF', 'TP'].includes(e.mode ?? ''))
            issue(at + '.mode', '不支持的定时器模式')
          if (
            !Number.isInteger(e.presetMs) ||
            e.presetMs! < 0 ||
            e.presetMs! > 86400000
          )
            issue(at + '.presetMs', '预置时间须为 0–86400000 ms 的整数')
        } else if (e.type === 'counter') {
          if (!['CTU', 'CTD'].includes(e.mode ?? ''))
            issue(at + '.mode', '不支持的计数器模式')
          if (!Number.isInteger(e.preset) || e.preset! < 0 || e.preset! > 65535)
            issue(at + '.preset', '预置计数须为 0–65535 的整数')
          if (
            typeof e.controlVariable !== 'string' ||
            !names.has(e.controlVariable)
          )
            issue(
              at + '.controlVariable',
              '复位或装载端须绑定已声明的 BOOL 变量',
            )
        } else if (!['R_TRIG', 'F_TRIG'].includes(e.mode ?? ''))
          issue(at + '.mode', '不支持的边沿模式')
      } else if (e.type === 'series' || e.type === 'parallel') {
        if (
          !Array.isArray(e.children) ||
          e.children.length < (e.type === 'parallel' ? 2 : 1) ||
          e.children.length > 2048
        )
          issue(
            at,
            e.type === 'parallel' ? '并联至少需要两条支路' : '串联支路不能为空',
          )
        if (Array.isArray(e.children))
          e.children
            .slice(0, 2048)
            .forEach((c, i) =>
              inspect(c, at + '.children[' + i + ']', depth + 1),
            )
      } else if (e.type !== 'not') issue(at, '不支持的元件类型')
    }
    inspect(network.condition, path + '.condition', 1)
    elements++
    if (!object(network.coil)) {
      issue(path + '.coil', '线圈必须是对象')
      return
    }
    checkId(network.coil.id, path + '.coil.id')
    if (typeof network.coil.negated !== 'boolean')
      issue(path + '.coil.negated', '线圈求反标志必须为 BOOL 值')
    const output = names.get(network.coil.variable)
    if (!output) issue(path + '.coil.variable', '线圈未绑定已声明变量')
    else if (output.kind === 'input')
      issue(path + '.coil.variable', '不能用线圈写入输入变量')
    const mode = network.coil.mode === undefined ? 'normal' : network.coil.mode
    if (!['normal', 'set', 'reset'].includes(mode))
      issue(path + '.coil.mode', '不支持的线圈模式')
    if (mode !== 'normal') {
      if (program.schemaVersion !== 2)
        issue(path + '.coil.mode', 'S/R 线圈需要新版程序格式')
      if (network.coil.negated)
        issue(path + '.coil.negated', 'S/R 线圈不能同时求反')
    }
    const writers = written.get(network.coil.variable) ?? new Set<CoilMode>()
    if (output && writers.size && (mode === 'normal' || writers.has('normal')))
      issue(
        path + '.coil.variable',
        '同一变量不能被多个线圈写入，普通线圈不能与 S/R 混写',
      )
    else if (output && writers.has(mode))
      issue(
        path + '.coil.variable',
        '同一变量不能重复使用 ' + (mode === 'set' ? 'S' : 'R') + ' 线圈',
      )
    writers.add(mode)
    written.set(network.coil.variable, writers)
  })
  if (elements > 2048) issue('networks', '元件数量不能超过 2048')
  return issues
}

// Validate before replacing an open document; malformed server data must not discard edits.
export function prepareLoadedProgram(value: unknown): LadProgram {
  const issues = validateProgram(value)
  if (issues.length)
    throw new Error(
      '模型数据错误：' +
        issues[0].message +
        '（' +
        issues[0].path +
        '）。当前文档未被替换。',
    )
  const program = structuredClone(value) as LadProgram
  program.networks.forEach((network) => {
    if (network.label === undefined) network.label = ''
  })
  return program
}

export function selectionFromIssue(
  program: LadProgram,
  path: string,
): LadSelection | null {
  const match = /networks\[(\d+)\]/.exec(path)
  if (!match) return null
  const network = program.networks[Number(match[1])]
  if (!network) return null
  if (path.includes('.coil'))
    return { networkId: network.id, elementId: network.coil.id }
  let element = network.condition
  for (const child of path.matchAll(/children\[(\d+)\]/g))
    element = element.children?.[Number(child[1])] ?? element
  return { networkId: network.id, elementId: element.id }
}
