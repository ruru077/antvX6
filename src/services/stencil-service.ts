import { Graph, Node, Stencil } from '@antv/x6'
import type { NodeConfig } from '../config/stencil'
import {
  advancedShapeConfigs,
  basicShapeConfigs,
  stencilGroups,
} from '../config/stencil'

export class StencilService {
  private stencil!: Stencil
  private stencilContainer: HTMLElement

  constructor(stencilContainer: HTMLElement) {
    this.stencilContainer = stencilContainer
  }

  create(graph: Graph): void {
    this.stencil = new Stencil({
      title: 'Stencil',
      target: graph,
      collapsable: true,
      stencilGraphWidth: 216,
      stencilGraphHeight: 0,
      groups: stencilGroups,
      search(cell, keyword) {
        return cell.shape.indexOf(keyword) !== -1
      },
      placeholder: 'Search shapes...',
      notFoundText: 'No shapes found',
      layoutOptions: {
        columns: 4,
        columnWidth: 46,
        rowHeight: 'auto',
        dx: 6,
        dy: 10,
        marginX: 6,
        marginY: 8,
      },
    })

    this.stencilContainer.appendChild(this.stencil.container)
    this.injectGroupControls()
  }

  private injectGroupControls(): void {
    const titleEl = this.stencilContainer.querySelector<HTMLElement>(
      '.x6-widget-stencil-title',
    )
    if (!titleEl) return

    const originalText = titleEl.textContent?.trim() || 'Stencil'
    titleEl.textContent = ''

    const ctrlGroup = document.createElement('div')
    ctrlGroup.className = 'stencil-ctrl-group'
    ctrlGroup.innerHTML =
      '<button class="stencil-ctrl-btn stencil-ctrl-expand" title="Expand all groups"></button>' +
      '<button class="stencil-ctrl-btn stencil-ctrl-collapse" title="Collapse all groups"></button>'

    const labelSpan = document.createElement('span')
    labelSpan.className = 'stencil-title-label'
    labelSpan.textContent = originalText.toUpperCase()

    titleEl.appendChild(ctrlGroup)
    titleEl.appendChild(labelSpan)

    ctrlGroup
      .querySelector('.stencil-ctrl-expand')
      ?.addEventListener('click', (e) => {
        e.stopPropagation()
        this.setAllGroupsCollapsed(false)
      })
    ctrlGroup
      .querySelector('.stencil-ctrl-collapse')
      ?.addEventListener('click', (e) => {
        e.stopPropagation()
        this.setAllGroupsCollapsed(true)
      })
  }

  private setAllGroupsCollapsed(collapse: boolean): void {
    const groups = this.stencilContainer.querySelectorAll<HTMLElement>(
      '.x6-widget-stencil-group.collapsable',
    )
    groups.forEach((groupEl) => {
      const isCollapsed = groupEl.classList.contains('collapsed')
      if ((collapse && !isCollapsed) || (!collapse && isCollapsed)) {
        groupEl
          .querySelector<HTMLElement>('.x6-widget-stencil-group-title')
          ?.click()
      }
    })
  }

  setShapes(graph: Graph): void {
    const createNode = (cfg: NodeConfig): Node => {
      const { path, ...rest } = cfg
      const options: Record<string, unknown> = { ...rest }
      if (path !== undefined) {
        options.path = path
      }
      return graph.createNode(options)
    }

    const basicNodes = basicShapeConfigs.map(createNode)
    const advancedNodes = advancedShapeConfigs.map(createNode)

    this.stencil.load(basicNodes, 'basic')
    this.stencil.load(advancedNodes, 'advanced')
  }

  dispose(): void {
    if (this.stencil) {
      this.stencil.dispose()
    }
  }
}
