import {
  DeleteOutlined,
  EditOutlined,
  PlayCircleOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import {
  Alert,
  Button,
  Card,
  Empty,
  Form,
  Input,
  message,
  Modal,
  Space,
  Table,
  Tooltip,
} from 'antd'
import { useNavigate } from 'react-router'
import { WorkspaceLoadingBoundary } from '@/components/layout/WorkspaceLoadingBoundary'
import {
  createDiagramModel,
  deleteDiagramModel,
  DiagramModelRequestError,
  getDiagramModel,
  listDiagramModels,
  updateDiagramModel,
} from '@/services/diagram-model-service'
import { useNcslabContextStore } from '@/services/ncslab-context-service'
import { DEFAULT_INTERPRETER_CONFIG } from '@/store/interpreterStore'
import type { DiagramModelSummary } from '@/services/diagram-model-service'
import type { TableColumnsType } from 'antd'
import type { EntryGraphModel } from '~/types'

type ModelFormValues = { modelName: string; description: string }
type DialogState =
  | { type: 'create' }
  | { type: 'update'; model: DiagramModelSummary }
  | null
const ICON_STYLE = { fontSize: 20 }
const sameId = (a: number | string, b: number | string) =>
  String(a) === String(b)
const errorText = (error: unknown) =>
  error instanceof Error ? error.message : '请求失败，请稍后重试'

function createEmptyGraphModel(modelName: string): EntryGraphModel {
  const rootId = crypto.randomUUID()
  return {
    currentGraphId: rootId,
    rootId,
    subGraphs: {
      [rootId]: {
        id: rootId,
        name: modelName,
        deep: 0,
        parentId: null,
        childrenIds: [],
        graphJson: { cells: [] },
      },
    },
  }
}

function ExchangeDiagram({
  workspacePath = '/workspace',
  active = true,
  workspaceReady = true,
}: {
  workspacePath?: string
  active?: boolean
  workspaceReady?: boolean
}) {
  const navigate = useNavigate()
  const [openTooltipKey, setOpenTooltipKey] = useState<string | null>(null)
  const runtimeContext = useNcslabContextStore((state) => state.context)
  const contextError = useNcslabContextStore((state) => state.error)
  const [messageApi, messageHolder] = message.useMessage()
  const [form] = Form.useForm<ModelFormValues>()
  const [publicModels, setPublicModels] = useState<DiagramModelSummary[]>([])
  const [privateModels, setPrivateModels] = useState<DiagramModelSummary[]>([])
  const [loadedScope, setLoadedScope] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<{
    scope: string
    message: string
  } | null>(null)
  const [openingKey, setOpeningKey] = useState<string | null>(null)
  const [dialog, setDialog] = useState<DialogState>(null)
  const [dialogLoading, setDialogLoading] = useState(false)
  const currentUser = runtimeContext?.user
  const plantId = runtimeContext?.plant.id
  const userId = currentUser?.id
  const currentScope = JSON.stringify([userId, plantId])
  const hasLoaded = loadedScope === currentScope
  const currentLoadError =
    loadError?.scope === currentScope ? loadError.message : null
  const exchangeReady = hasLoaded || currentLoadError != null
  const [reloadCount, setReloadCount] = useState(0)

  const loadModels = () => {
    setLoadedScope(null)
    setLoadError(null)
    setReloadCount((count) => count + 1)
  }

  useEffect(() => {
    let cancelled = false
    if (plantId == null || userId == null) return
    const requestScope = JSON.stringify([userId, plantId])
    const fetchModels = async () => {
      try {
        const result = await listDiagramModels(plantId)
        if (cancelled) return
        if (
          !Array.isArray(result.publicModels) ||
          !Array.isArray(result.privateModels)
        ) {
          throw new Error('模型目录响应格式无效')
        }
        setPublicModels(result.publicModels)
        setPrivateModels(result.privateModels)
        setLoadedScope(requestScope)
        setLoadError(null)
      } catch (error) {
        if (cancelled) return
        setPublicModels([])
        setPrivateModels([])
        setLoadError({ scope: requestScope, message: errorText(error) })
      }
    }
    void fetchModels()
    return () => {
      cancelled = true
    }
  }, [plantId, userId, reloadCount])

  const openModel = async (model: DiagramModelSummary, sourceKey: string) => {
    setOpenTooltipKey(null)
    setOpeningKey(sourceKey)
    try {
      const detail = await getDiagramModel(model.id)
      await navigate(workspacePath, {
        state: {
          diagramModel: detail.graphModel,
          modelId: detail.id,
          modelName: detail.modelName,
          config: detail.config,
        },
      })
    } catch (error) {
      messageApi.error(errorText(error))
    } finally {
      setOpeningKey(null)
    }
  }

  const showCreate = () => {
    setDialog({ type: 'create' })
    form.setFieldsValue({
      modelName: `unnamed${Math.floor(100000 + Math.random() * 900000)}`,
      description: '',
    })
  }
  const showUpdate = (model: DiagramModelSummary) => {
    setDialog({ type: 'update', model })
    form.setFieldsValue({
      modelName: model.modelName,
      description: model.description ?? '',
    })
  }
  const closeDialog = () => {
    setDialog(null)
    form.resetFields()
  }
  const replaceModel = (updated: DiagramModelSummary) => {
    setPublicModels((items) =>
      items.map((item) => (sameId(item.id, updated.id) ? updated : item)),
    )
    setPrivateModels((items) =>
      items.map((item) => (sameId(item.id, updated.id) ? updated : item)),
    )
  }

  const submitDialog = async () => {
    if (!dialog || plantId == null) return
    const values = await form.validateFields()
    setDialogLoading(true)
    try {
      if (dialog.type === 'create') {
        const modelName = values.modelName.trim()
        const created = await createDiagramModel({
          plantId,
          modelName,
          description: values.description?.trim() ?? '',
          graphModel: createEmptyGraphModel(modelName),
          config: DEFAULT_INTERPRETER_CONFIG,
        })
        setPrivateModels((items) => [...items, created])
        messageApi.success('模型创建成功')
      } else {
        replaceModel(
          await updateDiagramModel(dialog.model.id, {
            modelName: values.modelName.trim(),
            description: values.description?.trim() ?? '',
          }),
        )
        messageApi.success('模型信息更新成功')
      }
      closeDialog()
    } catch (error) {
      if (error instanceof DiagramModelRequestError && error.status === 409) {
        messageApi.warning('模型名称已存在，请修改后重试')
        form.getFieldInstance('modelName')?.focus()
      } else messageApi.error(errorText(error))
    } finally {
      setDialogLoading(false)
    }
  }

  const removeModel = (model: DiagramModelSummary) =>
    Modal.confirm({
      title: `确认删除模型“${model.modelName}”？`,
      content: '删除后无法恢复。',
      okText: '删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      async onOk() {
        try {
          await deleteDiagramModel(model.id)
          setPublicModels((items) =>
            items.filter((item) => !sameId(item.id, model.id)),
          )
          setPrivateModels((items) =>
            items.filter((item) => !sameId(item.id, model.id)),
          )
          messageApi.success('模型删除成功')
        } catch (error) {
          messageApi.error(errorText(error))
          throw error
        }
      },
    })

  const canManage = (model: DiagramModelSummary) =>
    currentUser != null && sameId(model.creatorId, currentUser.id)

  const openButton = (
    model: DiagramModelSummary,
    listType: 'public' | 'private',
  ) => {
    const tooltipKey = `${listType}:${model.id}`
    return (
      <Tooltip
        title="打开模型"
        open={active && openTooltipKey === tooltipKey && openingKey == null}
        onOpenChange={(open) => setOpenTooltipKey(open ? tooltipKey : null)}
      >
        <Button
          aria-label="打开模型"
          type="text"
          color="primary"
          variant="text"
          loading={openingKey === tooltipKey}
          icon={<PlayCircleOutlined style={ICON_STYLE} />}
          onClick={(event) => {
            event.stopPropagation()
            void openModel(model, tooltipKey)
          }}
        />
      </Tooltip>
    )
  }

  const publicColumns: TableColumnsType<DiagramModelSummary> = [
    { title: '模型名', dataIndex: 'modelName' },
    { title: '作者', dataIndex: 'author', width: 300 },
    {
      title: '上次更新',
      dataIndex: 'lastUpdate',
      width: 300,
      sorter: (a, b) => a.lastUpdate.localeCompare(b.lastUpdate),
    },
    {
      title: '操作',
      width: 160,
      render: (_, model) => openButton(model, 'public'),
    },
  ]

  const privateColumns: TableColumnsType<DiagramModelSummary> = [
    {
      title: '模型名',
      dataIndex: 'modelName',
      width: 'calc((100% - 160px) / 2)',
    },
    {
      title: '上次更新',
      dataIndex: 'lastUpdate',
      width: 'calc((100% - 160px) / 2)',
      sorter: (a, b) => a.lastUpdate.localeCompare(b.lastUpdate),
    },
    {
      title: '操作',
      width: 160,
      render: (_, model) => (
        <Space size={0}>
          {openButton(model, 'private')}
          {canManage(model) && (
            <>
              <Tooltip title="更新图表">
                <Button
                  aria-label="重命名模型"
                  type="text"
                  color="primary"
                  variant="text"
                  icon={<EditOutlined style={ICON_STYLE} />}
                  onClick={(event) => {
                    event.stopPropagation()
                    showUpdate(model)
                  }}
                />
              </Tooltip>
              <Tooltip title="删除模型">
                <Button
                  aria-label="删除模型"
                  type="text"
                  color="danger"
                  variant="text"
                  icon={<DeleteOutlined style={ICON_STYLE} />}
                  onClick={(event) => {
                    event.stopPropagation()
                    removeModel(model)
                  }}
                />
              </Tooltip>
            </>
          )}
        </Space>
      ),
    },
  ]

  if (!runtimeContext)
    return (
      <main className="min-h-full bg-[#f0f2f5] p-6">
        {messageHolder}
        <Alert
          showIcon
          type="info"
          title="等待主应用上下文"
          description={contextError ?? '请由主应用发送当前用户和实验对象信息。'}
        />
      </main>
    )

  return (
    <WorkspaceLoadingBoundary
      stage={workspaceReady && exchangeReady ? 'ready' : 'initializing'}
    >
      <main className="min-h-full bg-[#f0f2f5] p-6">
        {messageHolder}
        <div className="flex flex-col gap-4">
          {currentLoadError && (
            <Alert
              showIcon
              type="error"
              title="模型目录加载失败"
              description={currentLoadError}
              action={<Button onClick={() => loadModels()}>重新加载</Button>}
            />
          )}
          <Card title="公共算法模型" styles={{ body: { paddingTop: 12 } }}>
            <Table
              size="medium"
              rowClassName="font-normal"
              columns={publicColumns}
              dataSource={hasLoaded ? publicModels : []}
              locale={{
                emptyText: hasLoaded ? (
                  <Empty description="暂无公共模型" />
                ) : (
                  <div role="status">
                    {currentLoadError ? '模型目录加载失败' : '正在加载模型…'}
                  </div>
                ),
              }}
              pagination={{ pageSize: 10, position: ['bottomRight'] }}
              rowKey="id"
              onRow={(model) => ({ onDoubleClick: () => showUpdate(model) })}
            />
          </Card>
          <Card title="私有算法模型" styles={{ body: { paddingTop: 12 } }}>
            <Space className="mb-3">
              <Button type="primary" onClick={showCreate}>
                创建新模型
              </Button>
              <Tooltip title="新上传协议尚未接入">
                <Button
                  icon={<UploadOutlined />}
                  onClick={() => messageApi.info('新上传协议尚未接入')}
                >
                  上传文件
                </Button>
              </Tooltip>
            </Space>
            <Table
              size="medium"
              rowClassName="font-normal"
              columns={privateColumns}
              tableLayout="fixed"
              dataSource={hasLoaded ? privateModels : []}
              locale={{
                emptyText: hasLoaded ? (
                  <Empty description="暂无私有模型" />
                ) : (
                  <div role="status">
                    {currentLoadError ? '模型目录加载失败' : '正在加载模型…'}
                  </div>
                ),
              }}
              pagination={{ pageSize: 10, position: ['bottomRight'] }}
              rowKey="id"
              onRow={(model) => ({ onDoubleClick: () => showUpdate(model) })}
            />
          </Card>
        </div>
        <Modal
          open={dialog != null}
          title={dialog?.type === 'create' ? '保存图表' : '更新图表'}
          width={600}
          confirmLoading={dialogLoading}
          okText={dialog?.type === 'create' ? '保存' : '更新'}
          cancelText="取消"
          onCancel={closeDialog}
          onOk={() => void submitDialog()}
          afterClose={() => form.resetFields()}
        >
          <Form
            form={form}
            layout="horizontal"
            requiredMark={false}
            labelCol={{ span: 6 }}
            wrapperCol={{ span: 14 }}
          >
            <Form.Item
              label="图表名称"
              name="modelName"
              rules={[
                { required: true, whitespace: true, message: '请输入模型名称' },
                { max: 100, message: '模型名称不能超过 100 个字符' },
                {
                  pattern: /^[a-zA-Z0-9_-]+$/,
                  message: '仅允许英文字母、数字、下划线和短横线',
                },
              ]}
            >
              <Input maxLength={100} placeholder="请输入图表名称" />
            </Form.Item>
            <Form.Item
              label="描述"
              name="description"
              rules={[{ max: 500, message: '描述不能超过 500 个字符' }]}
            >
              <Input.TextArea
                maxLength={500}
                rows={4}
                showCount
                placeholder="请输入图表描述"
              />
            </Form.Item>
            {dialog && (
              <div
                style={{
                  marginTop: 20,
                  padding: 10,
                  backgroundColor: '#f0f2f5',
                  borderRadius: 4,
                  fontSize: 12,
                  color: '#666',
                }}
              >
                <p style={{ margin: 0 }}>
                  <strong>备注:</strong>
                </p>
                <ul
                  style={{
                    margin: '5px 0 0 20px',
                    padding: 0,
                    listStyleType: 'disc',
                  }}
                >
                  <li>图表将保存当前的模块配置</li>
                  {dialog.type === 'update' && <li>更新将覆盖现有图表</li>}
                </ul>
              </div>
            )}
          </Form>
        </Modal>
      </main>
    </WorkspaceLoadingBoundary>
  )
}

export default ExchangeDiagram
