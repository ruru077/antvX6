import { CloseOutlined } from '@ant-design/icons'
import { Alert, Button as AntButton, Form, Input, Select, Space } from 'antd'
import { SlidersHorizontalIcon } from 'lucide-react'
import { CONTACT_ME_EMAIL } from '@/assets/constant'
import { Button } from '@/components/ui/button'
import { FloatingWindow } from '@/components/ui/floating-window'
import {
  syncBlockDisplayByParamValues,
  UPDATE_BLOCK_PARAMS,
} from '@/services/block-param-service'
import {
  isMaskParamReference,
  MaskParamResolutionError,
  resolveMaskParamValue,
} from '@/services/mask-param-service'
import { resizeBlockByParamValues } from '@/services/resize-serviec'
import { routeAllEdges } from '@/services/routing-service'
import { useGraphStore } from '@/store/graphStore'
import { useSubGraphStore } from '@/store/subGraphStore'
import type { Graph, Node, NodeProperties } from '@antv/x6'
import type { BlockData } from '~/types/vo/block'

interface NodeParamWindowTarget {
  graphId: string
  nodeId: string
  snapshot: NodeProperties
}

function getSnapshotLabel(snapshot: NodeProperties): string {
  const label = snapshot.attrs?.label?.text
  return typeof label === 'string' ? label.trim() : ''
}

function activateTargetNode(target: NodeParamWindowTarget): {
  graph: Graph
  node: Node
} {
  const currentGraphId = useSubGraphStore.getState().currentGraphId
  if (currentGraphId !== target.graphId) {
    throw new Error(
      `Node ${target.nodeId} belongs to ${target.graphId}, current graph is ${currentGraphId}`,
    )
  }
  const graph = useGraphStore.getState().graph
  if (!graph) throw new Error('Graph is required')
  const node = graph.getCellById(target.nodeId)
  if (!node?.isNode()) {
    throw new Error(`Node ${target.nodeId} is required in ${target.graphId}`)
  }
  return { graph, node }
}

// ── BlockParamWindow ────────────────────────────────────────────────────────

/**
 * @description 模块参数设置悬浮窗口
 */
function BlockParamWindow({
  windowId,
  target,
  onDestroy,
}: {
  windowId: string
  target: NodeParamWindowTarget
  onDestroy: () => void
}) {
  const [form] = Form.useForm()

  const data = target.snapshot.data as BlockData | undefined
  const nodeLabel = getSnapshotLabel(target.snapshot)
  const paramValues = data?.paramValues ?? {}
  const paramLables = data?.paramLables ?? {}
  const paramOptions = data?.paramOptions ?? {}
  const paramKeys = Object.keys(paramValues)
  const currentParamValues = Form.useWatch([], form) ?? paramValues
  const subGraphs = useSubGraphStore.getState().subGraphs

  // TODO(feat/maskForm): 使用后端参数定义生成控件并执行声明式校验

  useEffect(() => {
    form.setFieldsValue(paramValues)
  }, [form])

  const handleOk = async () => {
    try {
      const values = await form.validateFields()
      const nextParamValues = Object.fromEntries(
        Object.entries(values).map(([key, value]) => [
          key,
          String(value ?? ''),
        ]),
      )
      const { graph, node } = activateTargetNode(target)
      graph.startBatch(UPDATE_BLOCK_PARAMS)
      try {
        node.setData(
          { paramValues: nextParamValues },
          { historyAction: UPDATE_BLOCK_PARAMS },
        )
        resizeBlockByParamValues(node, nextParamValues)
        syncBlockDisplayByParamValues(node, nextParamValues)
        await routeAllEdges(graph)
      } finally {
        graph.stopBatch(UPDATE_BLOCK_PARAMS)
      }
      onDestroy()
    } catch (error) {
      console.error('表单验证失败:', error)
    }
  }

  function renderFormItem(key: string) {
    const label = paramLables?.[key] ?? key
    const options = paramOptions?.[key] ?? []
    const currentValue = String(currentParamValues[key] ?? '')
    let actualValue: string | null = null
    if (options.length === 0 && isMaskParamReference(currentValue)) {
      try {
        actualValue = resolveMaskParamValue(
          currentValue,
          target.graphId,
          subGraphs,
        )
      } catch (error) {
        if (!(error instanceof MaskParamResolutionError)) throw error
      }
    }
    const rules =
      key !== 'Inputs'
        ? undefined
        : data?.blockType === 'Add'
          ? [
              {
                pattern: /^[+-]*$/,
                message: 'Add 模块的输入符号只能包含 + 或 -',
              },
            ]
          : data?.blockType === 'Product'
            ? [
                {
                  pattern: /^[*/]*$/,
                  message: 'Product 模块的输入符号只能包含 * 或 /',
                },
              ]
            : undefined

    return (
      <Form.Item key={key} label={label} name={key} colon={false} rules={rules}>
        {options.length > 0 ? (
          <Select
            options={options.map((option) => ({
              label: option,
              value: option,
            }))}
          />
        ) : (
          <Input
            addonAfter={
              actualValue === null ? undefined : (
                <span aria-label="解析值">{actualValue}</span>
              )
            }
            rootClassName={
              actualValue === null ? undefined : 'mask-param-resolved-input'
            }
          />
        )}
      </Form.Item>
    )
  }

  return (
    <FloatingWindow
      windowId={windowId}
      graphId={target.graphId}
      title={`参数设置 — ${nodeLabel || '未定义模块名'}`}
      taskbarIcon={SlidersHorizontalIcon}
      defaultWidth={600}
      defaultHeight={188}
      minWidth={480}
      minHeight={188}
      autoFitHeight
      maxAutoHeight={520}
      onClose={onDestroy}
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            size="xs"
            className="rounded-md"
            onClick={onDestroy}
          >
            取消
          </Button>
          <Button
            type="button"
            size="xs"
            className="rounded-md"
            onClick={handleOk}
          >
            确认
          </Button>
        </>
      }
    >
      {data?.description && (
        <div className="mb-4">
          <Alert type="info" title={data.description} showIcon />
        </div>
      )}
      <Form
        form={form}
        layout="horizontal"
        labelCol={{ span: 6 }}
        wrapperCol={{ span: 14 }}
        labelWrap
        validateTrigger="onBlur"
      >
        {paramKeys.map(renderFormItem)}
      </Form>
      {paramKeys.length === 0 && (
        <div className="py-6 text-center text-destructive">
          {` 当前模块暂无配置参数，如有需求请联系：${CONTACT_ME_EMAIL}`}
        </div>
      )}
    </FloatingWindow>
  )
}

// ── SubsystemParamWindow ────────────────────────────────────────────────────

type MaskParamItem = { name?: string; value?: string }

/**
 * @description 子系统封装参数悬浮窗口
 * 读取 node.data.maskParam，表单可动态增删参数项，确认后写回 maskParam
 */
function SubsystemParamWindow({
  windowId,
  target,
  onDestroy,
}: {
  windowId: string
  target: NodeParamWindowTarget
  onDestroy: () => void
}) {
  const [form] = Form.useForm<{ ModelName: string; list: MaskParamItem[] }>()

  const data = target.snapshot.data as BlockData | undefined
  const nodeLabel = getSnapshotLabel(target.snapshot)
  const maskParam = (data?.maskParam as Record<string, string>) ?? {}

  // maskParam Record → [{name, value}]
  const initialList = Object.entries(maskParam).map(([name, value]) => ({
    name,
    value: String(value ?? ''),
  }))
  const list = Form.useWatch('list', form) ?? initialList
  const subGraphs = useSubGraphStore.getState().subGraphs
  const currentMaskParam = Object.fromEntries(
    list
      .filter((item) => item?.name)
      .map((item) => [item.name!, String(item.value ?? '')]),
  )

  function getActualValue(item: MaskParamItem): {
    value: string
    error?: string
  } {
    try {
      return {
        value: resolveMaskParamValue(
          item.value ?? '',
          target.nodeId,
          subGraphs,
          {
            [target.nodeId]: currentMaskParam,
          },
        ),
      }
    } catch (error) {
      if (error instanceof MaskParamResolutionError) {
        return { value: '解析失败', error: error.message }
      }
      throw error
    }
  }

  useEffect(() => {
    form.setFieldsValue({ ModelName: nodeLabel, list: initialList })
  }, [form])

  const handleOk = async () => {
    try {
      const values = await form.validateFields()
      // [{name, value}] → Record<string, string>
      const result = Object.fromEntries(
        (values.list ?? [])
          .filter((item) => item.name)
          .map((item) => [item.name!, String(item.value ?? '')]),
      )
      activateTargetNode(target).node.setData({ maskParam: result })
      onDestroy()
    } catch (error) {
      console.error('表单验证失败:', error)
    }
  }

  return (
    <FloatingWindow
      windowId={windowId}
      graphId={target.graphId}
      title={`子系统封装参数 — ${nodeLabel || '未命名子系统'}`}
      taskbarIcon={SlidersHorizontalIcon}
      defaultWidth={720}
      defaultHeight={268}
      minWidth={560}
      minHeight={248}
      autoFitHeight
      maxAutoHeight={520}
      onClose={onDestroy}
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            size="xs"
            className="rounded-md"
            onClick={onDestroy}
          >
            取消
          </Button>
          <Button
            type="button"
            size="xs"
            className="rounded-md"
            onClick={handleOk}
          >
            确认
          </Button>
        </>
      }
    >
      {data?.description && (
        <div className="mb-4">
          <Alert type="info" message={data.description} showIcon />
        </div>
      )}
      <Form
        form={form}
        layout="horizontal"
        labelCol={{ span: 6 }}
        wrapperCol={{ span: 16 }}
        autoComplete="off"
        validateTrigger="onBlur"
      >
        {/* 封装模块名称（只读展示） */}
        <Form.Item label="封装模块名称" name="ModelName">
          <Input disabled />
        </Form.Item>

        {/* 动态参数列表 */}
        <Form.Item label="参数列表">
          <Form.List name="list">
            {(fields, { add, remove }) => (
              <div
                style={{ display: 'flex', flexDirection: 'column', rowGap: 11 }}
              >
                {fields.map((field) => {
                  const item = list[field.name] ?? {}
                  const actual = getActualValue(item)
                  const usesMaskParam = isMaskParamReference(item.value ?? '')
                  return (
                    <Space key={field.key} align="start">
                      <Form.Item
                        name={[field.name, 'name']}
                        rules={[
                          {
                            required: true,
                            whitespace: true,
                            message: '请输入参数名',
                          },
                          {
                            validator: (_, value) =>
                              /^\d+$/.test(String(value ?? '').trim())
                                ? Promise.reject(
                                    new Error('封装参数名不能为纯数值'),
                                  )
                                : Promise.resolve(),
                          },
                        ]}
                      >
                        <Input
                          placeholder="封装参数名"
                          style={{ width: 150 }}
                        />
                      </Form.Item>
                      <Form.Item
                        name={[field.name, 'value']}
                        rules={[
                          {
                            validator: () =>
                              actual.error
                                ? Promise.reject(new Error(actual.error))
                                : Promise.resolve(),
                          },
                        ]}
                      >
                        <Input
                          placeholder="封装参数值"
                          addonAfter={
                            usesMaskParam ? (
                              <span aria-label="解析值">{actual.value}</span>
                            ) : undefined
                          }
                          status={
                            usesMaskParam && actual.error ? 'error' : undefined
                          }
                          rootClassName={
                            usesMaskParam
                              ? 'mask-param-resolved-input'
                              : undefined
                          }
                          style={{ width: usesMaskParam ? 240 : 280 }}
                        />
                      </Form.Item>
                      <CloseOutlined
                        onClick={() => remove(field.name)}
                        style={{ cursor: 'pointer', marginTop: 6 }}
                      />
                    </Space>
                  )
                })}
                <AntButton type="dashed" onClick={() => add()} block>
                  + 添加参数
                </AntButton>
              </div>
            )}
          </Form.List>
        </Form.Item>
      </Form>
    </FloatingWindow>
  )
}

export { BlockParamWindow, SubsystemParamWindow }
export type { NodeParamWindowTarget }
