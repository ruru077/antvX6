import type { MessageInstance } from 'antd/es/message/interface'

let messageInstance: MessageInstance | null = null

function bindAntdMessage(instance: MessageInstance) {
  messageInstance = instance
}

function getAntdMessage(): MessageInstance {
  if (!messageInstance) {
    throw new Error('Ant Design App message context is required')
  }
  return messageInstance
}

export { bindAntdMessage, getAntdMessage }
