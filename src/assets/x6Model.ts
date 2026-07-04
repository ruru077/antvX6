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

const commonService = createCommonService()

// ── 注册 subsystem-block shape ──────────────────────────────────────────────
// 继承 text-block（foreignObject + div label），默认 attrs 定位 label 到节点下方
Graph.registerNode(
  'subsystem-block',
  {
    inherit: 'text-block',
    attrs: {
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

/** lucide arrow-big-down */
const ARROW_D =
  'M9 5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v6a1 1 0 0 0 1 1h3.293a.707.707 0 0 1 .5 1.207l-7.086 7.086a1 1 0 0 1-1.414 0l-7.086-7.086a.707.707 0 0 1 .5-1.207H8a1 1 0 0 0 1-1z'

export const MASK_SELECTOR = 'mask'

/** 箭头按钮 SVG 结构（仅结构，attrs 由 node.attr 写入 model） */
export const arrowMarkup = [
  {
    tagName: 'g',
    selector: MASK_SELECTOR,
    children: [
      { tagName: 'title', textContent: '查看内部封装' },
      { tagName: 'rect', selector: 'maskBg' },
      { tagName: 'path', selector: 'maskArrow' },
    ],
  },
]

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