# 局部路由与手动路径保护

日常入口使用 `routeEdge(edge)`、`routeEdges(graph, edges)` 或
`routeNodeEdges(graph, nodes)`，返回的 Promise 在本画布队列排空后完成。
只有“整理连线”和“自动排列”调用 `routeAllEdges`，主动重置手动路径。

每轮将允许写回的边与完整环境分开：所有带端口的节点仍是障碍物，其他
可见正式边以真实折线注册为 libavoid 固定路径；Manhattan 分支读取 View
计算后的 routePoints。固定连接只参与交叉/间距约束，不写回原模型。
边间避让是软约束，允许交叉并继续使用 jumpover；不把边变成实体障碍。

`routing-session.js` 用 WeakMap 隔离 Graph 状态，合并同帧请求，维护
图层代次、环境版本和正在编辑的边。模型 reset、历史回放、清空及销毁
使旧请求失效；写回前检查当前 Cell 身份。自动写回带 `routingWrite`
标记，避免递归调度。下游分支按父边到子边顺序更新，循环依赖不强行清空。

节点操作在几何变化前调用 `captureNodeRoutes`，结束后等待路由，再调用
`finishNodeRoutes` 和关闭历史批次。节点拖动、Selection、Transform、参数
调整和旋转入口均遵守这个顺序。端点修改可用 `captureEdgeRoutes` 保存
旧折线。保存期间不执行路由，加载也不触发重新计算。

工具只有实际修改 vertices 才设置 `edge.data.routingMode = 'manual'`，
与路径处于同一历史批次。无标记旧边如已有 vertices 且无自动 router，
按手动边处理。单击或拖回起点保留原模式。

`routing-geometry.js` 先尝试两端同量平移，再调整相邻折点；若端口方向、
正交性或节点碰撞不满足，则用相同全图环境连接到尽量长的原有中段。
逐步缩短保留范围仍失败时才重算这一条边，并继续保留 manual 模式。
Selection 已平移的有效路径优先保留，避免再次平移。

节点拖动以起点到当前位置的画布直线距离区分微调和重新布局。
不超过 `NODE_ROUTE_RESET_DISTANCE`（默认 60，三个网格）继续保留手动形状；
一旦超过阈值，本次拖动的关联边及下游分支转为 auto 并重新路由，
拖回阈值内也不恢复旧折点。框选同样适用，缩放不影响判断。
释放后重新开始计算下一次拖动的距离；撤销可恢复原路径和 manual 模式。
缩放节点、旋转及端口参数调整仍使用原来的局部修复策略。

路由库及本功能的算法、几何、交互、浏览器集成测试由独立 `m2p-libavoid` 仓库维护和运行。
Link 只通过 `packages/libavoid-js-0.5.0-beta.5-m2p.3.tgz` 使用库，保留业务调用代码。
Link 安装和构建不需要独立仓库、Playwright、Python 或 Emscripten。
包更新说明见 [packages/README.md](packages/README.md)。
