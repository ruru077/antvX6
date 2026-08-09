import { CloseOutlined } from '@ant-design/icons'
import { Alert, Button as AntButton, Form, Input, Select, Space } from 'antd'
import { CONTACT_ME_EMAIL } from '@/assets/constant'
import { Button } from '@/components/ui/button'
import { FloatingWindow } from '@/components/ui/floating-window'
import type { Node } from '@antv/x6'
import type { BlockData } from '~/types/vo/block'

// ── BlockParamWindow ────────────────────────────────────────────────────────

/**
 * @description 模块参数设置悬浮窗口
 */
function BlockParamWindow({
  node,
  onDestroy,
}: {
  node: Node
  onDestroy: () => void
}) {
  const [form] = Form.useForm()

  const data = node.getData<BlockData>()
  const nodeLabel = node.attr<string>('label/text')?.trim()
  const paramValues = data?.paramValues ?? {}
  const paramLables = data?.paramLables ?? {}
  const paramOptions = data?.paramOptions ?? {}
  const paramKeys = Object.keys(paramValues)

  useEffect(() => {
    form.setFieldsValue(paramValues)
  })

  const handleOk = async () => {
    try {
      const values = await form.validateFields()
      node.setData({ paramValues: values })
      onDestroy()
    } catch (error) {
      console.error('表单验证失败:', error)
    }
  }

  function renderFormItem(key: string) {
    const label = paramLables?.[key] ?? key
    const options = paramOptions?.[key] ?? []

    return (
      <Form.Item key={key} label={label} name={key} colon={false}>
        {options.length > 0 ? (
          <Select
            options={options.map((option) => ({
              label: option,
              value: option,
            }))}
          />
        ) : (
          <Input />
        )}
      </Form.Item>
    )
  }

  return (
    <FloatingWindow
      title={`参数设置 — ${nodeLabel || '未定义模块名'}`}
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
  node,
  onDestroy,
}: {
  node: Node
  onDestroy: () => void
}) {
  const [form] = Form.useForm<{ ModelName: string; list: MaskParamItem[] }>()

  const data = node.getData<BlockData>()
  const nodeLabel = node.attr<string>('label/text')?.trim() ?? ''
  const maskParam = (data?.maskParam as Record<string, string>) ?? {}

  // maskParam Record → [{name, value}]
  const initialList = Object.entries(maskParam).map(([name, value]) => ({
    name,
    value,
  }))

  useEffect(() => {
    form.setFieldsValue({ ModelName: nodeLabel, list: initialList })
  })

  const handleOk = async () => {
    try {
      const values = await form.validateFields()
      // [{name, value}] → Record<string, string>
      const result = Object.fromEntries(
        (values.list ?? [])
          .filter((item) => item.name)
          .map((item) => [item.name!, item.value ?? '']),
      )
      node.setData({ maskParam: result })
      onDestroy()
    } catch (error) {
      console.error('表单验证失败:', error)
    }
  }

  return (
    <FloatingWindow
      title={`子系统封装参数 — ${nodeLabel || '未命名子系统'}`}
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
                {fields.map((field) => (
                  <Space key={field.key} align="start">
                    <Form.Item
                      noStyle
                      name={[field.name, 'name']}
                      rules={[{ required: true, message: '请输入参数名' }]}
                    >
                      <Input placeholder="封装参数名" />
                    </Form.Item>
                    <Form.Item noStyle name={[field.name, 'value']}>
                      <Input placeholder="封装参数值" />
                    </Form.Item>
                    <CloseOutlined
                      onClick={() => remove(field.name)}
                      style={{ cursor: 'pointer', marginTop: 6 }}
                    />
                  </Space>
                ))}
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
