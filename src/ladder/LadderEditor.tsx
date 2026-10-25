import { ConfigProvider, Modal, message } from 'antd'
import {
  ArrowLeft,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  CircleCheck,
  CircleDot,
  Clock3,
  Copy,
  Download,
  FileCode2,
  FilePlus2,
  FolderOpen,
  Pause,
  Play,
  Plus,
  Redo2,
  RotateCcw,
  Save,
  StepForward,
  Trash2,
  Undo2,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { LadApiError } from './api'
import { reconcileLadderPorts } from './block'
import { applyLadDrop } from './drag'
import { FUNCTION_INFO, LAD_EXAMPLES } from './examples'
import FunctionInspector from './FunctionInspector'
import FunctionMonitor from './FunctionMonitor'
import LadderCanvas from './LadderCanvas'
import {
  blankNetwork,
  cloneProgram,
  contact,
  demoProgram,
  duplicateNetwork,
  emptyProgram,
  findElement,
  functionBlocks,
  functionalElement,
  isFunctionBlock,
  occupiedNames,
  prepareLoadedProgram,
  insertElement,
  ladId,
  removeElement,
  renameVariable,
  selectionFromIssue,
  simplifyProgramBranches,
  validateProgram,
  visitElements,
} from './model'
import PanelResizeHandle from './PanelResizeHandle'
import { dragLabel, dropLabel, useLadderDrag } from './useLadderDrag'
import { useLadderPanels } from './useLadderPanels'
import type { ladApi } from './api'
import type { LadderInterfacePort } from './block'
import type { LadDragPayload } from './drag'
import type {
  InsertMode,
  CoilMode,
  FunctionMode,
  LadElement,
  LadIssue,
  LadNetwork,
  LadProgram,
  LadSelection,
  LadSnapshot,
  LadSummary,
  LadVariable,
} from './model'
import type { ReactNode } from 'react'
import './ladder.scss'

export type EditorDocument = {
  program: LadProgram
  interfacePorts: LadderInterfacePort[]
}
type History = {
  past: EditorDocument[]
  present: EditorDocument
  future: EditorDocument[]
}
export type LadderEditorProps = {
  services: typeof ladApi
  initialProgram?: LadProgram
  initialName?: string
  initialInterfacePorts?: LadderInterfacePort[]
  initialModelId?: number | null
  embedded?: boolean
  readOnly?: boolean
  parentSnapshot?: LadSnapshot | null
  onLeave: () => void
  onDocumentLocation?: (id: number | null) => void
  onDirtyChange?: (dirty: boolean) => void
  onApply?: (
    program: LadProgram,
    name: string,
    interfacePorts: LadderInterfacePort[],
  ) => Promise<void>
}

const errorText = (error: unknown) =>
  error instanceof Error ? error.message : '请求失败'
const kindLabel = { input: '输入 I', output: '输出 Q', memory: '内部 M' }

function ToolButton({
  label,
  icon,
  onClick,
  disabled,
  primary,
  title,
  tone = 'neutral',
  compact,
}: {
  label: string
  icon?: ReactNode
  onClick: () => void
  disabled?: boolean
  primary?: boolean
  title?: string
  tone?: 'green' | 'amber' | 'blue' | 'red' | 'neutral'
  compact?: boolean
}) {
  return (
    <button
      type="button"
      className={
        'lad-button tone-' +
        tone +
        (primary ? ' primary' : '') +
        (compact ? ' is-compact' : '')
      }
      onClick={onClick}
      disabled={disabled}
      title={title ?? label}
      aria-label={label}
    >
      {icon && (
        <span className="lad-button-icon" aria-hidden="true">
          {icon}
        </span>
      )}
      {!compact && label}
    </button>
  )
}
function downloadText(name: string, value: string, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([value], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export default function LadderEditor({
  services: ladApi,
  initialProgram,
  initialInterfacePorts,
  initialName = 'LAD_自保持',
  initialModelId = null,
  embedded = false,
  readOnly = false,
  parentSnapshot,
  onLeave,
  onDocumentLocation,
  onDirtyChange,
  onApply,
}: LadderEditorProps) {
  const [history, setHistory] = useState<History>(() => ({
    past: [],
    present: {
      program: simplifyProgramBranches(initialProgram ?? demoProgram()),
      interfacePorts: structuredClone(initialInterfacePorts ?? []),
    },
    future: [],
  }))
  const program = history.present.program
  const [selection, setSelection] = useState<LadSelection | null>(null)
  const [insertMode, setInsertMode] = useState<InsertMode>('after')
  const [modelId, setModelId] = useState<number | null>(null)
  const [modelName, setModelName] = useState(initialName)
  const [savedContent, setSavedContent] = useState<string | null>(() =>
    embedded
      ? JSON.stringify({
          program: initialProgram,
          modelName: initialName,
          interfacePorts: initialInterfacePorts ?? [],
        })
      : null,
  )
  const [messageApi, messageHolder] = message.useMessage()
  const [modalApi, modalHolder] = Modal.useModal()
  const [busy, setBusy] = useState(false)
  const [running, setRunning] = useState(false)
  const [localSnapshot, setSnapshot] = useState<LadSnapshot | null>(null)
  const [serverIssues, setServerIssues] = useState<LadIssue[]>([])
  const [statusText, setStatusText] = useState('就绪')
  const [operationError, setOperationError] = useState(false)
  const panels = useLadderPanels({ canvasChromeHeight: 0 })
  const [inputs, setInputs] = useState<Record<string, boolean>>({
    Start: false,
    StopPressed: false,
  })
  const inputsRef = useRef(inputs)
  const sessionRef = useRef<string | null>(null)
  const runningRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const aliveRef = useRef(true)
  const requestRef = useRef(false)
  const openGeneration = useRef(0)
  const documentEpoch = useRef(0)
  const [models, setModels] = useState<LadSummary[]>([])
  const [openDialog, setOpenDialog] = useState(false)
  const [saveAsDialog, setSaveAsDialog] = useState(false)
  const [saveAsName, setSaveAsName] = useState('')
  const [code, setCode] = useState<string | null>(null)
  const [variableDraft, setVariableDraft] = useState({
    name: '',
    kind: 'input' as LadVariable['kind'],
    initialValue: false,
  })
  const [renameTarget, setRenameTarget] = useState<string | null>(null)
  const [renamedValue, setRenamedValue] = useState('')
  const [exampleId, setExampleId] = useState('self-hold')
  const activeExample = LAD_EXAMPLES.find((example) => example.id === exampleId)
  const instances = functionBlocks(program)
  const snapshot = embedded
    ? JSON.stringify(program) === JSON.stringify(initialProgram) &&
      JSON.stringify(history.present.interfacePorts) ===
        JSON.stringify(initialInterfacePorts ?? [])
      ? (parentSnapshot ?? null)
      : null
    : localSnapshot
  const locked = busy || running || readOnly
  const localIssues = validateProgram(program)
  const issues = serverIssues.length ? serverIssues : localIssues
  const network = program.networks.find((n) => n.id === selection?.networkId)
  const element =
    network && selection ? findElement(network, selection.elementId) : undefined
  const selectedCoil = network?.coil.id === selection?.elementId
  const dirty =
    JSON.stringify({
      program,
      modelName,
      ...(embedded ? { interfacePorts: history.present.interfacePorts } : {}),
    }) !== savedContent
  useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])
  const isCurrentDocument = (epoch: number) =>
    aliveRef.current && epoch === documentEpoch.current

  const updateInputs = (next: Record<string, boolean>) => {
    inputsRef.current = next
    setInputs(next)
  }
  const stop = useCallback(() => {
    runningRef.current = false
    setRunning(false)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
  }, [])
  const releaseSession = useCallback(() => {
    const id = sessionRef.current
    sessionRef.current = null
    if (id) void ladApi.close(id).catch(() => undefined)
  }, [])
  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
      openGeneration.current++
      documentEpoch.current++
      runningRef.current = false
      if (timerRef.current) clearTimeout(timerRef.current)
      releaseSession()
    }
  }, [releaseSession])
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (dirty) event.preventDefault()
    }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [dirty])

  const invalidate = () => {
    documentEpoch.current++
    stop()
    releaseSession()
    setSnapshot(null)
    setServerIssues([])
    setOperationError(false)
    setStatusText('已修改')
  }
  const edit = (next: LadProgram, rename?: { from: string; to: string }) => {
    if (locked) return
    next = simplifyProgramBranches(next)
    if (
      functionBlocks(next).length ||
      next.networks.some(
        (n) => n.coil.mode === 'set' || n.coil.mode === 'reset',
      )
    )
      next.schemaVersion = 2
    invalidate()
    setHistory((previous) => ({
      past: [...previous.past.slice(-79), previous.present],
      present: {
        program: next,
        interfacePorts: reconcileLadderPorts(
          next,
          previous.present.interfacePorts,
          rename ? { [rename.from]: rename.to } : {},
        ),
      },
      future: [],
    }))
    const nextInputs = Object.fromEntries(
      next.variables
        .filter((v) => v.kind === 'input')
        .map((v) => [v.name, v.initialValue]),
    )
    updateInputs(nextInputs)
  }
  const editNetwork = (change: (n: LadNetwork) => void) => {
    if (!network) return
    const next = cloneProgram(program)
    change(next.networks.find((n) => n.id === network.id)!)
    edit(next)
  }
  const undo = () => {
    if (locked || !history.past.length) return
    invalidate()
    const previous = history.past[history.past.length - 1]
    setHistory({
      past: history.past.slice(0, -1),
      present: previous,
      future: [history.present, ...history.future],
    })
    setSelection(null)
    updateInputs(
      Object.fromEntries(
        previous.program.variables
          .filter((v) => v.kind === 'input')
          .map((v) => [v.name, v.initialValue]),
      ),
    )
  }
  const redo = () => {
    if (locked || !history.future.length) return
    invalidate()
    const next = history.future[0]
    setHistory({
      past: [...history.past, history.present],
      present: next,
      future: history.future.slice(1),
    })
    setSelection(null)
    updateInputs(
      Object.fromEntries(
        next.program.variables
          .filter((v) => v.kind === 'input')
          .map((v) => [v.name, v.initialValue]),
      ),
    )
  }
  const reportError = (error: unknown) => {
    stop()
    setOperationError(true)
    if (error instanceof LadApiError && error.issues.length)
      setServerIssues(error.issues)
    if (
      error instanceof LadApiError &&
      [401, 403, 404, 410].includes(error.status)
    )
      releaseSession()
    const text =
      error instanceof LadApiError && error.status === 401
        ? '登录状态已失效，请先登录当前站点后重新打开 LAD 页面。'
        : errorText(error)
    setStatusText(text)
    messageApi.error(text)
  }
  const ensureSession = async (epoch: number) => {
    if (embedded) throw new Error('嵌入 LAD 由父模型仿真驱动')
    if (localIssues.length) {
      setServerIssues([])
      throw new Error('请先修复下方列出的程序问题')
    }
    if (!sessionRef.current) {
      const result = await ladApi.session(program)
      if (!isCurrentDocument(epoch)) {
        void ladApi.close(result.sessionId).catch(() => undefined)
        throw new Error('程序已切换')
      }
      sessionRef.current = result.sessionId
      setSnapshot(result.snapshot)
    }
    return sessionRef.current
  }
  const oneScan = async () => {
    if (requestRef.current) return false
    const epoch = documentEpoch.current
    requestRef.current = true
    setBusy(true)
    try {
      const id = await ensureSession(epoch)
      const result = await ladApi.step(id, { ...inputsRef.current })
      if (isCurrentDocument(epoch)) {
        setSnapshot(result.snapshot)
        setStatusText('扫描完成')
        setOperationError(false)
      }
      return isCurrentDocument(epoch)
    } catch (error) {
      if (isCurrentDocument(epoch)) reportError(error)
      return false
    } finally {
      requestRef.current = false
      if (isCurrentDocument(epoch)) setBusy(false)
    }
  }
  const run = () => {
    if (locked) return
    runningRef.current = true
    setRunning(true)
    const tick = async () => {
      const ok = await oneScan()
      if (ok && runningRef.current && aliveRef.current)
        timerRef.current = setTimeout(
          () => void tick(),
          Math.max(50, program.scanPeriodMs),
        )
      else if (aliveRef.current) stop()
    }
    void tick()
  }
  const reset = async () => {
    if (locked) return
    const epoch = documentEpoch.current
    setBusy(true)
    try {
      const id = await ensureSession(epoch)
      const result = await ladApi.reset(id)
      if (!isCurrentDocument(epoch)) return
      setSnapshot(result.snapshot)
      updateInputs(
        Object.fromEntries(
          program.variables
            .filter((v) => v.kind === 'input')
            .map((v) => [v.name, v.initialValue]),
        ),
      )
      setStatusText('已重置')
      setOperationError(false)
    } catch (error) {
      if (isCurrentDocument(epoch)) reportError(error)
    } finally {
      if (isCurrentDocument(epoch)) setBusy(false)
    }
  }
  const validate = async () => {
    if (embedded) {
      setServerIssues([])
      setStatusText(localIssues.length ? '校验未通过' : '校验通过')
      return
    }
    const epoch = documentEpoch.current
    setBusy(true)
    try {
      const result = await ladApi.validate(program)
      if (!isCurrentDocument(epoch)) return
      setServerIssues(result.errors)
      setStatusText(result.valid ? '校验通过' : '校验未通过')
      setOperationError(false)
      if (result.valid) messageApi.success('校验通过')
    } catch (error) {
      if (isCurrentDocument(epoch)) reportError(error)
    } finally {
      if (isCurrentDocument(epoch)) setBusy(false)
    }
  }
  const save = async (asNew = false, name = modelName) => {
    if (locked) return
    if (embedded) {
      setBusy(true)
      try {
        await onApply?.(program, name, history.present.interfacePorts)
      } catch (error) {
        messageApi.error(errorText(error))
      } finally {
        if (aliveRef.current) setBusy(false)
      }
      return
    }
    if (issues.length) {
      messageApi.warning('请先修复程序问题后保存')
      return
    }
    const epoch = documentEpoch.current
    setBusy(true)
    try {
      const result = await ladApi.save(
        asNew ? null : modelId,
        name.trim(),
        program,
      )
      if (!isCurrentDocument(epoch)) return
      setModelId(result.id)
      setModelName(result.modelName)
      setSavedContent(JSON.stringify({ program, modelName: result.modelName }))
      onDocumentLocation?.(result.id)
      setSaveAsDialog(false)
      setStatusText('已保存 · ' + result.modelName)
      setOperationError(false)
      messageApi.success('模型已保存')
    } catch (error) {
      if (isCurrentDocument(epoch)) reportError(error)
    } finally {
      if (isCurrentDocument(epoch)) setBusy(false)
    }
  }
  const replaceProgram = (
    next: LadProgram,
    name: string,
    id: number | null,
  ) => {
    invalidate()
    setStatusText(id === null ? '新建程序' : '已打开')
    setHistory({
      past: [],
      present: { program: next, interfacePorts: reconcileLadderPorts(next) },
      future: [],
    })
    setSelection(null)
    setExampleId('custom')
    setModelId(id)
    setModelName(name)
    updateInputs(
      Object.fromEntries(
        next.variables
          .filter((v) => v.kind === 'input')
          .map((v) => [v.name, v.initialValue]),
      ),
    )
    setSavedContent(
      id === null ? null : JSON.stringify({ program: next, modelName: name }),
    )
    onDocumentLocation?.(id)
  }
  const openModel = async (id: number) => {
    const generation = ++openGeneration.current
    setBusy(true)
    try {
      const result = await ladApi.open(id)
      if (!aliveRef.current || generation !== openGeneration.current) return
      const loadedProgram = prepareLoadedProgram(result.program)
      replaceProgram(loadedProgram, result.modelName, result.id)
      setOpenDialog(false)
    } catch (error) {
      if (aliveRef.current && generation === openGeneration.current)
        reportError(error)
    } finally {
      if (aliveRef.current && generation === openGeneration.current)
        setBusy(false)
    }
  }
  useEffect(() => {
    if (!embedded && initialModelId !== null) void openModel(initialModelId)
    // The URL is read once on mount; save/open update it without rebuilding the editor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const afterDiscard = (action: () => void) => {
    if (!dirty) {
      action()
      return
    }
    modalApi.confirm({
      title: '放弃当前未保存的修改？',
      content: '已保存的模型不受影响。',
      okText: '放弃并继续',
      cancelText: '继续编辑',
      onOk: action,
    })
  }
  const showModels = async () => {
    const epoch = documentEpoch.current
    setBusy(true)
    try {
      const result = await ladApi.models()
      if (isCurrentDocument(epoch)) {
        setModels(result.models)
        setOpenDialog(true)
        setStatusText('模型目录已加载')
        setOperationError(false)
      }
    } catch (error) {
      if (isCurrentDocument(epoch)) reportError(error)
    } finally {
      if (isCurrentDocument(epoch)) setBusy(false)
    }
  }
  const compile = async () => {
    const epoch = documentEpoch.current
    setBusy(true)
    try {
      const result = await ladApi.compile(program)
      if (isCurrentDocument(epoch)) {
        setCode(result.source)
        setStatusText('C99 源码已生成')
        setOperationError(false)
      }
    } catch (error) {
      if (isCurrentDocument(epoch)) reportError(error)
    } finally {
      if (isCurrentDocument(epoch)) setBusy(false)
    }
  }
  const add = (kind: 'no' | 'nc' | 'not' | FunctionMode) => {
    if (!network) {
      messageApi.info('请先新增或选择网络')
      return
    }
    if (insertMode === 'branch' && element?.type !== 'parallel') {
      messageApi.info('请先点击画布中并联组的虚线边框，再追加支路')
      return
    }
    const nextElement: LadElement = !['no', 'nc', 'not'].includes(kind)
      ? functionalElement(kind as FunctionMode, program)
      : kind === 'not'
        ? { id: ladId(), type: 'not' }
        : contact(
            program.variables.find((v) => v.kind === 'input')?.name ?? '',
            kind === 'nc',
          )
    editNetwork((next) =>
      insertElement(
        next,
        selectedCoil
          ? next.condition.id
          : (selection?.elementId ?? next.condition.id),
        nextElement,
        insertMode,
      ),
    )
    setSelection({ networkId: network.id, elementId: nextElement.id })
  }
  const addNetwork = () => {
    const next = cloneProgram(program)
    const used = new Set(next.networks.map((n) => n.coil.variable))
    const added = blankNetwork(
      next.variables.find((v) => v.kind === 'input')?.name ?? '',
      next.variables.find((v) => v.kind !== 'input' && !used.has(v.name))
        ?.name ?? '',
    )
    const position = network
      ? next.networks.findIndex((n) => n.id === network.id) + 1
      : next.networks.length
    next.networks.splice(position, 0, added)
    edit(next)
    setSelection({
      networkId: added.id,
      elementId: added.condition.children![0].id,
    })
  }
  const moveNetwork = (direction: number) => {
    if (!network) return
    const next = cloneProgram(program),
      index = next.networks.findIndex((n) => n.id === network.id),
      target = index + direction
    if (target < 0 || target >= next.networks.length) return
    ;[next.networks[index], next.networks[target]] = [
      next.networks[target],
      next.networks[index],
    ]
    edit(next)
  }
  const addVariable = () => {
    const name = variableDraft.name.trim()
    if (!/^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(name)) {
      messageApi.warning('变量名须以字母或下划线开头，仅含字母、数字和下划线')
      return
    }
    if (occupiedNames(program).has(name)) {
      messageApi.warning('该名称已被变量或功能块实例使用')
      return
    }
    const next = cloneProgram(program)
    next.variables.push({ ...variableDraft, name })
    edit(next)
    setVariableDraft({ name: '', kind: 'input', initialValue: false })
  }
  const removeVariable = (name: string) => {
    let used = false
    program.networks.forEach((n) => {
      if (n.coil.variable === name) used = true
      visitElements(n.condition, (e) => {
        if (e.variable === name || e.controlVariable === name) used = true
      })
    })
    if (used) {
      messageApi.warning('变量仍被触点、线圈或功能块控制端引用，请先解除绑定')
      return
    }
    const next = cloneProgram(program)
    next.variables = next.variables.filter((v) => v.name !== name)
    edit(next)
  }
  const locate = (issue: LadIssue) => {
    const selected = selectionFromIssue(program, issue.path)
    if (selected) {
      setSelection(selected)
      document
        .getElementById('lad-network-' + selected.networkId)
        ?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest',
        })
    } else
      document
        .getElementById('lad-variable-panel')
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  const drag = useLadderDrag({
    program,
    locked,
    onCommit: (next, selected) => {
      edit(next)
      setSelection(selected)
    },
    onStatus: (text) => {
      setStatusText(text)
      setOperationError(false)
    },
  })
  const setCoil = (tool: Extract<LadDragPayload, { kind: 'tool' }>['tool']) => {
    if (!network) {
      messageApi.info('请先选择网络，再设置末尾线圈')
      return
    }
    const result = applyLadDrop(
      program,
      { kind: 'tool', tool },
      { kind: 'coil', networkId: network.id },
    )
    if (result) {
      edit(result.program)
      setSelection(result.selection)
    }
  }

  const runState =
    issues.length || operationError
      ? {
          tone: 'error',
          label: issues.length ? '需修正' : '请求异常',
          icon: <CircleAlert />,
        }
      : readOnly
        ? { tone: 'success', label: '父模型仿真 · 只读', icon: <Play /> }
        : running
          ? { tone: 'success', label: '连续扫描', icon: <Play /> }
          : busy
            ? { tone: 'info', label: '处理中', icon: <Clock3 /> }
            : snapshot
              ? {
                  tone: 'warning',
                  label: embedded ? '父模型结果' : '已暂停',
                  icon: <Pause />,
                }
              : { tone: 'neutral', label: '编辑模式', icon: <CircleDot /> }

  return (
    <ConfigProvider
      theme={{ token: { colorPrimary: '#1769e0', fontFamily: 'inherit' } }}
    >
      {messageHolder}
      {modalHolder}
      <div
        className={
          'lad-page' +
          (drag.payload ? ' is-dragging' : '') +
          (panels.activePanel ? ' is-resizing' : '')
        }
        style={panels.style}
        onClickCapture={drag.onClickCapture}
        onPointerDownCapture={drag.onPointerDownCapture}
      >
        <header className="lad-header">
          <button
            className="lad-back"
            aria-label={embedded ? '取消并返回父画布' : '返回模型目录'}
            title={
              embedded ? '取消未应用修改并返回父画布' : '返回 M2PLink 模型目录'
            }
            disabled={busy}
            onClick={() => (embedded ? afterDiscard(onLeave) : onLeave())}
          >
            <ArrowLeft size={19} />
          </button>
          <div className="lad-brand" title="M2PLink · LAD 梯形图">
            <span className="lad-brand-mark">LD</span>
            <strong>M2PLink</strong>
          </div>
          <div className="lad-document">
            <input
              aria-label="模型名称"
              value={modelName}
              maxLength={100}
              disabled={locked}
              onChange={(event) => setModelName(event.target.value)}
            />
            <span
              className={
                'lad-document-status tone-' + (dirty ? 'warning' : 'success')
              }
            >
              {dirty ? (
                <CircleDot aria-hidden="true" />
              ) : (
                <CircleCheck aria-hidden="true" />
              )}
              {dirty ? '未保存' : '已保存'}
            </span>
          </div>
          <span
            className={'lad-status-badge tone-' + runState.tone}
            aria-live="polite"
          >
            {runState.icon}
            {runState.label}
          </span>
        </header>
        <div className="lad-body" ref={panels.bodyRef}>
          <aside className="lad-palette" id="lad-palette-panel">
            <h2>指令</h2>
            <label
              className="lad-field"
              title="选中画布元件后，点击工具箱按此位置添加；拖动时以高亮落点为准"
            >
              插入位置
              <select
                aria-label="插入位置"
                value={insertMode}
                disabled={locked}
                onChange={(event) =>
                  setInsertMode(event.target.value as InsertMode)
                }
              >
                <option value="after">串联 · 后</option>
                <option value="before">串联 · 前</option>
                <option value="parallel">并联</option>
                <option value="branch">追加支路</option>
              </select>
            </label>
            <button
              className="lad-palette-item"
              disabled={locked || !program.networks.length}
              title="常开触点：变量为 TRUE 时导通。拖入画布，或选中位置后点击添加。"
              onPointerDown={(event) =>
                drag.start({ kind: 'tool', tool: 'contact-open' }, event)
              }
              onClick={() => add('no')}
            >
              <b>─| |─</b>
              <span>
                常开触点<small>变量为 TRUE 时导通</small>
              </span>
            </button>
            <button
              className="lad-palette-item"
              disabled={locked || !program.networks.length}
              title="常闭触点：变量为 FALSE 时导通。拖入画布，或选中位置后点击添加。"
              onPointerDown={(event) =>
                drag.start({ kind: 'tool', tool: 'contact-closed' }, event)
              }
              onClick={() => add('nc')}
            >
              <b>─|/|─</b>
              <span>
                常闭触点<small>变量为 FALSE 时导通</small>
              </span>
            </button>
            <button
              className="lad-palette-item"
              disabled={locked || !program.networks.length}
              title="逻辑流求反：翻转前级结果。拖入画布，或选中位置后点击添加。"
              onPointerDown={(event) =>
                drag.start({ kind: 'tool', tool: 'not' }, event)
              }
              onClick={() => add('not')}
            >
              <b>─▷○─</b>
              <span>
                逻辑流求反<small>翻转前级 TRUE / FALSE</small>
              </span>
            </button>
            <div className="lad-sr-tools">
              {(
                [
                  ['coil-normal', '─( )─', '普通'],
                  ['coil-negated', '─(/)─', '反向'],
                  ['coil-set', '─(S)─', '置位'],
                  ['coil-reset', '─(R)─', '复位'],
                ] as const
              ).map(([tool, symbol, label]) => (
                <button
                  key={tool}
                  disabled={locked || !program.networks.length}
                  title={
                    label +
                    '线圈：拖到网络末尾线圈，或选中网络后点击。保留原变量绑定。'
                  }
                  onPointerDown={(event) =>
                    drag.start({ kind: 'tool', tool }, event)
                  }
                  onClick={() => setCoil(tool)}
                >
                  <b>{symbol}</b>
                  {label}
                </button>
              ))}
            </div>
            {(
              [
                ['定时器', ['TON', 'TOF', 'TP']],
                ['计数器', ['CTU', 'CTD']],
                ['边沿检测', ['R_TRIG', 'F_TRIG']],
              ] as [string, FunctionMode[]][]
            ).map(([title, modes]) => (
              <details className="lad-instruction-group" key={title}>
                <summary>{title}</summary>
                {modes.map((mode) => (
                  <button
                    key={mode}
                    className="lad-palette-item function"
                    disabled={locked || !program.networks.length}
                    title={
                      mode +
                      ' ' +
                      FUNCTION_INFO[mode].short +
                      '。拖入画布，或选中位置后点击添加。'
                    }
                    onPointerDown={(event) =>
                      drag.start({ kind: 'tool', tool: mode }, event)
                    }
                    onClick={() => add(mode)}
                  >
                    <b>{mode}</b>
                    <span>
                      {FUNCTION_INFO[mode].title}
                      <small>{FUNCTION_INFO[mode].short}</small>
                    </span>
                  </button>
                ))}
              </details>
            ))}
            <h2>网络</h2>
            <ToolButton
              label="新增网络"
              icon={<Plus size={16} />}
              disabled={locked || program.networks.length >= 128}
              onClick={addNetwork}
            />
            <div className="lad-small-actions">
              <ToolButton
                label="上移"
                icon={<ChevronUp size={14} />}
                disabled={
                  locked || !network || program.networks[0]?.id === network.id
                }
                onClick={() => moveNetwork(-1)}
              />
              <ToolButton
                label="下移"
                icon={<ChevronDown size={14} />}
                disabled={
                  locked ||
                  !network ||
                  program.networks.at(-1)?.id === network.id
                }
                onClick={() => moveNetwork(1)}
              />
            </div>
            <ToolButton
              label="复制网络"
              icon={<Copy size={16} />}
              disabled={locked || !network}
              onClick={() => {
                const next = cloneProgram(program)
                const copy = duplicateNetwork(network!, program)
                next.networks.splice(
                  next.networks.findIndex((n) => n.id === network!.id) + 1,
                  0,
                  copy,
                )
                edit(next)
                setSelection({ networkId: copy.id, elementId: copy.coil.id })
              }}
            />
            <ToolButton
              tone="red"
              label="删除网络"
              icon={<Trash2 size={16} />}
              disabled={locked || !network}
              onClick={() => {
                const next = cloneProgram(program)
                next.networks = next.networks.filter(
                  (n) => n.id !== network!.id,
                )
                edit(next)
                setSelection(null)
              }}
            />
          </aside>
          <PanelResizeHandle {...panels.getHandleProps('left')} />
          <main className="lad-center">
            <nav className="lad-toolbar" aria-label="模型和仿真工具栏">
              <div className="lad-tool-group">
                {!embedded && (
                  <>
                    <ToolButton
                      label="新建"
                      tone="blue"
                      icon={<FilePlus2 size={16} />}
                      disabled={locked}
                      onClick={() =>
                        afterDiscard(() =>
                          replaceProgram(emptyProgram(), 'LAD_新模型', null),
                        )
                      }
                    />
                    <ToolButton
                      label="打开"
                      tone="amber"
                      icon={<FolderOpen size={16} />}
                      disabled={locked}
                      onClick={() => void showModels()}
                    />
                  </>
                )}
                <ToolButton
                  label={embedded ? '应用并返回' : '保存'}
                  tone="blue"
                  icon={<Save size={16} />}
                  disabled={locked}
                  onClick={() => void save()}
                />
                {!embedded && (
                  <ToolButton
                    label="另存为"
                    tone="blue"
                    icon={<Copy size={16} />}
                    disabled={locked}
                    onClick={() => {
                      setSaveAsName(modelName + '_副本')
                      setSaveAsDialog(true)
                    }}
                  />
                )}
              </div>
              <div className="lad-tool-group">
                <ToolButton
                  label="撤销"
                  tone="neutral"
                  icon={<Undo2 size={16} />}
                  disabled={locked || !history.past.length}
                  onClick={undo}
                />
                <ToolButton
                  label="重做"
                  tone="neutral"
                  icon={<Redo2 size={16} />}
                  disabled={locked || !history.future.length}
                  onClick={redo}
                />
                <ToolButton
                  label="校验"
                  tone="green"
                  icon={<CheckCheck size={16} />}
                  disabled={locked}
                  onClick={() => void validate()}
                />
              </div>
              {!embedded && (
                <div className="lad-tool-group">
                  {running ? (
                    <ToolButton
                      label="暂停"
                      tone="amber"
                      icon={<Pause size={16} />}
                      primary
                      onClick={stop}
                    />
                  ) : (
                    <ToolButton
                      label="运行"
                      tone="green"
                      icon={<Play size={16} />}
                      primary
                      disabled={busy || !!issues.length}
                      onClick={run}
                    />
                  )}
                  <ToolButton
                    label="单步"
                    tone="blue"
                    icon={<StepForward size={16} />}
                    disabled={locked || !!issues.length}
                    onClick={() => void oneScan()}
                    title="只执行一次完整扫描"
                  />
                  <ToolButton
                    label="重置"
                    tone="amber"
                    icon={<RotateCcw size={16} />}
                    disabled={locked || !!issues.length}
                    onClick={() => void reset()}
                  />
                  <ToolButton
                    label="生成 C"
                    tone="blue"
                    icon={<FileCode2 size={16} />}
                    disabled={locked || !!issues.length}
                    onClick={() => void compile()}
                  />
                </div>
              )}
              <div className="lad-example-picker">
                <select
                  aria-label="选择教学示例"
                  title={activeExample?.description ?? '载入教学示例'}
                  value={activeExample?.id ?? ''}
                  disabled={locked}
                  onChange={(event) => {
                    const example = LAD_EXAMPLES.find(
                      (item) => item.id === event.target.value,
                    )
                    if (example)
                      afterDiscard(() => {
                        replaceProgram(
                          example.create(),
                          example.modelName,
                          null,
                        )
                        setExampleId(example.id)
                      })
                  }}
                >
                  <option value="" disabled>
                    教学示例…
                  </option>
                  {LAD_EXAMPLES.map((example) => (
                    <option key={example.id} value={example.id}>
                      {example.title}
                    </option>
                  ))}
                </select>
              </div>
              <label className="lad-scan-period">
                扫描周期{' '}
                <input
                  aria-label="扫描周期毫秒"
                  type="number"
                  min={1}
                  max={60000}
                  value={program.scanPeriodMs}
                  disabled={locked}
                  onChange={(event) => {
                    const next = cloneProgram(program)
                    next.scanPeriodMs = Number(event.target.value)
                    edit(next)
                  }}
                />{' '}
                ms
              </label>
            </nav>
            <section
              className="lad-workarea"
              ref={panels.centerRef}
              aria-label="梯形图工作区"
            >
              <div className="lad-canvas-scroll">
                <LadderCanvas
                  program={program}
                  selection={selection}
                  snapshot={snapshot}
                  onSelect={setSelection}
                  dragPayload={drag.payload}
                  onDragStart={drag.start}
                  dropTarget={drag.target}
                  onDropTargetChange={drag.setDropTarget}
                  locked={locked}
                />
              </div>
              <PanelResizeHandle {...panels.getHandleProps('bottom')} />
              <div className="lad-bottom-panel" id="lad-bottom-panel">
                <FunctionMonitor
                  elements={instances}
                  snapshot={snapshot}
                  onSelect={(id) => {
                    const containing = program.networks.find((n) =>
                      findElement(n, id),
                    )
                    if (containing)
                      setSelection({ networkId: containing.id, elementId: id })
                  }}
                />
                <section className="lad-variables" id="lad-variable-panel">
                  <div className="lad-panel-heading">
                    <h2
                      title={
                        embedded
                          ? '输入和输出通过父画布连接，输入为 0/1 标量；内部变量不出端口'
                          : '切换输入后在下一次扫描生效'
                      }
                    >
                      变量
                    </h2>
                  </div>
                  <div className="lad-variable-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>名称</th>
                          <th>类型</th>
                          <th title="BOOL 变量的初始值">初值</th>
                          <th
                            title={
                              embedded
                                ? '输入由父模型连线提供'
                                : '输入开关在下一次扫描开始时读取'
                            }
                          >
                            {embedded ? '来源' : '输入'}
                          </th>
                          <th>当前值</th>
                          <th>操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {program.variables.map((variable, index) => (
                          <tr key={variable.name}>
                            <td>
                              <button
                                className="lad-variable-name"
                                disabled={locked}
                                title="重命名并同步所有引用"
                                onClick={() => {
                                  setRenameTarget(variable.name)
                                  setRenamedValue(variable.name)
                                }}
                              >
                                {variable.name}
                              </button>
                            </td>
                            <td>
                              <select
                                aria-label={variable.name + ' 类型'}
                                value={variable.kind}
                                disabled={locked}
                                onChange={(event) => {
                                  const next = cloneProgram(program)
                                  next.variables[index].kind = event.target
                                    .value as LadVariable['kind']
                                  edit(next)
                                }}
                              >
                                <option value="input">输入 I</option>
                                <option value="output">输出 Q</option>
                                <option value="memory">内部 M</option>
                              </select>
                            </td>
                            <td>
                              <input
                                type="checkbox"
                                aria-label={variable.name + ' 初值'}
                                checked={variable.initialValue}
                                disabled={locked}
                                onChange={(event) => {
                                  const next = cloneProgram(program)
                                  next.variables[index].initialValue =
                                    event.target.checked
                                  edit(next)
                                }}
                              />
                            </td>
                            <td>
                              {variable.kind === 'input' && !embedded ? (
                                <label className="lad-input-toggle">
                                  <input
                                    type="checkbox"
                                    aria-label={variable.name + ' 输入'}
                                    checked={
                                      Object.hasOwn(inputs, variable.name)
                                        ? inputs[variable.name]
                                        : variable.initialValue
                                    }
                                    onChange={(event) =>
                                      updateInputs({
                                        ...inputsRef.current,
                                        [variable.name]: event.target.checked,
                                      })
                                    }
                                  />
                                  <span>
                                    {inputs[variable.name] === true
                                      ? 'TRUE'
                                      : 'FALSE'}
                                  </span>
                                </label>
                              ) : (
                                <span
                                  className="lad-muted"
                                  title={
                                    embedded && variable.kind === 'input'
                                      ? '父模型提供 0/1 标量'
                                      : '由程序写入'
                                  }
                                >
                                  {embedded && variable.kind === 'input'
                                    ? '父模型'
                                    : '—'}
                                </span>
                              )}
                            </td>
                            <td>
                              <span
                                className={
                                  'lad-value' +
                                  (snapshot?.variables[variable.name] === true
                                    ? ' true'
                                    : '')
                                }
                              >
                                {snapshot
                                  ? snapshot.variables[variable.name] === true
                                    ? 'TRUE'
                                    : 'FALSE'
                                  : '—'}
                              </span>
                            </td>
                            <td>
                              <button
                                className="lad-icon-button"
                                aria-label={'删除变量 ' + variable.name}
                                title={'删除变量 ' + variable.name}
                                disabled={locked}
                                onClick={() => removeVariable(variable.name)}
                              >
                                <Trash2 size={15} />
                              </button>
                            </td>
                          </tr>
                        ))}
                        {!program.variables.length && (
                          <tr>
                            <td colSpan={6} className="lad-muted">
                              暂无变量
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="lad-new-variable">
                    <input
                      aria-label="新增变量名称"
                      placeholder="新变量名称"
                      value={variableDraft.name}
                      disabled={locked}
                      maxLength={64}
                      onChange={(event) =>
                        setVariableDraft({
                          ...variableDraft,
                          name: event.target.value,
                        })
                      }
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') addVariable()
                      }}
                    />
                    <select
                      aria-label="新增变量类型"
                      value={variableDraft.kind}
                      disabled={locked}
                      onChange={(event) =>
                        setVariableDraft({
                          ...variableDraft,
                          kind: event.target.value as LadVariable['kind'],
                        })
                      }
                    >
                      <option value="input">输入 I</option>
                      <option value="output">输出 Q</option>
                      <option value="memory">内部 M</option>
                    </select>
                    <label>
                      <input
                        type="checkbox"
                        aria-label="新增变量初值"
                        disabled={locked}
                        checked={variableDraft.initialValue}
                        onChange={(event) =>
                          setVariableDraft({
                            ...variableDraft,
                            initialValue: event.target.checked,
                          })
                        }
                      />{' '}
                      初值 TRUE
                    </label>
                    <ToolButton
                      label="添加变量"
                      icon={<Plus size={15} />}
                      disabled={locked || program.variables.length >= 256}
                      onClick={addVariable}
                    />
                  </div>
                </section>
              </div>
            </section>
          </main>
          <PanelResizeHandle {...panels.getHandleProps('right')} />
          <aside className="lad-inspector" id="lad-inspector-panel">
            <h2 className="lad-inspector-heading">
              属性
              <span
                className={
                  'lad-check-status tone-' +
                  (issues.length ? 'error' : 'success')
                }
                title={issues.length ? '点击问题定位元件' : '结构检查通过'}
              >
                {issues.length ? (
                  <CircleAlert aria-hidden="true" />
                ) : (
                  <CircleCheck aria-hidden="true" />
                )}
                {issues.length ? issues.length + ' 项问题' : '校验通过'}
              </span>
            </h2>
            {network ? (
              <>
                <label className="lad-field">
                  网络注释
                  <input
                    aria-label="网络注释"
                    value={network.label}
                    disabled={locked}
                    maxLength={200}
                    onChange={(event) =>
                      editNetwork((n) => {
                        n.label = event.target.value
                      })
                    }
                  />
                </label>
                {(selectedCoil || element?.type === 'contact') && (
                  <>
                    <label className="lad-field">
                      绑定变量
                      <select
                        aria-label="元件绑定变量"
                        disabled={locked}
                        value={
                          selectedCoil
                            ? network.coil.variable
                            : (element!.variable ?? '')
                        }
                        onChange={(event) =>
                          editNetwork((n) => {
                            if (selectedCoil)
                              n.coil.variable = event.target.value
                            else
                              findElement(n, selection!.elementId)!.variable =
                                event.target.value
                          })
                        }
                      >
                        <option value="">选择已声明变量</option>
                        {program.variables
                          .filter((v) => !selectedCoil || v.kind !== 'input')
                          .map((v) => (
                            <option key={v.name} value={v.name}>
                              {v.name} · {kindLabel[v.kind]}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label
                      className="lad-checkbox"
                      title={
                        selectedCoil
                          ? '写入逻辑流的反值'
                          : '变量为 FALSE 时导通'
                      }
                    >
                      <input
                        type="checkbox"
                        aria-label={selectedCoil ? '反向线圈' : '常闭触点'}
                        checked={
                          selectedCoil
                            ? network.coil.negated
                            : (element!.negated ?? false)
                        }
                        disabled={
                          locked ||
                          (selectedCoil &&
                            network.coil.mode !== undefined &&
                            network.coil.mode !== 'normal')
                        }
                        onChange={(event) =>
                          editNetwork((n) => {
                            if (selectedCoil)
                              n.coil.negated = event.target.checked
                            else
                              findElement(n, selection!.elementId)!.negated =
                                event.target.checked
                          })
                        }
                      />
                      {selectedCoil ? '反向线圈' : '常闭触点'}
                    </label>
                  </>
                )}
                {selectedCoil && (
                  <>
                    <label className="lad-field">
                      线圈类型
                      <select
                        aria-label="线圈类型"
                        value={network.coil.mode ?? 'normal'}
                        disabled={locked}
                        onChange={(event) =>
                          editNetwork((n) => {
                            n.coil.mode = event.target.value as CoilMode
                            if (n.coil.mode !== 'normal') n.coil.negated = false
                          })
                        }
                      >
                        <option value="normal">普通线圈</option>
                        <option value="set">S · 置位并保持</option>
                        <option value="reset">R · 复位并保持</option>
                      </select>
                    </label>
                    {network.coil.mode && network.coil.mode !== 'normal' && (
                      <details className="lad-help">
                        <summary>说明</summary>
                        <p>
                          S 来流为 TRUE 时置位，R 来流为 TRUE 时复位；来流 FALSE
                          时保持。一个变量可有一组
                          S/R，同时触发时后执行的网络决定最终状态。S/R
                          不能与普通线圈混写。
                        </p>
                      </details>
                    )}
                  </>
                )}
                {element && isFunctionBlock(element) && (
                  <FunctionInspector
                    element={element}
                    program={program}
                    locked={locked}
                    state={
                      snapshot?.states &&
                      element.instance &&
                      Object.hasOwn(snapshot.states, element.instance)
                        ? snapshot.states[element.instance]
                        : undefined
                    }
                    onPatch={(patch) =>
                      editNetwork((n) =>
                        Object.assign(
                          findElement(n, selection!.elementId)!,
                          patch,
                        ),
                      )
                    }
                  />
                )}
                {element?.type === 'not' && (
                  <details className="lad-help">
                    <summary>说明</summary>
                    <p>
                      求反翻转的是前级逻辑流，FALSE 会变成
                      TRUE。它不是常闭触点；常闭触点仍受上游导通条件约束。
                    </p>
                  </details>
                )}
                {(element?.type === 'series' ||
                  element?.type === 'parallel') && (
                  <details className="lad-help">
                    <summary>说明</summary>
                    <p>
                      选择组内元件可继续串联；选择并联组后，以“追加支路”插入新分支。空支路不能执行。
                    </p>
                  </details>
                )}
                {!selectedCoil && (
                  <ToolButton
                    tone="red"
                    label="删除选中元件"
                    icon={<Trash2 size={15} />}
                    disabled={locked}
                    onClick={() => {
                      editNetwork((n) => removeElement(n, selection!.elementId))
                      setSelection({
                        networkId: network.id,
                        elementId: network.condition.id,
                      })
                    }}
                  />
                )}
                {!(element && isFunctionBlock(element)) && (
                  <div className="lad-live-inspector">
                    <span>当前逻辑流</span>
                    <b>
                      {snapshot && snapshot.scanIndex > 0 && selection
                        ? snapshot.trace[selection.elementId] === true
                          ? 'TRUE'
                          : 'FALSE'
                        : '未扫描'}
                    </b>
                  </div>
                )}
              </>
            ) : (
              <p className="lad-muted">未选择元件</p>
            )}
            {issues.length > 0 && (
              <div className="lad-diagnostics">
                <ol>
                  {issues.map((issue, index) => (
                    <li key={issue.path + index}>
                      <button onClick={() => locate(issue)} title={issue.path}>
                        {issue.message}
                      </button>
                    </li>
                  ))}
                </ol>
              </div>
            )}
            <details className="lad-help lad-example-steps">
              <summary>帮助</summary>
              <p>
                网络从上到下，逻辑流从左到右。并联为“或”，串联为“与”。下方网络能读取上方网络本次写入的值。
              </p>
              <p>输入只在每次扫描开始时锁存。蓝色显示该次扫描的逻辑流。</p>
              <p>
                定时器和计数器每次扫描都会更新，包括左侧断开的情况。计时使用逻辑时间，暂停时不会前进。
              </p>
              {activeExample && (
                <p>
                  {activeExample.title}：{activeExample.description}
                </p>
              )}
              {(
                activeExample?.steps ?? [
                  '从工具箱拖入指令，或选中位置后点击添加。拖动图形可移动元件，拖动网络序号可排序；Esc取消。',
                  '点击“重置”恢复初值；打开或关闭输入，再点击“单步”，查看本次逻辑流及状态。',
                  '输入需要跨扫描改变才形成边沿；反复点击单步但保持输入不变，不会重复计数。',
                  '使用“运行”连续扫描；“暂停”保留当前状态。修改程序会从初值重新开始。',
                ]
              ).map((step, index) => (
                <p key={index}>
                  {index + 1}. {step}
                </p>
              ))}
              {activeExample && (
                <small>以上为示例原参数。修改参数后请按实际设置验证。</small>
              )}
            </details>
          </aside>
        </div>
        <footer className="lad-status" role="status">
          <span
            className={
              drag.payload
                ? 'lad-drag-status'
                : 'lad-status-message tone-' +
                  (operationError ? 'error' : 'neutral')
            }
            title={statusText}
          >
            {!drag.payload &&
              (operationError ? (
                <CircleAlert aria-hidden="true" />
              ) : (
                <CircleDot aria-hidden="true" />
              ))}
            <span>
              {drag.payload
                ? dragLabel(drag.payload) +
                  ' · ' +
                  dropLabel(drag.target, program)
                : statusText}
            </span>
          </span>
          <span>
            {snapshot
              ? '扫描 #' +
                snapshot.scanIndex +
                ' · 逻辑时间 ' +
                (snapshot.timeMs / 1000).toFixed(3) +
                ' s'
              : '尚未扫描'}
          </span>
        </footer>
        {drag.payload && (
          <div
            className={'lad-drag-ghost ' + (drag.target ? 'valid' : 'invalid')}
            style={{
              left: Math.min(drag.position.x + 16, window.innerWidth - 235),
              top: Math.min(drag.position.y + 18, window.innerHeight - 65),
            }}
            aria-hidden="true"
          >
            <strong>{dragLabel(drag.payload)}</strong>
            <span>{dropLabel(drag.target, program)}</span>
          </div>
        )}
      </div>
      <Modal
        open={openDialog}
        title="我的 LAD 模型"
        footer={null}
        onCancel={() => setOpenDialog(false)}
        width={650}
      >
        <div className="lad-model-list">
          {models.length ? (
            models.map((model) => (
              <div key={model.id}>
                <div>
                  <strong>{model.modelName}</strong>
                  <small>{model.lastUpdate}</small>
                </div>
                <ToolButton
                  label="打开模型"
                  icon={<FolderOpen size={15} />}
                  disabled={busy}
                  onClick={() => afterDiscard(() => void openModel(model.id))}
                />
                <button
                  className="lad-icon-button"
                  aria-label={'删除模型 ' + model.modelName}
                  disabled={busy}
                  onClick={() =>
                    modalApi.confirm({
                      title: '删除模型“' + model.modelName + '”？',
                      content: '仅删除这个 LAD 模型，当前编辑内容仍保留。',
                      okText: '删除',
                      cancelText: '取消',
                      onOk: async () => {
                        try {
                          await ladApi.remove(model.id)
                          setModels((list) =>
                            list.filter((item) => item.id !== model.id),
                          )
                          if (modelId === model.id) {
                            setModelId(null)
                            setSavedContent(null)
                            onDocumentLocation?.(null)
                          }
                        } catch (error) {
                          reportError(error)
                          throw error
                        }
                      },
                    })
                  }
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))
          ) : (
            <p>尚无已保存的 LAD 模型。</p>
          )}
        </div>
      </Modal>
      <Modal
        open={saveAsDialog}
        title="另存为 LAD 模型"
        okText="保存副本"
        cancelText="取消"
        confirmLoading={busy}
        onCancel={() => setSaveAsDialog(false)}
        onOk={() => void save(true, saveAsName)}
      >
        <label className="lad-field">
          模型名称
          <input
            aria-label="副本名称"
            value={saveAsName}
            maxLength={100}
            onChange={(event) => setSaveAsName(event.target.value)}
          />
        </label>
      </Modal>
      <Modal
        open={renameTarget !== null}
        title="重命名变量"
        okText="重命名并更新引用"
        cancelText="取消"
        onCancel={() => setRenameTarget(null)}
        onOk={() => {
          try {
            edit(renameVariable(program, renameTarget!, renamedValue.trim()), {
              from: renameTarget!,
              to: renamedValue.trim(),
            })
            setRenameTarget(null)
          } catch (error) {
            messageApi.warning(errorText(error))
          }
        }}
      >
        <p>所有触点和线圈引用会同步更新。</p>
        <label className="lad-field">
          变量名称
          <input
            aria-label="重命名变量名称"
            value={renamedValue}
            maxLength={64}
            onChange={(event) => setRenamedValue(event.target.value)}
          />
        </label>
      </Modal>
      <Modal
        open={code !== null}
        title="C99 扫描源码"
        width={920}
        onCancel={() => setCode(null)}
        footer={
          <ToolButton
            label="下载 C 源码"
            icon={<Download size={16} />}
            onClick={() =>
              downloadText(
                modelName.replace(/[^\w\u4e00-\u9fa5-]/g, '_') + '.c',
                code!,
              )
            }
          />
        }
      >
        <p>
          与 Java 扫描共享 LAD 程序语义。该源码用于本机 C99
          编译验证，不包含实物设备 I/O 或下载操作。
        </p>
        <pre className="lad-source-code">{code}</pre>
      </Modal>
    </ConfigProvider>
  )
}
