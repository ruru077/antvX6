import { createSubsystemBackgroundFill } from '@/assets/x6Model'
import type { NodeMetadata } from '@antv/x6'

const IMAGE_PLACEHOLDER_ICON = `data:image/svg+xml,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <path d="m21 15-5-5L5 21" />
  </svg>
`)}`

const ImageNode: NodeMetadata = {
  shape: 'rect',
  size: { width: 128, height: 128 },
  markup: [
    { tagName: 'rect', selector: 'body' },
    { tagName: 'image', selector: 'image' },
    { tagName: 'image', selector: 'placeholder' },
  ],
  attrs: {
    body: {
      refWidth: '100%',
      refHeight: '100%',
      fill: createSubsystemBackgroundFill(),
      stroke: '#8c8c8c',
      strokeWidth: 1,
      strokeDasharray: '4 4',
    },
    image: {
      x: 0,
      y: 0,
      refWidth: '100%',
      refHeight: '100%',
      xlinkHref: '',
      preserveAspectRatio: 'none',
      visibility: 'hidden',
    },
    placeholder: {
      refX: '50%',
      refY: '50%',
      x: -14,
      y: -14,
      width: 28,
      height: 28,
      xlinkHref: IMAGE_PLACEHOLDER_ICON,
      preserveAspectRatio: 'xMidYMid meet',
    },
  },
  data: {
    title: 'Image',
    blockType: 'ImageNode',
    level: 10,
  },
}

const AnnotationNode: NodeMetadata = {
  shape: 'rect',
  size: { width: 80, height: 32 },
  markup: [
    { tagName: 'rect', selector: 'body' },
    { tagName: 'text', selector: 'label' },
  ],
  attrs: {
    body: {
      refWidth: '100%',
      refHeight: '100%',
      fill: '#ffffff',
      fillOpacity: 0,
      stroke: 'transparent',
    },
    label: {
      refX: 8,
      refY: '50%',
      text: '',
      fill: '#000000',
      fontFamily: 'Arial',
      fontSize: 14,
      textAnchor: 'start',
      textVerticalAnchor: 'middle',
    },
  },
  data: {
    title: 'Annotation',
    blockType: 'Annotation',
    level: 10,
  },
}

export { AnnotationNode, ImageNode }
