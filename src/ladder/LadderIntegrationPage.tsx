import { App, Button } from 'antd'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { formalLinkAttrs, signalPortGroups } from '@/assets/x6Model'
import { DiagramCanvas } from '@/components/layout/DiagramCanvas'
import { PanelSplitter } from '@/components/layout/PanelSplitter'
import { StencilLayout } from '@/components/layout/StencilLayout'
import { ScopeWindow } from '@/components/ScopeWindow'
import { bindAntdMessage } from '@/services/antd-message-service'
import {
  createDiagramModel,
  getDiagramModel,
} from '@/services/diagram-model-service'
import { useNcslabContextStore } from '@/services/ncslab-context-service'
import { loadEntryGraphModel } from '@/services/subsystem-service'
import { useGraphStore } from '@/store/graphStore'
import {
  DEFAULT_INTERPRETER_CONFIG,
  useInterpreterStore,
} from '@/store/interpreterStore'
import { useSubGraphStore } from '@/store/subGraphStore'
import { useGraphListener } from '@/utils/hooks/useGraphListener'
import { useModelAutosave } from '@/utils/hooks/useModelAutosave'
import { LADDER_CAPABILITY, validateLadderModel } from './block'
import { createLadderNode } from './blockNode'
import { isLocalLadderIntegration } from './localIntegration'
import type { BlockResources } from '@/api/blocks'
import type { DiagramModelDetail } from '@/services/diagram-model-service'
import type { NodeProperties } from '@antv/x6'
import type { EntryGraphModel } from '~/types/common/subGraph'
import type { Block } from '~/types/vo/block'
import '@/components/styles/BlockDiagram.scss'

function ordinaryNode(
  type: 'Constant' | 'Scope',
  label: string,
  value = '1',
): NodeProperties {
  return {
    shape: 'rect',
    width: 84,
    height: 50,
    markup: [
      { tagName: 'rect', selector: 'body' },
      { tagName: 'text', selector: 'label_middle' },
      { tagName: 'text', selector: 'label' },
    ],
    attrs: {
      body: { fill: '#fff', stroke: '#293447', strokeWidth: 2 },
      label_middle: {
        text: type === 'Constant' ? value : 'Scope',
        refX: '50%',
        refY: '50%',
        textAnchor: 'middle',
        textVerticalAnchor: 'middle',
      },
      label: {
        text: label,
        refX: '50%',
        refY: '100%',
        refY2: 8,
        textAnchor: 'middle',
        textVerticalAnchor: 'top',
      },
    },
    ports: {
      groups: signalPortGroups,
      items: [
        {
          id: type === 'Constant' ? 'o1' : 'i1',
          group: type === 'Constant' ? 'out' : 'in',
        },
      ],
    },
    data: {
      title: type,
      blockType: type,
      srcBlock: `simulink/${type === 'Constant' ? 'Sources/Constant' : 'Sinks/Scope'}`,
      description: type,
      level: 10,
      paramValues: type === 'Constant' ? { Value: value } : {},
      paramLables: type === 'Constant' ? { Value: 'Value' } : {},
    },
  }
}

const localResources: BlockResources = {
  libraries: [{ id: 100, name: 'Simulation', description: '本地软件仿真模块' }],
  blocks: [
    {
      id: 1001,
      libraryId: 100,
      block: ordinaryNode('Constant', 'Constant') as Block,
    },
    {
      id: 1002,
      libraryId: 100,
      block: ordinaryNode('Scope', 'Scope') as Block,
    },
  ],
}

export function createIntegrationModel(): EntryGraphModel {
  const ladder = createLadderNode()
  const input = (variable: string) =>
    ladder.data.ladder!.interfacePorts.find((p) => p.variable === variable)!.id
  return {
    requiredCapabilities: [LADDER_CAPABILITY],
    rootId: 'root',
    currentGraphId: 'root',
    subGraphs: {
      root: {
        id: 'root',
        parentId: null,
        deep: 0,
        name: 'LAD 联合模型',
        childrenIds: [],
        graphJson: {
          cells: [
            {
              ...ordinaryNode('Constant', 'Start', '1'),
              id: 'lad-demo-start',
              x: 100,
              y: 170,
            },
            {
              ...ordinaryNode('Constant', 'StopPressed', '0'),
              id: 'lad-demo-stop',
              x: 100,
              y: 290,
            },
            { ...ladder, id: 'lad-demo-controller', x: 350, y: 190 },
            {
              ...ordinaryNode('Scope', 'MotorScope'),
              id: 'lad-demo-scope',
              x: 700,
              y: 210,
            },
            {
              ...formalLinkAttrs,
              shape: 'edge',
              id: 'lad-demo-e1',
              source: { cell: 'lad-demo-start', port: 'o1' },
              target: { cell: 'lad-demo-controller', port: input('Start') },
            },
            {
              ...formalLinkAttrs,
              shape: 'edge',
              id: 'lad-demo-e2',
              source: { cell: 'lad-demo-stop', port: 'o1' },
              target: {
                cell: 'lad-demo-controller',
                port: input('StopPressed'),
              },
            },
            {
              ...formalLinkAttrs,
              shape: 'edge',
              id: 'lad-demo-e3',
              source: { cell: 'lad-demo-controller', port: input('Motor') },
              target: { cell: 'lad-demo-scope', port: 'i1' },
            },
          ],
        },
      },
    },
  }
}

function Workspace({ detail }: { detail: DiagramModelDetail }) {
  const paper = useRef<HTMLDivElement>(null)
  const { message: api } = App.useApp()
  bindAntdMessage(api)
  useGraphListener()
  useModelAutosave(true, detail.id)
  useLayoutEffect(() => {
    if (!paper.current) return
    useGraphStore.getState().initGraph(paper.current)
    const graph = useGraphStore.getState().graph
    loadEntryGraphModel(detail.graphModel, graph)
    useInterpreterStore.getState().setConfig(detail.config)
    useSubGraphStore.setState({ modelName: detail.modelName })
    graph.fromJSON(
      detail.graphModel.subGraphs[detail.graphModel.currentGraphId].graphJson,
    )
    graph.cleanHistory()
    useSubGraphStore
      .getState()
      .markSaved({ graphModel: detail.graphModel, config: detail.config })
    const frame = requestAnimationFrame(() =>
      graph.zoomToFit({ padding: 80, maxScale: 1.1 }),
    )
    return () => {
      cancelAnimationFrame(frame)
      useGraphStore.getState().destroyGraph()
    }
  }, [detail])
  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          padding: '7px 12px',
          background: '#eef5ff',
          display: 'flex',
          gap: 8,
          alignItems: 'center',
        }}
      >
        <strong>本地 LAD 联合模型</strong>
        <span>双击 LAD 编辑；双击 Scope 查看父仿真结果</span>
        <Button
          size="small"
          onClick={() =>
            useGraphStore
              .getState()
              .graph.addNode({ ...createLadderNode(), x: 350, y: 390 })
          }
        >
          添加 LAD
        </Button>
        <Button
          size="small"
          onClick={() =>
            useGraphStore
              .getState()
              .graph.addNode({
                ...ordinaryNode('Constant', 'Constant'),
                x: 100,
                y: 390,
              })
          }
        >
          添加 Constant
        </Button>
        <Button
          size="small"
          onClick={() =>
            useGraphStore
              .getState()
              .graph.addNode({
                ...ordinaryNode('Scope', 'Scope'),
                x: 700,
                y: 390,
              })
          }
        >
          添加 Scope
        </Button>
        <label style={{ cursor: 'pointer' }}>
          导入父模型
          <input
            type="file"
            accept=".json,application/json"
            style={{ display: 'none' }}
            onChange={async (event) => {
              const file = event.target.files?.[0]
              if (!file) return
              try {
                const imported = JSON.parse(await file.text())
                const model = imported.graphModel ?? imported
                validateLadderModel(model)
                const graph = useGraphStore.getState().graph
                loadEntryGraphModel(model, graph)
                graph.fromJSON(model.subGraphs[model.currentGraphId].graphJson)
                if (imported.config)
                  useInterpreterStore.getState().setConfig(imported.config)
                useSubGraphStore.getState().recomputeDirty()
                graph.zoomToFit({ padding: 80, maxScale: 1.1 })
              } catch (error) {
                api.error(error instanceof Error ? error.message : '导入失败')
              }
            }}
          />
        </label>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <PanelSplitter
          variant="workspace"
          stencil={
            <StencilLayout
              resources={localResources}
              onReady={() =>
                useGraphStore
                  .getState()
                  .graph?.zoomToFit({ padding: 60, maxScale: 1.1 })
              }
            />
          }
          canvas={
            <>
              <DiagramCanvas
                paperContainerRef={paper}
                exchangePath="/ladder-integration"
                showIssueLink={false}
                modelId={detail.id}
              />
              <ScopeWindow />
            </>
          }
        />
      </div>
    </div>
  )
}

export default function LadderIntegrationPage() {
  const [detail, setDetail] = useState<DiagramModelDetail | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    if (!isLocalLadderIntegration()) {
      setError('联合验收入口仅在本地开发环境可用')
      return
    }
    void (async () => {
      const response = await fetch('/m2plab/api/lad-local/session', {
        credentials: 'same-origin',
      })
      const session = await response.json()
      if (!response.ok || session.local !== true || !session.userId)
        throw new Error('请先登录本地 LAD 测试会话，再打开联合模型')
      useNcslabContextStore
        .getState()
        .setContext({ version: 1, user: { id: session.userId } })
      const id = new URLSearchParams(window.location.search).get('model')
      let result: DiagramModelDetail
      if (id) result = await getDiagramModel(id)
      else {
        const config = {
          ...DEFAULT_INTERPRETER_CONFIG,
          Step: 'FixedStep' as const,
          SimFixedStep: '0.01',
          SimSolver: 'ode4',
          StopTime: '2',
          ComSolver: 'ode4',
        }
        const graphModel = createIntegrationModel()
        const created = await createDiagramModel({
          modelName: 'LAD_Integration',
          description: '本地 Constant → LAD → Scope',
          graphModel,
          config,
        })
        result = await getDiagramModel(created.id)
        window.history.replaceState(
          window.history.state,
          '',
          '/ladder-integration?model=' + created.id,
        )
      }
      if (active) setDetail(result)
    })().catch((err) => {
      if (active) setError(err instanceof Error ? err.message : '加载失败')
    })
    return () => {
      active = false
    }
  }, [])
  return (
    <App>
      {detail ? (
        <Workspace detail={detail} />
      ) : (
        <div style={{ padding: 32 }}>{error || '正在加载本地联合模型…'}</div>
      )}
    </App>
  )
}
