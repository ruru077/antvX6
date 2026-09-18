import { requestDiagramModel } from '@/services/diagram-model-service'
import type { InterpreterConfig } from '@/store/interpreterStore'
import type { EntryGraphModel } from '~/types'

interface SaveModelInput {
  modelId: number | string
  graphModel: EntryGraphModel
  config: InterpreterConfig
}

function saveModel({ modelId, graphModel, config }: SaveModelInput) {
  return requestDiagramModel<void>(
    `/diagram-models/${encodeURIComponent(modelId)}/content`,
    {
      method: 'PUT',
      body: JSON.stringify({ graphModel, config }),
    },
  )
}

export { saveModel }
export type { SaveModelInput }
