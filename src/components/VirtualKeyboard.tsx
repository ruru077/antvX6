import { Button as AntdButton } from 'antd'
import { MinusIcon, XIcon } from 'lucide-react'
import { createPortal } from 'react-dom'
import { Rnd } from 'react-rnd'
import Keyboard from 'react-simple-keyboard'
import keyboardIcon from '@/assets/svg/sub-tabbar-keyboard.svg'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { createCommonService } from '@/services/common-service'
import { useGraphStore } from '@/store/graphStore'
import { usePhoneTerminal } from '@/utils/hooks/usePhoneTerminal'
import 'react-simple-keyboard/build/css/index.css'

type VirtualModifierState = {
  primary: boolean
  shift: boolean
  space: boolean
}

type VirtualKeyboardRect = {
  x: number
  y: number
  width: number
  height: number
}

type VirtualKeyboardWindowProps = {
  rect: VirtualKeyboardRect
  onRectChange: (rect: VirtualKeyboardRect) => void
  onMinimize: () => void
  onClose: () => void
}

const WINDOW_MARGIN = 16
const commonService = createCommonService()
const primaryModifierKey = commonService.getPrimaryModifeierByDevice()
const primaryModifierLabel = primaryModifierKey === 'metaKey' ? '⌘' : 'Ctrl'

const KEYBOARD_LAYOUT = {
  default: [
    '~ ! @ # $ % ^ & * ( ) _ + {bksp}',
    '{tab} Q W E R T Y U I O P { } |',
    '{lock} A S D F G H J K L : " {enter}',
    '{shift} Z X C V B N M < > ? {shift}',
    '.com @ {space}',
    '{primary} {delete} {arrowleft} {arrowup} {arrowdown} {arrowright}',
  ],
  lower: [
    '` 1 2 3 4 5 6 7 8 9 0 - = {bksp}',
    '{tab} q w e r t y u i o p [ ] \\',
    "{lock} a s d f g h j k l ; ' {enter}",
    '{shift} z x c v b n m , . / {shift}',
    '.com @ {space}',
    '{primary} {delete} {arrowleft} {arrowup} {arrowdown} {arrowright}',
  ],
}

const SHIFTED_SYMBOLS = new Set('~!@#$%^&*()_+{}|:"<>?')

const BUTTON_TO_KEY: Record<string, string> = {
  '{esc}': 'Escape',
  '{bksp}': 'Backspace',
  '{tab}': 'Tab',
  '{enter}': 'Enter',
  '{delete}': 'Delete',
  '{arrowleft}': 'ArrowLeft',
  '{arrowup}': 'ArrowUp',
  '{arrowdown}': 'ArrowDown',
  '{arrowright}': 'ArrowRight',
}

const KEY_CODES: Record<string, number> = {
  Backspace: 8,
  Tab: 9,
  Enter: 13,
  Escape: 27,
  ' ': 32,
  ArrowLeft: 37,
  ArrowUp: 38,
  ArrowRight: 39,
  ArrowDown: 40,
  Delete: 46,
  '`': 192,
  '~': 192,
  '!': 49,
  '@': 50,
  '#': 51,
  $: 52,
  '%': 53,
  '^': 54,
  '&': 55,
  '*': 56,
  '(': 57,
  ')': 48,
  '-': 189,
  _: 189,
  '=': 187,
  '+': 187,
  '[': 219,
  '{': 219,
  ']': 221,
  '}': 221,
  '\\': 220,
  '|': 220,
  ';': 186,
  ':': 186,
  "'": 222,
  '"': 222,
  ',': 188,
  '<': 188,
  '.': 190,
  '>': 190,
  '/': 191,
  '?': 191,
}

function getInitialRect(): VirtualKeyboardRect {
  const width = Math.min(720, window.innerWidth - WINDOW_MARGIN * 2)
  const height = Math.min(360, window.innerHeight - WINDOW_MARGIN * 2)
  return {
    x: Math.max(WINDOW_MARGIN, window.innerWidth - width - WINDOW_MARGIN),
    y: Math.max(WINDOW_MARGIN, window.innerHeight - height - WINDOW_MARGIN),
    width,
    height,
  }
}

function getPaperContainer() {
  const container = document.querySelector<HTMLElement>('.paper-container')
  if (!container) throw new Error('Paper container is required')
  return container
}

function getKeyCode(key: string) {
  return KEY_CODES[key] ?? key.toUpperCase().charCodeAt(0)
}

function getEventCode(key: string) {
  if (/^[a-z]$/i.test(key)) return `Key${key.toUpperCase()}`
  if (/^\d$/.test(key)) return `Digit${key}`
  if (key === '-' || key === '_') return 'Minus'
  if (key === '=' || key === '+') return 'Equal'
  if (key === '`' || key === '~') return 'Backquote'
  if (key === '[' || key === '{') return 'BracketLeft'
  if (key === ']' || key === '}') return 'BracketRight'
  if (key === '\\' || key === '|') return 'Backslash'
  if (key === ';' || key === ':') return 'Semicolon'
  if (key === "'" || key === '"') return 'Quote'
  if (key === ',' || key === '<') return 'Comma'
  if (key === '.' || key === '>') return 'Period'
  if (key === '/' || key === '?') return 'Slash'
  if (key === ' ') return 'Space'
  return key
}

function createVirtualKeyboardEvent(
  type: 'keydown' | 'keypress' | 'keyup',
  key: string,
  modifiers: VirtualModifierState,
) {
  const keyCode =
    type === 'keypress' && key.length === 1
      ? (modifiers.shift ? key.toUpperCase() : key).charCodeAt(0)
      : getKeyCode(key)
  const event = new KeyboardEvent(type, {
    key: modifiers.shift && key.length === 1 ? key.toUpperCase() : key,
    code: getEventCode(key),
    bubbles: true,
    cancelable: true,
    ctrlKey: primaryModifierKey === 'ctrlKey' && modifiers.primary,
    metaKey: primaryModifierKey === 'metaKey' && modifiers.primary,
    shiftKey: modifiers.shift,
  })

  Object.defineProperties(event, {
    which: { value: keyCode },
    keyCode: { value: keyCode },
    charCode: { value: type === 'keypress' ? keyCode : 0 },
  })
  return event
}

function VirtualKeyboardWindow({
  rect,
  onRectChange,
  onMinimize,
  onClose,
}: VirtualKeyboardWindowProps) {
  const graph = useGraphStore((state) => state.graph)
  const titleId = useId()
  const modifiersRef = useRef<VirtualModifierState>({
    primary: false,
    shift: false,
    space: false,
  })
  const [modifiers, setModifiers] = useState(modifiersRef.current)
  const [capsUppercase, setCapsUppercase] = useState(true)
  const layoutName = capsUppercase !== modifiers.shift ? 'default' : 'lower'

  function updateModifiers(next: VirtualModifierState) {
    modifiersRef.current = next
    setModifiers(next)
  }

  function dispatchEvent(
    type: 'keydown' | 'keypress' | 'keyup',
    key: string,
    eventModifiers = modifiersRef.current,
  ) {
    graph?.container.dispatchEvent(
      createVirtualKeyboardEvent(type, key, eventModifiers),
    )
  }

  function dispatchKey(key: string) {
    const eventModifiers = {
      ...modifiersRef.current,
      shift: modifiersRef.current.shift || SHIFTED_SYMBOLS.has(key),
    }
    dispatchEvent('keydown', key, eventModifiers)
    if (key.length === 1) dispatchEvent('keypress', key, eventModifiers)
    dispatchEvent('keyup', key, eventModifiers)
  }

  function releaseSpace() {
    if (modifiersRef.current.space) dispatchEvent('keyup', ' ')
  }

  function resetModifiers() {
    releaseSpace()
    updateModifiers({
      primary: false,
      shift: false,
      space: false,
    })
  }

  useEffect(
    () => () => {
      if (modifiersRef.current.space) dispatchEvent('keyup', ' ')
    },
    [],
  )

  function togglePrimaryModifier() {
    updateModifiers({
      ...modifiersRef.current,
      primary: !modifiersRef.current.primary,
    })
  }

  function toggleKeyboardLayout() {
    updateModifiers({
      ...modifiersRef.current,
      shift: !modifiersRef.current.shift,
    })
  }

  function toggleCaps() {
    setCapsUppercase((current) => !current)
  }

  function toggleSpace() {
    if (!graph) return
    if (modifiersRef.current.space) {
      dispatchEvent('keyup', ' ')
      updateModifiers({ ...modifiersRef.current, space: false })
      return
    }

    dispatchEvent('keydown', ' ')
    updateModifiers({ ...modifiersRef.current, space: true })
  }

  function pressKey(button: string) {
    if (button === '{primary}') {
      togglePrimaryModifier()
      return
    }
    if (button === '{shift}') {
      toggleKeyboardLayout()
      return
    }
    if (button === '{lock}') {
      toggleCaps()
      return
    }
    if (button === '{space}') {
      toggleSpace()
      return
    }

    dispatchKey(BUTTON_TO_KEY[button] ?? button)
    resetModifiers()
  }

  const activeButtons = [
    modifiers.primary && '{primary}',
    modifiers.shift && '{shift}',
    modifiers.space && '{space}',
  ].filter((button): button is string => Boolean(button))

  return createPortal(
    <Rnd
      bounds="window"
      cancel="[data-virtual-keyboard-action], .simple-keyboard"
      default={rect}
      dragHandleClassName="virtual-keyboard-window__drag-handle"
      minWidth={Math.min(560, window.innerWidth - WINDOW_MARGIN * 2)}
      minHeight={Math.min(320, window.innerHeight - WINDOW_MARGIN * 2)}
      style={{ zIndex: 80 }}
      onDragStop={(_, position) => {
        onRectChange({ ...rect, x: position.x, y: position.y })
      }}
      onResizeStop={(_, __, element, ___, position) => {
        onRectChange({
          x: position.x,
          y: position.y,
          width: element.offsetWidth,
          height: element.offsetHeight,
        })
      }}
    >
      <Card
        className="virtual-keyboard-window"
        role="dialog"
        aria-labelledby={titleId}
        aria-modal="false"
      >
        <CardHeader className="virtual-keyboard-window__drag-handle">
          <CardTitle id={titleId}>虚拟键盘</CardTitle>
          <CardAction
            className="virtual-keyboard-window__actions"
            data-virtual-keyboard-action
          >
            <Button
              type="button"
              variant="ghost"
              aria-label="最小化虚拟键盘"
              title="最小化"
              data-virtual-keyboard-action
              onClick={onMinimize}
            >
              <MinusIcon />
            </Button>
            <Button
              type="button"
              variant="ghost"
              aria-label="关闭虚拟键盘"
              title="关闭"
              data-virtual-keyboard-action
              onClick={onClose}
            >
              <XIcon />
            </Button>
          </CardAction>
        </CardHeader>
        <Separator />
        <CardContent className="virtual-keyboard-window__content">
          <Keyboard
            baseClass="simple-keyboard"
            layout={KEYBOARD_LAYOUT}
            layoutName={layoutName}
            display={{
              '{bksp}': 'Backspace',
              '{tab}': 'Tab',
              '{enter}': 'Enter',
              '{lock}': 'Caps',
              '{shift}': 'Shift',
              '{delete}': 'Delete',
              '{primary}': primaryModifierLabel,
              '{space}': 'Space',
              '{arrowleft}': '←',
              '{arrowup}': '↑',
              '{arrowdown}': '↓',
              '{arrowright}': '→',
            }}
            mergeDisplay
            buttonTheme={
              activeButtons.length
                ? [
                    {
                      class: 'hg-activeButton',
                      buttons: activeButtons.join(' '),
                    },
                  ]
                : []
            }
            disableButtonHold
            preventMouseDownDefault
            stopMouseDownPropagation
            stopMouseUpPropagation
            useButtonTag
            onKeyPress={pressKey}
          />
        </CardContent>
      </Card>
    </Rnd>,
    document.body,
  )
}

function VirtualKeyboard() {
  const phoneTerminal = usePhoneTerminal()
  const [open, setOpen] = useState(false)
  const [minimized, setMinimized] = useState(false)
  const [rect, setRect] = useState(getInitialRect)

  if (phoneTerminal) return null

  function toggleKeyboard() {
    if (!open) {
      setOpen(true)
      setMinimized(false)
      return
    }
    if (minimized) {
      setMinimized(false)
      return
    }
    setOpen(false)
  }

  return (
    <>
      <AntdButton
        className="subsystem-tab-bar__keyboard"
        type="text"
        title={open && !minimized ? '关闭虚拟键盘' : '打开虚拟键盘'}
        aria-label={open && !minimized ? '关闭虚拟键盘' : '打开虚拟键盘'}
        aria-pressed={open}
        icon={<img alt="" src={keyboardIcon} />}
        onClick={toggleKeyboard}
      />
      {open && !minimized && (
        <VirtualKeyboardWindow
          rect={rect}
          onRectChange={setRect}
          onMinimize={() => setMinimized(true)}
          onClose={() => setOpen(false)}
        />
      )}
      {open &&
        minimized &&
        createPortal(
          <button
            className="virtual-keyboard-side-tab"
            type="button"
            aria-label="展开虚拟键盘"
            title="展开虚拟键盘"
            onClick={() => setMinimized(false)}
          >
            <img alt="" src={keyboardIcon} />
          </button>,
          getPaperContainer(),
        )}
    </>
  )
}

export { VirtualKeyboard }
