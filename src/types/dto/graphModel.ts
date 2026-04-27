/**
 * @description Graph Model DTO (Data Transfer Object)
 */

/**
 * 配置参数对象
 */
interface Config {
  Step: string
  FixedStep: string
  Solver: string
  StartTime: string
  StopTime: string
  MaxDataPoints: string
  MaxStep: string
  MinStep: string
  InitialStep: string
  RelTol: string
  AbsTol: string
}

/**
 * Block 块对象
 */
interface Block {
  blockType: string
  srcBlock: string
  blockName: string
  paramValues: Record<string, string>
  blockPath: string
  blockUUID: string
}

/**
 * 连接线对象
 */
interface Line {
  fromBlockName: string
  fromPortNo: string
  toBlockName: string
  toPortNo: string
  linePath: string
  fromBlockUUID: string
  toBlockUUID: string
}

/**
 * 保存信息对象
 */
interface SaveInfo {
  uuid: number
  userId: number
  modelId: number
  modelRealName: string
  stepTime: number
  packetSize: number
  targetPlatform: number
  publicFlag: number
  testRig: number
  copyNum: number
  description: string
}

/**
 * Graph Model DTO
 */
interface GraphModelDTO {
  userId: number
  testRig: number
  copyNum: number
  modelId: number
  modelName: string
  uuid: number
  modelRealName: string
  templateName: string
  config: Config
  blocks: Block[]
  lines: Line[]
  option: Record<string, unknown>
  saveInfo: SaveInfo
}

export type { GraphModelDTO }
