import { Node } from '@antv/x6'
import {
  BLACK,
  EDGE_STROKE_WIDTH,
  RED,
  TARGETMARKER_SIZE,
} from '@/assets/constant'
import previewArrowRaw from '@/assets/previewArrow.svg?raw'

const previewArrowPath = previewArrowRaw.match(/\bd="([^"]+)"/)?.[1]

/** 拖拽连线时的预览线样式 */
const previewLink = {
  attrs: {
    line: {
      stroke: RED,
      strokeWidth: EDGE_STROKE_WIDTH,
      targetMarker: {
        name: 'path',
        d: previewArrowPath,
        transform: 'rotate(-90) scale(0.02)',
      },
      strokeDasharray: '4 2',
    },
  },
}

/** 正式连线样式 */
const formalLink = {
  attrs: {
    line: {
      stroke: BLACK,
      strokeWidth: 1.5,
      strokeDasharray: null,
      targetMarker: {
        name: 'block',
        args: { size: TARGETMARKER_SIZE },
        transform: 'rotate(180)',
        d: null,
      },
    },
  },
}

/** 信号端口组定义 */
const signalPortGroups = {
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
const electricalPortGroups = {
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

export { previewLink, formalLink, signalPortGroups, electricalPortGroups }

// ─── 子系统 Block 自定义形状 ─────────────────────────────────────────────────
// markup 顺序决定 SVG 层叠：thumb（底）→ body（边框）→ label（顶）
Node.define({
  shape: 'subsystem-block',
  markup: [
    { tagName: 'rect', selector: 'body' },
    { tagName: 'image', selector: 'thumb' },
    { tagName: 'text', selector: 'label' },
  ],
  attrs: {
    body: {
      refWidth: '100%',
      refHeight: '100%',
      fill: '#fff',
      stroke: '#333333',
      strokeWidth: 1,
    },
    label: {
      refX: '50%',
      refY: '50%',
      textAnchor: 'middle',
      dominantBaseline: 'middle',
      fontSize: 12,
      fill: '#333333',
      pointerEvents: 'none',
    },
    thumb: {
      refWidth: '98%',
      refHeight: '98%',
    },
  },
})
