const STROKE = '#353535'
const FILL = '#ffffff'

function shapeAttrs(bodyExtra: Record<string, unknown> = {}) {
  return {
    body: {
      fill: FILL,
      stroke: STROKE,
      strokeWidth: 1.5,
      ...bodyExtra,
    },
    label: {
      fill: STROKE,
      fontSize: 9,
      fontFamily: 'Open Sans, sans-serif',
      fontWeight: 'normal',
    },
  }
}

export interface StencilGroupConfig {
  name: string
  title: string
  collapsable: boolean
}

export interface NodeConfig {
  shape: string
  width: number
  height: number
  label: string
  path?: string
  attrs?: Record<string, unknown>
}

export const stencilGroups: StencilGroupConfig[] = [
  { name: 'basic', title: 'Basic shapes', collapsable: true },
  { name: 'advanced', title: 'Advanced shapes', collapsable: true },
]

export const basicShapeConfigs: NodeConfig[] = [
  {
    shape: 'rect',
    width: 44,
    height: 30,
    label: 'Rectangle',
    attrs: shapeAttrs({ rx: 2, ry: 2 }),
  },
  {
    shape: 'ellipse',
    width: 36,
    height: 36,
    label: 'Circle',
    attrs: shapeAttrs(),
  },
  {
    shape: 'ellipse',
    width: 44,
    height: 28,
    label: 'Ellipse',
    attrs: shapeAttrs(),
  },
  {
    shape: 'path',
    width: 34,
    height: 34,
    label: 'Diamond',
    path: 'M 17 0 L 34 17 L 17 34 L 0 17 Z',
    attrs: shapeAttrs(),
  },
  {
    shape: 'path',
    width: 36,
    height: 32,
    label: 'Triangle',
    path: 'M 18 0 L 36 32 L 0 32 Z',
    attrs: shapeAttrs(),
  },
  {
    shape: 'path',
    width: 40,
    height: 36,
    label: 'Hexagon',
    path: 'M 10 0 L 30 0 L 40 18 L 30 36 L 10 36 L 0 18 Z',
    attrs: shapeAttrs(),
  },
  {
    shape: 'path',
    width: 36,
    height: 36,
    label: 'Octagon',
    path: 'M 11 0 L 25 0 L 36 11 L 36 25 L 25 36 L 11 36 L 0 25 L 0 11 Z',
    attrs: shapeAttrs(),
  },
  {
    shape: 'path',
    width: 36,
    height: 36,
    label: 'Star',
    path: 'M 18 2 L 21.8 12.7 L 33.2 13.1 L 24.1 20.0 L 27.3 31.5 L 18 24.5 L 8.7 31.5 L 11.9 20.0 L 2.8 13.1 L 14.2 12.7 Z',
    attrs: shapeAttrs(),
  },
  {
    shape: 'path',
    width: 36,
    height: 36,
    label: 'Cross',
    path: 'M 13 0 L 23 0 L 23 13 L 36 13 L 36 23 L 23 23 L 23 36 L 13 36 L 13 23 L 0 23 L 0 13 L 13 13 Z',
    attrs: shapeAttrs(),
  },
  {
    shape: 'path',
    width: 44,
    height: 28,
    label: 'Arrow',
    path: 'M 0 8 L 26 8 L 26 0 L 44 14 L 26 28 L 26 20 L 0 20 Z',
    attrs: shapeAttrs(),
  },
  {
    shape: 'path',
    width: 44,
    height: 28,
    label: 'Parallelogram',
    path: 'M 10 0 L 44 0 L 34 28 L 0 28 Z',
    attrs: shapeAttrs(),
  },
  {
    shape: 'path',
    width: 44,
    height: 28,
    label: 'Trapezoid',
    path: 'M 8 0 L 36 0 L 44 28 L 0 28 Z',
    attrs: shapeAttrs(),
  },
  {
    shape: 'path',
    width: 36,
    height: 40,
    label: 'Pentagon',
    path: 'M 18 0 L 36 13 L 29 40 L 7 40 L 0 13 Z',
    attrs: shapeAttrs(),
  },
  {
    shape: 'path',
    width: 36,
    height: 36,
    label: 'L-Shape',
    path: 'M 0 0 L 18 0 L 18 18 L 36 18 L 36 36 L 0 36 Z',
    attrs: shapeAttrs(),
  },
]

export const advancedShapeConfigs: NodeConfig[] = [
  {
    shape: 'rect',
    width: 44,
    height: 34,
    label: 'Header Card',
    attrs: {
      body: {
        fill: FILL,
        stroke: STROKE,
        strokeWidth: 1.5,
        rx: 2,
        ry: 2,
      },
      label: {
        fill: STROKE,
        fontSize: 9,
        fontFamily: 'Open Sans, sans-serif',
        refY: 0.72,
      },
    },
  },
  {
    shape: 'rect',
    width: 44,
    height: 22,
    label: 'Stadium',
    attrs: shapeAttrs({ rx: 11, ry: 11 }),
  },
  {
    shape: 'path',
    width: 44,
    height: 28,
    label: 'Process',
    path: 'M 0 0 L 33 0 L 44 14 L 33 28 L 0 28 L 11 14 Z',
    attrs: shapeAttrs(),
  },
  {
    shape: 'path',
    width: 36,
    height: 40,
    label: 'Document',
    path: 'M 0 0 L 36 0 L 36 30 Q 27 40 18 32 Q 9 24 0 32 Z',
    attrs: shapeAttrs(),
  },
  {
    shape: 'path',
    width: 32,
    height: 44,
    label: 'Cylinder',
    path: 'M 0 8 Q 0 0 16 0 Q 32 0 32 8 L 32 36 Q 32 44 16 44 Q 0 44 0 36 Z M 0 8 Q 0 16 16 16 Q 32 16 32 8',
    attrs: shapeAttrs(),
  },
  {
    shape: 'path',
    width: 44,
    height: 30,
    label: 'Delay',
    path: 'M 0 0 L 29 0 Q 44 0 44 15 Q 44 30 29 30 L 0 30 Z',
    attrs: shapeAttrs(),
  },
  {
    shape: 'path',
    width: 40,
    height: 36,
    label: 'Note',
    path: 'M 0 0 L 30 0 L 40 10 L 40 36 L 0 36 Z M 30 0 L 30 10 L 40 10',
    attrs: shapeAttrs(),
  },
  {
    shape: 'path',
    width: 44,
    height: 30,
    label: 'Manual Input',
    path: 'M 0 10 L 44 0 L 44 30 L 0 30 Z',
    attrs: shapeAttrs(),
  },
]
