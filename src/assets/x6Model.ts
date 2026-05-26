import {
  BLACK,
  EDGE_STROKE_WIDTH,
  EDGE_TARGET_CP_OFFSET,
  EDGE_WRAPPER_WIDTH,
  RED,
  TARGETMARKER_SIZE,
} from '@/assets/constant'
import previewArrowRaw from '@/assets/previewArrow.svg?raw'

const previewArrowPath = previewArrowRaw.match(/\bd="([^"]+)"/)?.[1]

/** 拖拽连线时的预览线样式 */
const previewLink = {
  attrs: {
    wrap: {
      strokeWidth: EDGE_WRAPPER_WIDTH,
    },
    line: {
      stroke: RED,
      strokeWidth: EDGE_STROKE_WIDTH,
      targetMarker: {
        name: 'path',
        d: previewArrowPath,
        transform: 'rotate(-90) scale(0.015)',
      },
      strokeDasharray: '4 2',
    },
  },
}

/** 正式连线样式 */
const formalLink = {
  attrs: {
    wrap: {
      strokeWidth: EDGE_WRAPPER_WIDTH,
    },
    line: {
      stroke: BLACK,
      strokeWidth: EDGE_STROKE_WIDTH,
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

export {
  previewLink,
  formalLink,
  signalPortGroups,
  electricalPortGroups,
  previewArrowPath,
}
