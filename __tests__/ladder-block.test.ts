import { describe, expect, it, vi } from 'vite-plus/test'
import {
  assertLadderBlock,
  assertLadderSolver,
  createLadderBlockData,
  LADDER_CAPABILITY,
  ladderPortNumber,
  reconcileLadderPorts,
  validateLadderModel,
  withLadderCapabilities,
} from '../src/ladder/block'
import { commitLadderBlock } from '../src/ladder/blockCommit'
import { cloneProgram, demoProgram, renameVariable } from '../src/ladder/model'
import type { EntryGraphModel } from '../types/common/subGraph'
import type { Graph, Node } from '@antv/x6'

function parentModel(): EntryGraphModel {
  const ladder = createLadderBlockData()
  return {
    rootId: 'root',
    currentGraphId: 'root',
    requiredCapabilities: [LADDER_CAPABILITY],
    subGraphs: {
      root: {
        id: 'root',
        name: 'Root',
        parentId: null,
        deep: 0,
        childrenIds: [],
        graphJson: {
          cells: [
            {
              id: 'controller',
              shape: 'ladder-controller',
              data: { blockType: 'LadderController', ladder },
              ports: {
                items: ladder.interfacePorts.map((p) => ({
                  id: p.id,
                  group: p.direction === 'input' ? 'inSYS' : 'outSYS',
                })),
              },
            },
          ],
        },
      },
    },
  }
}

describe('LAD controller interfaces and parent-model persistence', () => {
  it('accepts valid variable names that also exist on Object.prototype without changing their terminal ID', () => {
    const block = createLadderBlockData(
      renameVariable(demoProgram(), 'Start', 'toString'),
    )
    expect(reconcileLadderPorts(block.program, block.interfacePorts)).toEqual(
      block.interfacePorts,
    )
  })
  it('preflights the supported parent solver without restricting legacy diagrams', () => {
    const config = {
      Step: 'FixedStep',
      SimSolver: 'ode4',
      SimFixedStep: '0.01',
    }
    expect(() => assertLadderSolver([demoProgram()], config)).not.toThrow()
    expect(() =>
      assertLadderSolver([demoProgram()], { ...config, SimSolver: 'ode1' }),
    ).toThrow('ode4')
    expect(() =>
      assertLadderSolver([demoProgram()], { ...config, SimFixedStep: '0.03' }),
    ).toThrow('整数倍')
    expect(() =>
      assertLadderSolver([demoProgram()], config, 'compilation'),
    ).toThrow('设备编译')
    expect(() =>
      assertLadderSolver([], { ...config, SimSolver: 'ode1' }),
    ).not.toThrow()
  })
  it('preserves connected terminal IDs through rename and reordering and maps explicit ordinals to DTO', () => {
    const original = createLadderBlockData()
    const renamed = renameVariable(original.program, 'Start', 'Enable')
    renamed.variables.reverse()
    const ports = reconcileLadderPorts(renamed, original.interfacePorts, {
      Start: 'Enable',
    })
    expect(ports.find((p) => p.variable === 'Enable')!.id).toBe(
      original.interfacePorts[0].id,
    )
    expect(ports.find((p) => p.variable === 'StopPressed')!.id).toBe(
      original.interfacePorts[1].id,
    )
    const next = {
      version: 1 as const,
      program: renamed,
      interfacePorts: ports,
    }
    assertLadderBlock(next)
    expect(
      ladderPortNumber(
        { blockType: 'LadderController', ladder: next },
        original.interfacePorts[0].id,
      ),
    ).toBe('2')
    expect(ladderPortNumber({ blockType: 'Gain' }, 'i12')).toBe('12')
  })
  it('never exposes memory and assigns a new terminal on direction change', () => {
    const original = createLadderBlockData()
    const next = cloneProgram(original.program)
    next.variables.push({ name: 'Memory', kind: 'memory', initialValue: false })
    next.variables[0].kind = 'output'
    const ports = reconcileLadderPorts(next, original.interfacePorts)
    expect(ports.some((p) => p.variable === 'Memory')).toBe(false)
    expect(ports.find((p) => p.variable === 'Start')!.id).not.toBe(
      original.interfacePorts[0].id,
    )
  })
  it('does not silently reuse a disconnected identity when a variable is deleted and recreated with the same name', () => {
    const original = createLadderBlockData()
    const without = cloneProgram(original.program)
    without.variables = without.variables.filter((v) => v.name !== 'Start')
    const afterDelete = reconcileLadderPorts(without, original.interfacePorts)
    const afterRecreate = reconcileLadderPorts(original.program, afterDelete)
    expect(afterRecreate.find((p) => p.variable === 'Start')!.id).not.toBe(
      original.interfacePorts[0].id,
    )
  })
  it('creates independent instance payloads, including stateful function and element identifiers', () => {
    const source = demoProgram()
    const a = createLadderBlockData(source)
    const b = createLadderBlockData(source)
    a.program.networks[0].label = 'Changed'
    a.program.variables[0].initialValue = true
    expect(b.program).toEqual(source)
    expect(a.interfacePorts[0].id).not.toBe(b.interfacePorts[0].id)
  })
  it('round-trips AST, Unicode and interface IDs in the complete parent graph', () => {
    const model = parentModel()
    model.subGraphs.root.graphJson.cells[0].data!.ladder.program.networks[0].label =
      ' 注释 中文 '
    const decoded = JSON.parse(JSON.stringify(model))
    expect(decoded).toEqual(model)
    expect(() => validateLadderModel(decoded)).not.toThrow()
    expect(withLadderCapabilities(model).requiredCapabilities).toEqual([
      LADDER_CAPABILITY,
    ])
    model.subGraphs.root.graphJson.cells = []
    expect(withLadderCapabilities(model).requiredCapabilities).toBeUndefined()
    expect(() => validateLadderModel(model)).not.toThrow()
  })
  it('rejects missing capabilities, mismatched canvas terminals and duplicate or invalid interface bindings', () => {
    const model = parentModel()
    delete model.requiredCapabilities
    expect(() => validateLadderModel(model)).toThrow('能力标记')
    model.requiredCapabilities = [LADDER_CAPABILITY]
    const node = model.subGraphs.root.graphJson.cells[0]
    ;(node.ports as { items: { id: string }[] }).items[0].id = 'wrong'
    expect(() => validateLadderModel(model)).toThrow('不一致')
    const block = createLadderBlockData()
    block.interfacePorts[0].order = 99
    expect(() => assertLadderBlock(block)).toThrow('连续')
    block.interfacePorts[0].order = 1
    block.interfacePorts[1].id = block.interfacePorts[0].id
    expect(() => assertLadderBlock(block)).toThrow('ID')
  })
})

describe('parent edit transaction', () => {
  function fixture() {
    const ladder = createLadderBlockData()
    const node = {
      id: 'controller',
      getData: () => ({ ladder }),
      setData: vi.fn(),
      prop: vi.fn(),
      attr: vi.fn(),
      resize: vi.fn(),
      getSize: () => ({ width: 180, height: 96 }),
    }
    let historySize = 0
    const graph = {
      getConnectedEdges: () => [
        {
          getSourceCellId: () => 'source',
          getSourcePortId: () => 'o1',
          getTargetCellId: () => node.id,
          getTargetPortId: () => ladder.interfacePorts[0].id,
        },
      ],
      startBatch: vi.fn(),
      stopBatch: vi.fn(() => {
        historySize++
      }),
      isHistoryEnabled: () => true,
      getUndoStackSize: () => historySize,
      undoAndCancel: vi.fn(),
    }
    return { ladder, node, graph }
  }
  it('rejects disconnecting an occupied input before any model or history mutation', async () => {
    const { ladder, node, graph } = fixture()
    const program = renameVariable(ladder.program, 'Start', 'Enable')
    const next = {
      version: 1 as const,
      program,
      interfacePorts: reconcileLadderPorts(program),
    }
    await expect(
      commitLadderBlock(
        graph as unknown as Graph,
        node as unknown as Node,
        next,
        {},
        'Controller',
      ),
    ).rejects.toThrow('断开')
    expect(node.setData).not.toHaveBeenCalled()
    expect(graph.startBatch).not.toHaveBeenCalled()
  })
  it('groups payload, terminals, name, geometry and routing in one completed history transaction', async () => {
    const { ladder, node, graph } = fixture()
    const program = renameVariable(ladder.program, 'Start', 'Enable')
    const next = {
      version: 1 as const,
      program,
      interfacePorts: reconcileLadderPorts(program, ladder.interfacePorts, {
        Start: 'Enable',
      }),
    }
    const route = vi.fn(async () => {
      expect(graph.stopBatch).not.toHaveBeenCalled()
    })
    await commitLadderBlock(
      graph as unknown as Graph,
      node as unknown as Node,
      next,
      { items: next.interfacePorts },
      'Controller',
      route,
    )
    expect(graph.startBatch).toHaveBeenCalledExactlyOnceWith(
      'edit-ladder-controller',
    )
    expect(graph.stopBatch).toHaveBeenCalledExactlyOnceWith(
      'edit-ladder-controller',
    )
    expect(node.setData.mock.calls[0][0].ladder).toEqual(next)
    expect(node.setData.mock.calls[0][0].ladder).not.toBe(next)
    expect(node.prop).toHaveBeenCalledOnce()
    expect(route).toHaveBeenCalledOnce()
  })
  it('closes and rolls back the new history transaction when routing fails', async () => {
    const { ladder, node, graph } = fixture()
    const next = {
      ...ladder,
      program: { ...ladder.program, scanPeriodMs: 200 },
    }
    await expect(
      commitLadderBlock(
        graph as unknown as Graph,
        node as unknown as Node,
        next,
        {},
        'Controller',
        async () => {
          throw new Error('routing failure')
        },
      ),
    ).rejects.toThrow('routing failure')
    expect(graph.stopBatch).toHaveBeenCalledExactlyOnceWith(
      'edit-ladder-controller',
    )
    expect(graph.undoAndCancel).toHaveBeenCalledOnce()
  })
})
