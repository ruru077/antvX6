import { Graph } from '@antv/x6'
import { subsystemPortGroups } from '@/assets/x6Model'
import { createLadderBlockData, LADDER_BLOCK_TYPE } from './block'
import type { LadderBlockData } from './block'
import type { Block } from '~/types/vo/block'

Graph.registerNode(
  'ladder-controller',
  {
    inherit: 'rect',
    width: 180,
    height: 96,
    markup: [
      { tagName: 'rect', selector: 'body' },
      { tagName: 'text', selector: 'symbol' },
      { tagName: 'text', selector: 'label' },
    ],
    attrs: {
      body: {
        fill: '#f5f9ff',
        stroke: '#1769e0',
        strokeWidth: 2,
        rx: 6,
        ry: 6,
      },
      symbol: {
        text: 'LAD',
        refX: '50%',
        refY: '50%',
        textAnchor: 'middle',
        textVerticalAnchor: 'middle',
        fontSize: 20,
        fontWeight: 700,
        fill: '#1769e0',
      },
      label: {
        refX: '50%',
        refY: '100%',
        refY2: 8,
        textAnchor: 'middle',
        textVerticalAnchor: 'top',
        text: '',
      },
    },
  },
  true,
)

export function ladderCanvasPorts(ladder: LadderBlockData) {
  return {
    groups: structuredClone(subsystemPortGroups),
    items: [...ladder.interfacePorts]
      .sort(
        (a, b) => a.direction.localeCompare(b.direction) || a.order - b.order,
      )
      .map((port) => ({
        id: port.id,
        group: port.direction === 'input' ? 'inSYS' : 'outSYS',
        label: {
          markup: {
            tagName: 'text',
            selector: 'text',
            textContent: port.variable,
          },
        },
      })),
  }
}

export function createLadderNode(ladder = createLadderBlockData()): Block {
  return {
    shape: 'ladder-controller',
    width: 180,
    height: Math.max(
      96,
      26 *
        Math.max(
          ladder.interfacePorts.filter((p) => p.direction === 'input').length,
          ladder.interfacePorts.filter((p) => p.direction === 'output').length,
        ) +
        24,
    ),
    attrs: { label: { text: 'LAD Controller' } },
    ports: ladderCanvasPorts(ladder),
    data: {
      blockType: LADDER_BLOCK_TYPE,
      title: 'LAD Controller',
      srcBlock: 'logic/LadderController',
      description: '梯形图控制器 · 双击编辑；输入输出为 0/1 标量',
      level: 10,
      paramValues: {},
      ladder: structuredClone(ladder),
    },
  }
}
