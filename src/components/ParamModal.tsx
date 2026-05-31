import type { Node } from '@antv/x6'
import { Alert, Form, Input, Modal, Select } from 'antd'
import type { BlockData } from '~/types/vo/block'
import { CONTACT_ME_EMAIL } from '@/assets/constant'

/**
 * @description 模块参数设置 Modal 组件
 */
function BlockParamModal({
  node,
  onDestroy,
}: {
  node: Node
  onDestroy: () => void
}) {
  const [open, setOpen] = useState(true)
  const [form] = Form.useForm()

  const data = node.getData<BlockData>()
  const nodeLabel = node.attr<string>('label/text')?.trim()
  const paramValues = data?.paramValues ?? {}
  const paramLables = data?.paramLables ?? {}
  const paramOptions = data?.paramOptions ?? {}
  const paramKeys = Object.keys(paramValues)

  useEffect(() => {
    form.setFieldsValue(paramValues)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleOk = () => {
    // 更新业务数据
    form.validateFields().then((values) => {
      node.setData({ paramValues: values })
      setOpen(false)
    })
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
    // TODO SIMULINKACTIVE GENERATECODE SFUNCTION
    <Modal
      open={open}
      title={`参数设置 — ${nodeLabel || '未定义模块名'}`}
      onOk={handleOk}
      onCancel={() => setOpen(false)}
      afterClose={onDestroy}
      okText="确认"
      cancelText="取消"
      width={600}
    >
      {/* 模块描述 */}
      {data?.description && (
        <Alert
          type="info"
          title={data.description}
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}
      {/* 表单项 */}
      <Form
        form={form}
        layout="horizontal"
        labelCol={{ span: 6 }}
        wrapperCol={{ span: 14 }}
        labelWrap
      >
        {paramKeys.map(renderFormItem)}
      </Form>
      {/* 兜底Callback */}
      {paramKeys.length === 0 && (
        <div
          style={{ textAlign: 'center', color: '#e61f1f', padding: '24px 0' }}
        >
          {` 当前模块暂无配置参数，如有需求请联系：${CONTACT_ME_EMAIL}`}
        </div>
      )}
    </Modal>
  )
}

export { BlockParamModal }
