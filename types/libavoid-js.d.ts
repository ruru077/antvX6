declare module 'libavoid-js' {
  type EnumValue = { value: number }

  type PointLike = {
    x: number
    y: number
  }

  type WasmObject = {
    delete?: () => void
  }

  type RouterRef = WasmObject & {
    processTransaction: () => void
    setRoutingParameter: (parameter: EnumValue, value: number) => void
    setRoutingOption: (option: EnumValue, value: boolean) => void
  }

  type ShapeRef = WasmObject
  type ConnEndRef = WasmObject
  type CheckpointRef = WasmObject
  type CheckpointVectorRef = WasmObject & {
    push_back: (checkpoint: CheckpointRef) => void
  }
  type ConnRef = WasmObject & {
    displayRoute: () => {
      size: () => number
      at: (index: number) => PointLike
    }
    setRoutingType: (type: number) => void
    setRoutingCheckpoints: (checkpoints: CheckpointVectorRef) => void
    setHateCrossings: (value: boolean) => void
  }

  export type Avoid = {
    RouterFlag: {
      OrthogonalRouting: EnumValue
      PolyLineRouting: EnumValue
    }
    ConnType: {
      ConnType_Orthogonal: EnumValue
      ConnType_PolyLine: EnumValue
    }
    RoutingParameter: {
      segmentPenalty: EnumValue
      anglePenalty: EnumValue
      crossingPenalty: EnumValue
      clusterCrossingPenalty: EnumValue
      fixedSharedPathPenalty: EnumValue
      portDirectionPenalty: EnumValue
      shapeBufferDistance: EnumValue
      idealNudgingDistance: EnumValue
      reverseDirectionPenalty: EnumValue
    }
    RoutingOption: {
      nudgeOrthogonalSegmentsConnectedToShapes: EnumValue
      nudgeOrthogonalTouchingColinearSegments: EnumValue
      performUnifyingNudgingPreprocessingStep: EnumValue
      nudgeSharedPathsWithCommonEndPoint: EnumValue
    }
    Point: new (x: number, y: number) => PointLike & WasmObject
    Rectangle: new (topLeft: PointLike, bottomRight: PointLike) => WasmObject
    Router: new (flags: number) => RouterRef
    ShapeRef: new (router: RouterRef, rectangle: WasmObject) => ShapeRef
    ShapeConnectionPin: new (
      shape: ShapeRef,
      classId: number,
      xOffset: number,
      yOffset: number,
      proportional: boolean,
      insideOffset: number,
      visDirs: number,
    ) => WasmObject & {
      setExclusive: (exclusive: boolean) => void
    }
    ConnEnd: new (shape: ShapeRef, classId: number) => ConnEndRef
    Checkpoint: new (
      point: PointLike,
      arrivalDirs?: number,
      departureDirs?: number,
    ) => CheckpointRef
    CheckpointVector: new () => CheckpointVectorRef
    ConnRef: new (
      router: RouterRef,
      sourceEnd: ConnEndRef,
      targetEnd: ConnEndRef,
    ) => ConnRef
  }

  export const AvoidLib: {
    load: (filePath?: string) => Promise<void>
    getInstance: () => Avoid
  }
}
