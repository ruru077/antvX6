import { Graph, Transform } from '@antv/x6'
import {
  BLACK,
  EDGE_STROKE_WIDTH,
  EDGE_WRAPPER_WIDTH,
  RED,
  TARGETMARKER_SIZE,
} from '@/assets/constant'
import previewArrowRaw from '@/assets/svg/preview-edge-arrow.svg?raw'
import { createCommonService } from '@/services/common-service'
import type { MarkupJSONMarkup } from '@antv/x6/lib/view/markup'

const commonService = createCommonService()

// ── 注册 subsystem-block shape ──────────────────────────────────────────────
// 继承 text-block（foreignObject + div label），默认 attrs 定位 label 到节点下方
const XHTML_NS = 'http://www.w3.org/1999/xhtml'

export const SUBSYSTEM_BACKGROUND_TOP = '#ffffff'
export const SUBSYSTEM_BACKGROUND_BOTTOM = '#dadada'
export const MASK_SELECTOR = 'mask'
export const OUTLINE_COLOR = 'rgb(102, 194, 255)'
export const DROP_SHADOW_FILTER = {
  name: 'dropShadow',
  args: {
    dx: 2.5,
    dy: 2.5,
    blur: 1.25,
    color: 'black',
    opacity: 0.55,
  },
}

export function createSubsystemBackgroundFill() {
  return {
    type: 'linearGradient' as const,
    stops: [
      { offset: 0, color: SUBSYSTEM_BACKGROUND_TOP },
      { offset: 0.3, color: SUBSYSTEM_BACKGROUND_TOP },
      { offset: 1, color: SUBSYSTEM_BACKGROUND_BOTTOM },
    ],
    attrs: { x1: 0, y1: 0, x2: 0, y2: 1 },
  }
}

/** lucide arrow-big-down */
const ARROW_D =
  'M9 5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v6a1 1 0 0 0 1 1h3.293a.707.707 0 0 1 .5 1.207l-7.086 7.086a1 1 0 0 1-1.414 0l-7.086-7.086a.707.707 0 0 1 .5-1.207H8a1 1 0 0 0 1-1z'

/**
 * subsystem-block 的完整 SVG/HTML 结构。
 * mask 是可选的最上层交互结构，避免业务代码增量拼接任意 markup。
 */
export function buildSubsystemMarkup(withMask = false): MarkupJSONMarkup[] {
  const markup: MarkupJSONMarkup[] = [
    { tagName: 'rect', selector: 'body' },
    { tagName: 'image', selector: 'thumb' },
    {
      tagName: 'foreignObject',
      selector: 'foreignObject',
      children: [
        {
          tagName: 'div',
          ns: XHTML_NS,
          selector: 'label',
          style: {
            width: '100%',
            height: '100%',
            position: 'static',
            backgroundColor: 'transparent',
            textAlign: 'center',
            margin: 0,
            padding: '0px 5px',
            boxSizing: 'border-box',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          },
        },
      ],
    },
  ]

  if (withMask) {
    markup.push({
      tagName: 'g',
      selector: MASK_SELECTOR,
      children: [
        { tagName: 'title', textContent: '查看内部封装' },
        { tagName: 'rect', selector: 'maskBg' },
        { tagName: 'path', selector: 'maskArrow' },
      ],
    })
  }

  return markup
}

Graph.registerNode(
  'subsystem-block',
  {
    inherit: 'text-block',
    markup: buildSubsystemMarkup(),
    attrs: {
      body: {
        refWidth: '100%',
        refHeight: '100%',
        fill: createSubsystemBackgroundFill(),
      },
      thumb: {
        refWidth: '100%',
        refHeight: '100%',
        preserveAspectRatio: 'xMidYMid meet',
        pointerEvents: 'none',
      },
      foreignObject: {
        refWidth: '100%',
        refHeight: null,
        refY: '100%',
      },
      label: {
        text: 'Subsystem',
        style: {
          width: 'fit-content',
          height: 'auto',
          whiteSpace: 'pre',
          marginLeft: '50%',
          transform: 'translateX(-50%)',
        },
      },
    },
  },
  true, // HMR 更新
)

// ── 子系统 mask 箭头 ──────────────────────────────────────────────────────────

/** mask 箭头 attrs */
export const maskArrowAttrs = {
  [MASK_SELECTOR]: {
    refX: 2,
    refDy: -22,
    cursor: 'pointer',
    'data-mask': 'subsystem',
  },
  maskBg: {
    width: 20,
    height: 20,
    rx: 4,
    fill: 'transparent',
    stroke: 'transparent',
  },
  maskArrow: {
    d: ARROW_D,
    fill: '#D1D1D1',
    stroke: '#AEAEAE',
    'stroke-width': 2,
    transform: 'translate(2, 3) scale(0.75)',
  },
}

// ──────────────────────────────────────────────────────────────────────────────

export const sourceMarkerAttrs = (state: 'empty' | 'full') => {
  switch (state) {
    case 'empty':
      return {
        name: 'path',
        fill: RED,
        stroke: RED,
        d: commonService.svgToPath(previewArrowRaw),
        transform: 'rotate(270) scale(0.015)',
      }
    case 'full':
      return {
        fill: 'none',
      }
  }
}

export const targetMarkerAttrs = (state: 'empty' | 'single' | 'full') => {
  switch (state) {
    case 'empty':
      return {
        name: 'path',
        fill: RED,
        d: commonService.svgToPath(previewArrowRaw),
        transform: 'rotate(-90) scale(0.015)',
      }
    case 'single': {
      return {
        name: 'block',
        fill: RED,
        args: { size: TARGETMARKER_SIZE },
        transform: 'rotate(180)',
      }
    }
    case 'full': {
      return {
        name: 'block',
        fill: BLACK,
        args: { size: TARGETMARKER_SIZE },
        transform: 'rotate(180)',
      }
    }
  }
}

/** 正式连线样式 */
export const formalLinkAttrs = {
  attrs: {
    wrap: {
      strokeWidth: EDGE_WRAPPER_WIDTH,
    },
    line: {
      stroke: BLACK,
      strokeWidth: EDGE_STROKE_WIDTH,
      strokeDasharray: null,
    },
  },
}

/** 预览线样式 */
export const previewLinkAttrs = {
  attrs: {
    wrap: {
      strokeWidth: EDGE_WRAPPER_WIDTH,
    },
    line: {
      stroke: RED,
      strokeWidth: EDGE_STROKE_WIDTH,
      strokeDasharray: '6 3',
    },
  },
}

/** 子系统外层端口组 */
export const subsystemPortGroups = {
  inSYS: {
    markup: [
      {
        tagName: 'path',
        selector: 'portBody',
        attrs: { d: 'M 0 0 -9 -5 -9 -3 -3 0 -9 3 -9 5 z' },
      },
    ],
    z: 1,
    attrs: {
      portBody: {
        magnet: true,
        strokeWidth: 10,
        strokeOpacity: 0,
      },
      text: {
        fontSize: 12,
        fontWeight: 'bold',
      },
    },
    position: { name: 'left' },
    label: {
      markup: {
        tagName: 'text',
        selector: 'text',
      },
      position: {
        name: 'right',
        args: { x: 2 },
      },
    },
  },
  outSYS: {
    markup: [
      {
        tagName: 'path',
        selector: 'portBody',
        attrs: { d: 'M 9 0 0 -5 0 -3 6 0 0 3 0 5 z' },
      },
    ],
    z: 1,
    attrs: {
      portBody: {
        magnet: true,
        stroke: '#000000',
        strokeWidth: 10,
        strokeOpacity: 0,
      },
      text: {
        fontSize: 12,
        fontWeight: 'bold',
      },
    },
    position: { name: 'right' },
    label: {
      markup: {
        tagName: 'text',
        selector: 'text',
      },
      position: {
        name: 'left',
        args: { x: -2 },
      },
    },
  },
}

/** 信号端口组定义 */
export const signalPortGroups = {
  in: {
    markup: [
      {
        tagName: 'path',
        selector: 'portBody',
        attrs: { d: 'M 0 0 -9 -5 -9 -3 -3 0 -9 3 -9 5 z' },
      },
    ],
    z: 1,
    attrs: {
      portBody: {
        magnet: true,
        fill: '#000000',
        stroke: '#000000',
        strokeWidth: 10,
        strokeOpacity: 0,
      },
    },
    position: { name: 'left' },
    label: { position: { name: 'left' } },
  },
  out: {
    markup: [
      {
        tagName: 'path',
        selector: 'portBody',
        attrs: { d: 'M 9 0 0 -5 0 -3 6 0 0 3 0 5 z' },
      },
    ],
    z: -1,
    attrs: {
      portBody: {
        magnet: true,
        fill: '#000000',
        stroke: '#000000',
        strokeWidth: 10,
        strokeOpacity: 0,
      },
    },
    position: { name: 'right' },
    label: { position: { name: 'right' } },
  },
}

/** 子系统内部 Inport 模板 */
export const Inport = {
  shape: 'rect',
  size: { width: 52, height: 26 },
  attrs: {
    body: {
      strokeWidth: 2,
      rx: 13,
      ry: 13,
      filter: DROP_SHADOW_FILTER,
    },
    label: {
      refX: '50%',
      refY: '100%',
      refY2: 5,
      textAnchor: 'middle',
      textVerticalAnchor: 'top',
      text: 'In',
    },
  },
  visible: true,
  markup: [
    { tagName: 'rect', selector: 'body' },
    { tagName: 'text', selector: 'label' },
  ],
  data: {
    title: 'In',
    srcBlock: 'simulink/Ports & Subsystems/In1',
    blockType: 'In',
    description: 'Provide an input port for a subsystem or model.',
    paramLables: {
      No: 'No.',
    },
    paramValues: {
      No: '1',
    },
    level: 10,
  },
  ports: {
    items: [{ id: 'o1', group: 'out' }],
    groups: {
      out: signalPortGroups.out,
    },
  },
}

/** 子系统内部 Outport 模板 */
export const Outport = {
  shape: 'rect',
  size: { width: 52, height: 26 },
  attrs: {
    body: {
      strokeWidth: 2,
      rx: 13,
      ry: 13,
      filter: DROP_SHADOW_FILTER,
    },
    label: {
      refX: '50%',
      refY: '100%',
      refY2: 5,
      textAnchor: 'middle',
      textVerticalAnchor: 'top',
      text: 'Out',
    },
  },
  visible: true,
  markup: [
    { tagName: 'rect', selector: 'body' },
    { tagName: 'text', selector: 'label' },
  ],
  data: {
    title: 'Out',
    srcBlock: 'simulink/Ports & Subsystems/Out1',
    blockType: 'Out',
    description: 'Provide an output port for a subsystem or model.',
    paramLables: {
      No: 'No.',
    },
    paramValues: {
      No: '1',
    },
    level: 10,
  },
  ports: {
    items: [{ id: 'i1', group: 'in' }],
    groups: {
      in: signalPortGroups.in,
    },
  },
}

/** 电气端口组定义（圆形造型） */
export const electricalPortGroups = {
  ine: {
    markup: [
      {
        tagName: 'circle',
        selector: 'portBody',
        attrs: { r: 2 },
      },
    ],
    attrs: {
      portBody: {
        magnet: true,
        fill: '#000000',
        stroke: '#000000',
        strokeWidth: 15,
        strokeOpacity: 0,
      },
    },
    position: { name: 'left' },
    label: { position: { name: 'left' } },
  },
  oute: {
    markup: [
      {
        tagName: 'circle',
        selector: 'portBody',
        attrs: { r: 2 },
      },
    ],
    attrs: {
      portBody: {
        magnet: true,
        fill: '#000000',
        stroke: '#000000',
        strokeWidth: 15,
        strokeOpacity: 0,
      },
    },
    position: { name: 'right' },
    label: { position: { name: 'right' } },
  },
}
