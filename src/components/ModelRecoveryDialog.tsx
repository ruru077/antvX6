import { Alert, Button, Modal, Tag } from 'antd'
import { Clock3, File, Save, Server, TriangleAlert } from 'lucide-react'
import type { ModelAutosaveInfo } from '@/services/model-autosave-service'
import '@/components/styles/model-recovery.scss'

function formatSavedTime(value: string | number | null | undefined) {
  if (value == null) return '未记录'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleString('zh-CN')
}

function relativeSavedTime(savedAt: number | null) {
  if (savedAt == null) return '未记录'
  const seconds = Math.max(0, Math.floor((Date.now() - savedAt) / 1000))
  if (seconds < 60) return '刚刚'
  if (seconds < 3600) return `${Math.floor(seconds / 60)} 分钟前`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} 小时前`
  return formatSavedTime(savedAt)
}

export function ModelRecoveryDialog({
  open,
  autosave,
  lastUpdate,
  onChoose,
}: {
  open: boolean
  autosave: ModelAutosaveInfo
  lastUpdate?: string
  onChoose: (source: 'database' | 'autosave' | 'discard') => void
}) {
  return (
    <Modal
      open={open}
      title={
        <span className="model-recovery-title">
          <TriangleAlert />
          恢复自动保存的图表
        </span>
      }
      width={600}
      centered
      footer={null}
      closable={false}
      maskClosable={false}
      keyboard={false}
      className="model-recovery"
    >
      <Alert
        showIcon
        type="warning"
        title="检测到自动保存版本"
        description="我们发现了此图表的自动保存版本，可能包含未保存的更改。请选择要加载的版本。"
      />
      <div className="model-recovery-options">
        <section className="model-recovery-option">
          <Server className="model-recovery-hero" aria-hidden="true" />
          <h3>数据库版本</h3>
          <div className="model-recovery-details">
            <div className="model-recovery-detail">
              <Clock3 aria-hidden="true" />
              <div>
                <span>上次保存：</span>
                <strong>{formatSavedTime(lastUpdate)}</strong>
              </div>
            </div>
            <div className="model-recovery-detail">
              <File aria-hidden="true" />
              <div>
                <span>版本：</span>
                <Tag color="blue">稳定</Tag>
              </div>
            </div>
          </div>
          <Button
            block
            type="primary"
            icon={<Server size={14} />}
            onClick={() => onChoose('database')}
          >
            加载数据库版本
          </Button>
        </section>
        <section className="model-recovery-option model-recovery-option-autosave">
          <Save className="model-recovery-hero" aria-hidden="true" />
          <h3>自动保存版本</h3>
          <div className="model-recovery-details">
            <div className="model-recovery-detail">
              <Clock3 aria-hidden="true" />
              <div>
                <span>已自动保存：</span>
                <strong
                  className="model-recovery-time"
                  title={formatSavedTime(autosave.savedAt)}
                >
                  {relativeSavedTime(autosave.savedAt)}
                </strong>
                <small>{formatSavedTime(autosave.savedAt)}</small>
              </div>
            </div>
            <div className="model-recovery-detail">
              <File aria-hidden="true" />
              <div>
                <span>大小：</span>
                <strong>{(autosave.sizeBytes / 1024).toFixed(1)} KB</strong>
              </div>
            </div>
            <div className="model-recovery-detail">
              <i className="model-recovery-dot" />
              <Tag color="orange">可能包含未保存的更改</Tag>
            </div>
          </div>
          <Button
            block
            icon={<Save size={14} />}
            onClick={() => onChoose('autosave')}
          >
            加载自动保存版本
          </Button>
        </section>
      </div>
      <Button
        block
        type="text"
        danger
        className="model-recovery-discard"
        onClick={() => onChoose('discard')}
      >
        放弃自动保存并加载数据库版本
      </Button>
      <p className="model-recovery-note">
        <TriangleAlert aria-hidden="true" />
        注意：自动保存的数据存储在您的浏览器本地，手动保存后将被清除。
      </p>
    </Modal>
  )
}
